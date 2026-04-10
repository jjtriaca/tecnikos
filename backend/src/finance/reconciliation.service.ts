import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { MatchLineDto, MatchAsRefundDto } from './dto/reconciliation.dto';
import { CodeGeneratorService } from '../common/code-generator.service';

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
   * Import a bank statement file (OFX or CSV)
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
    const ofxTransactions = isOfx ? this.ofxParser.parse(fileContent) : [];
    const csvTransactions = isOfx ? [] : this.csvParser.parse(fileContent);
    const totalCount = isOfx ? ofxTransactions.length : csvTransactions.length;

    if (totalCount === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo.');
    }

    // Create import record and lines in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const importRecord = await tx.bankStatementImport.create({
        data: {
          companyId,
          cashAccountId,
          fileName,
          fileType,
          importedByName,
          lineCount: totalCount,
          matchedCount: 0,
        },
      });

      // Check for duplicate FITIDs if OFX
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

      type LineData = {
        importId: string;
        cashAccountId: string;
        transactionDate: Date;
        description: string;
        amountCents: number;
        fitId: string | null;
        checkNum: string | null;
        refNum: string | null;
        status: 'UNMATCHED';
      };

      let lines: LineData[];

      if (isOfx) {
        lines = ofxTransactions
          .filter((t) => !existingFitIds.has(t.fitId))
          .map((t) => ({
            importId: importRecord.id,
            cashAccountId,
            transactionDate: t.transactionDate,
            description: t.description,
            amountCents: t.amountCents,
            fitId: t.fitId,
            checkNum: t.checkNum ?? null,
            refNum: t.refNum ?? null,
            status: 'UNMATCHED' as const,
          }));
      } else {
        lines = csvTransactions.map((t) => ({
          importId: importRecord.id,
          cashAccountId,
          transactionDate: t.transactionDate,
          description: t.description,
          amountCents: t.amountCents,
          fitId: null,
          checkNum: null,
          refNum: null,
          status: 'UNMATCHED' as const,
        }));
      }

      if (lines.length > 0) {
        await tx.bankStatementLine.createMany({ data: lines });
      }

      // Update line count to reflect actual inserted (minus duplicates)
      await tx.bankStatementImport.update({
        where: { id: importRecord.id },
        data: { lineCount: lines.length },
      });

      return {
        ...importRecord,
        lineCount: lines.length,
        skippedDuplicates: totalCount - lines.length,
      };
    });

    // Auto-reconciliation (async, non-blocking)
    this.tryAutoReconciliation(companyId, result.id, importedByName).catch((err) => {
      this.logger.error(`Auto-reconciliation failed for import ${result.id}: ${err.message}`);
    });

    return result;
  }

  /**
   * List all imports for a company
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
   *
   * For each UNMATCHED line, tries to find a candidate "paired" line in the same
   * import that looks like a refund: opposite sign, same absolute value, similar
   * counterparty name, within 60 days. Returns `suggestedPairLineId` as a virtual
   * field so the frontend can show a "Possivel estorno" badge.
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

    // Also fetch ALL lines of the import (not just filtered) to detect pairs even
    // when user filters by status. Pair detection uses only UNMATCHED candidates.
    const allLines = status
      ? await this.prisma.bankStatementLine.findMany({
          where: { importId },
          orderBy: { transactionDate: 'desc' },
        })
      : lines;

    const unmatched = allLines.filter((l) => l.status === 'UNMATCHED');

    // Build pair suggestions (symmetric map): for each unmatched line, find best
    // candidate with opposite sign, same absolute value, similar name, <60 days apart.
    const suggestions = new Map<string, string>(); // lineId -> suggestedPairId
    for (const a of unmatched) {
      if (suggestions.has(a.id)) continue; // already paired
      let best: { id: string; score: number } | null = null;
      for (const b of unmatched) {
        if (b.id === a.id) continue;
        if (suggestions.has(b.id)) continue;
        // Opposite sign
        if ((a.amountCents > 0) === (b.amountCents > 0)) continue;
        // Same absolute value (tolerance 1 cent)
        if (Math.abs(Math.abs(a.amountCents) - Math.abs(b.amountCents)) > 1) continue;
        // Within 60 days
        const daysApart = Math.abs(
          (new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysApart > 60) continue;
        // Score: lower is better. Name similarity bonus, date penalty.
        const nameScore = this.counterpartyNameSimilarity(a.description, b.description);
        const score = daysApart - nameScore * 10;
        if (!best || score < best.score) {
          best = { id: b.id, score };
        }
      }
      if (best) {
        suggestions.set(a.id, best.id);
        suggestions.set(best.id, a.id); // symmetric
      }
    }

    // Attach suggestedPairLineId (virtual) to each returned line
    return lines.map((l) => ({
      ...l,
      suggestedPairLineId: suggestions.get(l.id) || null,
    }));
  }

  /**
   * Extract the counterparty name token from a bank statement description and
   * return a similarity score [0..1] between two descriptions.
   *
   * Bank lines look like "RECEBIMENTO PIX-PIX_CRED 01768906106 CATIUCIA L SECHI PATRICIO"
   * and "DEVOLUCAO PIX-PIX_DEB 01768906106 CATIUCIA L SECHI PATRICIO".
   * We strip the prefix/codes and compare the rest (usually the name).
   */
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
   * Match a statement line to an entry or installment
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

    const updated = await this.prisma.bankStatementLine.update({
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

    // Update matched count on import
    const matchedCount = await this.prisma.bankStatementLine.count({
      where: { importId: line.importId, status: 'MATCHED' },
    });
    await this.prisma.bankStatementImport.update({
      where: { id: line.importId },
      data: { matchedCount },
    });

    // Auto-transfer from transit/source account to bank account on reconciliation
    if (dto.entryId) {
      const entry = await this.prisma.financialEntry.findUnique({
        where: { id: dto.entryId },
        select: { cashAccountId: true, netCents: true, grossCents: true, type: true },
      });
      const bankAccountId = line.cashAccountId; // from OFX import

      // Determine source account: entry's current account, or find transit account as fallback
      let sourceAccountId = entry?.cashAccountId;
      if (!sourceAccountId || sourceAccountId === bankAccountId) {
        // Find the transit account by type
        const transitAccount = await this.prisma.cashAccount.findFirst({
          where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
          select: { id: true },
        });
        sourceAccountId = transitAccount?.id || null;
      }

      if (sourceAccountId && sourceAccountId !== bankAccountId) {
        const transferAmount = Math.abs(line.amountCents);
        const isCredit = line.amountCents > 0; // credit = money INTO bank, debit = money OUT of bank

        if (isCredit) {
          // Credit (receivable): money moves Transit → Bank
          await this.prisma.cashAccount.update({
            where: { id: sourceAccountId },
            data: { currentBalanceCents: { decrement: transferAmount } },
          });
          await this.prisma.cashAccount.update({
            where: { id: bankAccountId },
            data: { currentBalanceCents: { increment: transferAmount } },
          });
        } else {
          // Debit (payable): money moves Bank → Transit (bank decreases, transit increases)
          await this.prisma.cashAccount.update({
            where: { id: bankAccountId },
            data: { currentBalanceCents: { decrement: transferAmount } },
          });
          await this.prisma.cashAccount.update({
            where: { id: sourceAccountId },
            data: { currentBalanceCents: { increment: transferAmount } },
          });
        }
        // Update entry's cashAccountId to the bank
        await this.prisma.financialEntry.update({
          where: { id: dto.entryId },
          data: { cashAccountId: bankAccountId },
        });
      }
    }

    return updated;
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

      // Update matchedCount on both imports (could be same import)
      const importIds = Array.from(new Set([entryLine.importId, exitLine.importId]));
      for (const impId of importIds) {
        const matchedCount = await tx.bankStatementLine.count({
          where: { importId: impId, status: 'MATCHED' },
        });
        await tx.bankStatementImport.update({
          where: { id: impId },
          data: { matchedCount },
        });
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
        // Update matchedCount on import(s)
        const importIds = Array.from(new Set([line.importId, pairLine?.importId].filter(Boolean) as string[]));
        for (const impId of importIds) {
          const matchedCount = await tx.bankStatementLine.count({
            where: { importId: impId, status: 'MATCHED' },
          });
          await tx.bankStatementImport.update({
            where: { id: impId },
            data: { matchedCount },
          });
        }
      });
      return { id: line.id, status: 'UNMATCHED' as const, unmatchedRefundPair: true };
    }

    const bankAccountId = line.cashAccountId;
    const transferAmount = Math.abs(line.amountCents);

    // Revert the auto-transfer if entry was moved to the bank
    if (line.matchedEntryId) {
      const entry = await this.prisma.financialEntry.findUnique({
        where: { id: line.matchedEntryId },
        select: { cashAccountId: true },
      });
      // If entry is now pointing to bank, revert it to transit
      if (entry?.cashAccountId === bankAccountId) {
        // Find the transit account (the one that lost the money)
        const transitAccount = await this.prisma.cashAccount.findFirst({
          where: { companyId, deletedAt: null, isActive: true, type: 'TRANSITO' },
          select: { id: true },
        });
        if (transitAccount) {
          const isCredit = line.amountCents > 0;
          if (isCredit) {
            // Revert credit: bank -amount, transit +amount
            await this.prisma.cashAccount.update({
              where: { id: bankAccountId },
              data: { currentBalanceCents: { decrement: transferAmount } },
            });
            await this.prisma.cashAccount.update({
              where: { id: transitAccount.id },
              data: { currentBalanceCents: { increment: transferAmount } },
            });
          } else {
            // Revert debit: bank +amount, transit -amount
            await this.prisma.cashAccount.update({
              where: { id: bankAccountId },
              data: { currentBalanceCents: { increment: transferAmount } },
            });
            await this.prisma.cashAccount.update({
              where: { id: transitAccount.id },
              data: { currentBalanceCents: { decrement: transferAmount } },
            });
          }
          // Move entry back to transit
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

    const matchedCount = await this.prisma.bankStatementLine.count({
      where: { importId: line.importId, status: 'MATCHED' },
    });
    await this.prisma.bankStatementImport.update({
      where: { id: line.importId },
      data: { matchedCount },
    });

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
    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { status: 'UNMATCHED', notes: null },
    });
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

    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: {
        status: 'IGNORED',
        notes: notes ?? null,
      },
    });
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
