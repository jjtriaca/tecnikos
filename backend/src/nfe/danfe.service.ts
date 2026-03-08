import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as bwipjs from 'bwip-js';

/* ══════════════════════════════════════════════════════════════════════
   DanfeService — Generates standard Brazilian DANFE PDF from NFe XML
   ══════════════════════════════════════════════════════════════════════ */

interface DanfeItem {
  num: number;
  code: string;
  description: string;
  ncm: string;
  cst: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount: number;
  bcIcms: number;
  icmsValue: number;
  icmsRate: number;
  ipiValue: number;
  ipiRate: number;
}

interface DanfeData {
  nfeKey: string;
  nfeNumber: string;
  nfeSeries: string;
  pageCount: string;
  issueDate: string;
  issueDateRaw: string;
  entryExitDate: string;
  entryExit: number; // 0=entrada, 1=saida
  natOp: string;
  protocol: string;
  protocolDate: string;
  emitter: {
    name: string;
    cnpj: string;
    ie: string;
    ieSubTrib: string;
    im: string;
    address: string;
    neighborhood: string;
    city: string;
    uf: string;
    cep: string;
    phone: string;
  };
  recipient: {
    name: string;
    cnpj: string;
    ie: string;
    address: string;
    neighborhood: string;
    city: string;
    uf: string;
    cep: string;
    phone: string;
    inscEst: string;
  };
  transport: {
    modFrete: string;
    name: string;
    cnpj: string;
    address: string;
    city: string;
    uf: string;
    ie: string;
    plate: string;
    plateUf: string;
    antt: string;
    qty: string;
    species: string;
    brand: string;
    numVol: string;
    grossWeight: string;
    netWeight: string;
  };
  invoice: {
    number: string;
    value: string;
    dueDate: string;
  };
  duplicates: Array<{
    number: string;
    dueDate: string;
    value: string;
  }>;
  items: DanfeItem[];
  totals: {
    bcIcms: number;
    icms: number;
    bcIcmsSt: number;
    icmsSt: number;
    icmsDesonerado: number;
    totalProducts: number;
    freight: number;
    insurance: number;
    discount: number;
    otherExpenses: number;
    ipi: number;
    ipiDevol: number;
    totalNf: number;
    approxTax: number;
  };
  info: string;
  infoFisco: string;
}

// Freight mode descriptions
const FRETE_MODES: Record<string, string> = {
  '0': '0-Emitente',
  '1': '1-Destinatario',
  '2': '2-Terceiros',
  '3': '3-Proprio/Rem',
  '4': '4-Proprio/Dest',
  '9': '9-Sem Frete',
};

