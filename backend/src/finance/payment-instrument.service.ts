import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentInstrumentDto, UpdatePaymentInstrumentDto } from './dto/payment-instrument.dto';

/**
 * Resultado da resolucao de auto-pay: dados prontos pra aplicar em FinancialEntry.create + ajuste de saldo.
 * Helper unico pra garantir que TODA criacao de entry respeite a config autoMarkPaid do instrumento.
 */
export interface AutoPayResolution {
  /** Status a aplicar no entry (PAID se autoMarkPaid=true, senao PENDING) */
  status: 'PAID' | 'PENDING';
  /** Data de pagamento (apenas se PAID) */
  paidAt?: Date;
  /** Conta final (respeita DTO, senao instrumento, senao TRANSITO) */
  cashAccountId?: string;
  /** Flag pra rastrear entries marcados PAID via auto-pay (usado em unmatch/revert) */
  autoMarkedPaid: boolean;
  /** ID do instrumento resolvido — passar no entry.paymentInstrumentId */
  resolvedInstrumentId?: string;
  /** Delta de saldo a aplicar apos create (null = nao mexer). cents tem o SINAL correto */
  balanceDelta: { accountId: string; cents: number } | null;
}

/**
 * Detecta se um PaymentMethod representa cartao de credito (vira conta virtual CARTAO_CREDITO).
 * Debito/PIX/dinheiro/etc. NAO geram conta virtual por padrao, mas podem via flag
 * `createExclusiveAccount` no DTO.
 */
function isCreditCardMethod(code: string | null | undefined): boolean {
  if (!code) return false;
  const c = code.toUpperCase();
  return c === 'CARTAO_CREDITO' || c === 'CREDITO' || c === 'CREDIT_CARD' || c === 'CREDIT';
}

function buildExclusiveAccountName(instrumentName: string, isCredit: boolean): string {
  const trimmed = instrumentName.trim();
  if (isCredit && /^cart[aã]o\b/i.test(trimmed)) return trimmed;
  if (isCredit) return `Cartao ${trimmed}`;
  return trimmed;
}

