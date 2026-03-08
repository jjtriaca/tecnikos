import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

/* ══════════════════════════════════════════════════════════════════════
   Parsed types returned by NfeParserService
   ══════════════════════════════════════════════════════════════════════ */

export interface ParsedNfeItemTax {
  // ICMS
  cstIcms: string | null;
  modBcIcms: number | null;
  baseIcmsCents: number | null;
  aliqIcms: number | null;
  icmsCents: number | null;
  // ICMS-ST
  baseIcmsStCents: number | null;
  aliqIcmsSt: number | null;
  icmsStCents: number | null;
  // IPI
  cstIpi: string | null;
  baseIpiCents: number | null;
  aliqIpi: number | null;
  ipiCents: number | null;
  // PIS
  cstPis: string | null;
  basePisCents: number | null;
  aliqPis: number | null;
  pisCents: number | null;
  // COFINS
  cstCofins: string | null;
  baseCofinsCents: number | null;
  aliqCofins: number | null;
  cofinsCents: number | null;
  // Others
  freteCents: number | null;
  seguroCents: number | null;
  descontoCents: number | null;
  outrasDespCents: number | null;
}

export interface ParsedNfeItem extends ParsedNfeItemTax {
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

export interface ParsedNfeTotals {
  baseIcmsCents: number | null;
  icmsCents: number | null;
  baseIcmsStCents: number | null;
  icmsStCents: number | null;
  ipiCents: number | null;
  pisCents: number | null;
  cofinsCents: number | null;
  freteCents: number | null;
  seguroCents: number | null;
  descontoCents: number | null;
  outrasDespCents: number | null;
}

export interface ParsedNfe {
  nfeNumber: string;
  nfeSeries: string;
  nfeKey: string | null;
  issueDate: string; // ISO string
  // IDE fiscal fields
  indOper: number | null;  // 0=Entrada, 1=Saída
  finNfe: number | null;   // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  // Supplier
  supplier: {
    cnpj: string;
    name: string;
  };
  items: ParsedNfeItem[];
  totalCents: number;
  // Fiscal totals
  totals: ParsedNfeTotals;
  // Additional info
  infCpl: string | null;
}

/* ══════════════════════════════════════════════════════════════════════
   Service — parses Brazilian NFe XML (authorized + standalone formats)
   Now extracts all tax fields (ICMS, IPI, PIS, COFINS, ST)
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
   * Extracts all tax fields needed for SPED generation.
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
    const indOper = ide.tpNF != null ? Number(ide.tpNF) : null;
    const finNfe = ide.finNFe != null ? Number(ide.finNFe) : null;

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

    // CNPJ/CPF: fast-xml-parser may parse as number, dropping leading zeros — pad back
    let supplierCnpj = '';
    if (emit.CNPJ != null) {
      supplierCnpj = String(emit.CNPJ).padStart(14, '0');
    } else if (emit.CPF != null) {
      supplierCnpj = String(emit.CPF).padStart(11, '0');
    }
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
      const freteCents = prod.vFrete ? this.toCents(String(prod.vFrete)) : null;
      const seguroCents = prod.vSeg ? this.toCents(String(prod.vSeg)) : null;
      const descontoCents = prod.vDesc ? this.toCents(String(prod.vDesc)) : null;
      const outrasDespCents = prod.vOutro ? this.toCents(String(prod.vOutro)) : null;

      // ── Extract taxes from imposto node ──
      const imposto = det.imposto;
      const taxData = this.extractItemTaxes(imposto);

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
        freteCents,
        seguroCents,
        descontoCents,
        outrasDespCents,
        ...taxData,
      };
    });

    // ── Totals ──────────────────────────────────────────────────────
    const total = infNFe.total;
    const icmsTot = total?.ICMSTot;
    const vNF = icmsTot?.vNF ?? '0';
    const totalCents = this.toCents(String(vNF));

    const totals: ParsedNfeTotals = {
      baseIcmsCents: icmsTot?.vBC ? this.toCents(String(icmsTot.vBC)) : null,
      icmsCents: icmsTot?.vICMS ? this.toCents(String(icmsTot.vICMS)) : null,
      baseIcmsStCents: icmsTot?.vBCST ? this.toCents(String(icmsTot.vBCST)) : null,
      icmsStCents: icmsTot?.vST ? this.toCents(String(icmsTot.vST)) : null,
      ipiCents: icmsTot?.vIPI ? this.toCents(String(icmsTot.vIPI)) : null,
      pisCents: icmsTot?.vPIS ? this.toCents(String(icmsTot.vPIS)) : null,
      cofinsCents: icmsTot?.vCOFINS ? this.toCents(String(icmsTot.vCOFINS)) : null,
      freteCents: icmsTot?.vFrete ? this.toCents(String(icmsTot.vFrete)) : null,
      seguroCents: icmsTot?.vSeg ? this.toCents(String(icmsTot.vSeg)) : null,
      descontoCents: icmsTot?.vDesc ? this.toCents(String(icmsTot.vDesc)) : null,
      outrasDespCents: icmsTot?.vOutro ? this.toCents(String(icmsTot.vOutro)) : null,
    };

    // ── Additional info ────────────────────────────────────────────
    const infAdic = infNFe.infAdic;
    const infCpl = infAdic?.infCpl ? String(infAdic.infCpl) : null;

    return {
      nfeNumber,
      nfeSeries,
      nfeKey,
      issueDate,
      indOper,
      finNfe,
      supplier: {
        cnpj: supplierCnpj,
        name: supplierName,
      },
      items,
      totalCents,
      totals,
      infCpl,
    };
  }

  /* ── Extract ICMS tax data from item ──────────────────────────────── */

