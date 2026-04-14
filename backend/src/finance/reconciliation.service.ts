import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfxParserService } from './ofx-parser.service';
import { CsvParserService } from './csv-parser.service';
import { MatchLineDto, MatchAsRefundDto, MatchCardInvoiceDto } from './dto/reconciliation.dto';
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
   * Extract year/month in Brazil timezone (America/Sao_Paulo).
   * Used to partition transactions into monthly statements.
   */
  private getBrazilianPeriod(date: Date): { year: number; month: number } {
    // Brazil is UTC-3 (no DST since 2019). Shift by -3h then read UTC components.
    const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1, // 1..12
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
    const ofxTransactions = isOfx ? this.ofxParser.parse(fileContent) : [];
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

        // Update statement: bump lineCount, refresh last* (overwrite fileName)
        await tx.bankStatement.update({
          where: { id: statement.id },
          data: {
            lineCount: { increment: txs.length },
            lastImportAt: new Date(),
            lastImportByName: importedByName,
            lastFileName: fileName,
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

    await this.recalcCounts(this.prisma, line.importId, line.statementId);

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
      status: 'PAID',
      type: 'PAYABLE',
      paymentInstrumentId: { in: paymentInstrumentIds },
    };
    if (!includeAlreadyMatched) {
      where.invoiceMatchLineId = null;
    }
    if (fromDate || toDate) {
      const range: Record<string, Date> = {};
      if (fromDate) range.gte = new Date(`${fromDate}T00:00:00.000-03:00`);
      if (toDate) range.lte = new Date(`${toDate}T23:59:59.999-03:00`);
      where.paidAt = range;
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
        paymentInstrumentId: true,
        invoiceMatchLineId: true,
        cashAccountId: true,
        partner: { select: { id: true, name: true } },
        paymentInstrumentRef: { select: { id: true, name: true, cardLast4: true } },
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
        paymentInstrumentId: true,
        invoiceMatchLineId: true,
      },
    });

    if (entries.length !== dto.entryIds.length) {
      throw new BadRequestException('Um ou mais lançamentos não foram encontrados.');
    }

    for (const e of entries) {
      if (e.status !== 'PAID') {
        throw new BadRequestException(`Lançamento ${e.id} não está como PAGO — não pode compor fatura.`);
      }
      if (e.invoiceMatchLineId && e.invoiceMatchLineId !== lineId) {
        throw new BadRequestException(`Lançamento ${e.id} já está vinculado a outra fatura conciliada.`);
      }
      if (!e.paymentInstrumentId) {
        throw new BadRequestException(`Lançamento ${e.id} não tem instrumento de pagamento — não pode compor fatura.`);
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

    return this.prisma.$transaction(async (tx) => {
      await tx.financialEntry.updateMany({
        where: { id: { in: dto.entryIds }, companyId },
        data: { invoiceMatchLineId: lineId },
      });
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

    // Fatura de cartao: desfaz o grupo (zera invoiceMatchLineId dos entries)
    if (line.isCardInvoice) {
      await this.prisma.$transaction(async (tx) => {
        await tx.financialEntry.updateMany({
          where: { invoiceMatchLineId: lineId, companyId },
          data: { invoiceMatchLineId: null },
        });
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
      return { id: line.id, status: 'UNMATCHED' as const, unmatchedCardInvoice: true };
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
