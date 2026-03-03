import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto } from './dto/transfer.dto';

@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Execute transfer in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Decrement source
      await tx.cashAccount.update({
        where: { id: dto.fromAccountId },
        data: { currentBalanceCents: { decrement: dto.amountCents } },
      });

      // Increment destination
      await tx.cashAccount.update({
        where: { id: dto.toAccountId },
        data: { currentBalanceCents: { increment: dto.amountCents } },
      });

      // Create transfer record
      const transfer = await tx.accountTransfer.create({
        data: {
          companyId,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amountCents: dto.amountCents,
          description: dto.description ?? null,
          transferDate: dto.transferDate ? new Date(dto.transferDate) : new Date(),
          createdByName,
        },
        include: {
          fromAccount: { select: { id: true, name: true, type: true } },
          toAccount: { select: { id: true, name: true, type: true } },
        },
      });

      return transfer;
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
