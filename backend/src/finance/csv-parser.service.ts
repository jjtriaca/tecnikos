import { Injectable, BadRequestException } from '@nestjs/common';

export interface CsvTransaction {
  transactionDate: Date;
  amountCents: number;
  description: string;
}

@Injectable()
export class CsvParserService {
  /**
   * Parse CSV bank statement content
   * Supports common Brazilian bank formats:
   * - Date;Description;Amount (semicolon-separated)
   * - Date,Description,Amount (comma-separated)
   *
   * The parser auto-detects the separator and date/amount columns.
   */
  parse(content: string): CsvTransaction[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV deve ter pelo menos um cabeçalho e uma linha de dados.');
    }

    // Detect separator
    const separator = lines[0].includes(';') ? ';' : ',';

    // Parse header
    const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase().replace(/"/g, ''));

    // Try to find columns
    const dateCol = this.findColumnIndex(headers, ['data', 'date', 'dt', 'dtmovimento', 'dt_movimento', 'dt.movimento']);
    const descCol = this.findColumnIndex(headers, ['descricao', 'description', 'desc', 'historico', 'memo', 'lancamento', 'descrição']);
    const amountCol = this.findColumnIndex(headers, ['valor', 'amount', 'vlr', 'value', 'montante', 'vlrmovimento']);

    if (dateCol === -1 || descCol === -1 || amountCol === -1) {
      throw new BadRequestException(
        'CSV não reconhecido. Certifique-se que possui colunas de Data, Descrição e Valor. ' +
        `Cabeçalhos encontrados: ${headers.join(', ')}`,
      );
    }

    const transactions: CsvTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.splitCsvLine(lines[i], separator);
      if (cols.length <= Math.max(dateCol, descCol, amountCol)) continue;

      const dateStr = cols[dateCol].replace(/"/g, '').trim();
      const description = cols[descCol].replace(/"/g, '').trim();
      const amountStr = cols[amountCol].replace(/"/g, '').trim();

      if (!dateStr || !description) continue;

      const transactionDate = this.parseBrDate(dateStr);
      const amountCents = this.parseAmount(amountStr);

      if (transactionDate && !isNaN(amountCents)) {
        transactions.push({ transactionDate, amountCents, description });
      }
    }

    if (transactions.length === 0) {
      throw new BadRequestException('Nenhuma transação válida encontrada no CSV.');
    }

    return transactions;
  }

  private findColumnIndex(headers: string[], candidates: string[]): number {
    for (const c of candidates) {
      const idx = headers.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  private splitCsvLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Parse Brazilian date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
   */
  private parseBrDate(str: string): Date | null {
    // Try DD/MM/YYYY or DD-MM-YYYY
    const brMatch = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (brMatch) {
      return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
    }
    // Try YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
    return null;
  }

  /**
   * Parse Brazilian amount format: 1.234,56 or -1234.56
   */
  private parseAmount(str: string): number {
    let cleaned = str.replace(/\s/g, '');
    // Brazilian format: 1.234,56 → 1234.56
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      cleaned = cleaned.replace(',', '.');
    }
    const val = parseFloat(cleaned);
    return Math.round(val * 100);
  }
}
