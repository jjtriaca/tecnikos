import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentInstrumentDto, UpdatePaymentInstrumentDto } from './dto/payment-instrument.dto';

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

      // Para cartao de credito (custom ou padrao): cria conta virtual automatica
      let cashAccountId: string | null = null;
      if (isCreditLocal) {
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
          showInReceivables: !isCreditLocal, // cartao de credito: so pagamento
          showInPayables: true,
          autoMarkPaid,
          feePercent: null,
          receivingDays: null,
        },
      });
    }
  }

  /**
   * Garante que todo PaymentInstrument de cartao de credito tenha uma CashAccount virtual
   * tipo CARTAO_CREDITO vinculada. Idempotente — rodado automaticamente a cada listagem
   * para migrar cadastros anteriores a Fase 2.
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
      if (pi.cashAccount && pi.cashAccount.type === 'CARTAO_CREDITO') continue;
      // Falta conta virtual ou aponta pra conta generica (ex: VALORES EM TRANSITO). Cria e religa.
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
   */
  private validateDirection(showInReceivables: boolean | undefined, showInPayables: boolean | undefined): void {
    const r = showInReceivables ?? true;
    const p = showInPayables ?? true;
    if (!r && !p) {
      throw new BadRequestException('Marque ao menos uma direcao: recebimento ou pagamento.');
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
        paymentMethod: { select: { id: true, name: true, code: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
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
        paymentMethod: { select: { id: true, name: true, code: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * List active instruments filtered by payment method
   */
  async findByMethod(companyId: string, paymentMethodId: string) {
    return this.prisma.paymentInstrument.findMany({
      where: { companyId, paymentMethodId, deletedAt: null, isActive: true },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true } },
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
    this.validateDirection(dto.showInReceivables, dto.showInPayables);

    // Validate paymentMethod exists
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, companyId, deletedAt: null },
    });
    if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');

    const isCredit = isCreditCardMethod(pm.code);
    let effectiveCashAccountId: string | null = dto.cashAccountId ?? null;

    if (isCredit) {
      // Cartao de credito: sempre cria conta virtual propria (forca comportamento)
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

    return this.prisma.paymentInstrument.create({
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
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true, type: true } },
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
      this.validateDirection(nextReceivables, nextPayables);
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

    if (wasCredit && !willBeCredit) {
      // Deixou de ser credito: desativa a conta virtual antiga; usuario passa a informar conta manual
      if (pi.cashAccountId) {
        await this.prisma.cashAccount.update({
          where: { id: pi.cashAccountId },
          data: { deletedAt: new Date(), isActive: false },
        });
      }
      effectiveCashAccountId = dto.cashAccountId ?? null;
    } else if (!wasCredit && willBeCredit) {
      // Virou credito: cria conta virtual nova
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
    } else if (willBeCredit && pi.cashAccountId) {
      // Continua credito: sincroniza nome e estado ativo da conta virtual
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
      // cashAccountId do instrumento permanece (credito nao aceita troca manual)
    } else if (!willBeCredit && dto.createExclusiveAccount && !pi.cashAccountId) {
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

    return this.prisma.paymentInstrument.update({
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
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true, type: true } },
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
