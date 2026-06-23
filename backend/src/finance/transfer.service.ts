import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto, DepositChecksDto, EndorseChecksDto } from './dto/transfer.dto';
import { withCreate, withUpdate } from '../common/tracking/tracking.helpers';
import { ClosedMonthGuardService } from './closed-month-guard.service';

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closedMonthGuard: ClosedMonthGuardService,
  ) {}

  /**
   * Create a transfer between two accounts (in a transaction)
   */
  async create(companyId: string, dto: CreateTransferDto, createdByName: string) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('A conta de origem e destino não podem ser iguais.');
    }

    // Validate both accounts belong to company
    const [from, to] = await Promise.all([
      this.prisma.cashAccount.findFirst({
        where: { id: dto.fromAccountId, companyId, deletedAt: null },
      }),
      this.prisma.cashAccount.findFirst({
        where: { id: dto.toAccountId, companyId, deletedAt: null },
      }),
    ]);

    if (!from) throw new NotFoundException('Conta de origem não encontrada.');
    if (!to) throw new NotFoundException('Conta de destino não encontrada.');

    // v1.12.16: trava de mes fechado — transferDate afeta saldo de ambas as contas
    const transferDate = dto.transferDate ? new Date(dto.transferDate) : new Date();
    await this.closedMonthGuard.assertNoneClosed(
      companyId,
      [
        { cashAccountId: dto.fromAccountId, affectedDate: transferDate },
        { cashAccountId: dto.toAccountId, affectedDate: transferDate },
      ],
      'Criar transferência entre contas',
    );

    // Execute transfer in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Decrement source
      await tx.cashAccount.update({
        where: { id: dto.fromAccountId },
        data: withUpdate({ currentBalanceCents: { decrement: dto.amountCents } }),
      });

      // Increment destination
      await tx.cashAccount.update({
        where: { id: dto.toAccountId },
        data: withUpdate({ currentBalanceCents: { increment: dto.amountCents } }),
      });

      // Create transfer record
      const transfer = await tx.accountTransfer.create({
        // withCreate complementa createdByUserId/Via/etc. — createdByName legado mantido.
        data: withCreate({
          companyId,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amountCents: dto.amountCents,
          description: dto.description ?? null,
          transferDate,
          createdByName,
        }),
        include: {
          fromAccount: { select: { id: true, name: true, type: true } },
          toAccount: { select: { id: true, name: true, type: true } },
        },
      });

      return transfer;
    });
  }

  /**
   * Deposita cheque(s) de terceiro em carteira: move o saldo do Caixa pra conta de transito
   * "Cheques a Compensar" (1 AccountTransfer pela soma) e marca cada cheque como depositado
   * (checkOutKind='DEPOSIT'). O entry do cheque PERMANECE no Caixa (preserva o historico do
   * recebimento) — o saldo e movido so pela transferencia, sem mexer no cashAccountId (evita
   * dupla contagem no balance-compare). A compensacao real (transito -> banco) acontece depois,
   * na conciliacao do extrato. v1.13.86 (Fase 2a).
   */
  async depositChecks(companyId: string, dto: DepositChecksDto, createdByName: string) {
    if (!dto.checkEntryIds?.length) {
      throw new BadRequestException('Selecione ao menos um cheque para depositar.');
    }

    const checks = await this.prisma.financialEntry.findMany({
      where: { id: { in: dto.checkEntryIds }, companyId, deletedAt: null },
      select: {
        id: true,
        netCents: true,
        cashAccountId: true,
        paymentMethod: true,
        status: true,
        checkOutAt: true,
        type: true,
      },
    });
    if (checks.length !== dto.checkEntryIds.length) {
      throw new BadRequestException('Um ou mais cheques não foram encontrados.');
    }

    // Valida: todos RECEIVABLE + CHEQUE + PAID + em carteira (checkOutAt null) + mesma origem
    const fromAccountId = checks[0].cashAccountId;
    if (!fromAccountId) {
      throw new BadRequestException('Cheque sem conta de origem.');
    }
    for (const c of checks) {
      if (c.type !== 'RECEIVABLE' || c.paymentMethod !== 'CHEQUE' || c.status !== 'PAID') {
        throw new BadRequestException('Só é possível depositar cheques de terceiro recebidos (em carteira).');
      }
      if (c.checkOutAt) {
        throw new BadRequestException('Um dos cheques já saiu da carteira (depositado ou repassado).');
      }
      if (c.cashAccountId !== fromAccountId) {
        throw new BadRequestException('Selecione cheques de uma única conta de origem.');
      }
    }

    const clearing = await this.prisma.cashAccount.findFirst({
      where: {
        companyId,
        deletedAt: null,
        type: 'TRANSITO',
        name: { equals: 'Cheques a Compensar', mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (!clearing) {
      throw new BadRequestException(
        'Conta "Cheques a Compensar" não encontrada. Crie uma conta de trânsito com esse nome.',
      );
    }
    if (clearing.id === fromAccountId) {
      throw new BadRequestException('A conta de origem não pode ser a própria conta de cheques a compensar.');
    }

    let targetBankName: string | null = null;
    if (dto.targetBankAccountId) {
      const bank = await this.prisma.cashAccount.findFirst({
        where: { id: dto.targetBankAccountId, companyId, deletedAt: null },
        select: { name: true },
      });
      targetBankName = bank?.name ?? null;
    }

    const totalCents = checks.reduce((sum, c) => sum + c.netCents, 0);
    const transferDate = dto.transferDate ? new Date(dto.transferDate) : new Date();

    await this.closedMonthGuard.assertNoneClosed(
      companyId,
      [
        { cashAccountId: fromAccountId, affectedDate: transferDate },
        { cashAccountId: clearing.id, affectedDate: transferDate },
      ],
      'Depositar cheque(s)',
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.cashAccount.update({
        where: { id: fromAccountId },
        data: withUpdate({ currentBalanceCents: { decrement: totalCents } }),
      });
      await tx.cashAccount.update({
        where: { id: clearing.id },
        data: withUpdate({ currentBalanceCents: { increment: totalCents } }),
      });

      const desc =
        `Deposito de ${checks.length} cheque(s)` +
        (targetBankName ? ` -> ${targetBankName}` : '') +
        (dto.note ? ` - ${dto.note}` : '');
      const transfer = await tx.accountTransfer.create({
        data: withCreate({
          companyId,
          fromAccountId,
          toAccountId: clearing.id,
          amountCents: totalCents,
          description: desc,
          transferDate,
          createdByName,
        }),
      });

      // Marca os cheques como depositados — saem da carteira, mas o entry fica na conta de
      // origem (cashAccountId inalterado: preserva o historico do recebimento).
      await tx.financialEntry.updateMany({
        where: { id: { in: dto.checkEntryIds } },
        data: {
          checkOutAt: transferDate,
          checkOutKind: 'DEPOSIT',
          checkOutRef: transfer.id,
        },
      });

      return { transfer, depositedCount: checks.length, totalCents, clearingAccountId: clearing.id };
    });
  }

  /**
   * Repasse/endosso de cheque(s) de terceiro pra PAGAR uma conta (PAYABLE). v1.13.91.
   * A conta vira PAID debitando o Caixa onde os cheques estao (pelo valor DA CONTA); os cheques
   * saem da carteira (checkOutKind='ENDORSE'). A diferenca vira AccountTransfer pra/da changeAccount:
   *  - cheques > conta (SOBRA): troco Caixa -> changeAccount. - cheques < conta (FALTA): complemento
   *    changeAccount -> Caixa. Se changeAccount vazio/=Caixa, troco fica / complemento sai do Caixa.
   * Saldo fecha nos 3 casos: a variacao do Caixa = -somaCheques (cheques saem), changeAccount ajusta
   * o troco/complemento, e a despesa = valorConta. Entry do cheque FICA no Caixa (preserva historico).
   */
  async endorseChecks(companyId: string, dto: EndorseChecksDto, userName: string) {
    if (!dto.checkEntryIds?.length) {
      throw new BadRequestException('Selecione ao menos um cheque para repassar.');
    }

    const payable = await this.prisma.financialEntry.findFirst({
      where: { id: dto.payableEntryId, companyId, deletedAt: null },
      select: { id: true, type: true, status: true, netCents: true, notes: true },
    });
    if (!payable) throw new NotFoundException('Conta a pagar não encontrada.');
    if (payable.type !== 'PAYABLE') {
      throw new BadRequestException('O lançamento alvo não é uma conta a pagar.');
    }
    if (payable.status !== 'PENDING' && payable.status !== 'CONFIRMED') {
      throw new BadRequestException('Esta conta não está em aberto (já paga ou cancelada).');
    }

    const checks = await this.prisma.financialEntry.findMany({
      where: { id: { in: dto.checkEntryIds }, companyId, deletedAt: null },
      select: { id: true, netCents: true, cashAccountId: true, paymentMethod: true, status: true, checkOutAt: true, type: true },
    });
    if (checks.length !== dto.checkEntryIds.length) {
      throw new BadRequestException('Um ou mais cheques não foram encontrados.');
    }
    const caixaId = checks[0].cashAccountId;
    if (!caixaId) throw new BadRequestException('Cheque sem conta de origem.');
    for (const c of checks) {
      if (c.type !== 'RECEIVABLE' || c.paymentMethod !== 'CHEQUE' || c.status !== 'PAID') {
        throw new BadRequestException('Só é possível repassar cheques de terceiro recebidos (em carteira).');
      }
      if (c.checkOutAt) throw new BadRequestException('Um dos cheques já saiu da carteira (depositado ou repassado).');
      if (c.cashAccountId !== caixaId) throw new BadRequestException('Selecione cheques de uma única conta de origem.');
    }

    const somaCheques = checks.reduce((s, c) => s + c.netCents, 0);
    const valorConta = payable.netCents;
    const diff = somaCheques - valorConta; // >0 troco | <0 complemento | 0 igual
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    // Conta do troco/complemento — so se ha diferenca E e diferente do proprio Caixa
    let changeAccountId: string | null = null;
    if (diff !== 0 && dto.changeAccountId && dto.changeAccountId !== caixaId) {
      const ca = await this.prisma.cashAccount.findFirst({
        where: { id: dto.changeAccountId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!ca) throw new NotFoundException('Conta do troco/complemento não encontrada.');
      changeAccountId = ca.id;
    }

    await this.closedMonthGuard.assertNoneClosed(
      companyId,
      [
        { cashAccountId: caixaId, affectedDate: paidAt },
        ...(changeAccountId ? [{ cashAccountId: changeAccountId, affectedDate: paidAt }] : []),
      ],
      'Repassar cheque',
    );

    const tsLog = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    return this.prisma.$transaction(async (tx) => {
      // 1. Conta vira PAID, debita o Caixa pelo valor DA CONTA
      const payLog = `[${tsLog}] PAGO com cheque(s) de terceiro (repasse)`;
      await tx.financialEntry.update({
        where: { id: payable.id },
        data: {
          status: 'PAID',
          paidAt,
          paymentMethod: 'CHEQUE',
          cashAccountId: caixaId,
          notes: payable.notes ? `${payable.notes}\n${payLog}` : payLog,
        },
      });
      await tx.cashAccount.update({
        where: { id: caixaId },
        data: withUpdate({ currentBalanceCents: { decrement: valorConta } }),
      });

      // 2. Cheques saem da carteira (ENDORSE) — entry fica no Caixa (preserva historico do recebimento)
      await tx.financialEntry.updateMany({
        where: { id: { in: dto.checkEntryIds } },
        data: { checkOutAt: paidAt, checkOutKind: 'ENDORSE', checkOutRef: payable.id },
      });

      // 3. Troco (sobra) ou complemento (falta) via AccountTransfer rastreavel — so se conta != Caixa
      if (diff !== 0 && changeAccountId) {
        const absDiff = Math.abs(diff);
        const fromId = diff > 0 ? caixaId : changeAccountId; // troco sai do Caixa; complemento vem da changeAccount
        const toId = diff > 0 ? changeAccountId : caixaId;
        const desc = diff > 0
          ? `Troco de repasse de cheque (conta ${payable.id.substring(0, 8)})`
          : `Complemento de repasse de cheque (conta ${payable.id.substring(0, 8)})`;
        await tx.accountTransfer.create({
          data: withCreate({ companyId, fromAccountId: fromId, toAccountId: toId, amountCents: absDiff, description: desc, transferDate: paidAt, createdByName: userName }),
        });
        await tx.cashAccount.update({ where: { id: fromId }, data: withUpdate({ currentBalanceCents: { decrement: absDiff } }) });
        await tx.cashAccount.update({ where: { id: toId }, data: withUpdate({ currentBalanceCents: { increment: absDiff } }) });
      }

      return { payableId: payable.id, endorsedCount: checks.length, somaCheques, valorConta, diff, changeAccountId };
    });
  }

  /**
   * List all transfers for a company
   */
  async findAll(companyId: string, options?: { dateFrom?: string; dateTo?: string }) {
    const where: Record<string, unknown> = { companyId };

    if (options?.dateFrom || options?.dateTo) {
      where.transferDate = {};
      if (options.dateFrom) (where.transferDate as Record<string, unknown>).gte = new Date(options.dateFrom);
      if (options.dateTo) (where.transferDate as Record<string, unknown>).lte = new Date(options.dateTo + 'T23:59:59.999Z');
    }

    return this.prisma.accountTransfer.findMany({
      where,
      include: {
        fromAccount: { select: { id: true, name: true, type: true } },
        toAccount: { select: { id: true, name: true, type: true } },
      },
      orderBy: { transferDate: 'desc' },
      take: 100,
    });
  }
}
