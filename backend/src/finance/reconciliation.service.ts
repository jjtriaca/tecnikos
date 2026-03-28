import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { MatchLineDto } from './dto/reconciliation.dto';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ofxParser: OfxParserService,
    private readonly csvParser: CsvParserService,
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
   * List statement lines for an import
   */
  async findLines(importId: string, companyId: string, status?: string) {
    // Verify the import belongs to this company
    const imp = await this.prisma.bankStatementImport.findFirst({
      where: { id: importId, companyId },
    });
    if (!imp) throw new NotFoundException('Importação não encontrada.');

    const where: Record<string, unknown> = { importId };
    if (status) where.status = status;

    return this.prisma.bankStatementLine.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
    });
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
   * Unmatch (revert) a matched line
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
