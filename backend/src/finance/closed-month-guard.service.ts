import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { breakInTenantTz, endOfTenantDay } from '../common/util/tenant-date.util';

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

    const statement = await this.prisma.bankStatement.findFirst({
      where: {
        companyId,
        cashAccountId,
        periodYear: year,
        periodMonth: month,
        statementBalanceCents: { not: null },
        statementBalanceDate: { not: null },
      },
      select: {
        id: true,
        periodYear: true,
        periodMonth: true,
        statementBalanceCents: true,
        statementBalanceDate: true,
        cashAccountId: true,
        cashAccount: { select: { name: true, currentBalanceCents: true } },
      },
    });
    if (!statement) return; // mes sem saldo declarado = aberto

    const D = endOfTenantDay(statement.statementBalanceDate!);
    const currentBalance = statement.cashAccount.currentBalanceCents;

    const [rec, pay, transferIn, transferOut] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: {
          cashAccountId: statement.cashAccountId,
          status: 'PAID',
          paidAt: { gt: D },
          type: 'RECEIVABLE',
          deletedAt: null,
        },
        _sum: { netCents: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          cashAccountId: statement.cashAccountId,
          status: 'PAID',
          paidAt: { gt: D },
          type: 'PAYABLE',
          deletedAt: null,
        },
        _sum: { netCents: true },
      }),
      this.prisma.accountTransfer.aggregate({
        where: { toAccountId: statement.cashAccountId, transferDate: { gt: D } },
        _sum: { amountCents: true },
      }),
      this.prisma.accountTransfer.aggregate({
        where: { fromAccountId: statement.cashAccountId, transferDate: { gt: D } },
        _sum: { amountCents: true },
      }),
    ]);

    const movsAfterD =
      (rec._sum.netCents || 0)
      - (pay._sum.netCents || 0)
      + (transferIn._sum.amountCents || 0)
      - (transferOut._sum.amountCents || 0);

    const systemBalanceAtD = currentBalance - movsAfterD;
    const diff = Math.abs(statement.statementBalanceCents! - systemBalanceAtD);

    if (diff > 1) return; // tolerancia 1 centavo — mes nao bate = aberto

    const monthLabel = `${String(statement.periodMonth).padStart(2, '0')}/${statement.periodYear}`;
    const accountName = statement.cashAccount.name;
    throw new BadRequestException(
      `Mês ${monthLabel} da conta "${accountName}" está fechado (conferência de saldo bate exata com o banco). ` +
      `Operação "${operation}" foi BLOQUEADA pra preservar a integridade do saldo conferido. ` +
      `Para alterar, reabra a conferência: vá em Finanças > Conciliação > extrato de ${monthLabel} ` +
      `e edite/remova o saldo do banco. Depois aplique a alteração e refaça a conferência.`,
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
