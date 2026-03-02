import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import {
  CreateCollectionRuleDto,
  UpdateCollectionRuleDto,
} from './dto/collection-rule.dto';

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── CRUD — CollectionRule ───────────────────────────

  /**
   * List active collection rules for a company, ordered by sortOrder
   */
  async findRules(companyId: string) {
    return this.prisma.collectionRule.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create a new collection rule
   */
  async createRule(companyId: string, dto: CreateCollectionRuleDto) {
    return this.prisma.collectionRule.create({
      data: {
        companyId,
        name: dto.name,
        daysAfterDue: dto.daysAfterDue,
        actionType: dto.actionType,
        messageTemplate: dto.messageTemplate ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * Update an existing collection rule
   */
  async updateRule(
    id: string,
    companyId: string,
    dto: UpdateCollectionRuleDto,
  ) {
    const rule = await this.prisma.collectionRule.findFirst({
      where: { id, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Regra de cobranca nao encontrada');
    if (rule.companyId !== companyId) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.prisma.collectionRule.update({
      where: { id },
      data: {
        name: dto.name ?? rule.name,
        daysAfterDue: dto.daysAfterDue ?? rule.daysAfterDue,
        actionType: dto.actionType ?? rule.actionType,
        messageTemplate:
          dto.messageTemplate !== undefined
            ? dto.messageTemplate
            : rule.messageTemplate,
        isActive: dto.isActive !== undefined ? dto.isActive : rule.isActive,
        sortOrder: dto.sortOrder ?? rule.sortOrder,
      },
    });
  }

  /**
   * Soft-delete a collection rule
   */
  async deleteRule(id: string, companyId: string) {
    const rule = await this.prisma.collectionRule.findFirst({
      where: { id, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Regra de cobranca nao encontrada');
    if (rule.companyId !== companyId) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.prisma.collectionRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─────────────────────────── Collection Execution ───────────────────────────

  /**
   * Daily cron job — runs at 6 AM every day.
   * Processes the collection pipeline for all companies.
   */
  @Cron('0 6 * * *')
  async processDaily() {
    this.logger.log('Iniciando processamento diario da regua de cobranca');

    try {
      // Get all distinct companyIds that have active collection rules
      const activeRules = await this.prisma.collectionRule.findMany({
        where: { isActive: true, deletedAt: null },
        select: { companyId: true },
        distinct: ['companyId'],
      });

      const companyIds = activeRules.map((r) => r.companyId);
      this.logger.log(
        `Encontradas ${companyIds.length} empresa(s) com regras ativas`,
      );

      let totalProcessed = 0;

      for (const companyId of companyIds) {
        const result = await this.processCompany(companyId);
        totalProcessed += result.executed;
      }

      this.logger.log(
        `Processamento diario concluido. Total de acoes executadas: ${totalProcessed}`,
      );
    } catch (error) {
      this.logger.error(
        'Erro no processamento diario da regua de cobranca',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Process collection rules for a single company.
   * Returns the count of executed actions.
   */
  private async processCompany(
    companyId: string,
  ): Promise<{ executed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get active rules for this company ordered by daysAfterDue
    const rules = await this.prisma.collectionRule.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: { daysAfterDue: 'asc' },
    });

    if (rules.length === 0) {
      return { executed: 0 };
    }

    // Get overdue installments (PENDING or OVERDUE with dueDate < today)
    const overdueInstallments = await this.prisma.financialInstallment.findMany(
      {
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: today },
          financialEntry: { companyId, deletedAt: null },
        },
        include: {
          financialEntry: {
            select: {
              id: true,
              companyId: true,
              partnerId: true,
              partner: { select: { id: true, name: true } },
            },
          },
        },
      },
    );

    let executed = 0;

    for (const installment of overdueInstallments) {
      const daysOverdue = Math.floor(
        (today.getTime() - installment.dueDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      for (const rule of rules) {
        // Rule fires when daysOverdue matches daysAfterDue exactly
        if (rule.daysAfterDue !== daysOverdue) {
          continue;
        }

        // Check if this rule was already executed for this installment today
        const alreadyExecuted =
          await this.prisma.collectionExecution.findFirst({
            where: {
              collectionRuleId: rule.id,
              installmentId: installment.id,
              executedAt: { gte: today },
            },
          });

        if (alreadyExecuted) {
          continue;
        }

        // Execute the action based on type
        const executionResult = await this.executeAction(
          rule,
          installment,
          daysOverdue,
        );

        // Record the execution
        await this.prisma.collectionExecution.create({
          data: {
            companyId,
            collectionRuleId: rule.id,
            financialEntryId: installment.financialEntry.id,
            installmentId: installment.id,
            status: executionResult.status,
            actionType: rule.actionType,
            message: executionResult.message,
            error: executionResult.error,
          },
        });

        executed++;
      }
    }

    this.logger.log(
      `Empresa ${companyId}: ${executed} acao(oes) executada(s) para ${overdueInstallments.length} parcela(s) vencida(s)`,
    );

    return { executed };
  }

  /**
   * Execute a single collection action for an installment.
   */
  private async executeAction(
    rule: {
      id: string;
      actionType: string;
      name: string;
      messageTemplate: string | null;
    },
    installment: {
      id: string;
      totalCents: number;
      dueDate: Date;
      financialEntry: {
        id: string;
        companyId: string;
        partnerId: string | null;
        partner: { id: string; name: string } | null;
      };
    },
    daysOverdue: number,
  ): Promise<{ status: string; message: string; error: string | null }> {
    const partnerName =
      installment.financialEntry.partner?.name ?? 'Sem parceiro';

    try {
      switch (rule.actionType) {
        case 'STATUS_CHANGE': {
          await this.prisma.financialInstallment.update({
            where: { id: installment.id },
            data: { status: 'OVERDUE' },
          });
          const msg = `Status da parcela ${installment.id} alterado para OVERDUE (${daysOverdue} dias apos vencimento)`;
          this.logger.log(msg);
          return { status: 'SUCCESS', message: msg, error: null };
        }

        case 'INTEREST_APPLY': {
          // Interest application is handled by InstallmentService.applyInterestToOverdue
          const msg = `Juros/multa para parcela ${installment.id} sera aplicado pelo InstallmentService (${daysOverdue} dias apos vencimento)`;
          this.logger.log(msg);
          return { status: 'SUCCESS', message: msg, error: null };
        }

        case 'WHATSAPP': {
          const msg = `[PLACEHOLDER] WhatsApp para ${partnerName} — Parcela vencida ha ${daysOverdue} dia(s), valor R$ ${(installment.totalCents / 100).toFixed(2)}`;
          this.logger.log(msg);
          return { status: 'SUCCESS', message: msg, error: null };
        }

        case 'EMAIL': {
          const msg = `[PLACEHOLDER] Email para ${partnerName} — Parcela vencida ha ${daysOverdue} dia(s), valor R$ ${(installment.totalCents / 100).toFixed(2)}`;
          this.logger.log(msg);
          return { status: 'SUCCESS', message: msg, error: null };
        }

        default: {
          const msg = `Tipo de acao desconhecido: ${rule.actionType}`;
          this.logger.warn(msg);
          return { status: 'SKIPPED', message: msg, error: null };
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erro ao executar regra "${rule.name}" para parcela ${installment.id}: ${errorMsg}`,
      );
      return {
        status: 'FAILED',
        message: `Erro na execucao da regra "${rule.name}"`,
        error: errorMsg,
      };
    }
  }

  // ─────────────────────── Execution History & Manual Trigger ─────────────────

  /**
   * List collection executions with pagination and optional date filters
   */
  async findExecutions(
    companyId: string,
    pagination?: PaginationDto,
    filters?: { dateFrom?: string; dateTo?: string },
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    // Apply date filters
    if (filters?.dateFrom || filters?.dateTo) {
      where.executedAt = {};
      if (filters.dateFrom) {
        where.executedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.executedAt.lte = toDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.collectionExecution.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.collectionExecution.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Manually trigger collection processing for a company.
   * Same logic as the daily cron, but on-demand.
   */
  async runManual(companyId: string) {
    this.logger.log(
      `Execucao manual da regua de cobranca para empresa ${companyId}`,
    );
    const result = await this.processCompany(companyId);
    this.logger.log(
      `Execucao manual concluida: ${result.executed} acao(oes) executada(s)`,
    );
    return result;
  }
}
