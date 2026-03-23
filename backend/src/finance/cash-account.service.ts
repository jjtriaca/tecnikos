import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashAccountDto, UpdateCashAccountDto } from './dto/cash-account.dto';

@Injectable()
export class CashAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all cash accounts (not soft-deleted)
   */
  async findAll(companyId: string) {
    return this.prisma.cashAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * List only active accounts (for dropdowns)
   */
  async findActive(companyId: string) {
    return this.prisma.cashAccount.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get one by id
   */
  async findOne(id: string, companyId: string) {
    const account = await this.prisma.cashAccount.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    return account;
  }

  /**
   * Create a new cash account
   */
  async create(companyId: string, dto: CreateCashAccountDto) {
    const initialBalance = dto.initialBalanceCents ?? 0;
    return this.prisma.cashAccount.create({
      data: {
        companyId,
        name: dto.name,
        type: dto.type,
        bankCode: dto.bankCode ?? null,
        bankName: dto.bankName ?? null,
        agency: dto.agency ?? null,
        accountNumber: dto.accountNumber ?? null,
        accountType: dto.accountType ?? null,
        pixKeyType: dto.pixKeyType ?? null,
        pixKey: dto.pixKey ?? null,
        initialBalanceCents: initialBalance,
        currentBalanceCents: initialBalance,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Update a cash account
   */
  async update(id: string, companyId: string, dto: UpdateCashAccountDto) {
    const account = await this.prisma.cashAccount.findFirst({
      where: { id, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    if (account.companyId !== companyId) throw new ForbiddenException();

    // Allow setting initial balance only when current balance is still 0
    let initialBalanceUpdate = {};
    if (dto.initialBalanceCents !== undefined) {
      if (account.currentBalanceCents !== 0) {
        throw new BadRequestException('Saldo inicial só pode ser definido quando o saldo atual é zero (sem movimentações).');
      }
      initialBalanceUpdate = {
        initialBalanceCents: dto.initialBalanceCents,
        currentBalanceCents: dto.initialBalanceCents,
      };
    }

    return this.prisma.cashAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.bankCode !== undefined && { bankCode: dto.bankCode }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.agency !== undefined && { agency: dto.agency }),
        ...(dto.accountNumber !== undefined && { accountNumber: dto.accountNumber }),
        ...(dto.accountType !== undefined && { accountType: dto.accountType }),
        ...(dto.pixKeyType !== undefined && { pixKeyType: dto.pixKeyType }),
        ...(dto.pixKey !== undefined && { pixKey: dto.pixKey }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...initialBalanceUpdate,
      },
    });
  }

  /**
   * Soft-delete a cash account
   */
  async remove(id: string, companyId: string) {
    const account = await this.prisma.cashAccount.findFirst({
      where: { id, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    if (account.companyId !== companyId) throw new ForbiddenException();

    return this.prisma.cashAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Adjust balance (used internally by transfers and payments)
   */
  async adjustBalance(id: string, deltaCents: number) {
    return this.prisma.cashAccount.update({
      where: { id },
      data: {
        currentBalanceCents: { increment: deltaCents },
      },
    });
  }
}