  private extractIcms(icmsNode: any): {
    cstIcms: string | null;
    modBcIcms: number | null;
    baseIcmsCents: number | null;
    aliqIcms: number | null;
    icmsCents: number | null;
    baseIcmsStCents: number | null;
    aliqIcmsSt: number | null;
    icmsStCents: number | null;
  } {
    if (!icmsNode) {
      return {
        cstIcms: null, modBcIcms: null, baseIcmsCents: null,
        aliqIcms: null, icmsCents: null, baseIcmsStCents: null,
        aliqIcmsSt: null, icmsStCents: null,
      };
    }

    // ICMS has multiple sub-elements: ICMS00, ICMS10, ICMS20, ICMS30, ICMS40,
    // ICMS51, ICMS60, ICMS70, ICMS90, ICMSSN101, ICMSSN102, ICMSSN201,
    // ICMSSN202, ICMSSN500, ICMSSN900
    const icmsKeys = [
      'ICMS00', 'ICMS02', 'ICMS10', 'ICMS15', 'ICMS20', 'ICMS30',
      'ICMS40', 'ICMS41', 'ICMS50', 'ICMS51', 'ICMS53', 'ICMS60',
      'ICMS61', 'ICMS70', 'ICMS90',
      'ICMSSN101', 'ICMSSN102', 'ICMSSN201', 'ICMSSN202',
      'ICMSSN500', 'ICMSSN900',
    ];

    let icmsData: any = null;
    for (const key of icmsKeys) {
      if (icmsNode[key]) {
        icmsData = icmsNode[key];
        break;
      }
    }

    if (!icmsData) {
      return {
        cstIcms: null, modBcIcms: null, baseIcmsCents: null,
        aliqIcms: null, icmsCents: null, baseIcmsStCents: null,
        aliqIcmsSt: null, icmsStCents: null,
      };
    }

    // Determine CST — for SN it's CSOSN, for Normal it's orig + CST
    let cstIcms: string | null = null;
    if (icmsData.CSOSN != null) {
      // Simples Nacional: CSOSN (3 digits for ICMSSN, e.g. "101", "500")
      cstIcms = String(icmsData.CSOSN).padStart(3, '0');
    } else if (icmsData.CST != null) {
      // Normal: orig (1 digit) + CST (2 digits) = 3 digits
      const orig = String(icmsData.orig ?? '0');
      const cst = String(icmsData.CST).padStart(2, '0');
      cstIcms = orig + cst;
    }

    return {
      cstIcms,
      modBcIcms: icmsData.modBC != null ? Number(icmsData.modBC) : null,
      baseIcmsCents: icmsData.vBC ? this.toCents(String(icmsData.vBC)) : null,
      aliqIcms: icmsData.pICMS != null ? parseFloat(String(icmsData.pICMS)) : null,
      icmsCents: icmsData.vICMS ? this.toCents(String(icmsData.vICMS)) : null,
      baseIcmsStCents: icmsData.vBCST ? this.toCents(String(icmsData.vBCST)) : null,
      aliqIcmsSt: icmsData.pICMSST != null ? parseFloat(String(icmsData.pICMSST)) : null,
      icmsStCents: icmsData.vICMSST ? this.toCents(String(icmsData.vICMSST)) : null,
    };
  }

  /* ── Extract IPI tax data from item ───────────────────────────────── */

  private extractIpi(ipiNode: any): {
    cstIpi: string | null;
    baseIpiCents: number | null;
    aliqIpi: number | null;
    ipiCents: number | null;
  } {
    if (!ipiNode) {
      return { cstIpi: null, baseIpiCents: null, aliqIpi: null, ipiCents: null };
    }

    // IPI has IPITrib (taxed) or IPINT (not taxed)
    const ipiTrib = ipiNode.IPITrib;
    const ipiNt = ipiNode.IPINT;

    if (ipiTrib) {
      return {
        cstIpi: ipiTrib.CST != null ? String(ipiTrib.CST).padStart(2, '0') : null,
        baseIpiCents: ipiTrib.vBC ? this.toCents(String(ipiTrib.vBC)) : null,
        aliqIpi: ipiTrib.pIPI != null ? parseFloat(String(ipiTrib.pIPI)) : null,
        ipiCents: ipiTrib.vIPI ? this.toCents(String(ipiTrib.vIPI)) : null,
      };
    }

    if (ipiNt) {
      return {
        cstIpi: ipiNt.CST != null ? String(ipiNt.CST).padStart(2, '0') : null,
        baseIpiCents: null,
        aliqIpi: null,
        ipiCents: null,
      };
    }

    return { cstIpi: null, baseIpiCents: null, aliqIpi: null, ipiCents: null };
  }

