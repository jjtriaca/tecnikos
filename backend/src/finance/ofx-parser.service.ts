import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface OfxTransaction {
  fitId: string;
  transactionDate: Date;
  amountCents: number;
  description: string;
  checkNum?: string;
  refNum?: string;
}

@Injectable()
export class OfxParserService {
  /**
   * Parse OFX file content and extract transactions
   */
  parse(content: string): OfxTransaction[] {
    try {
      // OFX files have SGML headers before the XML — strip them
      const xmlStart = content.indexOf('<OFX');
      if (xmlStart === -1) {
        throw new BadRequestException('Arquivo OFX inválido: tag <OFX> não encontrada.');
      }

      let xmlContent = content.substring(xmlStart);

      // OFX SGML uses self-closing tags without slash: <TAG>value
      // We need to close unclosed tags for the XML parser to work
      // Strategy: replace <TAG>value<NEXTTAG> patterns
      xmlContent = this.fixSgmlTags(xmlContent);

      const parser = new XMLParser({
        ignoreAttributes: false,
        isArray: (name) => name === 'STMTTRN',
        trimValues: true,
      });

      const parsed = parser.parse(xmlContent);

      // Navigate to transaction list
      // OFX structure: OFX > BANKMSGSRSV1 > STMTTRNRS > STMTRS > BANKTRANLIST > STMTTRN[]
      const stmtrs =
        parsed?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS ??
        parsed?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS;

      if (!stmtrs) {
        throw new BadRequestException('Arquivo OFX não contém dados de extrato bancário.');
      }

      const tranList = stmtrs.BANKTRANLIST;
      if (!tranList || !tranList.STMTTRN) {
        return [];
      }

      const transactions: OfxTransaction[] = [];
      const stmtTrns = Array.isArray(tranList.STMTTRN) ? tranList.STMTTRN : [tranList.STMTTRN];

      for (const trn of stmtTrns) {
        const fitId = String(trn.FITID || '');
        const dateStr = String(trn.DTPOSTED || '');
        const amount = parseFloat(trn.TRNAMT || '0');
        const memo = String(trn.MEMO || trn.NAME || '');
        const checkNum = trn.CHECKNUM ? String(trn.CHECKNUM) : undefined;
        const refNum = trn.REFNUM ? String(trn.REFNUM) : undefined;

        // Parse OFX date format: YYYYMMDD[HHmmss[.XXX]]
        const transactionDate = this.parseOfxDate(dateStr);
        const amountCents = Math.round(amount * 100);

        if (fitId) {
          transactions.push({
            fitId,
            transactionDate,
            amountCents,
            description: memo.trim(),
            checkNum,
            refNum,
          });
        }
      }

      return transactions;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Erro ao processar arquivo OFX: ${(err as Error).message}`);
    }
  }

  private parseOfxDate(dateStr: string): Date {
    if (!dateStr || dateStr.length < 8) return new Date();
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    let hours = 0, minutes = 0, seconds = 0;
    if (dateStr.length >= 14) {
      hours = parseInt(dateStr.substring(8, 10));
      minutes = parseInt(dateStr.substring(10, 12));
      seconds = parseInt(dateStr.substring(12, 14));
    }
    return new Date(year, month, day, hours, minutes, seconds);
  }

  /**
   * Fix SGML-style tags by closing unclosed elements
   */
  private fixSgmlTags(content: string): string {
    // Known leaf elements in OFX that contain values (not nested)
    const leafTags = [
      'TRNTYPE', 'DTPOSTED', 'DTUSER', 'DTSTART', 'DTEND', 'TRNAMT',
      'FITID', 'CHECKNUM', 'REFNUM', 'NAME', 'MEMO', 'BANKID',
      'ACCTID', 'ACCTTYPE', 'BALAMT', 'DTASOF', 'CURDEF', 'CODE',
      'SEVERITY', 'MESSAGE', 'TRNUID', 'CLIENTCOOKIE', 'SRVRTID',
      'BRANCHID', 'DTSERVER', 'LANGUAGE', 'ORG', 'FID',
    ];

    for (const tag of leafTags) {
      // Match <TAG>value (no closing tag)
      const regex = new RegExp(`<${tag}>([^<]*)(?!</${tag}>)`, 'gi');
      content = content.replace(regex, `<${tag}>$1</${tag}>`);
    }

    return content;
  }
}
