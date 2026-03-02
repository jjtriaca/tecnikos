import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

/* ══════════════════════════════════════════════════════════════════════
   Parsed types returned by NfeParserService
   ══════════════════════════════════════════════════════════════════════ */

export interface ParsedNfeItem {
  itemNumber: number;
  productCode: string;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface ParsedNfe {
  nfeNumber: string;
  nfeSeries: string;
  nfeKey: string | null;
  issueDate: string; // ISO string
  supplier: {
    cnpj: string;
    name: string;
  };
  items: ParsedNfeItem[];
  totalCents: number;
}

/* ══════════════════════════════════════════════════════════════════════
   Service — parses Brazilian NFe XML (authorized + standalone formats)
   ══════════════════════════════════════════════════════════════════════ */

@Injectable()
export class NfeParserService {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Parse NFe XML content and return a structured ParsedNfe object.
   * Handles both `nfeProc` (authorized envelope) and standalone `NFe` formats.
   */
  parse(xmlContent: string): ParsedNfe {
    let parsed: any;
    try {
      parsed = this.parser.parse(xmlContent);
    } catch (err) {
      throw new BadRequestException('XML inválido: não foi possível fazer o parse do conteúdo');
    }

    // Resolve the NFe node — authorized (nfeProc > NFe) or standalone (NFe)
    const nfeProc = parsed.nfeProc ?? parsed['ns0:nfeProc'] ?? null;
    const nfeNode = nfeProc?.NFe ?? parsed.NFe ?? null;

    if (!nfeNode) {
      throw new BadRequestException('XML inválido: elemento <NFe> não encontrado');
    }

    const infNFe = nfeNode.infNFe;
    if (!infNFe) {
      throw new BadRequestException('XML inválido: elemento <infNFe> não encontrado');
    }

    // ── IDE (identification) ─────────────────────────────────────────
    const ide = infNFe.ide;
    if (!ide) {
      throw new BadRequestException('XML inválido: elemento <ide> não encontrado');
    }

    const nfeNumber = String(ide.nNF ?? '');
    const nfeSeries = String(ide.serie ?? '');
    const issueDate = String(ide.dhEmi ?? '');

    // ── NFe Key (chave de acesso) ────────────────────────────────────
    let nfeKey: string | null = null;

    // Try protNFe (authorized envelope)
    const protNFe = nfeProc?.protNFe ?? null;
    if (protNFe?.infProt?.chNFe) {
      nfeKey = String(protNFe.infProt.chNFe);
    }

    // Fallback: infNFe @_Id attribute (e.g. "NFe35...")
    if (!nfeKey && infNFe['@_Id']) {
      const idAttr = String(infNFe['@_Id']);
      nfeKey = idAttr.replace(/^NFe/, '');
    }

    // ── Emitente (supplier) ──────────────────────────────────────────
    const emit = infNFe.emit;
    if (!emit) {
      throw new BadRequestException('XML inválido: elemento <emit> não encontrado');
    }

    const supplierCnpj = String(emit.CNPJ ?? emit.CPF ?? '');
    const supplierName = String(emit.xNome ?? '');

    // ── Items (det) ──────────────────────────────────────────────────
    const detRaw = infNFe.det;
    // Handle single item (object) vs multiple items (array)
    const detArray: any[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

    if (detArray.length === 0) {
      throw new BadRequestException('XML inválido: nenhum item (det) encontrado');
    }

    const items: ParsedNfeItem[] = detArray.map((det) => {
      const prod = det.prod;
      if (!prod) {
        throw new BadRequestException('XML inválido: elemento <prod> não encontrado em item');
      }

      const itemNumber = Number(det['@_nItem'] ?? 0);
      const productCode = String(prod.cProd ?? '');
      const description = String(prod.xProd ?? '');
      const ncm = String(prod.NCM ?? '');
      const cfop = String(prod.CFOP ?? '');
      const unit = String(prod.uCom ?? 'UN');
      const quantity = parseFloat(String(prod.qCom ?? '0'));
      const unitPriceCents = this.toCents(String(prod.vUnCom ?? '0'));
      const totalCents = this.toCents(String(prod.vProd ?? '0'));

      return {
        itemNumber,
        productCode,
        description,
        ncm,
        cfop,
        unit,
        quantity,
        unitPriceCents,
        totalCents,
      };
    });

    // ── Total ────────────────────────────────────────────────────────
    const total = infNFe.total;
    const vNF = total?.ICMSTot?.vNF ?? '0';
    const totalCents = this.toCents(String(vNF));

    return {
      nfeNumber,
      nfeSeries,
      nfeKey,
      issueDate,
      supplier: {
        cnpj: supplierCnpj,
        name: supplierName,
      },
      items,
      totalCents,
    };
  }

  /* ── Helper: convert BRL string to centavos ──────────────────────── */

  private toCents(value: string): number {
    return Math.round(parseFloat(value) * 100);
  }
}