@Injectable()
export class DanfeService {
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  async generate(xmlContent: string): Promise<Buffer> {
    const data = this.parseNfe(xmlContent);
    return this.buildPdf(data);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Parse NFe XML into DanfeData
     ═══════════════════════════════════════════════════════════════════ */

  private parseNfe(xml: string): DanfeData {
    const parsed = this.xmlParser.parse(xml);
    const nfeProc = parsed.nfeProc ?? parsed['ns0:nfeProc'] ?? parsed;
    const nfe = nfeProc.NFe ?? parsed.NFe;
    const infNFe = nfe?.infNFe;

    if (!infNFe) throw new Error('XML invalido: infNFe nao encontrado');

    const ide = infNFe.ide ?? {};
    const emit = infNFe.emit ?? {};
    const dest = infNFe.dest ?? {};
    const total = infNFe.total?.ICMSTot ?? {};
    const infAdic = infNFe.infAdic ?? {};
    const transp = infNFe.transp ?? {};
    const cobr = infNFe.cobr ?? {};

    // NFe Key + Protocol
    let nfeKey = '';
    let protocol = '';
    let protocolDate = '';
    const protNFe = nfeProc?.protNFe;
    if (protNFe?.infProt) {
      nfeKey = String(protNFe.infProt.chNFe ?? '');
      protocol = String(protNFe.infProt.nProt ?? '');
      const dhRecbto = String(protNFe.infProt.dhRecbto ?? '');
      if (dhRecbto) {
        try {
          const d = new Date(dhRecbto);
          if (!isNaN(d.getTime())) {
            protocolDate = d.toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
          }
        } catch { protocolDate = dhRecbto; }
      }
    }
    if (!nfeKey && infNFe['@_Id']) {
      nfeKey = String(infNFe['@_Id']).replace(/^NFe/, '');
    }

    // Addresses
    const emitEnd = emit.enderEmit ?? {};
    const destEnd = dest.enderDest ?? {};

    // Items
    const detRaw = infNFe.det;
    const detArray = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

    const items: DanfeItem[] = detArray.map((det: any) => {
      const prod = det.prod ?? {};
      const imposto = det.imposto ?? {};
      const icmsGroup = imposto.ICMS ?? {};
      const icmsInner = icmsGroup.ICMS00 ?? icmsGroup.ICMS10 ?? icmsGroup.ICMS20 ?? icmsGroup.ICMS30 ??
        icmsGroup.ICMS40 ?? icmsGroup.ICMS41 ?? icmsGroup.ICMS50 ?? icmsGroup.ICMS51 ??
        icmsGroup.ICMS60 ?? icmsGroup.ICMS70 ?? icmsGroup.ICMS90 ??
        icmsGroup.ICMSSN101 ?? icmsGroup.ICMSSN102 ?? icmsGroup.ICMSSN201 ??
        icmsGroup.ICMSSN202 ?? icmsGroup.ICMSSN500 ?? icmsGroup.ICMSSN900 ?? {};
      const ipiGroup = imposto.IPI ?? {};
      const ipiInner = ipiGroup.IPITrib ?? ipiGroup.IPINT ?? {};

      const orig = String(icmsInner.orig ?? '0');
      const cstIcms = String(icmsInner.CST ?? icmsInner.CSOSN ?? '');
      const cst = orig + cstIcms;

      return {
        num: Number(det['@_nItem'] ?? 0),
        code: String(prod.cProd ?? ''),
        description: String(prod.xProd ?? ''),
        ncm: String(prod.NCM ?? ''),
        cst,
        cfop: String(prod.CFOP ?? ''),
        unit: String(prod.uCom ?? 'UN'),
        quantity: parseFloat(String(prod.qCom ?? '0')),
        unitPrice: parseFloat(String(prod.vUnCom ?? '0')),
        total: parseFloat(String(prod.vProd ?? '0')),
        discount: parseFloat(String(prod.vDesc ?? '0')),
        bcIcms: parseFloat(String(icmsInner.vBC ?? '0')),
        icmsValue: parseFloat(String(icmsInner.vICMS ?? '0')),
        icmsRate: parseFloat(String(icmsInner.pICMS ?? '0')),
        ipiValue: parseFloat(String(ipiInner.vIPI ?? '0')),
        ipiRate: parseFloat(String(ipiInner.pIPI ?? '0')),
      };
    });

    // Date formatting
    const dhEmi = String(ide.dhEmi ?? '');
    let issueDate = dhEmi;
    let issueDateRaw = '';
    try {
      const d = new Date(dhEmi);
      if (!isNaN(d.getTime())) {
        issueDate = d.toLocaleDateString('pt-BR');
        issueDateRaw = dhEmi;
      }
    } catch { /* keep raw */ }

    const dhSaiEnt = String(ide.dhSaiEnt ?? '');
    let entryExitDate = '';
    if (dhSaiEnt) {
      try {
        const d = new Date(dhSaiEnt);
        if (!isNaN(d.getTime())) {
          entryExitDate = d.toLocaleDateString('pt-BR');
        }
      } catch { /* keep raw */ }
    }

    // Transport
    const transpInner = transp.transporta ?? {};
    const veicTransp = transp.veicTransp ?? {};
    const vol = transp.vol ?? {};

    // Invoice / duplicates
    const fat = cobr.fat ?? {};
    const dupRaw = cobr.dup;
    const dupArray = Array.isArray(dupRaw) ? dupRaw : dupRaw ? [dupRaw] : [];
    const duplicates = dupArray.map((dup: any) => ({
      number: String(dup.nDup ?? ''),
      dueDate: this.formatDateShort(String(dup.dVenc ?? '')),
      value: this.formatMoney(parseFloat(String(dup.vDup ?? '0'))),
    }));

    return {
      nfeKey,
      nfeNumber: String(ide.nNF ?? ''),
      nfeSeries: String(ide.serie ?? ''),
      pageCount: '1',
      issueDate,
      issueDateRaw,
      entryExitDate,
      entryExit: Number(ide.tpNF ?? 1),
      natOp: String(ide.natOp ?? ''),
      protocol,
      protocolDate,
      emitter: {
        name: String(emit.xNome ?? emit.xFant ?? ''),
        cnpj: this.formatCnpj(String(emit.CNPJ ?? emit.CPF ?? '')),
        ie: String(emit.IE ?? ''),
        ieSubTrib: String(emit.IEST ?? ''),
        im: String(emit.IM ?? ''),
        address: `${emitEnd.xLgr ?? ''}, ${emitEnd.nro ?? 'S/N'}`,
        neighborhood: String(emitEnd.xBairro ?? ''),
        city: String(emitEnd.xMun ?? ''),
        uf: String(emitEnd.UF ?? ''),
        cep: this.formatCep(String(emitEnd.CEP ?? '')),
        phone: this.formatPhone(String(emitEnd.fone ?? '')),
      },
      recipient: {
        name: String(dest.xNome ?? ''),
        cnpj: this.formatCnpj(String(dest.CNPJ ?? dest.CPF ?? '')),
        ie: String(dest.IE ?? ''),
        address: `${destEnd.xLgr ?? ''}, ${destEnd.nro ?? 'S/N'}`,
        neighborhood: String(destEnd.xBairro ?? ''),
        city: String(destEnd.xMun ?? ''),
        uf: String(destEnd.UF ?? ''),
        cep: this.formatCep(String(destEnd.CEP ?? '')),
        phone: this.formatPhone(String(destEnd.fone ?? '')),
        inscEst: String(dest.IE ?? dest.ISUF ?? ''),
      },
      transport: {
        modFrete: FRETE_MODES[String(transp.modFrete ?? '9')] ?? String(transp.modFrete ?? ''),
        name: String(transpInner.xNome ?? ''),
        cnpj: this.formatCnpj(String(transpInner.CNPJ ?? transpInner.CPF ?? '')),
        address: String(transpInner.xEnder ?? ''),
        city: String(transpInner.xMun ?? ''),
        uf: String(transpInner.UF ?? ''),
        ie: String(transpInner.IE ?? ''),
        plate: String(veicTransp.placa ?? ''),
        plateUf: String(veicTransp.UF ?? ''),
        antt: String(veicTransp.RNTC ?? ''),
        qty: String(vol.qVol ?? ''),
        species: String(vol.esp ?? ''),
        brand: String(vol.marca ?? ''),
        numVol: String(vol.nVol ?? ''),
        grossWeight: vol.pesoB ? this.formatQty(parseFloat(String(vol.pesoB))) : '',
        netWeight: vol.pesoL ? this.formatQty(parseFloat(String(vol.pesoL))) : '',
      },
      invoice: {
        number: String(fat.nFat ?? ''),
        value: fat.vLiq ? this.formatMoney(parseFloat(String(fat.vLiq))) : '',
        dueDate: '',
      },
      duplicates,
      items,
      totals: {
        bcIcms: parseFloat(String(total.vBC ?? '0')),
        icms: parseFloat(String(total.vICMS ?? '0')),
        bcIcmsSt: parseFloat(String(total.vBCST ?? '0')),
        icmsSt: parseFloat(String(total.vST ?? '0')),
        icmsDesonerado: parseFloat(String(total.vICMSDeson ?? '0')),
        totalProducts: parseFloat(String(total.vProd ?? '0')),
        freight: parseFloat(String(total.vFrete ?? '0')),
        insurance: parseFloat(String(total.vSeg ?? '0')),
        discount: parseFloat(String(total.vDesc ?? '0')),
        otherExpenses: parseFloat(String(total.vOutro ?? '0')),
        ipi: parseFloat(String(total.vIPI ?? '0')),
        ipiDevol: parseFloat(String(total.vIPIDevol ?? '0')),
        totalNf: parseFloat(String(total.vNF ?? '0')),
        approxTax: parseFloat(String(total.vTotTrib ?? '0')),
      },
      info: String(infAdic.infCpl ?? ''),
      infoFisco: String(infAdic.infAdFisco ?? ''),
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Build standard DANFE PDF
     ═══════════════════════════════════════════════════════════════════ */

  private async buildPdf(data: DanfeData): Promise<Buffer> {
    // Generate barcode image for the access key
    let barcodeImg: Buffer | null = null;
    if (data.nfeKey && data.nfeKey.length === 44) {
      try {
        barcodeImg = await bwipjs.toBuffer({
          bcid: 'code128',
          text: data.nfeKey,
          scale: 2,
          height: 12,
          includetext: false,
        });
      } catch { /* barcode generation failed, skip */ }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 15, bottom: 15, left: 15, right: 15 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const LX = 15; // left margin
      const PW = doc.page.width - 30; // page width (usable)
      const PH = doc.page.height - 30; // page height (usable)
      let y = 15;

      // Font sizes
      const F5 = 5;
      const F6 = 6;
      const F7 = 7;
      const F8 = 8;
      const F9 = 9;
      const F10 = 10;
      const F14 = 14;

      // ── Helpers ─────────────────────────────────────────────
      const box = (x: number, by: number, w: number, h: number) => {
        doc.lineWidth(0.5).rect(x, by, w, h).stroke('#000');
      };

      const label = (x: number, by: number, text: string, w?: number) => {
        doc.font('Helvetica').fontSize(F5).fillColor('#000')
          .text(text, x + 1.5, by + 1, { width: w ? w - 3 : 200 });
      };

      const val = (x: number, by: number, text: string, opts?: {
        w?: number; align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number; offsetY?: number
      }) => {
        doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(opts?.size ?? F7)
          .fillColor('#000')
          .text(text, x + 1.5, by + (opts?.offsetY ?? 7), {
            width: (opts?.w ?? 100) - 3,
            align: opts?.align ?? 'left',
            lineBreak: false,
          });
      };

      const sectionTitle = (text: string, sy: number) => {
        doc.font('Helvetica-Bold').fontSize(F5).fillColor('#000')
          .text(text, LX + 1, sy - 7);
      };

      // ══════════════════════════════════════════════════════════
      // BLOCO 1: HEADER (Emitente + DANFE + Barcode)
      // ══════════════════════════════════════════════════════════
      const H1 = 80;
      const danfeW = 70;
      const nfeW = 120;
      const emitW = PW - danfeW - nfeW;

      // Emitente box
      box(LX, y, emitW, H1);
      doc.font('Helvetica-Bold').fontSize(F9).fillColor('#000')
        .text(data.emitter.name, LX + 3, y + 5, { width: emitW - 6 });
      doc.font('Helvetica').fontSize(F6).fillColor('#000')
        .text(data.emitter.address, LX + 3, y + 22, { width: emitW - 6 })
        .text(`Bairro ${data.emitter.neighborhood}`, LX + 3, y + 30, { width: emitW - 6 })
        .text(`${data.emitter.city} - ${data.emitter.uf}`, LX + 3, y + 38, { width: emitW - 6 })
        .text(`CEP:${data.emitter.cep}  Fone: ${data.emitter.phone}`, LX + 3, y + 46, { width: emitW - 6 });

      // DANFE title box
      const dX = LX + emitW;
      box(dX, y, danfeW, H1);
      doc.font('Helvetica-Bold').fontSize(F14).fillColor('#000')
        .text('DANFE', dX, y + 3, { width: danfeW, align: 'center' });
      doc.font('Helvetica').fontSize(F5)
        .text('Documento Auxiliar da\nNota Fiscal Eletronica', dX + 2, y + 18, { width: danfeW - 4, align: 'center' });
      // Entry/Exit indicator
      doc.font('Helvetica').fontSize(F6)
        .text('0 - ENTRADA', dX + 5, y + 38, { width: 50 })
        .text('1 - SAIDA', dX + 5, y + 46, { width: 50 });
      // Entry/Exit box with number
      doc.rect(dX + danfeW - 20, y + 36, 16, 14).stroke('#000');
      doc.font('Helvetica-Bold').fontSize(F10)
        .text(String(data.entryExit), dX + danfeW - 20, y + 39, { width: 16, align: 'center' });
      // Page number
      doc.font('Helvetica').fontSize(F6)
        .text(`N. ${data.nfeNumber}`, dX + 2, y + 56, { width: danfeW - 4, align: 'center' })
        .text(`SERIE ${data.nfeSeries}`, dX + 2, y + 63, { width: danfeW - 4, align: 'center' })
        .text(`FOLHA 1/1`, dX + 2, y + 70, { width: danfeW - 4, align: 'center' });

      // NFe number + barcode box
      const nX = dX + danfeW;
      box(nX, y, nfeW, H1);
      // Barcode
      if (barcodeImg) {
        try {
          doc.image(barcodeImg, nX + 5, y + 4, { width: nfeW - 10, height: 30 });
        } catch { /* skip if image fails */ }
      }
      // Access key label
      doc.font('Helvetica').fontSize(F5)
        .text('CHAVE DE ACESSO', nX + 2, y + 37, { width: nfeW - 4, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(F6)
        .text(this.formatNfeKey(data.nfeKey), nX + 2, y + 44, { width: nfeW - 4, align: 'center' });
      // Protocol
      if (data.protocol) {
        doc.font('Helvetica').fontSize(F5)
          .text('PROTOCOLO DE AUTORIZACAO DE USO', nX + 2, y + 58, { width: nfeW - 4, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(F6)
          .text(`${data.protocol} ${data.protocolDate}`, nX + 2, y + 66, { width: nfeW - 4, align: 'center' });
      }

      y += H1;

      // ══════════════════════════════════════════════════════════
      // BLOCO 2: NATUREZA DA OPERACAO + INSCRICOES + CNPJ
      // ══════════════════════════════════════════════════════════
      const H2 = 18;

      // Natureza da Operacao
      const natW = PW * 0.55;
      box(LX, y, natW, H2);
      label(LX, y, 'NATUREZA DA OPERACAO');
      val(LX, y, data.natOp, { w: natW, bold: true });

      // Inscricao Estadual
      const ieW = (PW - natW) / 3;
      box(LX + natW, y, ieW, H2);
      label(LX + natW, y, 'INSCRICAO ESTADUAL');
      val(LX + natW, y, data.emitter.ie, { w: ieW });

      // IE Subst. Trib.
      box(LX + natW + ieW, y, ieW, H2);
      label(LX + natW + ieW, y, 'INSC. EST. SUBST. TRIB.');
      val(LX + natW + ieW, y, data.emitter.ieSubTrib, { w: ieW });

      // CNPJ
      box(LX + natW + ieW * 2, y, ieW, H2);
      label(LX + natW + ieW * 2, y, 'CNPJ');
      val(LX + natW + ieW * 2, y, data.emitter.cnpj, { w: ieW });

      y += H2;

      // ══════════════════════════════════════════════════════════
      // BLOCO 3: DESTINATARIO / REMETENTE
      // ══════════════════════════════════════════════════════════
      y += 2;
      sectionTitle('DESTINATARIO / REMETENTE', y + 7);
      y += 8;
      const RH = 18;

      // Row 1: Nome + CNPJ + Data
      const destNameW = PW * 0.55;
      const destCnpjW = PW * 0.25;
      const destDateW = PW - destNameW - destCnpjW;

      box(LX, y, destNameW, RH);
      label(LX, y, 'NOME / RAZAO SOCIAL');
      val(LX, y, data.recipient.name, { w: destNameW, bold: true });

      box(LX + destNameW, y, destCnpjW, RH);
      label(LX + destNameW, y, 'CNPJ/CPF');
      val(LX + destNameW, y, data.recipient.cnpj, { w: destCnpjW });

      box(LX + destNameW + destCnpjW, y, destDateW, RH);
      label(LX + destNameW + destCnpjW, y, 'DATA DA EMISSAO');
      val(LX + destNameW + destCnpjW, y, data.issueDate, { w: destDateW, align: 'center' });

      y += RH;

      // Row 2: Endereco + Bairro + CEP + Data Entrada/Saida
      const addrW = PW * 0.38;
      const bairroW = PW * 0.22;
      const cepW = PW * 0.15;
      const dEntW = PW - addrW - bairroW - cepW;

      box(LX, y, addrW, RH);
      label(LX, y, 'ENDERECO');
      val(LX, y, data.recipient.address, { w: addrW });

      box(LX + addrW, y, bairroW, RH);
      label(LX + addrW, y, 'BAIRRO/DISTRITO');
      val(LX + addrW, y, data.recipient.neighborhood, { w: bairroW });

      box(LX + addrW + bairroW, y, cepW, RH);
      label(LX + addrW + bairroW, y, 'CEP');
      val(LX + addrW + bairroW, y, data.recipient.cep, { w: cepW });

      box(LX + addrW + bairroW + cepW, y, dEntW, RH);
      label(LX + addrW + bairroW + cepW, y, 'DATA ENTRADA/SAIDA');
      val(LX + addrW + bairroW + cepW, y, data.entryExitDate, { w: dEntW, align: 'center' });

      y += RH;

      // Row 3: Municipio + Fone + UF + IE
      const munW = PW * 0.38;
      const foneW = PW * 0.22;
      const ufW = PW * 0.08;
      const ieDestW = PW - munW - foneW - ufW;

      box(LX, y, munW, RH);
      label(LX, y, 'MUNICIPIO');
      val(LX, y, data.recipient.city, { w: munW });

      box(LX + munW, y, foneW, RH);
      label(LX + munW, y, 'FONE/FAX');
      val(LX + munW, y, data.recipient.phone, { w: foneW });

      box(LX + munW + foneW, y, ufW, RH);
      label(LX + munW + foneW, y, 'UF');
      val(LX + munW + foneW, y, data.recipient.uf, { w: ufW, align: 'center' });

      box(LX + munW + foneW + ufW, y, ieDestW, RH);
      label(LX + munW + foneW + ufW, y, 'INSCRICAO ESTADUAL');
      val(LX + munW + foneW + ufW, y, data.recipient.inscEst, { w: ieDestW });

      y += RH;

      // ══════════════════════════════════════════════════════════
      // BLOCO 4: FATURA / DUPLICATA
      // ══════════════════════════════════════════════════════════
      if (data.duplicates.length > 0 || data.invoice.number) {
        y += 2;
        sectionTitle('FATURA/DUPLICATA', y + 7);
        y += 8;
        const fatH = 18;

        // Show duplicates inline
        const dupText = data.duplicates.map(d =>
          `${d.number ? d.number + ':' : ''} Venc=${d.dueDate} Val=${d.value}`
        ).join('  |  ');
        const displayText = dupText || `Fatura: ${data.invoice.number}  Valor: ${data.invoice.value}`;

        box(LX, y, PW, fatH);
        val(LX, y, displayText, { w: PW, size: F6 });
        y += fatH;
      }

      // ══════════════════════════════════════════════════════════
      // BLOCO 5: CALCULO DO IMPOSTO
      // ══════════════════════════════════════════════════════════
      y += 2;
      sectionTitle('CALCULO DO IMPOSTO', y + 7);
      y += 8;
      const TH = 18;
      const tw = PW / 7;

      const taxRow1 = [
        { l: 'BASE CALCULO ICMS', v: this.formatMoney(data.totals.bcIcms) },
        { l: 'VALOR DO ICMS', v: this.formatMoney(data.totals.icms) },
        { l: 'BASE CALC. ICMS ST', v: this.formatMoney(data.totals.bcIcmsSt) },
        { l: 'VALOR DO ICMS ST', v: this.formatMoney(data.totals.icmsSt) },
        { l: 'V.IMP. IMPORTACAO', v: '0,00' },
        { l: 'VALOR DO IPI', v: this.formatMoney(data.totals.ipi) },
        { l: 'VALOR TOTAL PRODUTOS', v: this.formatMoney(data.totals.totalProducts) },
      ];

      taxRow1.forEach((t, i) => {
        const tx = LX + i * tw;
        box(tx, y, tw, TH);
        label(tx, y, t.l);
        val(tx, y, t.v, { w: tw, align: 'right' });
      });
      y += TH;

      const taxRow2 = [
        { l: 'VALOR DO FRETE', v: this.formatMoney(data.totals.freight) },
        { l: 'VALOR DO SEGURO', v: this.formatMoney(data.totals.insurance) },
        { l: 'DESCONTO', v: this.formatMoney(data.totals.discount) },
        { l: 'OUTRAS DESP. ACESS.', v: this.formatMoney(data.totals.otherExpenses) },
        { l: 'VALOR DO IPI DEVOL.', v: this.formatMoney(data.totals.ipiDevol) },
        { l: 'V. APROX. TRIBUTOS', v: this.formatMoney(data.totals.approxTax) },
        { l: 'VALOR TOTAL DA NOTA', v: this.formatMoney(data.totals.totalNf) },
      ];

      taxRow2.forEach((t, i) => {
        const tx = LX + i * tw;
        box(tx, y, tw, TH);
        label(tx, y, t.l);
        val(tx, y, t.v, { w: tw, align: 'right', bold: i === 6 });
      });
      y += TH;

      // ══════════════════════════════════════════════════════════
      // BLOCO 6: TRANSPORTADOR / VOLUMES
      // ══════════════════════════════════════════════════════════
      y += 2;
      sectionTitle('TRANSPORTADOR / VOLUMES TRANSPORTADOS', y + 7);
      y += 8;

      // Row 1: Razao Social, Frete, Codigo ANTT, Placa, UF, CNPJ/CPF
      const trNameW = PW * 0.30;
      const trFreteW = PW * 0.14;
      const trAnttW = PW * 0.12;
      const trPlacaW = PW * 0.14;
      const trUfW = PW * 0.06;
      const trCnpjW = PW - trNameW - trFreteW - trAnttW - trPlacaW - trUfW;

      box(LX, y, trNameW, RH);
      label(LX, y, 'RAZAO SOCIAL');
      val(LX, y, data.transport.name, { w: trNameW });

      box(LX + trNameW, y, trFreteW, RH);
      label(LX + trNameW, y, 'FRETE POR CONTA');
      val(LX + trNameW, y, data.transport.modFrete, { w: trFreteW, size: F6 });

      box(LX + trNameW + trFreteW, y, trAnttW, RH);
      label(LX + trNameW + trFreteW, y, 'CODIGO ANTT');
      val(LX + trNameW + trFreteW, y, data.transport.antt, { w: trAnttW });

      const plX = LX + trNameW + trFreteW + trAnttW;
      box(plX, y, trPlacaW, RH);
      label(plX, y, 'PLACA DO VEICULO');
      val(plX, y, data.transport.plate, { w: trPlacaW });

      box(plX + trPlacaW, y, trUfW, RH);
      label(plX + trPlacaW, y, 'UF');
      val(plX + trPlacaW, y, data.transport.plateUf, { w: trUfW, align: 'center' });

      box(plX + trPlacaW + trUfW, y, trCnpjW, RH);
      label(plX + trPlacaW + trUfW, y, 'CNPJ/CPF');
      val(plX + trPlacaW + trUfW, y, data.transport.cnpj, { w: trCnpjW });

      y += RH;

      // Row 2: Endereco, Municipio, UF, IE
      const trAddrW = PW * 0.38;
      const trCityW = PW * 0.30;
      const trUf2W = PW * 0.06;
      const trIeW = PW - trAddrW - trCityW - trUf2W;

      box(LX, y, trAddrW, RH);
      label(LX, y, 'ENDERECO');
      val(LX, y, data.transport.address, { w: trAddrW });

      box(LX + trAddrW, y, trCityW, RH);
      label(LX + trAddrW, y, 'MUNICIPIO');
      val(LX + trAddrW, y, data.transport.city, { w: trCityW });

      box(LX + trAddrW + trCityW, y, trUf2W, RH);
      label(LX + trAddrW + trCityW, y, 'UF');
      val(LX + trAddrW + trCityW, y, data.transport.uf, { w: trUf2W, align: 'center' });

      box(LX + trAddrW + trCityW + trUf2W, y, trIeW, RH);
      label(LX + trAddrW + trCityW + trUf2W, y, 'INSCRICAO ESTADUAL');
      val(LX + trAddrW + trCityW + trUf2W, y, data.transport.ie, { w: trIeW });

      y += RH;

      // Row 3: Quantidade, Especie, Marca, Numero, Peso Bruto, Peso Liquido
      const vColW = PW / 6;
      const volFields = [
        { l: 'QUANTIDADE', v: data.transport.qty },
        { l: 'ESPECIE', v: data.transport.species },
        { l: 'MARCA', v: data.transport.brand },
        { l: 'NUMERO', v: data.transport.numVol },
        { l: 'PESO BRUTO', v: data.transport.grossWeight },
        { l: 'PESO LIQUIDO', v: data.transport.netWeight },
      ];

      volFields.forEach((f, i) => {
        const fx = LX + i * vColW;
        box(fx, y, vColW, RH);
        label(fx, y, f.l);
        val(fx, y, f.v, { w: vColW, align: i >= 4 ? 'right' : 'center' });
      });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // BLOCO 7: DADOS DOS PRODUTOS / SERVICOS
      // ══════════════════════════════════════════════════════════
      y += 2;
      sectionTitle('DADOS DOS PRODUTOS / SERVICOS', y + 7);
      y += 8;

      // Column definitions
      const itemCols = [
        { l: 'COD. PROD', w: PW * 0.07 },
        { l: 'DESCRICAO DOS PRODUTOS/SERVICOS', w: PW * 0.24 },
        { l: 'NCM/SH', w: PW * 0.07 },
        { l: 'CST', w: PW * 0.04 },
        { l: 'CFOP', w: PW * 0.05 },
        { l: 'UN.', w: PW * 0.04 },
        { l: 'QUANT.', w: PW * 0.07 },
        { l: 'V. UNITARIO', w: PW * 0.08 },
        { l: 'V. DESC.', w: PW * 0.06 },
        { l: 'V. TOTAL', w: PW * 0.07 },
        { l: 'BC ICMS', w: PW * 0.07 },
        { l: 'V. ICMS', w: PW * 0.06 },
        { l: 'ALIQ ICMS', w: PW * 0.04 },
        { l: 'V. IPI', w: PW * 0.04 },
      ];

      // Adjust last column to fill remaining width
      const totalColW = itemCols.reduce((s, c) => s + c.w, 0);
      if (totalColW < PW) {
        itemCols[1].w += PW - totalColW;
      }

      // Header row
      const hdrH = 20;
      let cx = LX;
      itemCols.forEach((col) => {
        box(cx, y, col.w, hdrH);
        doc.font('Helvetica-Bold').fontSize(F5).fillColor('#000')
          .text(col.l, cx + 1, y + 2, { width: col.w - 2, align: 'center' });
        cx += col.w;
      });
      y += hdrH;

      // Item rows
      const itemRowH = 11;
      for (const item of data.items) {
        // Page break check
        if (y + itemRowH > PH - 80) {
          doc.addPage();
          y = 15;
        }

        const rowValues = [
          item.code,
          item.description,
          item.ncm,
          item.cst,
          item.cfop,
          item.unit,
          this.formatQty(item.quantity),
          this.formatMoney(item.unitPrice),
          item.discount > 0 ? this.formatMoney(item.discount) : '',
          this.formatMoney(item.total),
          item.bcIcms > 0 ? this.formatMoney(item.bcIcms) : '',
          item.icmsValue > 0 ? this.formatMoney(item.icmsValue) : '',
          item.icmsRate > 0 ? this.formatMoney(item.icmsRate) : '',
          item.ipiValue > 0 ? this.formatMoney(item.ipiValue) : '',
        ];

        cx = LX;
        rowValues.forEach((v, i) => {
          box(cx, y, itemCols[i].w, itemRowH);
          const align = i >= 6 ? 'right' : i <= 0 ? 'center' : 'left';
          doc.font('Helvetica').fontSize(F5).fillColor('#000')
            .text(v, cx + 1, y + 2, {
              width: itemCols[i].w - 2,
              align,
              ellipsis: true,
              lineBreak: false,
            });
          cx += itemCols[i].w;
        });
        y += itemRowH;
      }

      // ══════════════════════════════════════════════════════════
      // BLOCO 8: INFORMACOES COMPLEMENTARES
      // ══════════════════════════════════════════════════════════
      y += 2;
      const infoText = [data.infoFisco, data.info].filter(Boolean).join('\n');
      if (infoText) {
        if (y + 50 > PH) {
          doc.addPage();
          y = 15;
        }
        sectionTitle('INFORMACOES COMPLEMENTARES', y + 7);
        y += 8;

        const infoH = Math.min(80, Math.max(30, Math.ceil(infoText.length / 120) * 8 + 10));
        box(LX, y, PW, infoH);
        doc.font('Helvetica').fontSize(F5).fillColor('#000')
          .text(infoText, LX + 2, y + 2, { width: PW - 4 });
      }

      doc.end();
    });
  }

  /* ── Formatters ────────────────────────────────────────────── */

  private formatCnpj(cnpj: string): string {
    if (cnpj.length === 14)
      return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (cnpj.length === 11)
      return cnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return cnpj;
  }

  private formatCep(cep: string): string {
    if (cep.length === 8) return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    return cep;
  }

  private formatPhone(phone: string): string {
    if (phone.length === 10) return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    if (phone.length === 11) return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    return phone;
  }

  private formatNfeKey(key: string): string {
    if (!key) return '';
    return key.replace(/(.{4})/g, '$1 ').trim();
  }

  private formatMoney(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatQty(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }

  private formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    } catch { /* ignore */ }
    return dateStr;
  }
}
