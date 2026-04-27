import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { CreateCashAccountDto, UpdateCashAccountDto } from './dto/cash-account.dto';

@Injectable()
export class CashAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

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
    const code = await this.codeGenerator.generateCode(companyId, 'CASH_ACCOUNT');
    return this.prisma.cashAccount.create({
      data: {
        companyId,
        code,
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
        initialBalanceDate: dto.initialBalanceDate ? new Date(dto.initialBalanceDate) : null,
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
        ...(dto.showInReceivables !== undefined && { showInReceivables: dto.showInReceivables }),
        ...(dto.showInPayables !== undefined && { showInPayables: dto.showInPayables }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.initialBalanceDate !== undefined && {
          initialBalanceDate: dto.initialBalanceDate ? new Date(dto.initialBalanceDate) : null,
        }),
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

  /**
   * Rebalance — operacao auditavel para corrigir divergencias historicas (v1.10.15+).
   *
   * Cria entry tecnico (isRefundEntry=true) com descricao + motivo. Saldo atualiza
   * pela criacao do entry. Nao polui DRE/MRR (isRefundEntry filtra esses entries
   * em relatorios de cliente).
   *
   * Uso: ajuste de saldo historico nao rastreavel (cleanup scripts antigos, UPDATE
   * direto na CashAccount no passado etc.). Cada uso fica registrado com motivo
   * em `notes` (marker `[REBALANCE_AJUSTE]`) e snapshot antes/depois.
   */
  async rebalance(
    cashAccountId: string,
    companyId: string,
    dto: {
      direction: 'CREDIT' | 'DEBIT';
      amountCents: number;
      reason: string;
      financialAccountId?: string;
    },
    userName: string,
  ) {
    if (!dto.amountCents || dto.amountCents <= 0) {
      throw new BadRequestException('Valor do rebalanceamento deve ser positivo.');
    }
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException(
        'Motivo do rebalanceamento e obrigatorio (minimo 10 caracteres).',
      );
    }

    const account = await this.prisma.cashAccount.findFirst({
      where: { id: cashAccountId, companyId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Conta nao encontrada.');
    if (!account.isActive) {
      throw new BadRequestException('Conta inativa nao pode ser rebalanceada.');
    }

    if (dto.financialAccountId) {
      const fa = await this.prisma.financialAccount.findFirst({
        where: {
          id: dto.financialAccountId,
          companyId,
          isActive: true,
          allowPosting: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!fa) throw new BadRequestException('Plano de contas invalido ou inativo.');
    }

    const code = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');
    const tsLog = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const balanceBefore = account.currentBalanceCents;
    const delta = dto.direction === 'CREDIT' ? dto.amountCents : -dto.amountCents;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.financialEntry.create({
        data: {
          companyId,
          code,
          type: dto.direction === 'CREDIT' ? 'RECEIVABLE' : 'PAYABLE',
          status: 'PAID',
          description: `Ajuste de saldo ${dto.direction === 'CREDIT' ? '(credito)' : '(debito)'} — ${dto.reason.trim()}`,
          grossCents: dto.amountCents,
          netCents: dto.amountCents,
          paidAt: now,
          confirmedAt: now,
          dueDate: now,
          cashAccountId,
          financialAccountId: dto.financialAccountId || null,
          isRefundEntry: true,
          notes: `[REBALANCE_AJUSTE] ${tsLog} — ${userName}\nMotivo: ${dto.reason.trim()}\nSaldo antes: R$ ${(balanceBefore / 100).toFixed(2)}\nDelta: ${delta >= 0 ? '+' : ''}R$ ${(delta / 100).toFixed(2)}`,
        },
      });

      await tx.cashAccount.update({
        where: { id: cashAccountId },
        data: { currentBalanceCents: { increment: delta } },
      });

      const accountAfter = await tx.cashAccount.findUnique({
        where: { id: cashAccountId },
        select: { currentBalanceCents: true },
      });

      return {
        entry,
        balanceBefore,
        balanceAfter: accountAfter!.currentBalanceCents,
        deltaCents: delta,
      };
    });
  }
}
