import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { MatchLineDto, MatchAsRefundDto, MatchCardInvoiceDto, EntryAccountAssignmentDto, MatchAsTransferDto } from './dto/reconciliation.dto';
import { CodeGeneratorService } from '../common/code-generator.service';

/**
 * Detecta paymentMethod pela descricao da linha do extrato bancario.
 * Retorna o code do PaymentMethod ou null se nao conseguir deduzir.
 */
function detectPaymentMethodFromDescription(description: string | null): string | null {
  if (!description) return null;
  const d = description.toUpperCase();
  if (d.includes('PIX')) return 'PIX';
  if (d.includes('BOLETO') || d.includes('LIQUIDACAO') || d.includes('LIQUIDAÇÃO')) return 'BOLETO';
  if (d.includes('DARF') || d.includes('ARRECADACAO') || d.includes('ARRECADAÇÃO')) return 'BOLETO';
  if (d.includes('CREDITO MASTER') || d.includes('DEBITO MASTER')) return 'CARTAO_DEBITO';
  if (d.includes('CREDITO VISA') || d.includes('DEBITO VISA')) return 'CARTAO_DEBITO';
  if (d.includes('CREDITO ELO') || d.includes('DEBITO ELO')) return 'CARTAO_DEBITO';
  if (d.includes('TRANSF ENTRE CONTAS') || d.includes('TRANSFERENCIA') || d.includes('TRANSFERÊNCIA')) return 'TRANSFERENCIA';
  if (d.includes('TARIFA') || d.includes('CESTA DE RELACIONAMENTO') || d.includes('CESTA RELACIONAMENTO')) return 'DEBITO_EM_CONTA';
  if (d.includes('ESTORNO')) return 'DEBITO_EM_CONTA';
  if (d.includes('CONVENIO') || d.includes('CONVÊNIO')) return 'BOLETO';
  return null;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ofxParser: OfxParserService,
    private readonly csvParser: CsvParserService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  /**
   * Extract year/month from transactionDate. Usado pra particionar linhas em statements mensais.
   *
   * As datas do OFX sao naive (sem timezone) — representam "o dia do evento no banco" (BR).
   * O parser salva como `new Date(year, month, day)` que no servidor UTC vira `yyyy-mm-dd 00:00 UTC`.
   * Ler direto os componentes UTC da o mes correto (sem deslocamento de timezone).
   *
   * v1.09.67 — fix: antes subtraia 3h o que jogava linhas do dia 01 do mes pro mes anterior.
   */
  private getBrazilianPeriod(date: Date): { year: number; month: number } {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1, // 1..12
    };
  }

  /**
   * Import a bank statement file (OFX or CSV).
   *
   * v1.08.87: file lines are now partitioned into monthly statements (BankStatement).
   * Lines from the same account in the same month are merged into an existing statement
   * instead of creating a new import per file. The import record is kept as an audit log
   * of file uploads.
   */
  async importFile(
    companyId: string,
    cashAccountId: string,
    fileName: string,
    fileContent: string,
    importedByName: string,
  ) {
    // Validate account
    const account = await this.prisma.cashAccount.findFirst({
      where: { id: cashAccountId, companyId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Conta não encontrada.');

    // Detect file type and parse
    const fileType = fileName.toLowerCase().endsWith('.ofx') ? 'OFX' : 'CSV';
    const isOfx = fileType === 'OFX';
    const ofxResult = isOfx ? this.ofxParser.parseWithMeta(fileContent) : null;
    const ofxTransactions = ofxResult?.transactions ?? [];
    const csvTransactions = isOfx ? [] : this.csvParser.parse(fileContent);
    const totalCount = isOfx ? ofxTransactions.length : csvTransactions.length;

    if (totalCount === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Dedup by FITID across the entire cashAccount (not per-import)
      let existingFitIds = new Set<string>();
      if (isOfx && ofxTransactions.length > 0) {
        const fitIds = ofxTransactions.map((t) => t.fitId).filter(Boolean);
        if (fitIds.length > 0) {
          const existing = await tx.bankStatementLine.findMany({
            where: { cashAccountId, fitId: { in: fitIds } },
            select: { fitId: true },
          });
          existingFitIds = new Set(existing.map((e) => e.fitId!).filter(Boolean));
        }
      }

      // 2. Get the list of transactions to insert (after dedup)
      type Tx = {
        transactionDate: Date;
        description: string;
        amountCents: number;
        fitId: string | null;
        checkNum: string | null;
        refNum: string | null;
      };
      const newTxs: Tx[] = isOfx
        ? ofxTransactions
            .filter((t) => !existingFitIds.has(t.fitId))
            .map((t) => ({
              transactionDate: t.transactionDate,
              description: t.description,
              amountCents: t.amountCents,
              fitId: t.fitId,
              checkNum: t.checkNum ?? null,
              refNum: t.refNum ?? null,
            }))
        : csvTransactions.map((t) => ({
            transactionDate: t.transactionDate,
            description: t.description,
            amountCents: t.amountCents,
            fitId: null,
            checkNum: null,
            refNum: null,
          }));

      // 3. Group by monthly period (Brazil timezone)
      const byPeriod = new Map<string, { year: number; month: number; txs: Tx[] }>();
      for (const t of newTxs) {
        const { year, month } = this.getBrazilianPeriod(t.transactionDate);
        const key = `${year}-${month}`;
        if (!byPeriod.has(key)) byPeriod.set(key, { year, month, txs: [] });
        byPeriod.get(key)!.txs.push(t);
      }

      // 4. Create the audit import record
      const importRecord = await tx.bankStatementImport.create({
        data: {
          companyId,
          cashAccountId,
          fileName,
          fileType,
          importedByName,
          lineCount: newTxs.length,
          matchedCount: 0,
        },
      });

      // 5. For each period, find or create the BankStatement and insert lines
      const touchedStatements: Array<{ id: string; lineCountDelta: number }> = [];
      let primaryStatementId: string | null = null;
      let primaryStatementCount = 0;

      for (const { year, month, txs } of byPeriod.values()) {
        // Find or create statement
        let statement = await tx.bankStatement.findUnique({
          where: {
            cashAccountId_periodYear_periodMonth: {
              cashAccountId,
              periodYear: year,
              periodMonth: month,
            },
          },
        });

        if (!statement) {
          statement = await tx.bankStatement.create({
            data: {
              companyId,
              cashAccountId,
              periodYear: year,
              periodMonth: month,
              lineCount: 0,
              matchedCount: 0,
              lastImportAt: new Date(),
              lastImportByName: importedByName,
              lastFileName: fileName,
            },
          });
        }

        // Insert lines for this statement
        await tx.bankStatementLine.createMany({
          data: txs.map((t) => ({
            importId: importRecord.id,
            statementId: statement!.id,
            cashAccountId,
            transactionDate: t.transactionDate,
            description: t.description,
            amountCents: t.amountCents,
            fitId: t.fitId,
            checkNum: t.checkNum,
            refNum: t.refNum,
            status: 'UNMATCHED' as const,
          })),
        });

        // Saldo do OFX (LEDGERBAL) — grava apenas no statement que cobre a data DTASOF
        const shouldWriteBalance = isOfx
          && ofxResult?.statementBalanceCents != null
          && ofxResult?.statementBalanceDate
          && (() => {
            const { year: balYear, month: balMonth } = this.getBrazilianPeriod(ofxResult.statementBalanceDate);
            return balYear === year && balMonth === month;
          })();

        // Update statement: bump lineCount, refresh last* (overwrite fileName), grava saldo se aplicavel
        await tx.bankStatement.update({
          where: { id: statement.id },
          data: {
            lineCount: { increment: txs.length },
            lastImportAt: new Date(),
            lastImportByName: importedByName,
            lastFileName: fileName,
            ...(shouldWriteBalance && {
              statementBalanceCents: ofxResult!.statementBalanceCents,
              statementBalanceDate: ofxResult!.statementBalanceDate,
            }),
          },
        });

        touchedStatements.push({ id: statement.id, lineCountDelta: txs.length });
        if (txs.length > primaryStatementCount) {
          primaryStatementCount = txs.length;
          primaryStatementId = statement.id;
        }
      }

      // 6. Link the import to its primary statement (largest contribution)
      if (primaryStatementId) {
        await tx.bankStatementImport.update({
          where: { id: importRecord.id },
          data: { statementId: primaryStatementId },
        });
      }

      // 7. Saldo do OFX (LEDGERBAL): garante atualizacao MESMO quando nao ha transacoes
      //    novas (reimport do mesmo arquivo). Busca/cria o statement do periodo do saldo
      //    e grava o valor.
      if (isOfx && ofxResult?.statementBalanceCents != null && ofxResult?.statementBalanceDate) {
        const balDate = ofxResult.statementBalanceDate;
        const { year: balYear, month: balMonth } = this.getBrazilianPeriod(balDate);
        let balStatement = await tx.bankStatement.findUnique({
          where: {
            cashAccountId_periodYear_periodMonth: {
              cashAccountId,
              periodYear: balYear,
              periodMonth: balMonth,
            },
          },
        });
        if (!balStatement) {
          balStatement = await tx.bankStatement.create({
            data: {
              companyId,
              cashAccountId,
              periodYear: balYear,
              periodMonth: balMonth,
              lineCount: 0,
              matchedCount: 0,
            },
          });
        }
        await tx.bankStatement.update({
          where: { id: balStatement.id },
          data: {
            statementBalanceCents: ofxResult.statementBalanceCents,
            statementBalanceDate: balDate,
          },
        });
        this.logger.log(
          `Saldo OFX gravado em statement ${balStatement.id}: ` +
          `R$${(ofxResult.statementBalanceCents / 100).toFixed(2)} em ${balDate.toISOString().slice(0, 10)}`,
        );
      }

      return {
        ...importRecord,
        statementId: primaryStatementId,
        lineCount: newTxs.length,
        skippedDuplicates: totalCount - newTxs.length,
        touchedStatementCount: touchedStatements.length,
      };
    });

    // Auto-reconciliation (async, non-blocking)
    this.tryAutoReconciliation(companyId, result.id, importedByName).catch((err) => {
      this.logger.error(`Auto-reconciliation failed for import ${result.id}: ${err.message}`);
    });

    return result;
  }

  /**
   * List all monthly statements for a company, grouped by cash account.
   * Used in the main reconciliation view (instead of listing import files).
   */
  async findStatements(companyId: string) {
    return this.prisma.bankStatement.findMany({
      where: { companyId },
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { cashAccountId: 'asc' },
      ],
      include: {
        cashAccount: {
          select: { id: true, name: true, bankName: true, bankCode: true, accountNumber: true, agency: true },
        },
      },
      take: 100,
    });
  }

  /**
   * Seta manualmente o saldo oficial do banco para um BankStatement
   * (casos onde o OFX antigo nao tinha LEDGERBAL ou o banco nao exporta esse campo).
   */
  async setManualStatementBalance(
    statementId: string,
    companyId: string,
    balanceCents: number,
    balanceDate: Date,
  ) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!statement) throw new NotFoundException('Extrato não encontrado.');
    return this.prisma.bankStatement.update({
      where: { id: statementId },
      data: {
        statementBalanceCents: balanceCents,
        statementBalanceDate: balanceDate,
      },
    });
  }

  /**
   * Calcula o saldo do SISTEMA na data informada pelo OFX (statementBalanceDate)
   * e compara com o saldo do banco (statementBalanceCents).
   *
   * Abordagem: parte do saldo atual da conta e "reverte" os movimentos posteriores a D.
   *   saldo_sistema_em_D = saldo_atual - movs_apos_D
   *   movs_apos_D = (receivable PAID) - (payable PAID) + (transfer_in) - (transfer_out)
   *
   * Assim o sinal do saldo_sistema bate com banco (positivo = dinheiro em conta).
   */
  async getStatementBalanceCompare(statementId: string, companyId: string) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
      include: {
        cashAccount: { select: { id: true, name: true, currentBalanceCents: true } },
      },
    });
    if (!statement) throw new NotFoundException('Extrato não encontrado.');

    if (statement.statementBalanceCents == null || !statement.statementBalanceDate) {
      return {
        hasBalance: false,
        cashAccountName: statement.cashAccount.name,
        bankBalanceCents: null,
        bankBalanceDate: null,
        systemBalanceCents: null,
        diffCents: null,
        matches: null,
      };
    }

    const D = statement.statementBalanceDate;
    const cashAccountId = statement.cashAccountId;
    const currentBalance = statement.cashAccount.currentBalanceCents;

    // Movimentos APOS a data D (que afetaram o saldo entre D e hoje)
    const [rec, pay, transferIn, transferOut] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: {
          cashAccountId,
          status: 'PAID',
          paidAt: { gt: D },
          type: 'RECEIVABLE',
          deletedAt: null,
        },
        _sum: { netCents: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          cashAccountId,
          status: 'PAID',
          paidAt: { gt: D },
          type: 'PAYABLE',
          deletedAt: null,
        },
        _sum: { netCents: true },
      }),
      this.prisma.accountTransfer.aggregate({
        where: { toAccountId: cashAccountId, transferDate: { gt: D } },
        _sum: { amountCents: true },
      }),
      this.prisma.accountTransfer.aggregate({
        where: { fromAccountId: cashAccountId, transferDate: { gt: D } },
        _sum: { amountCents: true },
      }),
    ]);

    const movsAfterD =
      (rec._sum.netCents || 0)
      - (pay._sum.netCents || 0)
      + (transferIn._sum.amountCents || 0)
      - (transferOut._sum.amountCents || 0);

    const systemBalanceAtD = currentBalance - movsAfterD;
    const diff = statement.statementBalanceCents - systemBalanceAtD;
    // Tolerancia de 1 centavo (arredondamento)
    const matches = Math.abs(diff) <= 1;

    return {
      hasBalance: true,
      cashAccountName: statement.cashAccount.name,
      bankBalanceCents: statement.statementBalanceCents,
      bankBalanceDate: statement.statementBalanceDate,
      systemBalanceCents: systemBalanceAtD,
      diffCents: diff,
      matches,
      breakdown: {
        currentBalance,
        receivableAfterCents: rec._sum.netCents || 0,
        payableAfterCents: pay._sum.netCents || 0,
        transferInAfterCents: transferIn._sum.amountCents || 0,
        transferOutAfterCents: transferOut._sum.amountCents || 0,
      },
    };
  }

  /**
   * List statement lines for a given BankStatement (monthly extrato).
   * Wraps findLines() with statement-based filtering.
   */
  async findStatementLines(statementId: string, companyId: string, status?: string) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!statement) throw new NotFoundException('Extrato não encontrado.');

    const where: Record<string, unknown> = { statementId };
    if (status) where.status = status;

    const lines = await this.prisma.bankStatementLine.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
    });

    // Reuse pair suggestion logic from findLines
    const allLines = status
      ? await this.prisma.bankStatementLine.findMany({
          where: { statementId },
          orderBy: { transactionDate: 'desc' },
        })
      : lines;

    return this.attachPairSuggestions(lines, allLines);
  }

  /**
   * Attach refund pair suggestions (virtual field) to lines.
   * Extracted so findLines() and findStatementLines() can share the logic.
   */
  private attachPairSuggestions(
    lines: any[],
    allLines: any[],
  ) {
    const unmatched = allLines.filter((l) => l.status === 'UNMATCHED');
    const suggestions = new Map<string, string>();
    for (const a of unmatched) {
      if (suggestions.has(a.id)) continue;
      let best: { id: string; score: number } | null = null;
      for (const b of unmatched) {
        if (b.id === a.id) continue;
        if (suggestions.has(b.id)) continue;
        if ((a.amountCents > 0) === (b.amountCents > 0)) continue;
        if (Math.abs(Math.abs(a.amountCents) - Math.abs(b.amountCents)) > 1) continue;
        const daysApart = Math.abs(
          (new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysApart > 60) continue;
        const nameScore = this.counterpartyNameSimilarity(a.description, b.description);
        const score = daysApart - nameScore * 10;
        if (!best || score < best.score) {
          best = { id: b.id, score };
        }
      }
      if (best) {
        suggestions.set(a.id, best.id);
        suggestions.set(best.id, a.id);
      }
    }
    return lines.map((l) => ({
      ...l,
      suggestedPairLineId: suggestions.get(l.id) || null,
    }));
  }

  /**
   * List all imports for a company (audit log of file uploads)
   */
  async findImports(companyId: string) {
    return this.prisma.bankStatementImport.findMany({
      where: { companyId },
      orderBy: { importedAt: 'desc' },
      take: 50,
    });
  }

  /**
   * List statement lines for an import, enriched with refund pair suggestions.
   * Kept for backward compatibility — the new flow uses findStatementLines.
   */
  async findLines(importId: string, companyId: string, status?: string) {
    // Verify the import belongs to this company
    const imp = await this.prisma.bankStatementImport.findFirst({
      where: { id: importId, companyId },
    });
    if (!imp) throw new NotFoundException('Importação não encontrada.');

    const where: Record<string, unknown> = { importId };
    if (status) where.status = status;

    const lines = await this.prisma.bankStatementLine.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
    });

    const allLines = status
      ? await this.prisma.bankStatementLine.findMany({
          where: { importId },
          orderBy: { transactionDate: 'desc' },
        })
      : lines;

    return this.attachPairSuggestions(lines, allLines);
  }

  /**
   * Extract the counterparty name token from a bank statement description and
   * return a similarity score [0..1] between two descriptions.
   *
   * Bank lines look like "RECEBIMENTO PIX-PIX_CRED 01768906106 CATIUCIA L SECHI PATRICIO"
   * and "DEVOLUCAO PIX-PIX_DEB 01768906106 CATIUCIA L SECHI PATRICIO".
   * We strip the prefix/codes and compare the rest (usually the name).
   */
  /**
   * Recalculate matchedCount on both the import and the statement that a line belongs to.
   * Call after any mutation that changes a line's status.
   */
  private async recalcCounts(tx: any, importId: string, statementId: string | null) {
    const importMatched = await tx.bankStatementLine.count({
      where: { importId, status: 'MATCHED' },
    });
    await tx.bankStatementImport.update({
      where: { id: importId },
      data: { matchedCount: importMatched },
    });
    if (statementId) {
      const [lineCount, matchedCount] = await Promise.all([
        tx.bankStatementLine.count({ where: { statementId } }),
        tx.bankStatementLine.count({ where: { statementId, status: 'MATCHED' } }),
      ]);
      await tx.bankStatement.update({
        where: { id: statementId },
        data: { lineCount, matchedCount },
      });
    }
  }

  private counterpartyNameSimilarity(a: string, b: string): number {
    const clean = (s: string) =>
      s
        .toUpperCase()
        .replace(/RECEBIMENTO|DEVOLUCAO|PAGAMENTO|PIX[_-]?(CRED|DEB)?|[0-9]/g, ' ')
        .replace(/[^A-Z ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);
    const tokensA = new Set(clean(a));
    const tokensB = new Set(clean(b));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let shared = 0;
    for (const t of tokensA) if (tokensB.has(t)) shared++;
    return shared / Math.max(tokensA.size, tokensB.size);
  }

  /**
   * Retorna true se a empresa tem plano de contas configurado (ao menos 1 conta ativa que aceita postagem).
   * Usado para decidir se a validacao de financialAccountId na conciliacao e obrigatoria.
   */
  private async companyUsesChartOfAccounts(companyId: string): Promise<boolean> {
    const count = await this.prisma.financialAccount.count({
      where: { companyId, isActive: true, allowPosting: true, deletedAt: null },
    });
    return count > 0;
  }

  /**
   * Match a statement line to an entry or installment.
   * Se a entry estiver PENDING, e marcada automaticamente como PAID (consistencia com extrato bancario
   * — se o valor saiu do banco, a conta foi paga). Flag entry.autoMarkedPaid permite reverter no unmatch.
   * Valida financialAccountId se a empresa tem plano de contas configurado.
   */
  async matchLine(lineId: string, companyId: string, dto: MatchLineDto, matchedByName: string) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (line.status === 'MATCHED') {
      throw new BadRequestException('Linha já está conciliada.');
    }

    if (!dto.entryId && !dto.installmentId) {
      throw new BadRequestException('Informe o lançamento ou parcela para conciliar.');
    }

    // Carrega o entry (se informado) para decidir auto-pay + validacoes
    const entryBefore = dto.entryId
      ? await this.prisma.financialEntry.findUnique({
          where: { id: dto.entryId },
          select: {
            id: true,
            companyId: true,
            deletedAt: true,
            status: true,
            type: true,
            netCents: true,
            grossCents: true,
            cashAccountId: true,
            financialAccountId: true,
            paymentMethod: true,
            isRefundEntry: true,
          },
        })
      : null;

    if (dto.entryId) {
      if (!entryBefore || entryBefore.companyId !== companyId || entryBefore.deletedAt) {
        throw new NotFoundException('Lançamento não encontrado.');
      }
      if (entryBefore.status === 'CANCELLED') {
        throw new BadRequestException('Lançamento cancelado não pode ser conciliado.');
      }
      // Protecao: entry ja conciliado com outra linha do extrato
      const existingMatch = await this.prisma.bankStatementLine.findFirst({
        where: {
          matchedEntryId: dto.entryId,
          status: 'MATCHED',
          id: { not: lineId },
        },
        select: { id: true, transactionDate: true, description: true, amountCents: true },
      });
      if (existingMatch) {
        const dateStr = existingMatch.transactionDate.toLocaleDateString('pt-BR');
        throw new BadRequestException(
          `Este lançamento já está conciliado com outra linha do extrato ` +
          `(${dateStr} — ${existingMatch.description}). ` +
          `Desfaça aquela conciliação primeiro ou escolha outro lançamento.`,
        );
      }
      // Protecao: entry ja e parte de uma fatura de cartao conciliada
      const entryInvoiceGroup = await this.prisma.financialEntry.findUnique({
        where: { id: dto.entryId },
        select: { invoiceMatchLineId: true },
      });
      if (entryInvoiceGroup?.invoiceMatchLineId) {
        throw new BadRequestException(
          'Este lançamento já está conciliado como parte de uma fatura de cartão. ' +
          'Desfaça aquela conciliação primeiro.',
        );
      }
    }

    // Protecao: installment ja conciliada com outra linha
    if (dto.installmentId) {
      const existingMatch = await this.prisma.bankStatementLine.findFirst({
        where: {
          matchedInstallmentId: dto.installmentId,
          status: 'MATCHED',
          id: { not: lineId },
        },
        select: { id: true, transactionDate: true, description: true },
      });
      if (existingMatch) {
        const dateStr = existingMatch.transactionDate.toLocaleDateString('pt-BR');
        throw new BadRequestException(
          `Esta parcela já está conciliada com outra linha do extrato ` +
          `(${dateStr} — ${existingMatch.description}). ` +
          `Desfaça aquela conciliação primeiro.`,
        );
      }
    }

    // Validacao de plano de contas (se empresa usa e entry nao e tecnico/refund)
    const usesChart = await this.companyUsesChartOfAccounts(companyId);
    let financialAccountIdToSet: string | null = null;

    if (entryBefore && !entryBefore.isRefundEntry && usesChart) {
      // Se DTO passou, valida e usa. Senao, exige que entry ja tenha.
      if (dto.financialAccountId) {
        const fa = await this.prisma.financialAccount.findFirst({
          where: { id: dto.financialAccountId, companyId, isActive: true, allowPosting: true, deletedAt: null },
          select: { id: true },
        });
        if (!fa) {
          throw new BadRequestException('Plano de contas inválido ou inativo.');
        }
        financialAccountIdToSet = dto.financialAccountId;
      } else if (!entryBefore.financialAccountId) {
        throw new BadRequestException('Informe o plano de contas do lançamento antes de conciliar.');
      }
    }

    const bankAccountId = line.cashAccountId;
    const transferAmount = Math.abs(line.amountCents);
    const tsLog = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    return this.prisma.$transaction(async (tx) => {
      // 1. Atualiza a linha do extrato
      const updated = await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'MATCHED',
          matchedEntryId: dto.entryId ?? null,
          matchedInstallmentId: dto.installmentId ?? null,
          matchedAt: new Date(),
          matchedByName,
          matchedLiquidCents: dto.liquidCents ?? null,
          matchedTaxCents: dto.taxCents ?? null,
          notes: dto.notes ?? null,
        },
      });

      await this.recalcCounts(tx, line.importId, line.statementId);

      // 2. Processa o entry (auto-pay ou transfer existente)
      if (entryBefore) {
        const wasPending = entryBefore.status === 'PENDING' || entryBefore.status === 'CONFIRMED';
        const entryUpdate: Record<string, unknown> = {};

        // Aplica plano de contas se definido via DTO
        if (financialAccountIdToSet) {
          entryUpdate.financialAccountId = financialAccountIdToSet;
        }

        // v1.09.94: Determinar conta de origem (preserva historico no VT / conta original).
        // Se entry ja tem cashAccountId diferente do banco, usa ela (ex: VT).
        // Senao, busca a conta de TRANSITO como fallback.
        let sourceAccountId: string | null = entryBefore.cashAccountId;
        if (!sourceAccountId || sourceAccountId === bankAccountId) {
          const transitAccount = await tx.cashAccount.findFirst({
            where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
            select: { id: true },
          });
          sourceAccountId = transitAccount?.id || null;
        }
        const usesTransit = !!(sourceAccountId && sourceAccountId !== bankAccountId);

        if (wasPending) {
          // PENDING -> PAID via conciliacao bancaria.
          // Auto-detecta paymentMethod pela descricao da linha do extrato
          const detectedMethod = detectPaymentMethodFromDescription(line.description);
          if (!entryBefore.paymentMethod && !detectedMethod && !dto.paymentMethod) {
            throw new BadRequestException(
              'Não foi possível identificar a forma de pagamento automaticamente. ' +
              'Defina a forma de pagamento do lançamento antes de conciliar.',
            );
          }
          entryUpdate.status = 'PAID';
          entryUpdate.paidAt = line.transactionDate;
          entryUpdate.autoMarkedPaid = true;
          if (!entryBefore.paymentMethod) {
            entryUpdate.paymentMethod = dto.paymentMethod || detectedMethod;
          }
          const logLine = `[${tsLog}] PAGO via conciliação bancária (linha ${line.id.substring(0, 8)})`;
          entryUpdate.notes = logLine;

          if (usesTransit) {
            // v1.09.94 — Fluxo com conta de transito (preserva historico completo no VT)
            // 1) entry fica na conta de origem (VT), saldo origem += grossCents (receita entra no VT)
            // 2) Transfer origem -> banco no valor liquido (-liquido na origem, +liquido no banco)
            // 3) Se taxa: entry PAYABLE de taxa na origem (-taxa)
            // Net origem: +gross - liquido - taxa = 0 (ciclo fecha quando gross = liquido + taxa)
            // Net banco: +liquido (= line.amountCents)
            entryUpdate.cashAccountId = sourceAccountId;
            const entryGross = entryBefore.grossCents;
            const lineAbs = Math.abs(line.amountCents);
            const isCredit = line.amountCents > 0;

            // Passo 1: receita entra na conta origem
            await tx.cashAccount.update({
              where: { id: sourceAccountId! },
              data: {
                currentBalanceCents: entryBefore.type === 'RECEIVABLE'
                  ? { increment: entryGross }
                  : { decrement: entryGross },
              },
            });

            // Passo 2: cria AccountTransfer rastreavel
            const fromId = isCredit ? sourceAccountId! : bankAccountId;
            const toId = isCredit ? bankAccountId : sourceAccountId!;
            await tx.accountTransfer.create({
              data: {
                companyId,
                fromAccountId: fromId,
                toAccountId: toId,
                amountCents: lineAbs,
                description: `Conciliacao - linha ${line.id.substring(0, 8)} (entry ${entryBefore.id.substring(0, 8)})`,
                transferDate: line.transactionDate,
                createdByName: matchedByName,
              },
            });
            await tx.cashAccount.update({
              where: { id: fromId },
              data: { currentBalanceCents: { decrement: lineAbs } },
            });
            await tx.cashAccount.update({
              where: { id: toId },
              data: { currentBalanceCents: { increment: lineAbs } },
            });
          } else {
            // Fluxo legado (sem conta de transito): entry vai direto pro banco
            entryUpdate.cashAccountId = bankAccountId;
            await tx.cashAccount.update({
              where: { id: bankAccountId },
              data: { currentBalanceCents: { increment: line.amountCents } },
            });
          }

          await tx.financialEntry.update({
            where: { id: entryBefore.id },
            data: entryUpdate,
          });

          // v1.09.68: Taxa de cartao (RECEIVABLE com valor liquido < bruto).
          // Cria entry PAYABLE tecnico de taxa. v1.09.94: no fluxo de transito,
          // a taxa vai na conta origem (VT), nao no banco.
          const taxCents = dto.taxCents ?? 0;
          if (taxCents > 0 && entryBefore.type === 'RECEIVABLE' && line.amountCents > 0) {
            const taxCode = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');
            const taxAccountId = usesTransit ? sourceAccountId! : bankAccountId;
            await tx.financialEntry.create({
              data: {
                companyId,
                code: taxCode,
                type: 'PAYABLE',
                status: 'PAID',
                description: `Taxa cartao - conciliacao linha ${line.id.substring(0, 8)} (entry ${entryBefore.id.substring(0, 8)})`,
                grossCents: taxCents,
                netCents: taxCents,
                paidAt: line.transactionDate,
                cashAccountId: taxAccountId,
                autoMarkedPaid: true,
                isRefundEntry: true, // marca como entry tecnico (nao aparece em DRE cliente)
              },
            });
            if (usesTransit) {
              // Fluxo novo: taxa decrementa saldo da conta origem
              await tx.cashAccount.update({
                where: { id: taxAccountId },
                data: { currentBalanceCents: { decrement: taxCents } },
              });
            }
            // Fluxo legado: saldo do banco ja foi incrementado com line.amountCents (liquido),
            // nao precisa decrementar taxa aqui.
          }
        } else {
          // Entry ja PAID — aplica plano (se veio) e corrige paidAt pra data REAL do banco.
          // Isso e critico porque o usuario frequentemente cria entry com paidAt=hoje
          // e depois concilia com uma linha bancaria de semanas atras. A data correta
          // do movimento financeiro e a data do banco, nao a data do registro no sistema.
          entryUpdate.paidAt = line.transactionDate;
          if (Object.keys(entryUpdate).length > 0) {
            await tx.financialEntry.update({
              where: { id: entryBefore.id },
              data: entryUpdate,
            });
          }

          if (usesTransit) {
            const isCredit = line.amountCents > 0;
            const fromId = isCredit ? sourceAccountId! : bankAccountId;
            const toId = isCredit ? bankAccountId : sourceAccountId!;

            // Criar AccountTransfer rastreavel (balance-compare depende disso)
            await tx.accountTransfer.create({
              data: {
                companyId,
                fromAccountId: fromId,
                toAccountId: toId,
                amountCents: transferAmount,
                description: `Conciliacao - linha ${line.id.substring(0, 8)} (entry ${entryBefore.id.substring(0, 8)})`,
                transferDate: line.transactionDate,
                createdByName: matchedByName,
              },
            });

            // Ajustar saldos do transfer
            await tx.cashAccount.update({
              where: { id: fromId },
              data: { currentBalanceCents: { decrement: transferAmount } },
            });
            await tx.cashAccount.update({
              where: { id: toId },
              data: { currentBalanceCents: { increment: transferAmount } },
            });

            // v1.09.94: NAO mover entry pro banco (preserva historico no VT).
            // Taxa automatica: se RECEIVABLE com gross > liquido, cria entry de taxa na origem.
            const autoTaxCents = (dto.taxCents ?? 0) > 0
              ? (dto.taxCents ?? 0)
              : (entryBefore.type === 'RECEIVABLE' && isCredit && entryBefore.grossCents > transferAmount
                  ? entryBefore.grossCents - transferAmount
                  : 0);
            if (autoTaxCents > 0 && entryBefore.type === 'RECEIVABLE' && isCredit) {
              const taxCode = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');
              await tx.financialEntry.create({
                data: {
                  companyId,
                  code: taxCode,
                  type: 'PAYABLE',
                  status: 'PAID',
                  description: `Taxa cartao - conciliacao linha ${line.id.substring(0, 8)} (entry ${entryBefore.id.substring(0, 8)})`,
                  grossCents: autoTaxCents,
                  netCents: autoTaxCents,
                  paidAt: line.transactionDate,
                  cashAccountId: sourceAccountId!,
                  autoMarkedPaid: true,
                  isRefundEntry: true,
                },
              });
              await tx.cashAccount.update({
                where: { id: sourceAccountId! },
                data: { currentBalanceCents: { decrement: autoTaxCents } },
              });
            }
          }
          // Se !usesTransit: entry ja esta no banco, nada a fazer (saldo ja correto)
        }
      }

      return updated;
    });
  }

  /**
   * Match a pair of statement lines as a PIX refund (entry indevida + devolucao).
   *
   * Used when a third party sends money by mistake and the company refunds it
   * without any OS/FIN involved. Creates two technical entries (RECEIVABLE + PAYABLE),
   * both flagged as `isRefundEntry`, linked together and to the bank lines, so the
   * cash movement is fully traceable in accounting without polluting MRR/metrics.
   */
  async matchAsRefund(
    lineId: string,
    companyId: string,
    dto: MatchAsRefundDto,
    matchedByName: string,
  ) {
    // 1. Load both lines with their imports
    const [lineA, lineB] = await Promise.all([
      this.prisma.bankStatementLine.findUnique({
        where: { id: lineId },
        include: { import: { select: { companyId: true } } },
      }),
      this.prisma.bankStatementLine.findUnique({
        where: { id: dto.pairedLineId },
        include: { import: { select: { companyId: true } } },
      }),
    ]);

    if (!lineA || lineA.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (!lineB || lineB.import.companyId !== companyId) {
      throw new NotFoundException('Linha par não encontrada.');
    }
    if (lineA.id === lineB.id) {
      throw new BadRequestException('Linha não pode ser par dela mesma.');
    }
    if (lineA.status !== 'UNMATCHED' || lineB.status !== 'UNMATCHED') {
      throw new BadRequestException('Ambas as linhas devem estar pendentes.');
    }

    // 2. Validate: opposite signs, same absolute value (tolerance 1 cent)
    const signA = lineA.amountCents > 0;
    const signB = lineB.amountCents > 0;
    if (signA === signB) {
      throw new BadRequestException(
        'As linhas devem ter sinais opostos (uma entrada e uma saida).',
      );
    }
    const amtA = Math.abs(lineA.amountCents);
    const amtB = Math.abs(lineB.amountCents);
    if (Math.abs(amtA - amtB) > 1) {
      throw new BadRequestException(
        'As linhas devem ter o mesmo valor absoluto para formar um par de estorno.',
      );
    }

    // 3. Identify entry (credit) and exit (debit) lines
    const entryLine = signA ? lineA : lineB;
    const exitLine = signA ? lineB : lineA;
    const amount = amtA;

    const counterparty =
      dto.counterpartyName?.trim() || this.extractCounterparty(entryLine.description);
    const descReceivable = `Recebimento PIX indevido${counterparty ? ` - ${counterparty}` : ''}`;
    const descPayable = `Devolucao PIX indevido${counterparty ? ` - ${counterparty}` : ''}`;

    // 4. Generate codes (outside transaction — CodeCounter has its own locking)
    const codeReceivable = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');
    const codePayable = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');

    // 5. Transaction: create entries + mark lines matched + link pair
    const result = await this.prisma.$transaction(async (tx) => {
      // Create RECEIVABLE entry (money in, already paid)
      const receivable = await tx.financialEntry.create({
        data: {
          companyId,
          code: codeReceivable,
          type: 'RECEIVABLE',
          status: 'PAID',
          description: descReceivable,
          grossCents: amount,
          netCents: amount,
          paidAt: entryLine.transactionDate,
          confirmedAt: new Date(),
          dueDate: entryLine.transactionDate,
          cashAccountId: entryLine.cashAccountId,
          paymentMethod: 'PIX',
          isRefundEntry: true,
          notes: dto.notes || null,
        },
      });

      // Create PAYABLE entry (money out, already paid)
      const payable = await tx.financialEntry.create({
        data: {
          companyId,
          code: codePayable,
          type: 'PAYABLE',
          status: 'PAID',
          description: descPayable,
          grossCents: amount,
          netCents: amount,
          paidAt: exitLine.transactionDate,
          confirmedAt: new Date(),
          dueDate: exitLine.transactionDate,
          cashAccountId: exitLine.cashAccountId,
          paymentMethod: 'PIX',
          isRefundEntry: true,
          refundPairEntryId: receivable.id,
          notes: dto.notes || null,
        },
      });

      // Back-link receivable -> payable
      await tx.financialEntry.update({
        where: { id: receivable.id },
        data: { refundPairEntryId: payable.id },
      });

      // Mark entry line MATCHED against receivable
      await tx.bankStatementLine.update({
        where: { id: entryLine.id },
        data: {
          status: 'MATCHED',
          matchedEntryId: receivable.id,
          matchedAt: new Date(),
          matchedByName,
          refundPairLineId: exitLine.id,
          isRefund: true,
          notes: dto.notes || null,
        },
      });

      // Mark exit line MATCHED against payable
      await tx.bankStatementLine.update({
        where: { id: exitLine.id },
        data: {
          status: 'MATCHED',
          matchedEntryId: payable.id,
          matchedAt: new Date(),
          matchedByName,
          refundPairLineId: entryLine.id,
          isRefund: true,
          notes: dto.notes || null,
        },
      });

      // Update matchedCount on both imports and statements
      const pairs = Array.from(new Set([
        `${entryLine.importId}|${entryLine.statementId || ''}`,
        `${exitLine.importId}|${exitLine.statementId || ''}`,
      ])).map((s) => s.split('|'));
      for (const [impId, stmtId] of pairs) {
        await this.recalcCounts(tx, impId, stmtId || null);
      }

      return { receivable, payable, entryLineId: entryLine.id, exitLineId: exitLine.id };
    });

    return result;
  }

  /**
   * Extract the counterparty name from a PIX/bank description.
   * Strips common prefixes, CPFs, and IDs, returning the remainder (usually the name).
   */
  private extractCounterparty(description: string): string {
    return description
      .toUpperCase()
      .replace(/RECEBIMENTO|DEVOLUCAO|PAGAMENTO|PIX[_-]?(CRED|DEB)?|TRANSFERENCIA|TED|DOC/g, ' ')
      .replace(/\d{6,}/g, ' ') // strip long numbers (CPF, IDs)
      .replace(/[^A-Z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .join(' ')
      .trim();
  }

  /**
   * Lista compras pagas com os cartoes informados no periodo, candidatas a compor
   * uma fatura conciliada com a linha do extrato.
   *
   * Filtra por `paymentInstrumentId` (nao por cashAccount), o que permite incluir
   * tambem pagamentos historicos anteriores a migracao pra conta-cartao virtual.
   */
  async findCardInvoiceCandidates(
    companyId: string,
    params: {
      paymentInstrumentIds: string[];
      fromDate?: string;
      toDate?: string;
      includeAlreadyMatched?: boolean;
    },
  ) {
    const { paymentInstrumentIds, fromDate, toDate, includeAlreadyMatched } = params;
    if (!paymentInstrumentIds || paymentInstrumentIds.length === 0) {
      return { entries: [], totalCents: 0 };
    }

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      // PAID (historico), PENDING/CONFIRMED (nao pago ainda — sera auto-pago ao conciliar)
      status: { in: ['PAID', 'PENDING', 'CONFIRMED'] },
      type: 'PAYABLE',
      paymentInstrumentId: { in: paymentInstrumentIds },
    };
    if (!includeAlreadyMatched) {
      where.invoiceMatchLineId = null;
      // Tambem exclui entries ja conciliados individualmente com alguma linha do extrato
      const matchedLines = await this.prisma.bankStatementLine.findMany({
        where: { status: 'MATCHED', matchedEntryId: { not: null } },
        select: { matchedEntryId: true },
      });
      const matchedIds = Array.from(new Set(
        matchedLines.map((l) => l.matchedEntryId!).filter(Boolean),
      ));
      if (matchedIds.length > 0) {
        where.id = { notIn: matchedIds };
      }
    }
    if (fromDate || toDate) {
      const range: Record<string, Date> = {};
      if (fromDate) range.gte = new Date(`${fromDate}T00:00:00.000-03:00`);
      if (toDate) range.lte = new Date(`${toDate}T23:59:59.999-03:00`);
      // Prefere cardBillingDate (ciclo de fatura do cartao, separado de paidAt).
      // Fallback pra paidAt/dueDate pra entries antigos que ainda nao tem cardBillingDate.
      where.OR = [
        { cardBillingDate: range },
        { AND: [{ cardBillingDate: null }, { paidAt: range }] },
        { AND: [{ cardBillingDate: null }, { paidAt: null }, { dueDate: range }] },
      ];
    }

    const entries = await this.prisma.financialEntry.findMany({
      where,
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        code: true,
        description: true,
        netCents: true,
        grossCents: true,
        paidAt: true,
        dueDate: true,
        status: true,
        isRefundEntry: true,
        paymentInstrumentId: true,
        invoiceMatchLineId: true,
        cashAccountId: true,
        financialAccountId: true,
        partner: { select: { id: true, name: true } },
        paymentInstrumentRef: { select: { id: true, name: true, cardLast4: true } },
        financialAccount: { select: { id: true, name: true } },
      },
    });

    const totalCents = entries.reduce((acc, e) => acc + (e.netCents || e.grossCents || 0), 0);
    return { entries, totalCents };
  }

  /**
   * Concilia uma linha do extrato com N entries (fatura de cartao).
   * A soma dos entries tem que bater com o valor absoluto da linha.
   */
  async matchAsCardInvoice(
    lineId: string,
    companyId: string,
    dto: MatchCardInvoiceDto,
    matchedByName: string,
  ) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (line.status === 'MATCHED') {
      throw new BadRequestException('Linha já está conciliada.');
    }
    if (line.amountCents >= 0) {
      throw new BadRequestException('Apenas linhas de débito (valor negativo) podem ser conciliadas como fatura de cartão.');
    }
    if (!dto.entryIds || dto.entryIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um lançamento.');
    }

    const entries = await this.prisma.financialEntry.findMany({
      where: {
        id: { in: dto.entryIds },
        companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        type: true,
        netCents: true,
        grossCents: true,
        cashAccountId: true,
        paymentInstrumentId: true,
        invoiceMatchLineId: true,
        financialAccountId: true,
        isRefundEntry: true,
      },
    });

    if (entries.length !== dto.entryIds.length) {
      throw new BadRequestException('Um ou mais lançamentos não foram encontrados.');
    }

    // Indexa atribuicoes de plano de contas (se informadas)
    const assignmentsByEntry = new Map<string, string>();
    for (const a of dto.entryAccountAssignments || []) {
      assignmentsByEntry.set(a.entryId, a.financialAccountId);
    }

    // Validacao do plano de contas (se empresa usa)
    const usesChart = await this.companyUsesChartOfAccounts(companyId);
    const accountIdsToValidate = Array.from(new Set(
      [...assignmentsByEntry.values()].filter(Boolean),
    ));
    if (accountIdsToValidate.length > 0) {
      const validAccounts = await this.prisma.financialAccount.findMany({
        where: {
          id: { in: accountIdsToValidate },
          companyId,
          isActive: true,
          allowPosting: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (validAccounts.length !== accountIdsToValidate.length) {
        throw new BadRequestException('Um ou mais planos de contas informados são inválidos ou inativos.');
      }
    }

    // Protecao: nenhum dos entries pode estar conciliado com outra linha (1:1 match)
    const conflictingMatch = await this.prisma.bankStatementLine.findFirst({
      where: {
        matchedEntryId: { in: dto.entryIds },
        status: 'MATCHED',
        id: { not: lineId },
      },
      select: {
        id: true,
        transactionDate: true,
        description: true,
        matchedEntryId: true,
      },
    });
    if (conflictingMatch) {
      const dateStr = conflictingMatch.transactionDate.toLocaleDateString('pt-BR');
      throw new BadRequestException(
        `Lançamento ${conflictingMatch.matchedEntryId} já está conciliado com outra linha ` +
        `(${dateStr} — ${conflictingMatch.description}). ` +
        `Remova-o da seleção ou desfaça a conciliação anterior.`,
      );
    }

    for (const e of entries) {
      if (e.status === 'CANCELLED') {
        throw new BadRequestException(`Lançamento ${e.id} está cancelado — não pode compor fatura.`);
      }
      if (e.invoiceMatchLineId && e.invoiceMatchLineId !== lineId) {
        throw new BadRequestException(`Lançamento ${e.id} já está vinculado a outra fatura conciliada.`);
      }
      if (!e.paymentInstrumentId) {
        throw new BadRequestException(`Lançamento ${e.id} não tem instrumento de pagamento — não pode compor fatura.`);
      }
      // Validacao de plano: se empresa usa e entry nao tem e nao foi passado no DTO, bloqueia
      if (usesChart && !e.isRefundEntry && !e.financialAccountId && !assignmentsByEntry.has(e.id)) {
        throw new BadRequestException(
          `Lançamento ${e.id} não tem plano de contas definido. Informe antes de conciliar.`,
        );
      }
    }

    const entriesTotal = entries.reduce((acc, e) => acc + (e.netCents || e.grossCents || 0), 0);
    const lineAbs = Math.abs(line.amountCents);
    const diff = Math.abs(entriesTotal - lineAbs);
    // Tolerancia de 1 centavo (arredondamento)
    if (diff > 1) {
      throw new BadRequestException(
        `Soma dos lançamentos (R$ ${(entriesTotal / 100).toFixed(2)}) não bate com valor da fatura (R$ ${(lineAbs / 100).toFixed(2)}). Diferença: R$ ${(diff / 100).toFixed(2)}.`,
      );
    }

    const tsLog = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Pre-computa destino de saldo por entry: usa cashAccountId (virtual do cartao)
    // ou, se nao tiver (entries historicos pre-Fase 2), busca via paymentInstrument
    const instrumentsToFetch = Array.from(new Set(
      entries.filter((e) => !e.cashAccountId && e.paymentInstrumentId).map((e) => e.paymentInstrumentId as string),
    ));
    const instrumentAccounts = new Map<string, string | null>();
    if (instrumentsToFetch.length > 0) {
      const pis = await this.prisma.paymentInstrument.findMany({
        where: { id: { in: instrumentsToFetch }, companyId },
        select: { id: true, cashAccountId: true },
      });
      for (const pi of pis) instrumentAccounts.set(pi.id, pi.cashAccountId);
    }

    const resolveDestAccount = (e: { cashAccountId: string | null; paymentInstrumentId: string | null }): string | null => {
      if (e.cashAccountId) return e.cashAccountId;
      if (e.paymentInstrumentId) return instrumentAccounts.get(e.paymentInstrumentId) ?? null;
      return null;
    };

    return this.prisma.$transaction(async (tx) => {
      // Creditos acumulados por conta destino — aplicados no final como transferencia consolidada
      const creditByAccount = new Map<string, number>();

      for (const e of entries) {
        const amount = e.netCents || e.grossCents || 0;
        const destAccountId = resolveDestAccount(e);

        const entryUpdate: Record<string, unknown> = { invoiceMatchLineId: lineId };
        if (assignmentsByEntry.has(e.id)) {
          entryUpdate.financialAccountId = assignmentsByEntry.get(e.id)!;
        }

        const wasPending = e.status === 'PENDING' || e.status === 'CONFIRMED';
        if (wasPending) {
          entryUpdate.status = 'PAID';
          entryUpdate.paidAt = line.transactionDate;
          entryUpdate.autoMarkedPaid = true;
          entryUpdate.notes = `[${tsLog}] PAGO via fatura de cartão conciliada (linha ${line.id.substring(0, 8)})`;
          // Se entry garante cashAccount destino, entra na conta virtual como divida (decrement)
          if (destAccountId) {
            await tx.cashAccount.update({
              where: { id: destAccountId },
              data: { currentBalanceCents: { decrement: amount } },
            });
            // entry tambem recebe a cashAccountId (pra refletir onde o dinheiro foi "contabilizado")
            if (!e.cashAccountId) entryUpdate.cashAccountId = destAccountId;
          }
        }

        // Acumula credito pra conta destino (vai zerar divida na transferencia final)
        if (destAccountId) {
          creditByAccount.set(destAccountId, (creditByAccount.get(destAccountId) || 0) + amount);
        }

        await tx.financialEntry.update({
          where: { id: e.id },
          data: entryUpdate,
        });
      }

      // Transferencia consolidada via AccountTransfer (banco → cada conta de cartao).
      // AccountTransfer e rastreavel pelo balance-compare (via transferDate), diferente de decrement direto.
      const bankAccountId = line.cashAccountId;
      for (const [cardAccountId, amount] of creditByAccount.entries()) {
        await tx.accountTransfer.create({
          data: {
            companyId,
            fromAccountId: bankAccountId,
            toAccountId: cardAccountId,
            amountCents: amount,
            description: `Fatura cartao — conciliacao linha ${line.id.substring(0, 8)}`,
            transferDate: line.transactionDate,
            createdByName: matchedByName,
          },
        });
      }
      // Atualiza saldos: debita banco, credita cada conta de cartao
      await tx.cashAccount.update({
        where: { id: bankAccountId },
        data: { currentBalanceCents: { decrement: lineAbs } },
      });
      for (const [cardAccountId, amount] of creditByAccount.entries()) {
        await tx.cashAccount.update({
          where: { id: cardAccountId },
          data: { currentBalanceCents: { increment: amount } },
        });
      }

      const updated = await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'MATCHED',
          isCardInvoice: true,
          matchedAt: new Date(),
          matchedByName,
          notes: dto.notes ?? null,
        },
      });
      await this.recalcCounts(tx, line.importId, line.statementId);
      return { ...updated, entriesCount: dto.entryIds.length, entriesTotalCents: entriesTotal };
    });
  }

  /**
   * Concilia uma linha do extrato com N entries (PIX/boleto/transferencia — NAO cartao).
   * Direcao pelo sinal da linha: credito → RECEIVABLE; debito → PAYABLE.
   * Soma dos entries tem que bater com o valor absoluto da linha.
   * Entries PENDING/CONFIRMED viram PAID automaticamente; saldo do banco e atualizado.
   */
  async matchAsMultiple(
    lineId: string,
    companyId: string,
    dto: MatchCardInvoiceDto,
    matchedByName: string,
  ) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (line.status === 'MATCHED') {
      throw new BadRequestException('Linha já está conciliada.');
    }
    if (!dto.entryIds || dto.entryIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um lançamento.');
    }

    const expectedType: 'RECEIVABLE' | 'PAYABLE' = line.amountCents >= 0 ? 'RECEIVABLE' : 'PAYABLE';

    const entries = await this.prisma.financialEntry.findMany({
      where: { id: { in: dto.entryIds }, companyId, deletedAt: null },
      select: {
        id: true,
        status: true,
        type: true,
        netCents: true,
        grossCents: true,
        cashAccountId: true,
        invoiceMatchLineId: true,
        financialAccountId: true,
        isRefundEntry: true,
      },
    });
    if (entries.length !== dto.entryIds.length) {
      throw new BadRequestException('Um ou mais lançamentos não foram encontrados.');
    }

    // Indexa atribuicoes de plano de contas
    const assignmentsByEntry = new Map<string, string>();
    for (const a of dto.entryAccountAssignments || []) {
      assignmentsByEntry.set(a.entryId, a.financialAccountId);
    }
    const usesChart = await this.companyUsesChartOfAccounts(companyId);
    const accountIdsToValidate = Array.from(new Set(
      [...assignmentsByEntry.values()].filter(Boolean),
    ));
    if (accountIdsToValidate.length > 0) {
      const validAccounts = await this.prisma.financialAccount.findMany({
        where: { id: { in: accountIdsToValidate }, companyId, isActive: true, allowPosting: true, deletedAt: null },
        select: { id: true },
      });
      if (validAccounts.length !== accountIdsToValidate.length) {
        throw new BadRequestException('Um ou mais planos de contas informados são inválidos ou inativos.');
      }
    }

    // Proteção: nenhum entry pode estar conciliado em outra linha 1:1
    const conflictingMatch = await this.prisma.bankStatementLine.findFirst({
      where: { matchedEntryId: { in: dto.entryIds }, status: 'MATCHED', id: { not: lineId } },
      select: { id: true, transactionDate: true, description: true, matchedEntryId: true },
    });
    if (conflictingMatch) {
      const dateStr = conflictingMatch.transactionDate.toLocaleDateString('pt-BR');
      throw new BadRequestException(
        `Lançamento ${conflictingMatch.matchedEntryId} já conciliado com outra linha ` +
        `(${dateStr} — ${conflictingMatch.description}). Remova da seleção ou desfaça.`,
      );
    }

    for (const e of entries) {
      if (e.status === 'CANCELLED') {
        throw new BadRequestException(`Lançamento ${e.id} está cancelado.`);
      }
      if (e.type !== expectedType) {
        throw new BadRequestException(
          `Lançamento ${e.id} é ${e.type} mas linha ${line.amountCents >= 0 ? 'crédito' : 'débito'} exige ${expectedType}.`,
        );
      }
      if (e.invoiceMatchLineId && e.invoiceMatchLineId !== lineId) {
        throw new BadRequestException(`Lançamento ${e.id} já vinculado a outra conciliação múltipla.`);
      }
      if (usesChart && !e.isRefundEntry && !e.financialAccountId && !assignmentsByEntry.has(e.id)) {
        throw new BadRequestException(
          `Lançamento ${e.id} sem plano de contas. Informe antes de conciliar.`,
        );
      }
    }

    const entriesTotal = entries.reduce((acc, e) => acc + (e.netCents || e.grossCents || 0), 0);
    const lineAbs = Math.abs(line.amountCents);
    const diff = Math.abs(entriesTotal - lineAbs);
    if (diff > 1) {
      throw new BadRequestException(
        `Soma dos lançamentos (R$ ${(entriesTotal / 100).toFixed(2)}) não bate com o valor da linha (R$ ${(lineAbs / 100).toFixed(2)}). Diferença: R$ ${(diff / 100).toFixed(2)}.`,
      );
    }

    const tsLog = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    return this.prisma.$transaction(async (tx) => {
      for (const e of entries) {
        const amount = e.netCents || e.grossCents || 0;
        const entryUpdate: Record<string, unknown> = { invoiceMatchLineId: lineId };
        if (assignmentsByEntry.has(e.id)) {
          entryUpdate.financialAccountId = assignmentsByEntry.get(e.id)!;
        }
        const wasPending = e.status === 'PENDING' || e.status === 'CONFIRMED';
        if (wasPending) {
          entryUpdate.status = 'PAID';
          entryUpdate.paidAt = line.transactionDate;
          entryUpdate.autoMarkedPaid = true;
          entryUpdate.cashAccountId = line.cashAccountId;
          entryUpdate.notes = `[${tsLog}] PAGO via conciliação múltipla (linha ${line.id.substring(0, 8)})`;
        }
        await tx.financialEntry.update({ where: { id: e.id }, data: entryUpdate });
        // Ignora entries ja PAID — nao afetam saldo agora (saldo foi afetado quando foram pagos).
        // TODO: se era PAID e cashAccountId era diferente, idealmente faria AccountTransfer.
        // Por ora: linha = agrupa os existentes sem mover saldo.
      }

      // Saldo do banco: total dos entries que estavam PENDING (os PAID nao afetam — ja foram contabilizados antes)
      const pendingTotal = entries
        .filter((e) => e.status === 'PENDING' || e.status === 'CONFIRMED')
        .reduce((acc, e) => acc + (e.netCents || e.grossCents || 0), 0);
      if (pendingTotal > 0) {
        const delta = expectedType === 'RECEIVABLE' ? pendingTotal : -pendingTotal;
        await tx.cashAccount.update({
          where: { id: line.cashAccountId },
          data: { currentBalanceCents: { increment: delta } },
        });
      }

      const updated = await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'MATCHED',
          isCardInvoice: false,
          matchedAt: new Date(),
          matchedByName,
          notes: dto.notes ?? null,
        },
      });
      await this.recalcCounts(tx, line.importId, line.statementId);
      return { ...updated, entriesCount: dto.entryIds.length, entriesTotalCents: entriesTotal };
    });
  }

  /**
   * matchAsTransfer — Concilia linha do extrato criando uma AccountTransfer.
   * Uso: depositos em dinheiro (Caixa -> Banco), saques (Banco -> Caixa), transferencias entre contas proprias.
   *
   * Logica de direcao (respeita o sinal da linha):
   *  - line.amountCents > 0 (credito): dinheiro ENTROU na conta do extrato.
   *    -> transfer: sourceAccountId (origem externa) -> line.cashAccountId (conta do extrato)
   *    -> saldo: source -= amount, target += amount
   *  - line.amountCents < 0 (debito): dinheiro SAIU da conta do extrato.
   *    -> transfer: line.cashAccountId (conta do extrato) -> sourceAccountId (destino externo)
   *    -> saldo: source (extrato) -= amount, target (externo) += amount
   */
  async matchAsTransfer(
    lineId: string,
    companyId: string,
    dto: MatchAsTransferDto,
    matchedByName: string,
  ) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (line.status !== 'UNMATCHED') {
      throw new BadRequestException('Apenas linhas não conciliadas podem ser conciliadas como transferência.');
    }
    if (!dto.sourceAccountId) {
      throw new BadRequestException('Conta de origem/destino da transferência é obrigatória.');
    }
    if (dto.sourceAccountId === line.cashAccountId) {
      throw new BadRequestException('A conta de origem deve ser diferente da conta do extrato.');
    }

    // Valida que a outra conta existe, pertence a empresa e esta ativa
    const otherAccount = await this.prisma.cashAccount.findFirst({
      where: { id: dto.sourceAccountId, companyId, deletedAt: null },
      select: { id: true, name: true, isActive: true, type: true },
    });
    if (!otherAccount) {
      throw new NotFoundException('Conta de origem/destino não encontrada.');
    }
    if (!otherAccount.isActive) {
      throw new BadRequestException('Conta de origem/destino está inativa.');
    }

    const absAmount = Math.abs(line.amountCents);
    if (absAmount <= 0) {
      throw new BadRequestException('Valor da linha inválido.');
    }

    // Direcao da transferencia conforme sinal da linha
    const isCredit = line.amountCents > 0;
    const fromAccountId = isCredit ? dto.sourceAccountId : line.cashAccountId;
    const toAccountId = isCredit ? line.cashAccountId : dto.sourceAccountId;

    const description = dto.description?.trim()
      || (isCredit
        ? `Depósito / transferência recebida (${line.description})`
        : `Saque / transferência enviada (${line.description})`);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cria a AccountTransfer
      const transfer = await tx.accountTransfer.create({
        data: {
          companyId,
          fromAccountId,
          toAccountId,
          amountCents: absAmount,
          description,
          transferDate: line.transactionDate,
          createdByName: matchedByName,
        },
      });

      // 2. Atualiza saldos das duas contas
      await tx.cashAccount.update({
        where: { id: fromAccountId },
        data: { currentBalanceCents: { decrement: absAmount } },
      });
      await tx.cashAccount.update({
        where: { id: toAccountId },
        data: { currentBalanceCents: { increment: absAmount } },
      });

      // 3. Marca a linha como MATCHED vinculada a transferencia
      const updatedLine = await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'MATCHED',
          transferMatchId: transfer.id,
          matchedAt: new Date(),
          matchedByName,
          notes: dto.notes ?? null,
        },
      });

      await this.recalcCounts(tx, line.importId, line.statementId);

      return { ...updatedLine, transfer };
    });

    this.logger.log(
      `Linha ${lineId} conciliada como transferência: ${fromAccountId} -> ${toAccountId} ` +
      `(R$${(absAmount / 100).toFixed(2)})`,
    );

    return result;
  }

  /**
   * Unmatch (revert) a matched line. For refund pairs, unmatches BOTH lines and
   * deletes the two technical entries that were created.
   */
  async unmatchLine(lineId: string, companyId: string) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (line.status !== 'MATCHED') {
      throw new BadRequestException('Linha não está conciliada.');
    }

    // Transferencia (deposito em dinheiro, etc): reverte saldos e deleta a AccountTransfer
    if (line.transferMatchId) {
      const transfer = await this.prisma.accountTransfer.findUnique({
        where: { id: line.transferMatchId },
      });
      await this.prisma.$transaction(async (tx) => {
        if (transfer) {
          // Reverte saldos: origem recupera, destino perde
          await tx.cashAccount.update({
            where: { id: transfer.fromAccountId },
            data: { currentBalanceCents: { increment: transfer.amountCents } },
          });
          await tx.cashAccount.update({
            where: { id: transfer.toAccountId },
            data: { currentBalanceCents: { decrement: transfer.amountCents } },
          });
          // Deleta a transfer (FK ON DELETE SET NULL limpa transferMatchId na linha, mas reescrevemos abaixo)
          await tx.accountTransfer.delete({ where: { id: transfer.id } });
        }
        await tx.bankStatementLine.update({
          where: { id: lineId },
          data: {
            status: 'UNMATCHED',
            transferMatchId: null,
            matchedAt: null,
            matchedByName: null,
            notes: null,
          },
        });
        await this.recalcCounts(tx, line.importId, line.statementId);
      });
      return { id: line.id, status: 'UNMATCHED' as const, unmatchedTransfer: true };
    }

    // Fatura de cartao: desfaz o grupo (zera invoiceMatchLineId; reverte status de entries auto-pagos;
    // desfaz a transferencia de saldo banco->contas virtuais)
    if (line.isCardInvoice) {
      const groupEntries = await this.prisma.financialEntry.findMany({
        where: { invoiceMatchLineId: lineId, companyId },
        select: { id: true, autoMarkedPaid: true, cashAccountId: true, paymentInstrumentId: true, netCents: true, grossCents: true },
      });
      const autoPaidIds = groupEntries.filter((e) => e.autoMarkedPaid).map((e) => e.id);
      const otherIds = groupEntries.filter((e) => !e.autoMarkedPaid).map((e) => e.id);

      // Resolve conta destino por entry (pode ter fallback via instrument)
      const instrumentsToFetch = Array.from(new Set(
        groupEntries.filter((e) => !e.cashAccountId && e.paymentInstrumentId).map((e) => e.paymentInstrumentId as string),
      ));
      const instrumentAccounts = new Map<string, string | null>();
      if (instrumentsToFetch.length > 0) {
        const pis = await this.prisma.paymentInstrument.findMany({
          where: { id: { in: instrumentsToFetch }, companyId },
          select: { id: true, cashAccountId: true },
        });
        for (const pi of pis) instrumentAccounts.set(pi.id, pi.cashAccountId);
      }
      const resolveDestAccount = (e: { cashAccountId: string | null; paymentInstrumentId: string | null }): string | null => {
        if (e.cashAccountId) return e.cashAccountId;
        if (e.paymentInstrumentId) return instrumentAccounts.get(e.paymentInstrumentId) ?? null;
        return null;
      };

      const lineAbs = Math.abs(line.amountCents);

      await this.prisma.$transaction(async (tx) => {
        // 0. Deletar AccountTransfers criados pelo matchAsCardInvoice (rastreabilidade)
        const linePrefix = lineId.substring(0, 8);
        await tx.accountTransfer.deleteMany({
          where: {
            companyId,
            fromAccountId: line.cashAccountId,
            description: { contains: linePrefix },
          },
        });

        // 1. Reverte transferencia consolidada (banco += total, contas destino -= por entry)
        await tx.cashAccount.update({
          where: { id: line.cashAccountId },
          data: { currentBalanceCents: { increment: lineAbs } },
        });
        for (const e of groupEntries) {
          const amount = e.netCents || e.grossCents || 0;
          const destAccountId = resolveDestAccount(e);
          if (destAccountId) {
            await tx.cashAccount.update({
              where: { id: destAccountId },
              data: { currentBalanceCents: { decrement: amount } },
            });
          }
        }

        // 2. Para entries que o match auto-marcou como PAID: re-incrementa destino (desfaz o decrement do match)
        //    Isso deixa saldo liquido = 0 na destino pra esses entries
        for (const e of groupEntries) {
          if (!e.autoMarkedPaid) continue;
          const amount = e.netCents || e.grossCents || 0;
          const destAccountId = resolveDestAccount(e);
          if (destAccountId) {
            await tx.cashAccount.update({
              where: { id: destAccountId },
              data: { currentBalanceCents: { increment: amount } },
            });
          }
        }

        // 3. Reverte status + limpa campos nos entries auto-pagos
        if (autoPaidIds.length > 0) {
          await tx.financialEntry.updateMany({
            where: { id: { in: autoPaidIds }, companyId },
            data: {
              invoiceMatchLineId: null,
              status: 'PENDING',
              paidAt: null,
              autoMarkedPaid: false,
            },
          });
        }
        // 4. Entries que ja estavam PAID antes do match: so remove o vinculo com a fatura
        if (otherIds.length > 0) {
          await tx.financialEntry.updateMany({
            where: { id: { in: otherIds }, companyId },
            data: { invoiceMatchLineId: null },
          });
        }
        await tx.bankStatementLine.update({
          where: { id: lineId },
          data: {
            status: 'UNMATCHED',
            isCardInvoice: false,
            matchedAt: null,
            matchedByName: null,
            notes: null,
          },
        });
        await this.recalcCounts(tx, line.importId, line.statementId);
      });
      return { id: line.id, status: 'UNMATCHED' as const, unmatchedCardInvoice: true, revertedPending: autoPaidIds.length };
    }

    // Refund pair: unmatch both lines + delete both technical entries
    if (line.isRefund && line.refundPairLineId) {
      const pairLine = await this.prisma.bankStatementLine.findUnique({
        where: { id: line.refundPairLineId },
      });
      await this.prisma.$transaction(async (tx) => {
        // Delete technical entries (not soft delete — they never existed outside this pair)
        const entryIds = [line.matchedEntryId, pairLine?.matchedEntryId].filter(Boolean) as string[];
        if (entryIds.length > 0) {
          // Break circular FK first
          await tx.financialEntry.updateMany({
            where: { id: { in: entryIds } },
            data: { refundPairEntryId: null },
          });
          await tx.financialEntry.deleteMany({
            where: { id: { in: entryIds }, isRefundEntry: true, companyId },
          });
        }
        // Reset both lines
        await tx.bankStatementLine.updateMany({
          where: { id: { in: [line.id, ...(pairLine ? [pairLine.id] : [])] } },
          data: {
            status: 'UNMATCHED',
            matchedEntryId: null,
            matchedInstallmentId: null,
            matchedAt: null,
            matchedByName: null,
            matchedLiquidCents: null,
            matchedTaxCents: null,
            refundPairLineId: null,
            isRefund: false,
            notes: null,
          },
        });
        // Update matchedCount on imports + statements
        const pairs = Array.from(new Set([
          `${line.importId}|${line.statementId || ''}`,
          pairLine ? `${pairLine.importId}|${pairLine.statementId || ''}` : null,
        ].filter(Boolean) as string[])).map((s) => s.split('|'));
        for (const [impId, stmtId] of pairs) {
          await this.recalcCounts(tx, impId, stmtId || null);
        }
      });
      return { id: line.id, status: 'UNMATCHED' as const, unmatchedRefundPair: true };
    }

    const bankAccountId = line.cashAccountId;
    const transferAmount = Math.abs(line.amountCents);
    const linePrefix = line.id.substring(0, 8);

    // v1.09.94: Detecta qual fluxo foi usado no match:
    // - Se existe AccountTransfer com description apontando pra essa linha -> fluxo com transito
    // - Senao -> fluxo legado (entry foi movido direto pro banco)
    if (line.matchedEntryId) {
      const entry = await this.prisma.financialEntry.findUnique({
        where: { id: line.matchedEntryId },
        select: { cashAccountId: true, autoMarkedPaid: true, grossCents: true, type: true },
      });

      const autoTransfer = await this.prisma.accountTransfer.findFirst({
        where: {
          companyId,
          description: { contains: `linha ${linePrefix}` },
        },
        select: { id: true, fromAccountId: true, toAccountId: true, amountCents: true },
      });

      const autoTaxEntry = await this.prisma.financialEntry.findFirst({
        where: {
          companyId,
          type: 'PAYABLE',
          isRefundEntry: true,
          description: { contains: `linha ${linePrefix}` },
          deletedAt: null,
        },
        select: { id: true, cashAccountId: true, netCents: true },
      });

      if (entry?.autoMarkedPaid && autoTransfer) {
        // v1.09.94: Fluxo novo - PENDING virou PAID com auto-transfer VT -> banco.
        // Reverter: transfer, receita adicionada em VT, entry de taxa, voltar entry pra PENDING.
        // 1) Reverter transfer
        await this.prisma.cashAccount.update({
          where: { id: autoTransfer.fromAccountId },
          data: { currentBalanceCents: { increment: autoTransfer.amountCents } },
        });
        await this.prisma.cashAccount.update({
          where: { id: autoTransfer.toAccountId },
          data: { currentBalanceCents: { decrement: autoTransfer.amountCents } },
        });
        await this.prisma.accountTransfer.delete({ where: { id: autoTransfer.id } });

        // 2) Reverter receita que foi adicionada a conta origem (VT) no match
        if (entry.cashAccountId && entry.grossCents > 0) {
          await this.prisma.cashAccount.update({
            where: { id: entry.cashAccountId },
            data: {
              currentBalanceCents: entry.type === 'RECEIVABLE'
                ? { decrement: entry.grossCents }
                : { increment: entry.grossCents },
            },
          });
        }

        // 3) Reverter entry de taxa (se existir)
        if (autoTaxEntry) {
          await this.prisma.cashAccount.update({
            where: { id: autoTaxEntry.cashAccountId! },
            data: { currentBalanceCents: { increment: autoTaxEntry.netCents } },
          });
          await this.prisma.financialEntry.delete({ where: { id: autoTaxEntry.id } });
        }

        // 4) Volta entry pra PENDING (preserva cashAccountId — era conta original)
        await this.prisma.financialEntry.update({
          where: { id: line.matchedEntryId },
          data: {
            status: 'PENDING',
            paidAt: null,
            autoMarkedPaid: false,
          },
        });
      } else if (entry?.autoMarkedPaid) {
        // Fluxo legado pre v1.09.94: PENDING -> PAID, entry foi direto pro banco.
        // Reverter saldo do banco + deletar entry de taxa (criada no banco).
        await this.prisma.cashAccount.update({
          where: { id: bankAccountId },
          data: { currentBalanceCents: { decrement: line.amountCents } },
        });

        if (autoTaxEntry) {
          // v1.09.70: no fluxo legado, saldo do banco ja recebeu o liquido,
          // a entry de taxa NAO decrementou saldo adicional — so deletar.
          await this.prisma.financialEntry.delete({ where: { id: autoTaxEntry.id } });
        } else if (line.matchedTaxCents && line.matchedTaxCents > 0) {
          // Fallback: busca por matchedTaxCents (entries antigos sem description padronizada)
          const legacyTaxEntry = await this.prisma.financialEntry.findFirst({
            where: {
              companyId,
              type: 'PAYABLE',
              isRefundEntry: true,
              description: { contains: `linha ${linePrefix}` },
              cashAccountId: bankAccountId,
              netCents: line.matchedTaxCents,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (legacyTaxEntry) {
            await this.prisma.financialEntry.delete({ where: { id: legacyTaxEntry.id } });
          }
        }

        await this.prisma.financialEntry.update({
          where: { id: line.matchedEntryId },
          data: {
            status: 'PENDING',
            paidAt: null,
            cashAccountId: null,
            autoMarkedPaid: false,
          },
        });
      } else if (autoTransfer) {
        // v1.09.94: Entry ja era PAID antes do match, houve auto-transfer (fluxo B novo ou antigo).
        // Reverter transfer e entry de taxa. NAO mover entry (pode ter ficado em VT ou no banco).
        await this.prisma.cashAccount.update({
          where: { id: autoTransfer.fromAccountId },
          data: { currentBalanceCents: { increment: autoTransfer.amountCents } },
        });
        await this.prisma.cashAccount.update({
          where: { id: autoTransfer.toAccountId },
          data: { currentBalanceCents: { decrement: autoTransfer.amountCents } },
        });
        await this.prisma.accountTransfer.delete({ where: { id: autoTransfer.id } });

        if (autoTaxEntry) {
          await this.prisma.cashAccount.update({
            where: { id: autoTaxEntry.cashAccountId! },
            data: { currentBalanceCents: { increment: autoTaxEntry.netCents } },
          });
          await this.prisma.financialEntry.delete({ where: { id: autoTaxEntry.id } });
        }

        // Fluxo antigo movia entry pro banco — se esta no banco, volta pro transit pra compatibilidade
        if (entry?.cashAccountId === bankAccountId) {
          const transitAccount = await this.prisma.cashAccount.findFirst({
            where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
            select: { id: true },
          });
          if (transitAccount) {
            await this.prisma.financialEntry.update({
              where: { id: line.matchedEntryId },
              data: { cashAccountId: transitAccount.id },
            });
          }
        }
      } else if (entry?.cashAccountId === bankAccountId) {
        // Fluxo legado sem auto-transfer rastreavel: desfaz o transfer implicito via saldo
        const transitAccount = await this.prisma.cashAccount.findFirst({
          where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
          select: { id: true },
        });
        if (transitAccount) {
          const isCredit = line.amountCents > 0;
          if (isCredit) {
            await this.prisma.cashAccount.update({
              where: { id: bankAccountId },
              data: { currentBalanceCents: { decrement: transferAmount } },
            });
            await this.prisma.cashAccount.update({
              where: { id: transitAccount.id },
              data: { currentBalanceCents: { increment: transferAmount } },
            });
          } else {
            await this.prisma.cashAccount.update({
              where: { id: bankAccountId },
              data: { currentBalanceCents: { increment: transferAmount } },
            });
            await this.prisma.cashAccount.update({
              where: { id: transitAccount.id },
              data: { currentBalanceCents: { decrement: transferAmount } },
            });
          }
          await this.prisma.financialEntry.update({
            where: { id: line.matchedEntryId },
            data: { cashAccountId: transitAccount.id },
          });
        }
      }
    }

    const updated = await this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: {
        status: 'UNMATCHED',
        matchedEntryId: null,
        matchedInstallmentId: null,
        matchedAt: null,
        matchedByName: null,
        matchedLiquidCents: null,
        matchedTaxCents: null,
        notes: null,
      },
    });

    await this.recalcCounts(this.prisma, line.importId, line.statementId);

    return updated;
  }

  /**
   * Unignore a statement line (revert to UNMATCHED)
   */
  async unignoreLine(lineId: string, companyId: string) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }
    if (line.status !== 'IGNORED') {
      throw new BadRequestException('Apenas linhas ignoradas podem ser revertidas.');
    }
    const updated = await this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { status: 'UNMATCHED', notes: null },
    });
    await this.recalcCounts(this.prisma, line.importId, line.statementId);
    return updated;
  }

  /**
   * Ignore a statement line
   */
  async ignoreLine(lineId: string, companyId: string, notes?: string) {
    const line = await this.prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { import: { select: { companyId: true } } },
    });
    if (!line || line.import.companyId !== companyId) {
      throw new NotFoundException('Linha não encontrada.');
    }

    const updated = await this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: {
        status: 'IGNORED',
        notes: notes ?? null,
      },
    });
    await this.recalcCounts(this.prisma, line.importId, line.statementId);
    return updated;
  }

  /**
   * Auto-reconciliation: match imported lines with financial entries by exact amount
   */
  private async tryAutoReconciliation(companyId: string, importId: string, matchedByName: string) {
    // Check if auto-reconciliation is enabled
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    const config = (company?.systemConfig as Record<string, any>) || {};
    if (!config?.financial?.autoReconciliation) return;

    // Get unmatched lines from this import
    const lines = await this.prisma.bankStatementLine.findMany({
      where: { importId, status: 'UNMATCHED' },
    });
    if (lines.length === 0) return;

    // Get paid entries assigned to transit account (most common reconciliation source)
    const transitAccount = await this.prisma.cashAccount.findFirst({
      where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
      select: { id: true },
    });

    let autoMatchCount = 0;

    for (const line of lines) {
      const absAmount = Math.abs(line.amountCents);
      const entryType = line.amountCents >= 0 ? 'RECEIVABLE' : 'PAYABLE';

      // Find entries with exact amount match, same type, paid status
      const candidates = await this.prisma.financialEntry.findMany({
        where: {
          companyId,
          type: entryType,
          status: 'PAID',
          netCents: absAmount,
          deletedAt: null,
          // Only match entries that aren't already reconciled to a bank
          ...(transitAccount ? { cashAccountId: transitAccount.id } : {}),
        },
        select: { id: true, paidAt: true },
        orderBy: { paidAt: 'desc' },
      });

      if (candidates.length !== 1) continue; // Only auto-match when exactly 1 candidate (unambiguous)

      const entry = candidates[0];

      try {
        await this.matchLine(line.id, companyId, { entryId: entry.id }, `${matchedByName} (auto)`);
        autoMatchCount++;
      } catch {
        // Skip if match fails (e.g., already matched)
      }
    }

    if (autoMatchCount > 0) {
      this.logger.log(`Auto-reconciled ${autoMatchCount} lines for import ${importId}`);
    }
  }
}
