import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentInstrumentDto, UpdatePaymentInstrumentDto } from './dto/payment-instrument.dto';

@Injectable()
export class PaymentInstrumentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all payment instruments for a company (not soft-deleted)
   */
  async findAll(companyId: string) {
    return this.prisma.paymentInstrument.findMany({
      where: { companyId, deletedAt: null },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * List only active instruments (for dropdowns)
   */
  async findActive(companyId: string) {
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
   * Create a payment instrument
   */
  async create(companyId: string, dto: CreatePaymentInstrumentDto) {
    // Validate paymentMethod exists
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, companyId, deletedAt: null },
    });
    if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');

    // Validate cashAccount if provided
    if (dto.cashAccountId) {
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
        cashAccountId: dto.cashAccountId ?? null,
        details: dto.details ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true } },
      },
    });
  }

  /**
   * Update a payment instrument
   */
  async update(id: string, companyId: string, dto: UpdatePaymentInstrumentDto) {
    const pi = await this.prisma.paymentInstrument.findFirst({
      where: { id, deletedAt: null },
    });
    if (!pi) throw new NotFoundException('Instrumento de pagamento não encontrado.');
    if (pi.companyId !== companyId) throw new ForbiddenException();

    // Validate paymentMethod if changed
    if (dto.paymentMethodId && dto.paymentMethodId !== pi.paymentMethodId) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, companyId, deletedAt: null },
      });
      if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');
    }

    // Validate cashAccount if changed
    if (dto.cashAccountId !== undefined && dto.cashAccountId !== pi.cashAccountId) {
      if (dto.cashAccountId) {
        const ca = await this.prisma.cashAccount.findFirst({
          where: { id: dto.cashAccountId, companyId, deletedAt: null },
        });
        if (!ca) throw new NotFoundException('Conta caixa/banco não encontrada.');
      }
    }

    return this.prisma.paymentInstrument.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.paymentMethodId !== undefined && { paymentMethodId: dto.paymentMethodId }),
        ...(dto.cardLast4 !== undefined && { cardLast4: dto.cardLast4 || null }),
        ...(dto.cardBrand !== undefined && { cardBrand: dto.cardBrand || null }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName || null }),
        ...(dto.cashAccountId !== undefined && { cashAccountId: dto.cashAccountId || null }),
        ...(dto.details !== undefined && { details: dto.details || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        paymentMethod: { select: { id: true, name: true, code: true, requiresBrand: true } },
        cashAccount: { select: { id: true, name: true, bankName: true } },
      },
    });
  }

  /**
   * Soft-delete a payment instrument
   */
  async remove(id: string, companyId: string) {
    const pi = await this.prisma.paymentInstrument.findFirst({
      where: { id, deletedAt: null },
    });
    if (!pi) throw new NotFoundException('Instrumento de pagamento não encontrado.');
    if (pi.companyId !== companyId) throw new ForbiddenException();

    return this.prisma.paymentInstrument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
