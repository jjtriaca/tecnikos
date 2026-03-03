import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';

const DEFAULT_PAYMENT_METHODS = [
  { name: 'PIX', code: 'PIX', sortOrder: 1 },
  { name: 'Cartão Crédito', code: 'CARTAO_CREDITO', requiresBrand: true, sortOrder: 2 },
  { name: 'Cartão Débito', code: 'CARTAO_DEBITO', requiresBrand: true, sortOrder: 3 },
  { name: 'Dinheiro', code: 'DINHEIRO', sortOrder: 4 },
  { name: 'Transferência Eletrônica', code: 'TRANSFERENCIA', sortOrder: 5 },
  { name: 'Boleto', code: 'BOLETO', sortOrder: 6 },
  { name: 'Cheque', code: 'CHEQUE', requiresCheckData: true, sortOrder: 7 },
  { name: 'Outros', code: 'OUTROS', sortOrder: 8 },
];

@Injectable()
export class PaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all payment methods for a company (not soft-deleted)
   */
  async findAll(companyId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * List only active payment methods (for dropdowns)
   */
  async findActive(companyId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create a payment method
   */
  async create(companyId: string, dto: CreatePaymentMethodDto) {
    // Check unique code
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Forma de pagamento com código "${dto.code}" já existe.`);
    }

    return this.prisma.paymentMethod.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        isActive: dto.isActive ?? true,
        feePercent: dto.feePercent ?? null,
        receivingDays: dto.receivingDays ?? null,
        requiresBrand: dto.requiresBrand ?? false,
        requiresCheckData: dto.requiresCheckData ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * Update a payment method
   */
  async update(id: string, companyId: string, dto: UpdatePaymentMethodDto) {
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id, deletedAt: null },
    });
    if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');
    if (pm.companyId !== companyId) throw new ForbiddenException();

    // If code changed, check uniqueness
    if (dto.code && dto.code !== pm.code) {
      const existing = await this.prisma.paymentMethod.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Forma de pagamento com código "${dto.code}" já existe.`);
      }
    }

    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.feePercent !== undefined && { feePercent: dto.feePercent }),
        ...(dto.receivingDays !== undefined && { receivingDays: dto.receivingDays }),
        ...(dto.requiresBrand !== undefined && { requiresBrand: dto.requiresBrand }),
        ...(dto.requiresCheckData !== undefined && { requiresCheckData: dto.requiresCheckData }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  /**
   * Soft-delete a payment method
   */
  async remove(id: string, companyId: string) {
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id, deletedAt: null },
    });
    if (!pm) throw new NotFoundException('Forma de pagamento não encontrada.');
    if (pm.companyId !== companyId) throw new ForbiddenException();

    return this.prisma.paymentMethod.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Seed default payment methods for a company (skip existing codes)
   */
  async seedDefaults(companyId: string) {
    const existing = await this.prisma.paymentMethod.findMany({
      where: { companyId, deletedAt: null },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((e) => e.code));

    const toCreate = DEFAULT_PAYMENT_METHODS.filter(
      (m) => !existingCodes.has(m.code),
    );

    if (toCreate.length === 0) {
      return { created: 0, message: 'Todas as formas de pagamento padrão já existem.' };
    }

    await this.prisma.paymentMethod.createMany({
      data: toCreate.map((m) => ({
        companyId,
        name: m.name,
        code: m.code,
        isActive: true,
        requiresBrand: m.requiresBrand ?? false,
        requiresCheckData: m.requiresCheckData ?? false,
        sortOrder: m.sortOrder,
      })),
    });

    return { created: toCreate.length, message: `${toCreate.length} formas de pagamento criadas.` };
  }
}
