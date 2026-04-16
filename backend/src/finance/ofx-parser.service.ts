import { Injectable, BadRequestException } from '@nestjs/common';

export interface OfxTransaction {
  fitId: string;
  transactionDate: Date;
  amountCents: number;
  description: string;
  checkNum?: string;
  refNum?: string;
}

export interface OfxParseResult {
  transactions: OfxTransaction[];
  // Saldo reportado pelo banco (LEDGERBAL) e a data de referencia desse saldo
  statementBalanceCents: number | null;
  statementBalanceDate: Date | null;
  // Periodo do extrato (DTSTART / DTEND do BANKTRANLIST)
  periodStart: Date | null;
  periodEnd: Date | null;
}

@Injectable()
export class OfxParserService {
  /**
   * Parse OFX file content and extract transactions + saldo do banco (LEDGERBAL).
   * Uses regex-based extraction instead of XML parser to handle SGML-style OFX reliably.
   * Retorna array direto pra compat com codigo antigo; use parseWithMeta() pra metadados.
   */
  parse(content: string): OfxTransaction[] {
    return this.parseWithMeta(content).transactions;
  }

  /**
   * Parse com metadados completos (saldo + periodo + transacoes).
   */
  parseWithMeta(content: string): OfxParseResult {
    try {
      // Find OFX content
      const ofxStart = content.indexOf('<OFX');
      if (ofxStart === -1) {
        throw new BadRequestException('Arquivo OFX inválido: tag <OFX> não encontrada.');
      }
      const ofxContent = content.substring(ofxStart);

      // Extract LEDGERBAL block (saldo atual do banco)
      const ledgerBlocks = this.extractBlocks(ofxContent, 'LEDGERBAL');
      let statementBalanceCents: number | null = null;
      let statementBalanceDate: Date | null = null;
      if (ledgerBlocks.length > 0) {
        const balBlock = ledgerBlocks[0];
        const balAmt = this.extractValue(balBlock, 'BALAMT');
        const dtAsof = this.extractValue(balBlock, 'DTASOF');
        if (balAmt) {
          statementBalanceCents = Math.round(parseFloat(balAmt) * 100);
        }
        if (dtAsof) {
          statementBalanceDate = this.parseOfxDate(dtAsof);
        }
      }

      // Extract period (DTSTART, DTEND)
      let periodStart: Date | null = null;
      let periodEnd: Date | null = null;
      const dtStart = this.extractValue(ofxContent, 'DTSTART');
      const dtEnd = this.extractValue(ofxContent, 'DTEND');
      if (dtStart) periodStart = this.parseOfxDate(dtStart);
      if (dtEnd) periodEnd = this.parseOfxDate(dtEnd);

      // Extract all STMTTRN blocks using regex (handles both SGML and XML styles)
      const transactionBlocks = this.extractBlocks(ofxContent, 'STMTTRN');
      if (transactionBlocks.length === 0) {
        // Try to find BANKTRANLIST to verify OFX structure
        if (!ofxContent.includes('BANKTRANLIST') && !ofxContent.includes('CCSTMTRS')) {
          throw new BadRequestException('Arquivo OFX não contém dados de extrato bancário.');
        }
        return { transactions: [], statementBalanceCents, statementBalanceDate, periodStart, periodEnd };
      }

      const transactions: OfxTransaction[] = [];

      for (const block of transactionBlocks) {
        const fitId = this.extractValue(block, 'FITID');
        const dateStr = this.extractValue(block, 'DTPOSTED');
        const amountStr = this.extractValue(block, 'TRNAMT');
        const memo = this.extractValue(block, 'MEMO') || this.extractValue(block, 'NAME') || '';
        const checkNum = this.extractValue(block, 'CHECKNUM') || undefined;
        const refNum = this.extractValue(block, 'REFNUM') || undefined;

        if (!fitId) continue;

        const transactionDate = this.parseOfxDate(dateStr);
        const amount = parseFloat(amountStr || '0');
        const amountCents = Math.round(amount * 100);

        transactions.push({
          fitId: fitId.trim(),
          transactionDate,
          amountCents,
          description: memo.trim(),
          checkNum,
          refNum,
        });
      }

      return { transactions, statementBalanceCents, statementBalanceDate, periodStart, periodEnd };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Erro ao processar arquivo OFX: ${(err as Error).message}`);
    }
  }

  /**
   * Extract value of a tag from OFX content.
   * Handles both SGML style (<TAG>value) and XML style (<TAG>value</TAG>).
   */
  private extractValue(content: string, tag: string): string {
    // Try XML style first: <TAG>value</TAG>
    const xmlRegex = new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`, 'i');
    const xmlMatch = content.match(xmlRegex);
    if (xmlMatch) return xmlMatch[1].trim();

    // Try SGML style: <TAG>value\n or <TAG>value<NEXT_TAG>
    const sgmlRegex = new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, 'i');
    const sgmlMatch = content.match(sgmlRegex);
    if (sgmlMatch) return sgmlMatch[1].trim();

    return '';
  }

  /**
   * Extract all blocks between <tag> and </tag> markers.
   */
  private extractBlocks(content: string, tag: string): string[] {
    const blocks: string[] = [];
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;
    let pos = 0;

    while (true) {
      const start = content.indexOf(openTag, pos);
      if (start === -1) break;

      const end = content.indexOf(closeTag, start);
      if (end === -1) {
        // SGML style: no closing tag. Find next STMTTRN or end of BANKTRANLIST
        const nextOpen = content.indexOf(openTag, start + openTag.length);
        const listEnd = content.indexOf('</BANKTRANLIST>', start);
        const blockEnd = nextOpen !== -1 ? nextOpen : (listEnd !== -1 ? listEnd : content.length);
        blocks.push(content.substring(start, blockEnd));
        pos = blockEnd;
      } else {
        blocks.push(content.substring(start, end + closeTag.length));
        pos = end + closeTag.length;
      }
    }

    return blocks;
  }

  private parseOfxDate(dateStr: string): Date {
    if (!dateStr || dateStr.length < 8) return new Date();
    // Remove timezone info like [-3:BRT]
    const clean = dateStr.replace(/\[.*\]/, '').trim();
    const year = parseInt(clean.substring(0, 4));
    const month = parseInt(clean.substring(4, 6)) - 1;
    const day = parseInt(clean.substring(6, 8));
    let hours = 0, minutes = 0, seconds = 0;
    if (clean.length >= 14) {
      hours = parseInt(clean.substring(8, 10));
      minutes = parseInt(clean.substring(10, 12));
      seconds = parseInt(clean.substring(12, 14));
    }
    return new Date(year, month, day, hours, minutes, seconds);
  }
}
