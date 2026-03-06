import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardFeeRateDto, UpdateCardFeeRateDto } from './dto/card-fee-rate.dto';

@Injectable()
export class CardFeeRateService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all fee rates for a company, ordered by brand + type + installments */
  async findAll(companyId: string) {
    return this.prisma.cardFeeRate.findMany({
      where: { companyId },
      orderBy: [{ brand: 'asc' }, { type: 'asc' }, { installmentFrom: 'asc' }],
    });
  }

  /** Create a new fee rate */
  async create(companyId: string, dto: CreateCardFeeRateDto) {
    if (dto.installmentTo < dto.installmentFrom) {
      throw new BadRequestException('installmentTo deve ser >= installmentFrom');
    }

    // Check for overlap
    const existing = await this.prisma.cardFeeRate.findFirst({
      where: {
        companyId,
        brand: dto.brand,
        type: dto.type,
        installmentFrom: dto.installmentFrom,
        installmentTo: dto.installmentTo,
      },
    });
    if (existing) {
      throw new BadRequestException('Já existe uma taxa para esta combinação de bandeira/tipo/parcelas');
    }

    return this.prisma.cardFeeRate.create({
      data: {
        companyId,
        brand: dto.brand,
        type: dto.type,
        installmentFrom: dto.installmentFrom,
        installmentTo: dto.installmentTo,
        feePercent: dto.feePercent,
        receivingDays: dto.receivingDays,
      },
    });
  }

  /** Update a fee rate */
  async update(id: string, companyId: string, dto: UpdateCardFeeRateDto) {
    const rate = await this.prisma.cardFeeRate.findFirst({ where: { id, companyId } });
    if (!rate) throw new BadRequestException('Taxa não encontrada');

    return this.prisma.cardFeeRate.update({
      where: { id },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  /** Delete a fee rate */
  async remove(id: string, companyId: string) {
    const rate = await this.prisma.cardFeeRate.findFirst({ where: { id, companyId } });
    if (!rate) throw new BadRequestException('Taxa não encontrada');

    return this.prisma.cardFeeRate.delete({ where: { id } });
  }

  /**
   * Lookup the best matching fee rate for a given brand/type/installments.
   * Returns null if no match found (caller should fall back to PaymentMethod.feePercent).
   */
  async lookup(
    companyId: string,
    brand: string,
    type: string,
    installments: number,
  ): Promise<{ feePercent: number; receivingDays: number } | null> {
    const rate = await this.prisma.cardFeeRate.findFirst({
      where: {
        companyId,
        brand,
        type,
        isActive: true,
        installmentFrom: { lte: installments },
        installmentTo: { gte: installments },
      },
      orderBy: { installmentFrom: 'asc' },
    });

    if (!rate) return null;
    return { feePercent: rate.feePercent, receivingDays: rate.receivingDays };
  }
}
