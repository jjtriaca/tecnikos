import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { MatchLineDto } from './dto/reconciliation.dto';

@Injectable()
export class ReconciliationService {
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
    return this.prisma.$transaction(async (tx) => {
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

    const updated = await this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: {
        status: 'UNMATCHED',
        matchedEntryId: null,
        matchedInstallmentId: null,
        matchedAt: null,
        matchedByName: null,
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
}
