import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { breakInTenantTz } from '../common/util/tenant-date.util';

/**
 * Trava de "mes fechado" — bloqueia operacoes financeiras que afetariam o saldo
 * de um mes cuja conferencia ja esta batendo exata com o banco.
 *
 * v1.12.16: motivado pelo incidente do encargo de fatura orfao (R$ 32,12 em
 * marco e abril que quebrou retroativamente). A regra do CLAUDE.md "Financeiro
 * e EXATO" exige que meses ja conferidos NAO possam ser alterados acidentalmente.
 *
 * Mes "fechado" = BankStatement com:
 *   - statementBalanceCents preenchido (saldo declarado pelo usuario via OFX/edicao)
 *   - statementBalanceDate preenchido
 *   - diferenca entre banco e sistema na data D = 0 (toleancia 1 centavo)
 *
 * Pra "reabrir" um mes fechado, o usuario remove/edita o saldo declarado no
 * BankStatement (botao Editar em Conciliacao).
 *
 * Onde aplicar:
 *   - ReconciliationService.matchLine / matchAsCardInvoice / matchAsMultiple /
 *     matchAsTransfer / matchAsRefund — alvo: (line.cashAccountId, line.transactionDate)
 *   - ReconciliationService.unmatchLine — alvo: idem
 *   - FinanceService.create/update/delete entry quando muda paidAt PAID
 *   - TransferService quando muda transferDate / cria / deleta
 */
@Injectable()
export class ClosedMonthGuardService {
  private readonly logger = new Logger(ClosedMonthGuardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante que (cashAccountId, affectedDate) NAO cai em mes fechado.
   * Lanca BadRequestException com mensagem clara em PT-BR.
   *
   * Para no-op silencioso se cashAccountId ou affectedDate vazios — chamadores
   * podem passar valores possivelmente nulos sem precisar checar.
   */
  async assertNotClosed(
    companyId: string,
    cashAccountId: string | null | undefined,
    affectedDate: Date | null | undefined,
    operation: string,
  ): Promise<void> {
    if (!cashAccountId || !affectedDate) return;

    const { year, month } = breakInTenantTz(affectedDate);

    // v1.13.89: trava so vale pra mes FECHADO MANUALMENTE (closedAt preenchido). Antes inferia
    // "fechado" pela conferencia batendo (saldo declarado + diff<=1c) — isso pegava o mes corrente
    // que o usuario ainda concilia no dia a dia (OFX diario), bloqueando desfazer conciliacoes
    // recentes. Agora so o fechamento de proposito (botao na Conciliacao) trava.
    const statement = await this.prisma.bankStatement.findFirst({
      where: {
        companyId,
        cashAccountId,
        periodYear: year,
        periodMonth: month,
        closedAt: { not: null },
      },
      select: {
        periodYear: true,
        periodMonth: true,
        cashAccount: { select: { name: true } },
      },
    });
    if (!statement) return; // mes nao fechado manualmente = aberto

    const monthLabel = `${String(statement.periodMonth).padStart(2, '0')}/${statement.periodYear}`;
    const accountName = statement.cashAccount.name;
    throw new BadRequestException(
      `Mês ${monthLabel} da conta "${accountName}" está FECHADO. ` +
      `Operação "${operation}" foi BLOQUEADA pra preservar o saldo conferido. ` +
      `Para alterar, reabra o mês: Finanças > Conciliação > extrato de ${monthLabel} > botão "Reabrir mês".`,
    );
  }

  /**
   * Variante: bloqueia se QUALQUER (cashAccountId, date) cai em mes fechado.
   * Util pra transfers (2 contas) e match multi-mes.
   */
  async assertNoneClosed(
    companyId: string,
    targets: Array<{ cashAccountId: string | null | undefined; affectedDate: Date | null | undefined }>,
    operation: string,
  ): Promise<void> {
    for (const t of targets) {
      await this.assertNotClosed(companyId, t.cashAccountId, t.affectedDate, operation);
    }
  }
}