  /* ── Extract PIS tax data from item ───────────────────────────────── */

  private extractPis(pisNode: any): {
    cstPis: string | null;
    basePisCents: number | null;
    aliqPis: number | null;
    pisCents: number | null;
  } {
    if (!pisNode) {
      return { cstPis: null, basePisCents: null, aliqPis: null, pisCents: null };
    }

    // PIS has: PISAliq, PISQtde, PISNT, PISOutr
    const pisAliq = pisNode.PISAliq;
    const pisNt = pisNode.PISNT;
    const pisOutr = pisNode.PISOutr;
    const pisQtde = pisNode.PISQtde;

    const data = pisAliq || pisOutr || pisQtde;
    if (data) {
      return {
        cstPis: data.CST != null ? String(data.CST).padStart(2, '0') : null,
        basePisCents: data.vBC ? this.toCents(String(data.vBC)) : null,
        aliqPis: data.pPIS != null ? parseFloat(String(data.pPIS)) : null,
        pisCents: data.vPIS ? this.toCents(String(data.vPIS)) : null,
      };
    }

    if (pisNt) {
      return {
        cstPis: pisNt.CST != null ? String(pisNt.CST).padStart(2, '0') : null,
        basePisCents: null,
        aliqPis: null,
        pisCents: null,
      };
    }

    return { cstPis: null, basePisCents: null, aliqPis: null, pisCents: null };
  }

  /* ── Extract COFINS tax data from item ────────────────────────────── */

  private extractCofins(cofinsNode: any): {
    cstCofins: string | null;
    baseCofinsCents: number | null;
    aliqCofins: number | null;
    cofinsCents: number | null;
  } {
    if (!cofinsNode) {
      return { cstCofins: null, baseCofinsCents: null, aliqCofins: null, cofinsCents: null };
    }

    // COFINS has: COFINSAliq, COFINSQtde, COFINSNT, COFINSOutr
    const cofinsAliq = cofinsNode.COFINSAliq;
    const cofinsNt = cofinsNode.COFINSNT;
    const cofinsOutr = cofinsNode.COFINSOutr;
    const cofinsQtde = cofinsNode.COFINSQtde;

    const data = cofinsAliq || cofinsOutr || cofinsQtde;
    if (data) {
      return {
        cstCofins: data.CST != null ? String(data.CST).padStart(2, '0') : null,
        baseCofinsCents: data.vBC ? this.toCents(String(data.vBC)) : null,
        aliqCofins: data.pCOFINS != null ? parseFloat(String(data.pCOFINS)) : null,
        cofinsCents: data.vCOFINS ? this.toCents(String(data.vCOFINS)) : null,
      };
    }

    if (cofinsNt) {
      return {
        cstCofins: cofinsNt.CST != null ? String(cofinsNt.CST).padStart(2, '0') : null,
        baseCofinsCents: null,
        aliqCofins: null,
        cofinsCents: null,
      };
    }

    return { cstCofins: null, baseCofinsCents: null, aliqCofins: null, cofinsCents: null };
  }

  /* ── Extract all taxes from item's imposto node ───────────────────── */

  private extractItemTaxes(imposto: any): Omit<ParsedNfeItemTax, 'freteCents' | 'seguroCents' | 'descontoCents' | 'outrasDespCents'> {
    if (!imposto) {
      return {
        cstIcms: null, modBcIcms: null, baseIcmsCents: null, aliqIcms: null, icmsCents: null,
        baseIcmsStCents: null, aliqIcmsSt: null, icmsStCents: null,
        cstIpi: null, baseIpiCents: null, aliqIpi: null, ipiCents: null,
        cstPis: null, basePisCents: null, aliqPis: null, pisCents: null,
        cstCofins: null, baseCofinsCents: null, aliqCofins: null, cofinsCents: null,
      };
    }

    const icms = this.extractIcms(imposto.ICMS);
    const ipi = this.extractIpi(imposto.IPI);
    const pis = this.extractPis(imposto.PIS);
    const cofins = this.extractCofins(imposto.COFINS);

    return { ...icms, ...ipi, ...pis, ...cofins };
  }

  /* ── Helper: convert BRL string to centavos ──────────────────────── */

  private toCents(value: string): number {
    return Math.round(parseFloat(value) * 100);
  }
}