@Injectable()
export class PaymentInstrumentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * HELPER UNICO pra resolucao de auto-pay ao criar FinancialEntry.
   * Usado por TODOS os pontos do sistema que criam entries (createEntry, NFe process,
   * NFS-e process, OS approve/finalize, renegociacao, etc.).
   *
   * Garante que, se o instrumento ou paymentMethod escolhido tem autoMarkPaid=true,
   * o entry nasce PAID com cashAccountId e saldo da conta atualizado. Se nao, PENDING.
   *
   * Regras:
   *  1. Se `paymentInstrumentId` fornecido, usa ele. Senao, resolve via paymentMethod code
   *     (primeiro instrumento ativo do mesmo metodo, preferindo autoMarkPaid=true).
   *  2. cashAccountId final: DTO > instrumento > fallback TRANSITO (so se autoMarkPaid=true).
   *  3. balanceDelta: RECEIVABLE = +netCents, PAYABLE = -netCents (so quando autoMarkPaid).
   *  4. Aceita tx opcional pra ser chamado dentro de transacao existente.
   */
  async resolveAutoPay(params: {
    companyId: string;
    paymentInstrumentId?: string | null;
    paymentMethodCode?: string | null;
    dtoCashAccountId?: string | null;
    type: 'RECEIVABLE' | 'PAYABLE';
    netCents: number;
    tx?: Prisma.TransactionClient;
  }): Promise<AutoPayResolution> {
    const client = params.tx ?? this.prisma;
    let resolvedInstrumentId: string | undefined = params.paymentInstrumentId ?? undefined;
    let instrument: { id: string; autoMarkPaid: boolean; cashAccountId: string | null } | null = null;

    if (resolvedInstrumentId) {
      instrument = await client.paymentInstrument.findFirst({
        where: { id: resolvedInstrumentId, companyId: params.companyId, deletedAt: null, isActive: true },
        select: { id: true, autoMarkPaid: true, cashAccountId: true },
      });
      if (!instrument) resolvedInstrumentId = undefined;
    } else if (params.paymentMethodCode) {
      // Resolve via paymentMethod code — pega o instrumento padrao (autoMarkPaid=true primeiro)
      const pm = await client.paymentMethod.findFirst({
        where: { companyId: params.companyId, code: params.paymentMethodCode, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (pm) {
        instrument = await client.paymentInstrument.findFirst({
          where: { companyId: params.companyId, paymentMethodId: pm.id, deletedAt: null, isActive: true },
          orderBy: [{ autoMarkPaid: 'desc' }, { sortOrder: 'asc' }],
          select: { id: true, autoMarkPaid: true, cashAccountId: true },
        });
        if (instrument) resolvedInstrumentId = instrument.id;
      }
    }

    // Default: nao autoMarkPaid
    if (!instrument?.autoMarkPaid) {
      return {
        status: 'PENDING',
        paidAt: undefined,
        cashAccountId: params.dtoCashAccountId ?? undefined,
        autoMarkedPaid: false,
        resolvedInstrumentId,
        balanceDelta: null,
      };
    }

    // autoMarkPaid=true — determina conta final
    let finalCashAccountId: string | undefined = params.dtoCashAccountId ?? instrument.cashAccountId ?? undefined;
    if (!finalCashAccountId) {
      const transit = await client.cashAccount.findFirst({
        where: { companyId: params.companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
        select: { id: true },
      });
      finalCashAccountId = transit?.id;
    }

    const balanceDelta = finalCashAccountId
      ? { accountId: finalCashAccountId, cents: params.type === 'RECEIVABLE' ? params.netCents : -params.netCents }
      : null;

    return {
      status: 'PAID',
      paidAt: new Date(),
      cashAccountId: finalCashAccountId,
      autoMarkedPaid: true,
      resolvedInstrumentId,
      balanceDelta,
    };
  }

  /**
   * Aplica o delta de saldo resultado de resolveAutoPay. Chame apos o create do entry.
   */
  async applyBalanceDelta(
    delta: AutoPayResolution['balanceDelta'],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!delta) return;
    const client = tx ?? this.prisma;
    await client.cashAccount.update({
      where: { id: delta.accountId },
      data: { currentBalanceCents: { increment: delta.cents } },
    });
  }

  /**
   * Garante que todo PaymentMethod ativo da empresa tenha pelo menos 1 PaymentInstrument
   * correspondente. Idempotente — criado na migracao de v1.09.03 para nao perder "tipos"
   * customizados (ex: "Master", "Visa 5x") que o usuario tinha na tela antiga de
   * Formas de Pagamento (escondida na Fase 6).
   */
  private async ensureInstrumentsForAllMethods(companyId: string): Promise<void> {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, code: true, sortOrder: true },
    });
    if (methods.length === 0) return;

    // Busca todos os instrumentos existentes (ativos ou inativos) para evitar duplicatas
    const existingInstruments = await this.prisma.paymentInstrument.findMany({
      where: { companyId, deletedAt: null },
      select: { paymentMethodId: true },
    });
    const methodsWithInstruments = new Set(existingInstruments.map((i) => i.paymentMethodId));

    for (const pm of methods) {
      if (methodsWithInstruments.has(pm.id)) continue;
      // Defaults inteligentes pelo codigo
      const code = (pm.code || '').toUpperCase();
      const isCreditLocal = code === 'CARTAO_CREDITO' || code === 'CREDITO' || code === 'CREDIT_CARD' || code === 'CREDIT';
      const autoMarkPaid = code === 'DINHEIRO' || code === 'PIX' || code === 'CARTAO_DEBITO' || code === 'DEBITO';

      // Defaults por tipo — cartao de credito generico (sem bandeira) = exclusivo pagamento
      const defaultShowInReceivables = !isCreditLocal;
      const defaultShowInPayables = true;

      // Para cartao de credito EXCLUSIVO pra pagar: cria conta virtual automatica
      let cashAccountId: string | null = null;
      if (isCreditLocal && defaultShowInPayables && !defaultShowInReceivables) {
        const virtualAccount = await this.prisma.cashAccount.create({
          data: {
            companyId,
            name: buildExclusiveAccountName(pm.name, true),
            type: 'CARTAO_CREDITO',
            initialBalanceCents: 0,
            currentBalanceCents: 0,
            showInReceivables: false,
            showInPayables: true,
            isActive: true,
          },
        });
        cashAccountId = virtualAccount.id;
      }

      await this.prisma.paymentInstrument.create({
        data: {
          companyId,
          paymentMethodId: pm.id,
          name: pm.name,
          cardLast4: null,
          cardBrand: null,
          bankName: null,
          cashAccountId,
          details: null,
          isActive: true,
          sortOrder: pm.sortOrder ?? 0,
          showInReceivables: defaultShowInReceivables,
          showInPayables: defaultShowInPayables,
          autoMarkPaid,
          feePercent: null,
          receivingDays: null,
        },
      });
    }
  }

  /**
   * Garante que todo PaymentInstrument de cartao de credito USADO PRA PAGAMENTO tenha uma
   * CashAccount virtual tipo CARTAO_CREDITO vinculada. Idempotente.
   *
   * REGRA: so cria conta virtual quando e cartao EXCLUSIVO pra pagar (showInPayables=true
   * e showInReceivables=false). Cartoes de recebimento (maquininha) NAO tem conta virtual —
   * o dinheiro vai pra Valores em Transito e depois cai no banco via conciliacao.
   */
  private async ensureVirtualCardAccounts(companyId: string): Promise<void> {
    const instruments = await this.prisma.paymentInstrument.findMany({
      where: { companyId, deletedAt: null },
      include: {
        paymentMethod: { select: { code: true } },
        cashAccount: { select: { id: true, type: true } },
      },
    });

    for (const pi of instruments) {
      if (!isCreditCardMethod(pi.paymentMethod?.code)) continue;
      // So cartao de pagamento exclusivo gera conta virtual automatica
      if (!pi.showInPayables || pi.showInReceivables) continue;
      if (pi.cashAccount && pi.cashAccount.type === 'CARTAO_CREDITO') continue;
      const virtualAccount = await this.prisma.cashAccount.create({
        data: {
          companyId,
          name: buildExclusiveAccountName(pi.name, true),
          type: 'CARTAO_CREDITO',
          initialBalanceCents: 0,
          currentBalanceCents: 0,
          showInReceivables: false,
          showInPayables: true,
          isActive: pi.isActive,
        },
      });
      await this.prisma.paymentInstrument.update({
        where: { id: pi.id },
        data: { cashAccountId: virtualAccount.id },
      });
    }
  }

  /**
   * Normaliza e valida as flags de direcao. Pelo menos 1 dos dois precisa estar true.
   * Para cartoes (requiresBrand), apenas 1 direcao e permitida — cartoes sao exclusivos por natureza
   * (cartao da empresa so paga, maquininha so recebe).
   */
  private validateDirection(
    showInReceivables: boolean | undefined,
    showInPayables: boolean | undefined,
    requiresBrand = false,
  ): void {
    const r = showInReceivables ?? true;
    const p = showInPayables ?? true;
    if (!r && !p) {
      throw new BadRequestException('Marque ao menos uma direcao: recebimento ou pagamento.');
    }
    if (requiresBrand && r && p) {
      throw new BadRequestException(
        'Cartoes sao exclusivos — escolha apenas Recebimento (maquininha) OU Pagamento (cartao da empresa), nao ambos.',
      );
    }
  }

  /**
   * List all payment instruments for a company (not soft-deleted)
   */
  async findAll(companyId: string) {
    await this.ensureInstrumentsForAllMethods(companyId);
    await this.ensureVirtualCardAccounts(companyId);
    return this.prisma.paymentInstrument.findMany({
      where: { companyId, deletedAt: null },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true, type: true } },
        feeRates: { where: { deletedAt: null }, orderBy: [{ installmentFrom: 'asc' }] },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * List only active instruments (for dropdowns)
   */
  async findActive(companyId: string) {
    await this.ensureInstrumentsForAllMethods(companyId);
    await this.ensureVirtualCardAccounts(companyId);
    return this.prisma.paymentInstrument.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
        feeRates: { where: { deletedAt: null }, orderBy: [{ installmentFrom: 'asc' }] },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Lista instrumentos ativos filtrando por direcao (A Receber / A Pagar).
   * Usado pelos dropdowns dos modais de lancamento.
   */
  async findActiveByDirection(companyId: string, direction: 'RECEIVABLE' | 'PAYABLE') {
    await this.ensureInstrumentsForAllMethods(companyId);
    await this.ensureVirtualCardAccounts(companyId);
    const where: Record<string, unknown> = { companyId, deletedAt: null, isActive: true };
    if (direction === 'RECEIVABLE') where.showInReceivables = true;
    else where.showInPayables = true;
    return this.prisma.paymentInstrument.findMany({
      where,
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
        feeRates: { where: { deletedAt: null }, orderBy: [{ installmentFrom: 'asc' }] },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * List active instruments filtered by payment method
   */
  /**
   * Atualiza uma faixa individual de taxa (usado pelo modal de conciliacao pra ajustar
   * a taxa cadastrada quando a operadora cobra diferente do configurado).
   */
  async updateFeeRate(rateId: string, companyId: string, dto: { feePercent?: number; receivingDays?: number | null }) {
    const rate = await this.prisma.paymentInstrumentFeeRate.findFirst({
      where: { id: rateId, companyId, deletedAt: null },
    });
    if (!rate) throw new NotFoundException('Faixa de taxa não encontrada.');
    return this.prisma.paymentInstrumentFeeRate.update({
      where: { id: rateId },
      data: {
        ...(dto.feePercent !== undefined && { feePercent: dto.feePercent }),
        ...(dto.receivingDays !== undefined && { receivingDays: dto.receivingDays }),
      },
    });
  }

  /**
   * Migra CardFeeRate (cadastro antigo por bandeira+tipo) para PaymentInstrumentFeeRate
   * (taxas embutidas no meio). Idempotente — roda sem efeito colateral se ja migrado.
   *
   * Estrategia:
   *  1. Para cada (brand, type) com CardFeeRate ativo, acha ou cria 1 PaymentInstrument de recebimento
   *  2. Copia cada faixa de CardFeeRate pro PaymentInstrumentFeeRate do meio correspondente
   *  3. Nao duplica: se ja existe faixa com mesma (from, to) no meio, pula
   */
  async migrateCardFeeRates(companyId: string): Promise<{
    instrumentsCreated: number;
    instrumentsReused: number;
    ratesCreated: number;
    ratesSkipped: number;
  }> {
    const cardFeeRates = await this.prisma.cardFeeRate.findMany({
      where: { companyId, isActive: true },
    });
    if (cardFeeRates.length === 0) {
      return { instrumentsCreated: 0, instrumentsReused: 0, ratesCreated: 0, ratesSkipped: 0 };
    }

    // Busca PaymentMethods padrao
    const [pmCredito, pmDebito] = await Promise.all([
      this.prisma.paymentMethod.findFirst({ where: { companyId, code: 'CARTAO_CREDITO', deletedAt: null } }),
      this.prisma.paymentMethod.findFirst({ where: { companyId, code: 'CARTAO_DEBITO', deletedAt: null } }),
    ]);
    if (!pmCredito || !pmDebito) {
      throw new BadRequestException('PaymentMethods padrao (CARTAO_CREDITO/CARTAO_DEBITO) nao encontrados.');
    }

    // Agrupa por (brand, type) — um grupo = um meio
    const groups = new Map<string, { brand: string; type: string; rates: typeof cardFeeRates }>();
    for (const r of cardFeeRates) {
      const key = `${r.brand}__${r.type}`;
      const existing = groups.get(key);
      if (existing) existing.rates.push(r);
      else groups.set(key, { brand: r.brand, type: r.type, rates: [r] });
    }

    let instrumentsCreated = 0;
    let instrumentsReused = 0;
    let ratesCreated = 0;
    let ratesSkipped = 0;

    for (const group of groups.values()) {
      const paymentMethodId = group.type === 'CREDITO' ? pmCredito.id : pmDebito.id;
      const desiredName = `${group.brand} ${group.type === 'CREDITO' ? 'Credito' : 'Debito'}`;

      // Procura um instrumento de recebimento com mesma bandeira+tipo
      const existing = await this.prisma.paymentInstrument.findFirst({
        where: {
          companyId,
          deletedAt: null,
          paymentMethodId,
          cardBrand: { equals: group.brand, mode: 'insensitive' },
          showInReceivables: true,
        },
      });

      let instrumentId: string;
      if (existing) {
        instrumentId = existing.id;
        instrumentsReused++;
      } else {
        // Cria meio novo: recebimento, sem conta virtual (cartao de receber), sem auto-pay pra credito
        const created = await this.prisma.paymentInstrument.create({
          data: {
            companyId,
            paymentMethodId,
            name: desiredName,
            cardBrand: group.brand,
            cardLast4: null,
            showInReceivables: true,
            showInPayables: false,
            autoMarkPaid: group.type === 'DEBITO', // debito sai no ato
            isActive: true,
            sortOrder: 0,
          },
        });
        instrumentId = created.id;
        instrumentsCreated++;
      }

      // Para cada faixa do grupo, insere em PaymentInstrumentFeeRate se nao existir
      for (const rate of group.rates) {
        const existingRate = await this.prisma.paymentInstrumentFeeRate.findFirst({
          where: {
            companyId,
            paymentInstrumentId: instrumentId,
            installmentFrom: rate.installmentFrom,
            installmentTo: rate.installmentTo,
            deletedAt: null,
          },
        });
        if (existingRate) {
          ratesSkipped++;
          continue;
        }
        await this.prisma.paymentInstrumentFeeRate.create({
          data: {
            companyId,
            paymentInstrumentId: instrumentId,
            installmentFrom: rate.installmentFrom,
            installmentTo: rate.installmentTo,
            feePercent: rate.feePercent,
            receivingDays: rate.receivingDays,
            sortOrder: rate.installmentFrom,
          },
        });
        ratesCreated++;
      }
    }

    return { instrumentsCreated, instrumentsReused, ratesCreated, ratesSkipped };
  }

  /**
   * Faz lookup da faixa de taxa aplicavel para (instrumento + parcelas).
   * Retorna null se nao tiver faixa cadastrada cobrindo esse numero.
   */
  async lookupFeeRate(paymentInstrumentId: string, companyId: string, installments: number) {
    return this.prisma.paymentInstrumentFeeRate.findFirst({
      where: {
        paymentInstrumentId,
        companyId,
        deletedAt: null,
        installmentFrom: { lte: installments },
        installmentTo: { gte: installments },
      },
      orderBy: [{ installmentFrom: 'desc' }],
    });
  }

  /**
   * Substitui as faixas de taxa do instrumento (replace atomico).
   * Valida sobreposicoes e consistencia (from <= to).
   */
  private async replaceFeeRates(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    paymentInstrumentId: string,
    companyId: string,
    rates: { installmentFrom: number; installmentTo: number; feePercent: number; receivingDays?: number | null }[],
  ): Promise<void> {
    const sorted = [...rates].sort((a, b) => a.installmentFrom - b.installmentFrom);
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      if (r.installmentFrom > r.installmentTo) {
        throw new BadRequestException(
          `Faixa invalida: parcela "de" (${r.installmentFrom}) maior que "ate" (${r.installmentTo}).`,
        );
      }
      if (i > 0 && r.installmentFrom <= sorted[i - 1].installmentTo) {
        throw new BadRequestException(
          `Faixas se sobrepoem: ${sorted[i - 1].installmentFrom}-${sorted[i - 1].installmentTo} e ${r.installmentFrom}-${r.installmentTo}.`,
        );
      }
    }

    await tx.paymentInstrumentFeeRate.updateMany({
      where: { paymentInstrumentId, companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (rates.length > 0) {
      await tx.paymentInstrumentFeeRate.createMany({
        data: rates.map((r, idx) => ({
          companyId,
          paymentInstrumentId,
          installmentFrom: r.installmentFrom,
          installmentTo: r.installmentTo,
          feePercent: r.feePercent,
          receivingDays: r.receivingDays ?? null,
          sortOrder: idx,
        })),
      });
    }
  }

  async findByMethod(companyId: string, paymentMethodId: string) {
    return this.prisma.paymentInstrument.findMany({
      where: { companyId, paymentMethodId, deletedAt: null, isActive: true },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create a payment instrument.
   * Regras:
   * - Cartao de credito: SEMPRE cria CashAccount virtual tipo CARTAO_CREDITO (ignora cashAccountId e createExclusiveAccount=false)
   * - Demais tipos: respeita createExclusiveAccount (true = cria CashAccount dedicada) ou cashAccountId informado
   */
  async create(companyId: string, dto: CreatePaymentInstrumentDto) {
    // Validate paymentMethod exists
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, companyId, deletedAt: null },
    });
    if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');

    this.validateDirection(dto.showInReceivables, dto.showInPayables, pm.requiresBrand);

    const isCredit = isCreditCardMethod(pm.code);
    // So cartao de credito EXCLUSIVO pra pagar gera conta virtual automaticamente.
    // Cartoes de recebimento (maquininha) seguem accountOption do usuario (none/existing/exclusive).
    const nextShowInReceivables = dto.showInReceivables ?? true;
    const nextShowInPayables = dto.showInPayables ?? true;
    const isCreditForPaymentOnly = isCredit && nextShowInPayables && !nextShowInReceivables;
    let effectiveCashAccountId: string | null = dto.cashAccountId ?? null;

    if (isCreditForPaymentOnly) {
      // Cartao de credito exclusivo pra pagar: sempre cria conta virtual propria
      const virtualAccount = await this.prisma.cashAccount.create({
        data: {
          companyId,
          name: buildExclusiveAccountName(dto.name, true),
          type: 'CARTAO_CREDITO',
          initialBalanceCents: 0,
          currentBalanceCents: 0,
          showInReceivables: false,
          showInPayables: true,
          isActive: dto.isActive ?? true,
        },
      });
      effectiveCashAccountId = virtualAccount.id;
    } else if (dto.createExclusiveAccount) {
      // Outros tipos com flag marcada: cria CashAccount dedicada tipo BANCO (utilitario)
      const dedicatedAccount = await this.prisma.cashAccount.create({
        data: {
          companyId,
          name: buildExclusiveAccountName(dto.name, false),
          type: 'BANCO',
          bankName: dto.bankName ?? null,
          initialBalanceCents: 0,
          currentBalanceCents: 0,
          showInReceivables: dto.showInReceivables ?? true,
          showInPayables: dto.showInPayables ?? true,
          isActive: dto.isActive ?? true,
        },
      });
      effectiveCashAccountId = dedicatedAccount.id;
    } else if (dto.cashAccountId) {
      // Demais tipos: valida conta informada manualmente
      const ca = await this.prisma.cashAccount.findFirst({
        where: { id: dto.cashAccountId, companyId, deletedAt: null },
      });
      if (!ca) throw new NotFoundException('Conta caixa/banco não encontrada.');
    }

    const created = await this.prisma.paymentInstrument.create({
      data: {
        companyId,
        paymentMethodId: dto.paymentMethodId,
        name: dto.name,
        cardLast4: dto.cardLast4 ?? null,
        cardBrand: dto.cardBrand ?? null,
        bankName: dto.bankName ?? null,
        cashAccountId: effectiveCashAccountId,
        details: dto.details ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        billingClosingDay: dto.billingClosingDay ?? null,
        billingDueDay: dto.billingDueDay ?? null,
        showInReceivables: dto.showInReceivables ?? true,
        showInPayables: dto.showInPayables ?? true,
        autoMarkPaid: dto.autoMarkPaid ?? false,
        feePercent: dto.feePercent ?? null,
        receivingDays: dto.receivingDays ?? null,
      },
    });

    // Cria faixas de taxa se informadas (pode ser array vazio)
    if (dto.feeRates) {
      await this.prisma.$transaction(async (tx) => {
        await this.replaceFeeRates(tx, created.id, companyId, dto.feeRates || []);
      });
    }

    return this.prisma.paymentInstrument.findUnique({
      where: { id: created.id },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true, type: true } },
        feeRates: { where: { deletedAt: null }, orderBy: [{ installmentFrom: 'asc' }] },
      },
    });
  }

  /**
   * Update a payment instrument.
   * Para cartoes de credito, sincroniza mudancas de nome/ativo com a CashAccount virtual vinculada.
   */
  async update(id: string, companyId: string, dto: UpdatePaymentInstrumentDto) {
    const pi = await this.prisma.paymentInstrument.findFirst({
      where: { id, deletedAt: null },
      include: { paymentMethod: { select: { code: true } } },
    });
    if (!pi) throw new NotFoundException('Instrumento de pagamento não encontrado.');
    if (pi.companyId !== companyId) throw new ForbiddenException();

    // Validate direction se algum foi enviado
    if (dto.showInReceivables !== undefined || dto.showInPayables !== undefined) {
      const nextReceivables = dto.showInReceivables ?? pi.showInReceivables;
      const nextPayables = dto.showInPayables ?? pi.showInPayables;
      // Busca requiresBrand do metodo atual ou novo (se trocou)
      let requiresBrand = false;
      if (dto.paymentMethodId && dto.paymentMethodId !== pi.paymentMethodId) {
        const pm = await this.prisma.paymentMethod.findUnique({
          where: { id: dto.paymentMethodId },
          select: { requiresBrand: true },
        });
        requiresBrand = !!pm?.requiresBrand;
      } else {
        const pm = await this.prisma.paymentMethod.findUnique({
          where: { id: pi.paymentMethodId },
          select: { requiresBrand: true },
        });
        requiresBrand = !!pm?.requiresBrand;
      }
      this.validateDirection(nextReceivables, nextPayables, requiresBrand);
    }

    const currentMethodCode = pi.paymentMethod?.code;
    let targetMethodCode = currentMethodCode;

    // Validate paymentMethod if changed
    if (dto.paymentMethodId && dto.paymentMethodId !== pi.paymentMethodId) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, companyId, deletedAt: null },
      });
      if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');
      targetMethodCode = pm.code;
    }

    const wasCredit = isCreditCardMethod(currentMethodCode);
    const willBeCredit = isCreditCardMethod(targetMethodCode);

    // Validate cashAccount if changed manually (only for non-credit — credit usa virtual)
    if (!willBeCredit && dto.cashAccountId !== undefined && dto.cashAccountId !== pi.cashAccountId) {
      if (dto.cashAccountId) {
        const ca = await this.prisma.cashAccount.findFirst({
          where: { id: dto.cashAccountId, companyId, deletedAt: null },
        });
        if (!ca) throw new NotFoundException('Conta caixa/banco não encontrada.');
      }
    }

    let effectiveCashAccountId: string | null | undefined = undefined;

    // Flags finais de direcao (considerando dto + estado atual)
    const nextShowInReceivables = dto.showInReceivables ?? pi.showInReceivables;
    const nextShowInPayables = dto.showInPayables ?? pi.showInPayables;
    const wasCreditForPaymentOnly = wasCredit && pi.showInPayables && !pi.showInReceivables;
    const willBeCreditForPaymentOnly = willBeCredit && nextShowInPayables && !nextShowInReceivables;

    if (wasCreditForPaymentOnly && !willBeCreditForPaymentOnly) {
      // Deixou de ser credito-exclusivo-de-pagamento: desativa conta virtual existente
      // (pode ter virado credito-de-recebimento, ou mudou pra outro tipo)
      if (pi.cashAccountId) {
        const virtAcc = await this.prisma.cashAccount.findUnique({
          where: { id: pi.cashAccountId },
          select: { type: true },
        });
        if (virtAcc?.type === 'CARTAO_CREDITO') {
          await this.prisma.cashAccount.update({
            where: { id: pi.cashAccountId },
            data: { deletedAt: new Date(), isActive: false },
          });
        }
      }
      effectiveCashAccountId = dto.cashAccountId ?? null;
    } else if (!wasCreditForPaymentOnly && willBeCreditForPaymentOnly && !pi.cashAccountId) {
      // Virou credito-exclusivo-de-pagamento e ainda nao tem conta: cria virtual
      const newName = dto.name ?? pi.name;
      const virtualAccount = await this.prisma.cashAccount.create({
        data: {
          companyId,
          name: buildExclusiveAccountName(newName, true),
          type: 'CARTAO_CREDITO',
          initialBalanceCents: 0,
          currentBalanceCents: 0,
          showInReceivables: false,
          showInPayables: true,
          isActive: dto.isActive ?? pi.isActive,
        },
      });
      effectiveCashAccountId = virtualAccount.id;
    } else if (willBeCreditForPaymentOnly && pi.cashAccountId) {
      // Continua credito-exclusivo-de-pagamento: sincroniza nome e estado ativo da conta virtual
      const updates: Record<string, unknown> = {};
      if (dto.name !== undefined && dto.name !== pi.name) {
        updates.name = buildExclusiveAccountName(dto.name, true);
      }
      if (dto.isActive !== undefined && dto.isActive !== pi.isActive) {
        updates.isActive = dto.isActive;
      }
      if (Object.keys(updates).length > 0) {
        await this.prisma.cashAccount.update({
          where: { id: pi.cashAccountId },
          data: updates,
        });
      }
    } else if (!willBeCreditForPaymentOnly && dto.createExclusiveAccount && !pi.cashAccountId) {
      // Nao-credito sem conta ainda, mas pediu conta exclusiva agora: cria
      const dedicatedAccount = await this.prisma.cashAccount.create({
        data: {
          companyId,
          name: buildExclusiveAccountName(dto.name ?? pi.name, false),
          type: 'BANCO',
          bankName: dto.bankName ?? pi.bankName ?? null,
          initialBalanceCents: 0,
          currentBalanceCents: 0,
          showInReceivables: dto.showInReceivables ?? pi.showInReceivables,
          showInPayables: dto.showInPayables ?? pi.showInPayables,
          isActive: dto.isActive ?? pi.isActive,
        },
      });
      effectiveCashAccountId = dedicatedAccount.id;
    } else if (dto.cashAccountId !== undefined) {
      effectiveCashAccountId = dto.cashAccountId || null;
    }

    await this.prisma.paymentInstrument.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.paymentMethodId !== undefined && { paymentMethodId: dto.paymentMethodId }),
        ...(dto.cardLast4 !== undefined && { cardLast4: dto.cardLast4 || null }),
        ...(dto.cardBrand !== undefined && { cardBrand: dto.cardBrand || null }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName || null }),
        ...(effectiveCashAccountId !== undefined && { cashAccountId: effectiveCashAccountId }),
        ...(dto.details !== undefined && { details: dto.details || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.billingClosingDay !== undefined && { billingClosingDay: dto.billingClosingDay }),
        ...(dto.billingDueDay !== undefined && { billingDueDay: dto.billingDueDay }),
        ...(dto.showInReceivables !== undefined && { showInReceivables: dto.showInReceivables }),
        ...(dto.showInPayables !== undefined && { showInPayables: dto.showInPayables }),
        ...(dto.autoMarkPaid !== undefined && { autoMarkPaid: dto.autoMarkPaid }),
        ...(dto.feePercent !== undefined && { feePercent: dto.feePercent }),
        ...(dto.receivingDays !== undefined && { receivingDays: dto.receivingDays }),
      },
    });

    // Substitui as faixas de taxa se informadas
    if (dto.feeRates) {
      await this.prisma.$transaction(async (tx) => {
        await this.replaceFeeRates(tx, id, companyId, dto.feeRates || []);
      });
    }

    return this.prisma.paymentInstrument.findUnique({
      where: { id },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true, type: true } },
        feeRates: { where: { deletedAt: null }, orderBy: [{ installmentFrom: 'asc' }] },
      },
    });
  }

  /**
   * Soft-delete a payment instrument.
   * Se for cartao de credito, desativa tambem a CashAccount virtual vinculada.
   */
  async remove(id: string, companyId: string) {
    const pi = await this.prisma.paymentInstrument.findFirst({
      where: { id, deletedAt: null },
      include: { paymentMethod: { select: { code: true } } },
    });
    if (!pi) throw new NotFoundException('Instrumento de pagamento não encontrado.');
    if (pi.companyId !== companyId) throw new ForbiddenException();

    if (isCreditCardMethod(pi.paymentMethod?.code) && pi.cashAccountId) {
      await this.prisma.cashAccount.update({
        where: { id: pi.cashAccountId },
        data: { deletedAt: new Date(), isActive: false },
      });
    }

    return this.prisma.paymentInstrument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
