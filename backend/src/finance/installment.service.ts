import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';
import { SplitCardEntryDto } from './dto/split-card-entry.dto';

/**
 * InstallmentService — arquitetura pos-refactor (v1.09.99):
 * Parcelas sao FinancialEntry filhas com parentEntryId apontando pro pai.
 * O FinancialInstallment continua no schema (apenas pra compat com dados antigos)
 * mas parcelamentos novos NAO criam mais FinancialInstallment.
 *
 * Adapter pattern: endpoints que retornam "installment" formatam entries filhas
 * no shape legado { id, installmentNumber, dueDate, amountCents, totalCents, status, ... }
 * pra nao quebrar o frontend atual.
 */
@Injectable()
export class InstallmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  /**
   * Gera N parcelas como entries filhas com parentEntryId = pai.
   * Pai vira CANCELLED (some do "a receber") mas preserva NFS-e/histórico.
   * Filhas herdam nfseStatus, nfseEmissionId, paymentMethod, paymentInstrumentId,
   * financialAccountId, partner, type, serviceOrderId, config de juros/multa.
   */
  async generateInstallments(entryId: string, companyId: string, dto: GenerateInstallmentsDto) {
    const pai = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Lancamento nao encontrado');
    if (pai.status === 'PAID' || pai.status === 'CANCELLED') {
      throw new BadRequestException('Lancamento com status terminal nao pode ser parcelado');
    }
    const existentes = await this.prisma.financialEntry.count({
      where: { parentEntryId: entryId, deletedAt: null },
    });
    if (existentes > 0) {
      throw new BadRequestException('Lancamento ja possui parcelas');
    }

    const count = dto.count;
    const intervalDays = dto.intervalDays ?? 30;
    const baseAmount = Math.floor(pai.netCents / count);
    const remainder = pai.netCents - (baseAmount * count);

    const firstDue = new Date(dto.firstDueDate.includes('T') ? dto.firstDueDate : `${dto.firstDueDate}T12:00:00`);

    // Pre-gera N codigos (sequencial)
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY'));
    }

    await this.prisma.$transaction(async (tx) => {
      const filhasInfo: Array<{ code: string; amountCents: number; dueDate: Date }> = [];
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(firstDue);
        dueDate.setDate(dueDate.getDate() + (i * intervalDays));
        const amountCents = i === count - 1 ? baseAmount + remainder : baseAmount;
        filhasInfo.push({ code: codes[i], amountCents, dueDate });
        await tx.financialEntry.create({
          data: {
            companyId,
            code: codes[i],
            type: pai.type,
            status: 'PENDING',
            description: `${pai.description} — Parcela ${i + 1}/${count}`,
            grossCents: amountCents,
            netCents: amountCents,
            dueDate,
            parentEntryId: entryId,
            partnerId: pai.partnerId,
            serviceOrderId: pai.serviceOrderId,
            paymentMethod: pai.paymentMethod,
            paymentMethodId: pai.paymentMethodId,
            paymentInstrumentId: pai.paymentInstrumentId,
            financialAccountId: pai.financialAccountId,
            cashAccountId: pai.cashAccountId,
            // Parcela de CARTAO cai na fatura do ciclo seguinte (mae + i meses). A conciliacao
            // de fatura filtra candidatas por cardBillingDate, entao cada parcela aparece na
            // fatura certa. So aplica quando a mae e cartao (tem cardBillingDate); senao undefined.
            cardBillingDate: pai.cardBillingDate
              ? new Date(pai.cardBillingDate.getFullYear(), pai.cardBillingDate.getMonth() + i, pai.cardBillingDate.getDate(), 12, 0, 0)
              : undefined,
            nfseStatus: pai.nfseStatus,
            nfseEmissionId: pai.nfseEmissionId,
            interestType: dto.interestType || pai.interestType || 'SIMPLE',
            interestRateMonthly: dto.interestRateMonthly ?? pai.interestRateMonthly ?? null,
            penaltyPercent: dto.penaltyPercent ?? pai.penaltyPercent ?? null,
            penaltyFixedCents: dto.penaltyFixedCents ?? pai.penaltyFixedCents ?? null,
            installmentCount: count,
          },
        });
      }

      // Notes do pai: lista detalhada das parcelas filhas.
      // Primeira linha em [bracket] pra a coluna "notes" da tabela renderizar como hint.
      const fmtBrl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
      const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const parcelasLinhas = filhasInfo
        .map((f) => `- ${f.code} (${fmtBrl(f.amountCents)} venc ${fmtDate(f.dueDate)})`)
        .join('\n');
      const totalFmt = fmtBrl(filhasInfo.reduce((s, f) => s + f.amountCents, 0));
      const notesFormatado = `[Parcelado em ${count}x] Total: ${totalFmt}\n${parcelasLinhas}`;

      // Pai: SPLIT, preserva valores/NFS-e, registra info de parcelamento
      await tx.financialEntry.update({
        where: { id: entryId },
        data: {
          status: 'SPLIT',
          installmentCount: count,
          interestType: dto.interestType || pai.interestType,
          interestRateMonthly: dto.interestRateMonthly ?? pai.interestRateMonthly,
          penaltyPercent: dto.penaltyPercent ?? pai.penaltyPercent,
          penaltyFixedCents: dto.penaltyFixedCents ?? pai.penaltyFixedCents,
          notes: notesFormatado,
        },
      });
    });

    return this.getInstallments(entryId, companyId);
  }

  /**
   * Divide um lancamento de CARTAO JA PAGO em N parcelas, uma por ciclo de fatura.
   *
   * Diferente de generateInstallments (so PENDENTE -> filhas PENDENTES): aceita PAGO e cria
   * filhas PAGAS com cardBillingDate por ciclo (ciclo do pai + i meses), preservando o vinculo
   * do cartao — pra cada parcela cair na fatura certa na conciliacao de fatura.
   *
   * SALDO (exato, net ZERO): reverte o delta que o pai aplicou ao ser pago (PAYABLE: +netCents,
   * espelha o estorno provado em finance.service ~L1141) e aplica o delta de cada filha
   * (PAYABLE: -valor, convencao auto-pay payment-instrument.service L146). Como a soma das
   * filhas == total do pai, na MESMA conta e MESMA data paidAt, o impacto liquido e exatamente
   * zero — a conferencia de saldo de qualquer mes (inclusive fechado) continua identica.
   *
   * dryRun=true: retorna o plano (parcelas + ciclos + saldoNetCents) SEM gravar nada.
   */
  async splitPaidCardEntry(
    entryId: string,
    companyId: string,
    dto: SplitCardEntryDto,
  ) {
    const count = Math.floor(Number(dto.count));
    if (!count || count < 2) throw new BadRequestException('Informe ao menos 2 parcelas');
    if (count > 36) throw new BadRequestException('Maximo de 36 parcelas');

    const pai = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Lancamento nao encontrado');
    if (pai.status !== 'PAID') {
      throw new BadRequestException(
        'Este metodo divide lancamentos de cartao JA PAGOS. Para lancamentos pendentes, use "Parcelar".',
      );
    }
    if (!pai.cardBillingDate) {
      throw new BadRequestException(
        'Lancamento nao tem ciclo de fatura (cardBillingDate) — nao parece ser de cartao.',
      );
    }
    if (!pai.cashAccountId) {
      throw new BadRequestException('Lancamento sem conta de saldo vinculada.');
    }
    if (pai.invoiceMatchLineId) {
      throw new BadRequestException(
        'Lancamento ja esta conciliado em uma fatura. Desconcilie antes de dividir.',
      );
    }
    const existentes = await this.prisma.financialEntry.count({
      where: { parentEntryId: entryId, deletedAt: null },
    });
    if (existentes > 0) throw new BadRequestException('Lancamento ja foi dividido/parcelado.');
    const settlements = await this.prisma.cardSettlement.count({
      where: { financialEntryId: entryId },
    });
    if (settlements > 0) {
      throw new BadRequestException(
        'Lancamento tem repasse de cartao (settlement) — divida manualmente para nao afetar o repasse.',
      );
    }

    // Plano: divide igual, sobra de centavos na ultima parcela. Ciclo = ciclo do pai + i meses.
    const base = Math.floor(pai.netCents / count);
    const remainder = pai.netCents - base * count;
    const cbdPai = pai.cardBillingDate;
    const plano = Array.from({ length: count }, (_, i) => ({
      parcela: i + 1,
      valorCents: i === count - 1 ? base + remainder : base,
      cardBillingDate: new Date(
        cbdPai.getFullYear(),
        cbdPai.getMonth() + i,
        cbdPai.getDate(),
        12, 0, 0,
      ),
    }));
    // Sanity: financeiro e exato — a soma das parcelas tem que ser IDENTICA ao total.
    const somaCents = plano.reduce((s, p) => s + p.valorCents, 0);
    if (somaCents !== pai.netCents) {
      throw new BadRequestException('Erro interno: soma das parcelas difere do total.');
    }

    // Delta de saldo: reverte o pai + aplica cada filha => ZERO liquido (mesma conta/data).
    const reverseCents = pai.type === 'RECEIVABLE' ? -pai.netCents : pai.netCents;
    const childCents = (v: number) => (pai.type === 'RECEIVABLE' ? v : -v);
    const saldoNetCents = reverseCents + plano.reduce((s, p) => s + childCents(p.valorCents), 0);

    if (dto.dryRun) {
      return {
        dryRun: true as const,
        paiId: pai.id,
        paiCode: pai.code,
        paiNetCents: pai.netCents,
        cashAccountId: pai.cashAccountId,
        saldoNetCents, // DEVE ser 0
        parcelas: plano,
      };
    }
    // Trava dura: nunca grava se o impacto de saldo nao for exatamente zero.
    if (saldoNetCents !== 0) {
      throw new BadRequestException('Abortado: impacto de saldo nao e zero (seguranca financeira).');
    }

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY'));
    }

    const fmtBrl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
    const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    await this.prisma.$transaction(async (tx) => {
      // 1. Reverte o saldo que o pai aplicou quando foi pago (PAYABLE: +netCents).
      await tx.cashAccount.update({
        where: { id: pai.cashAccountId! },
        data: { currentBalanceCents: { increment: reverseCents } },
      });

      // 2. Cria as filhas PAGAS; cada uma aplica seu delta (PAYABLE: -valor).
      for (let i = 0; i < count; i++) {
        const p = plano[i];
        await tx.financialEntry.create({
          data: {
            companyId,
            code: codes[i],
            type: pai.type,
            status: 'PAID',
            description: `${pai.description} — Parcela ${i + 1}/${count}`,
            grossCents: p.valorCents,
            netCents: p.valorCents,
            dueDate: pai.dueDate,
            paidAt: pai.paidAt,
            cardBillingDate: p.cardBillingDate,
            parentEntryId: entryId,
            partnerId: pai.partnerId,
            serviceOrderId: pai.serviceOrderId,
            paymentMethod: pai.paymentMethod,
            paymentMethodId: pai.paymentMethodId,
            paymentInstrumentId: pai.paymentInstrumentId,
            financialAccountId: pai.financialAccountId,
            cashAccountId: pai.cashAccountId,
            nfseStatus: pai.nfseStatus,
            nfseEmissionId: pai.nfseEmissionId,
            installmentCount: count,
          },
        });
        await tx.cashAccount.update({
          where: { id: pai.cashAccountId! },
          data: { currentBalanceCents: { increment: childCents(p.valorCents) } },
        });
      }

      // 3. Pai -> SPLIT (sai do saldo/relatorios, preserva historico/NFS-e).
      const linhas = plano
        .map((p) => `- ${fmtBrl(p.valorCents)} (fatura ${fmtDate(p.cardBillingDate)})`)
        .join('\n');
      const notes = `[Dividido em ${count}x no cartao] Total: ${fmtBrl(pai.netCents)}\n${linhas}`;
      await tx.financialEntry.update({
        where: { id: entryId },
        data: { status: 'SPLIT', installmentCount: count, notes },
      });
    });

    return this.getInstallments(entryId, companyId);
  }

  /**
   * Lista parcelas do entry (entries filhas via parentEntryId) no shape legado.
   */
  async getInstallments(entryId: string, companyId: string) {
    const pai = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, companyId, deletedAt: null },
    });
    if (!pai) throw new NotFoundException('Lancamento nao encontrado');

    const filhas = await this.prisma.financialEntry.findMany({
      where: { parentEntryId: entryId, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return filhas.map((f, idx) => this.toInstallmentShape(f, idx + 1, entryId));
  }

  /**
   * "Paga" uma parcela — na verdade, marca a entry filha como PAID.
   * id = FinancialEntry.id (filha).
   */
  async payInstallment(installmentId: string, companyId: string, paidAmountCents?: number, notes?: string) {
    const filha = await this.prisma.financialEntry.findFirst({
      where: { id: installmentId, companyId, deletedAt: null },
    });
    if (!filha) throw new NotFoundException('Parcela nao encontrada');
    if (filha.status === 'PAID') throw new BadRequestException('Parcela ja foi paga');
    if (filha.status === 'CANCELLED') throw new BadRequestException('Parcela com status terminal');

    const updated = await this.prisma.financialEntry.update({
      where: { id: installmentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        grossCents: paidAmountCents ?? filha.grossCents,
        netCents: paidAmountCents ?? filha.netCents,
        notes: notes ?? filha.notes,
      },
    });

    return this.toInstallmentShape(updated, 1, filha.parentEntryId || installmentId);
  }

  /**
   * Cancela uma parcela (marca entry filha como CANCELLED).
   */
  async cancelInstallment(installmentId: string, companyId: string, notes?: string) {
    const filha = await this.prisma.financialEntry.findFirst({
      where: { id: installmentId, companyId, deletedAt: null },
    });
    if (!filha) throw new NotFoundException('Parcela nao encontrada');
    if (filha.status === 'PAID') throw new BadRequestException('Parcela ja paga nao pode ser cancelada');
    if (filha.status === 'CANCELLED') throw new BadRequestException('Parcela ja esta cancelada');

    const updated = await this.prisma.financialEntry.update({
      where: { id: installmentId },
      data: { status: 'CANCELLED', notes: notes ?? filha.notes },
    });
    return this.toInstallmentShape(updated, 1, filha.parentEntryId || installmentId);
  }

  /**
   * Atualiza dueDate/amountCents da parcela (entry filha).
   */
  async updateInstallment(installmentId: string, companyId: string, data: { dueDate?: string; amountCents?: number }) {
    const filha = await this.prisma.financialEntry.findFirst({
      where: { id: installmentId, companyId, deletedAt: null },
    });
    if (!filha) throw new NotFoundException('Parcela nao encontrada');
    if (filha.status === 'PAID') throw new BadRequestException('Parcela ja paga nao pode ser editada');
    if (filha.status === 'CANCELLED') throw new BadRequestException('Parcela cancelada nao pode ser editada');

    const updateData: Record<string, unknown> = {};
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate.includes('T') ? data.dueDate : `${data.dueDate}T12:00:00`);
    }
    if (data.amountCents !== undefined && data.amountCents > 0) {
      updateData.grossCents = data.amountCents;
      updateData.netCents = data.amountCents;
    }
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nenhum dado para atualizar');
    }

    const updated = await this.prisma.financialEntry.update({
      where: { id: installmentId },
      data: updateData,
    });
    return this.toInstallmentShape(updated, 1, filha.parentEntryId || installmentId);
  }

  /**
   * Cron diario: aplica juros/multa em parcelas (entries filhas) vencidas.
   * grossCents recebe principal + juros + multa calculados.
   * Principal original e preservado no campo netCents (snapshot do momento da criacao).
   */
  async applyInterestToOverdue(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentEntryId: { not: null },
        status: 'PENDING',
        dueDate: { lt: today },
      },
    });

    let processedCount = 0;
    if (overdue.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const f of overdue) {
          if (!f.dueDate) continue;
          const principal = f.netCents;
          let interestCents = 0;
          if (f.interestRateMonthly && f.interestRateMonthly > 0) {
            const daysOverdue = Math.floor((today.getTime() - f.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const dailyRate = f.interestRateMonthly / 30 / 100;
            interestCents = f.interestType === 'COMPOUND'
              ? Math.round(principal * (Math.pow(1 + dailyRate, daysOverdue) - 1))
              : Math.round(principal * dailyRate * daysOverdue);
          }
          let penaltyCents = 0;
          if (f.penaltyPercent && f.penaltyPercent > 0) {
            penaltyCents += Math.round(principal * f.penaltyPercent / 100);
          }
          if (f.penaltyFixedCents && f.penaltyFixedCents > 0) {
            penaltyCents += f.penaltyFixedCents;
          }
          await tx.financialEntry.update({
            where: { id: f.id },
            data: {
              grossCents: principal + interestCents + penaltyCents,
            },
          });
          processedCount++;
        }
      });
    }
    return { processed: processedCount };
  }

  /**
   * Aging report: overdue entries filhas + entries sem parentEntryId vencidas.
   */
  async getOverdueAgingReport(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Entries filhas (parcelas) vencidas
    const overdueFilhas = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentEntryId: { not: null },
        status: { in: ['PENDING', 'CONFIRMED'] },
        dueDate: { lt: today },
      },
      include: { partner: { select: { id: true, name: true } } },
    });
    // Entries sem parcelamento vencidas
    const overdueEntries = await this.prisma.financialEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentEntryId: null,
        dueDate: { lt: today },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { partner: { select: { id: true, name: true } } },
    });

    const buckets = {
      '0-30': { count: 0, totalCents: 0 },
      '31-60': { count: 0, totalCents: 0 },
      '61-90': { count: 0, totalCents: 0 },
      '90+': { count: 0, totalCents: 0 },
    };

    const categorize = (dueDate: Date, amount: number) => {
      const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 30) { buckets['0-30'].count++; buckets['0-30'].totalCents += amount; }
      else if (days <= 60) { buckets['31-60'].count++; buckets['31-60'].totalCents += amount; }
      else if (days <= 90) { buckets['61-90'].count++; buckets['61-90'].totalCents += amount; }
      else { buckets['90+'].count++; buckets['90+'].totalCents += amount; }
    };

    for (const f of overdueFilhas) {
      if (f.dueDate) categorize(f.dueDate, f.grossCents);
    }
    for (const e of overdueEntries) {
      if (e.dueDate) categorize(e.dueDate, e.netCents);
    }

    const totalOverdueCents = Object.values(buckets).reduce((s, b) => s + b.totalCents, 0);
    const totalOverdueCount = Object.values(buckets).reduce((s, b) => s + b.count, 0);

    return { buckets, totalOverdueCents, totalOverdueCount };
  }

  /**
   * Adapter: formata FinancialEntry filha no shape legado FinancialInstallment
   * pra compatibilidade com o frontend atual.
   */
  private toInstallmentShape(entry: any, installmentNumber: number, financialEntryId: string) {
    const principal = entry.netCents || entry.grossCents || 0;
    const total = entry.grossCents || 0;
    const diff = total - principal;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = entry.status === 'PENDING' && entry.dueDate && entry.dueDate < today;
    return {
      id: entry.id,
      financialEntryId,
      installmentNumber,
      dueDate: entry.dueDate,
      amountCents: principal,
      interestCents: diff > 0 ? diff : 0,
      penaltyCents: 0,
      discountCents: 0,
      totalCents: total,
      status: entry.status === 'PAID' ? 'PAID'
        : entry.status === 'CANCELLED' ? 'CANCELLED'
        : isOverdue ? 'OVERDUE' : 'PENDING',
      paidAt: entry.paidAt,
      paidAmountCents: entry.status === 'PAID' ? total : null,
      notes: entry.notes,
      // Campos extras pra debug/audit
      _entryId: entry.id,
      _entryCode: entry.code,
    };
  }
}
