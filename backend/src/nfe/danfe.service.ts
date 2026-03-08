import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as bwipjs from 'bwip-js';

/* ══════════════════════════════════════════════════════════════════════
   DanfeService — Generates standard Brazilian DANFE PDF from NFe XML
   Layout follows MOC (Manual de Orientação do Contribuinte) standard.
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
  exitTime: string;
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
    totalServicos: number;
    bcIssqn: number;
    issqn: number;
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
      numberParseOptions: {
        leadingZeros: false,
        hex: false,
        skipLike: /.*/, // Don't parse ANY values as numbers — keep all as strings
      },
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
    const issqnTot = infNFe.total?.ISSQNtot ?? {};
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
    let exitTime = '';
    if (dhSaiEnt) {
      try {
        const d = new Date(dhSaiEnt);
        if (!isNaN(d.getTime())) {
          entryExitDate = d.toLocaleDateString('pt-BR');
          exitTime = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
      exitTime,
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
        address: `${emitEnd.xLgr ?? ''} N.${emitEnd.nro ?? 'S/N'}`,
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
        address: `${destEnd.xLgr ?? ''} N. ${destEnd.nro ?? 'S/N'}`,
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
        totalServicos: parseFloat(String(issqnTot.vServ ?? '0')),
        bcIssqn: parseFloat(String(issqnTot.vBC ?? '0')),
        issqn: parseFloat(String(issqnTot.vISS ?? '0')),
      },
      info: String(infAdic.infCpl ?? ''),
      infoFisco: String(infAdic.infAdFisco ?? ''),
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Build standard DANFE PDF — MOC layout
     ═══════════════════════════════════════════════════════════════════ */

  private async buildPdf(data: DanfeData): Promise<Buffer> {
    // Generate barcode image for the access key
    let barcodeImg: Buffer | null = null;
    if (data.nfeKey && data.nfeKey.length === 44) {
      try {
        barcodeImg = await bwipjs.toBuffer({
          bcid: 'code128',
          text: data.nfeKey,
          scale: 3,
          height: 15,
          includetext: false,
        });
      } catch { /* barcode generation failed, skip */ }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const LX = 10;
      const PW = doc.page.width - 20; // ~575
      const PH = doc.page.height - 20;
      let y = 10;
      let cx = 0;

      const F5 = 5, F6 = 6, F7 = 7, F8 = 8, F9 = 9, F10 = 10;
      const RH = 18; // standard row height

      // ── Helpers ─────────────────────────────────────────────
      const box = (x: number, by: number, w: number, h: number) => {
        doc.lineWidth(0.4).rect(x, by, w, h).stroke('#000');
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
          .text(text || '', x + 1.5, by + (opts?.offsetY ?? 7), {
            width: (opts?.w ?? 100) - 3,
            align: opts?.align ?? 'left',
            lineBreak: false,
          });
      };

      const sectionTitle = (text: string, sy: number) => {
        doc.font('Helvetica-Bold').fontSize(F5).fillColor('#000')
          .text(text, LX + 1, sy);
      };

      // ══════════════════════════════════════════════════════════
      // CANHOTO (Recibo de entrega)
      // ══════════════════════════════════════════════════════════
      const canhH = 38;
      const canhTextW = PW - 100;
      box(LX, y, canhTextW, canhH);
      doc.font('Helvetica').fontSize(F6).fillColor('#000')
        .text(`RECEBEMOS DE ${data.emitter.name} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`, LX + 3, y + 2, { width: canhTextW - 6 });
      // Data recebimento + Assinatura
      const halfCanh = canhTextW / 2;
      box(LX, y + 16, halfCanh, canhH - 16);
      label(LX, y + 16, 'DATA DE RECEBIMENTO');
      box(LX + halfCanh, y + 16, halfCanh, canhH - 16);
      label(LX + halfCanh, y + 16, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR');

      // NF-e box (right of canhoto)
      const nfeBoxX = LX + canhTextW;
      box(nfeBoxX, y, 100, canhH);
      doc.font('Helvetica-Bold').fontSize(F10).fillColor('#000')
        .text('NF-e', nfeBoxX + 2, y + 3, { width: 96, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(F8)
        .text(`N. ${data.nfeNumber}`, nfeBoxX + 2, y + 15, { width: 96, align: 'center' })
        .text(`SÉRIE ${data.nfeSeries}`, nfeBoxX + 2, y + 25, { width: 96, align: 'center' });

      y += canhH;

      // Dashed cut line
      doc.save().lineWidth(0.5).dash(3, { space: 3 })
        .moveTo(LX, y + 2).lineTo(LX + PW, y + 2).stroke('#999').restore();
      y += 6;

      // ══════════════════════════════════════════════════════════
      // HEADER: Emitente | DANFE | Barcode+Chave+Protocolo
      // ══════════════════════════════════════════════════════════
      const H1 = 95;
      const emitW = Math.round(PW * 0.38);
      const danfeW = Math.round(PW * 0.20);
      const barcW = PW - emitW - danfeW;

      // Emitente (left column)
      box(LX, y, emitW, H1);
      doc.font('Helvetica-Bold').fontSize(F9).fillColor('#000')
        .text(data.emitter.name, LX + 4, y + 10, { width: emitW - 8 });
      let emitY = y + 32;
      doc.font('Helvetica').fontSize(F6)
        .text(data.emitter.address, LX + 4, emitY, { width: emitW - 8 });
      emitY += 9;
      doc.text(`Bairro ${data.emitter.neighborhood},${data.emitter.city} - ${data.emitter.uf}`, LX + 4, emitY, { width: emitW - 8 });
      emitY += 9;
      doc.text(`Fone: ${data.emitter.phone}, CEP:${data.emitter.cep}`, LX + 4, emitY, { width: emitW - 8 });

      // DANFE title (center column)
      const dX = LX + emitW;
      box(dX, y, danfeW, H1);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
        .text('DANFE', dX, y + 4, { width: danfeW, align: 'center' });
      doc.font('Helvetica').fontSize(F5)
        .text('Documento\nAuxiliar da Nota\nFiscal Eletrônica', dX + 3, y + 18, { width: danfeW - 6, align: 'center' });
      // Entry/Exit indicator
      doc.font('Helvetica').fontSize(F6)
        .text('0 - ENTRADA', dX + 6, y + 40)
        .text('1 - SAÍDA', dX + 6, y + 48);
      doc.rect(dX + danfeW - 22, y + 39, 16, 16).stroke('#000');
      doc.font('Helvetica-Bold').fontSize(F10)
        .text(String(data.entryExit), dX + danfeW - 22, y + 42, { width: 16, align: 'center' });
      // Number / Series / Page
      doc.font('Helvetica-Bold').fontSize(F7)
        .text(`N. ${data.nfeNumber}`, dX + 3, y + 62, { width: danfeW - 6, align: 'center' })
        .text(`SÉRIE ${data.nfeSeries}`, dX + 3, y + 71, { width: danfeW - 6, align: 'center' });
      doc.font('Helvetica').fontSize(F6)
        .text('FOLHA 1/1', dX + 3, y + 82, { width: danfeW - 6, align: 'center' });

      // Barcode + Key + Protocol (right column)
      const bX = dX + danfeW;
      box(bX, y, barcW, H1);
      if (barcodeImg) {
        try {
          doc.image(barcodeImg, bX + 8, y + 4, { width: barcW - 16, height: 28 });
        } catch { /* skip */ }
      }
      doc.font('Helvetica').fontSize(F5)
        .text('CHAVE DE ACESSO', bX + 3, y + 35, { width: barcW - 6, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(F6)
        .text(this.formatNfeKey(data.nfeKey), bX + 3, y + 43, { width: barcW - 6, align: 'center' });
      doc.font('Helvetica').fontSize(F5)
        .text('Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', bX + 3, y + 56, { width: barcW - 6, align: 'center' });
      if (data.protocol) {
        doc.font('Helvetica').fontSize(F5)
          .text('PROTOCOLO DE AUTORIZAÇÃO DE USO', bX + 3, y + 72, { width: barcW - 6, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(F7)
          .text(`${data.protocol} ${data.protocolDate}`, bX + 3, y + 80, { width: barcW - 6, align: 'center' });
      }

      y += H1;

      // ══════════════════════════════════════════════════════════
      // NATUREZA DA OPERAÇÃO (full width — protocol is in header)
      // ══════════════════════════════════════════════════════════
      box(LX, y, PW, RH);
      label(LX, y, 'NATUREZA DA OPERAÇÃO');
      val(LX, y, data.natOp, { w: PW, bold: true });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // INSCRIÇÃO ESTADUAL | INSC. EST. SUBST. TRIB. | CNPJ
      // ══════════════════════════════════════════════════════════
      const ieColW = Math.round(PW / 3);
      const cnpjColW = PW - ieColW * 2;
      box(LX, y, ieColW, RH);
      label(LX, y, 'INSCRIÇÃO ESTADUAL');
      val(LX, y, data.emitter.ie, { w: ieColW });
      box(LX + ieColW, y, ieColW, RH);
      label(LX + ieColW, y, 'INSC. ESTADUAL DO SUBST. TRIBUTÁRIO');
      val(LX + ieColW, y, data.emitter.ieSubTrib, { w: ieColW });
      box(LX + ieColW * 2, y, cnpjColW, RH);
      label(LX + ieColW * 2, y, 'CNPJ');
      val(LX + ieColW * 2, y, data.emitter.cnpj, { w: cnpjColW });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // DESTINATÁRIO/REMETENTE
      // ══════════════════════════════════════════════════════════
      y += 1;
      sectionTitle('DESTINATÁRIO/REMETENTE', y + 7);
      y += 8;

      // Row 1: Nome/Razão Social | CNPJ/CPF | Data Emissão
      const dNameW = Math.round(PW * 0.55);
      const dCnpjW = Math.round(PW * 0.25);
      const dDateW = PW - dNameW - dCnpjW;
      box(LX, y, dNameW, RH);
      label(LX, y, 'NOME/RAZÃO SOCIAL');
      val(LX, y, data.recipient.name, { w: dNameW, bold: true });
      box(LX + dNameW, y, dCnpjW, RH);
      label(LX + dNameW, y, 'CNPJ/CPF');
      val(LX + dNameW, y, data.recipient.cnpj, { w: dCnpjW });
      box(LX + dNameW + dCnpjW, y, dDateW, RH);
      label(LX + dNameW + dCnpjW, y, 'DATA DA EMISSÃO');
      val(LX + dNameW + dCnpjW, y, data.issueDate, { w: dDateW, align: 'center' });
      y += RH;

      // Row 2: Endereço | Bairro | CEP | Data Entrada/Saída
      const dAddrW = Math.round(PW * 0.38);
      const dBairroW = Math.round(PW * 0.22);
      const dCepW = Math.round(PW * 0.15);
      const dEntW = PW - dAddrW - dBairroW - dCepW;
      box(LX, y, dAddrW, RH);
      label(LX, y, 'ENDEREÇO');
      val(LX, y, data.recipient.address, { w: dAddrW });
      box(LX + dAddrW, y, dBairroW, RH);
      label(LX + dAddrW, y, 'BAIRRO/DISTRITO');
      val(LX + dAddrW, y, data.recipient.neighborhood, { w: dBairroW });
      box(LX + dAddrW + dBairroW, y, dCepW, RH);
      label(LX + dAddrW + dBairroW, y, 'CEP');
      val(LX + dAddrW + dBairroW, y, data.recipient.cep, { w: dCepW });
      box(LX + dAddrW + dBairroW + dCepW, y, dEntW, RH);
      label(LX + dAddrW + dBairroW + dCepW, y, 'DATA DA ENTRADA/SAÍDA');
      val(LX + dAddrW + dBairroW + dCepW, y, data.entryExitDate, { w: dEntW, align: 'center' });
      y += RH;

      // Row 3: Município | Fone | UF | IE | Hora Saída
      const dMunW = Math.round(PW * 0.34);
      const dFoneW = Math.round(PW * 0.18);
      const dUfW = Math.round(PW * 0.06);
      const dIeW = Math.round(PW * 0.22);
      const dHoraW = PW - dMunW - dFoneW - dUfW - dIeW;
      cx = LX;
      box(cx, y, dMunW, RH); label(cx, y, 'MUNICÍPIO'); val(cx, y, data.recipient.city, { w: dMunW }); cx += dMunW;
      box(cx, y, dFoneW, RH); label(cx, y, 'FONE/FAX'); val(cx, y, data.recipient.phone, { w: dFoneW }); cx += dFoneW;
      box(cx, y, dUfW, RH); label(cx, y, 'UF'); val(cx, y, data.recipient.uf, { w: dUfW, align: 'center' }); cx += dUfW;
      box(cx, y, dIeW, RH); label(cx, y, 'INSCRIÇÃO ESTADUAL'); val(cx, y, data.recipient.inscEst, { w: dIeW }); cx += dIeW;
      box(cx, y, dHoraW, RH); label(cx, y, 'HORA DA SAÍDA'); val(cx, y, data.exitTime, { w: dHoraW, align: 'center' });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // FATURA/DUPLICATA
      // ══════════════════════════════════════════════════════════
      if (data.duplicates.length > 0 || data.invoice.number) {
        y += 1;
        sectionTitle('FATURA/DUPLICATA', y + 7);
        y += 8;
        const dupText = data.duplicates.map(d =>
          `${d.number ? d.number + ':' : ''} Venc=${d.dueDate} Valor=${d.value}`
        ).join('  |  ');
        const displayText = dupText || `Fatura: ${data.invoice.number}  Valor: ${data.invoice.value}`;
        box(LX, y, PW, RH);
        val(LX, y, displayText, { w: PW, size: F6 });
        y += RH;
      }

      // ══════════════════════════════════════════════════════════
      // CÁLCULO DE IMPOSTO
      // ══════════════════════════════════════════════════════════
      y += 1;
      sectionTitle('CÁLCULO DE IMPOSTO', y + 7);
      y += 8;

      // Row 1: 5 columns (standard DANFE)
      const t5w = PW / 5;
      const taxR1 = [
        { l: 'BASE DE CÁLCULO DO ICMS', v: this.formatMoney(data.totals.bcIcms) },
        { l: 'VALOR DO ICMS', v: this.formatMoney(data.totals.icms) },
        { l: 'BASE DE CÁLCULO DO ICMS ST', v: this.formatMoney(data.totals.bcIcmsSt) },
        { l: 'VALOR DO ICMS ST', v: this.formatMoney(data.totals.icmsSt) },
        { l: 'VALOR TOTAL DOS PRODUTOS', v: this.formatMoney(data.totals.totalProducts) },
      ];
      taxR1.forEach((t, i) => {
        const tx = LX + i * t5w;
        const w = i === 4 ? PW - t5w * 4 : t5w;
        box(tx, y, w, RH);
        label(tx, y, t.l);
        val(tx, y, t.v, { w, align: 'right' });
      });
      y += RH;

      // Row 2: 6 columns (standard DANFE)
      const t6w = PW / 6;
      const taxR2 = [
        { l: 'VALOR DO FRETE', v: this.formatMoney(data.totals.freight) },
        { l: 'VALOR DO SEGURO', v: this.formatMoney(data.totals.insurance) },
        { l: 'DESCONTO', v: this.formatMoney(data.totals.discount) },
        { l: 'OUTRAS DESPESAS ACESSÓRIAS', v: this.formatMoney(data.totals.otherExpenses) },
        { l: 'VALOR DO IPI', v: this.formatMoney(data.totals.ipi) },
        { l: 'VALOR TOTAL DA NOTA', v: this.formatMoney(data.totals.totalNf) },
      ];
      taxR2.forEach((t, i) => {
        const tx = LX + i * t6w;
        const w = i === 5 ? PW - t6w * 5 : t6w;
        box(tx, y, w, RH);
        label(tx, y, t.l);
        val(tx, y, t.v, { w, align: 'right', bold: i === 5 });
      });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // TRANSPORTADOR/VOLUMES TRANSPORTADOS
      // ══════════════════════════════════════════════════════════
      y += 1;
      sectionTitle('TRANSPORTADOR/VOLUMES TRANSPORTADOS', y + 7);
      y += 8;

      // Row 1: Razão Social | Frete Por Conta | Código ANTT | Placa | UF | CNPJ/CPF
      const trNW = Math.round(PW * 0.30);
      const trFW = Math.round(PW * 0.14);
      const trAW = Math.round(PW * 0.12);
      const trPW2 = Math.round(PW * 0.14);
      const trUW = Math.round(PW * 0.06);
      const trCW = PW - trNW - trFW - trAW - trPW2 - trUW;
      cx = LX;
      box(cx, y, trNW, RH); label(cx, y, 'RAZÃO SOCIAL'); val(cx, y, data.transport.name, { w: trNW }); cx += trNW;
      box(cx, y, trFW, RH); label(cx, y, 'FRETE POR CONTA'); val(cx, y, data.transport.modFrete, { w: trFW, size: F6 }); cx += trFW;
      box(cx, y, trAW, RH); label(cx, y, 'CÓDIGO ANTT'); val(cx, y, data.transport.antt, { w: trAW }); cx += trAW;
      box(cx, y, trPW2, RH); label(cx, y, 'PLACA DO VEÍCULO'); val(cx, y, data.transport.plate, { w: trPW2 }); cx += trPW2;
      box(cx, y, trUW, RH); label(cx, y, 'UF'); val(cx, y, data.transport.plateUf, { w: trUW, align: 'center' }); cx += trUW;
      box(cx, y, trCW, RH); label(cx, y, 'CNPJ/CPF'); val(cx, y, data.transport.cnpj, { w: trCW });
      y += RH;

      // Row 2: Endereço | Município | UF | Inscrição Estadual
      const trAdW = Math.round(PW * 0.38);
      const trMW = Math.round(PW * 0.30);
      const trU2W = Math.round(PW * 0.06);
      const trIW = PW - trAdW - trMW - trU2W;
      cx = LX;
      box(cx, y, trAdW, RH); label(cx, y, 'ENDEREÇO'); val(cx, y, data.transport.address, { w: trAdW }); cx += trAdW;
      box(cx, y, trMW, RH); label(cx, y, 'MUNICÍPIO'); val(cx, y, data.transport.city, { w: trMW }); cx += trMW;
      box(cx, y, trU2W, RH); label(cx, y, 'UF'); val(cx, y, data.transport.uf, { w: trU2W, align: 'center' }); cx += trU2W;
      box(cx, y, trIW, RH); label(cx, y, 'INSCRIÇÃO ESTADUAL'); val(cx, y, data.transport.ie, { w: trIW });
      y += RH;

      // Row 3: Quantidade | Espécie | Marca | Número | Peso Bruto | Peso Líquido
      const vW = PW / 6;
      const vols = [
        { l: 'QUANTIDADE', v: data.transport.qty },
        { l: 'ESPÉCIE', v: data.transport.species },
        { l: 'MARCA', v: data.transport.brand },
        { l: 'NÚMERO', v: data.transport.numVol },
        { l: 'PESO BRUTO', v: data.transport.grossWeight },
        { l: 'PESO LÍQUIDO', v: data.transport.netWeight },
      ];
      vols.forEach((f, i) => {
        const fx = LX + i * vW;
        const w = i === 5 ? PW - vW * 5 : vW;
        box(fx, y, w, RH);
        label(fx, y, f.l);
        val(fx, y, f.v, { w, align: i >= 4 ? 'right' : 'center' });
      });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // DADOS DOS PRODUTOS/SERVIÇOS
      // ══════════════════════════════════════════════════════════
      y += 1;
      sectionTitle('DADOS DOS PRODUTOS/SERVIÇOS', y + 7);
      y += 8;

      // Standard DANFE product columns (14 columns — MOC standard)
      const pCols = [
        { l: 'CÓDIGO\nPRODUTO', w: 44 },
        { l: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 0 }, // auto-fill remaining
        { l: 'NCM/SH', w: 40 },
        { l: 'CST', w: 20 },
        { l: 'CFOP', w: 26 },
        { l: 'UN', w: 18 },
        { l: 'QUANTI-\nDADE', w: 42 },
        { l: 'VALOR\nUNITÁRIO', w: 50 },
        { l: 'VALOR\nTOTAL', w: 48 },
        { l: 'B.CÁLC.\nDO ICMS', w: 48 },
        { l: 'VALOR\nDO ICMS', w: 40 },
        { l: 'VALOR\nDO IPI', w: 34 },
        { l: 'ALÍQ.\nICMS', w: 30 },
        { l: 'ALÍQ.\nIPI', w: 26 },
      ];

      // Calculate auto-fill width for description column
      const fixedW = pCols.reduce((s, c) => s + c.w, 0);
      pCols[1].w = PW - fixedW;

      // Header row
      const hdrH = 22;
      cx = LX;
      pCols.forEach((col) => {
        box(cx, y, col.w, hdrH);
        doc.font('Helvetica-Bold').fontSize(F5).fillColor('#000')
          .text(col.l, cx + 1, y + 2, { width: col.w - 2, align: 'center' });
        cx += col.w;
      });
      y += hdrH;

      // Item rows
      const rowH = 13;
      for (const item of data.items) {
        // Page break check (leave room for ISSQN + info sections)
        if (y + rowH > PH - 90) {
          doc.addPage();
          y = 15;
        }

        const rowVals = [
          item.code,
          item.description,
          item.ncm,
          item.cst,
          item.cfop,
          item.unit,
          this.formatQty(item.quantity),
          this.formatMoney(item.unitPrice),
          this.formatMoney(item.total),
          item.bcIcms > 0 ? this.formatMoney(item.bcIcms) : '',
          item.icmsValue > 0 ? this.formatMoney(item.icmsValue) : '',
          item.ipiValue > 0 ? this.formatMoney(item.ipiValue) : '',
          item.icmsRate > 0 ? this.formatMoney(item.icmsRate) : '',
          item.ipiRate > 0 ? this.formatMoney(item.ipiRate) : '',
        ];

        cx = LX;
        rowVals.forEach((v, i) => {
          box(cx, y, pCols[i].w, rowH);
          const align = i >= 6 ? 'right' : i === 0 ? 'center' : 'left';
          doc.font('Helvetica').fontSize(F6).fillColor('#000')
            .text(v, cx + 1, y + 3, {
              width: pCols[i].w - 2,
              align,
              ellipsis: true,
              lineBreak: false,
            });
          cx += pCols[i].w;
        });
        y += rowH;
      }

      // ══════════════════════════════════════════════════════════
      // CÁLCULO DO ISSQN
      // ══════════════════════════════════════════════════════════
      if (y + RH + RH + 50 > PH) { doc.addPage(); y = 15; }
      y += 1;
      sectionTitle('CÁLCULO DO ISSQN', y + 7);
      y += 8;
      const issqnW = PW / 4;
      const issqnFields = [
        { l: 'INSCRIÇÃO MUNICIPAL', v: data.emitter.im || '' },
        { l: 'VALOR TOTAL DOS SERVIÇOS', v: this.formatMoney(data.totals.totalServicos) },
        { l: 'BASE DE CÁLCULO DE ISSQN', v: this.formatMoney(data.totals.bcIssqn) },
        { l: 'VALOR DO ISSQN', v: this.formatMoney(data.totals.issqn) },
      ];
      issqnFields.forEach((f, i) => {
        const fx = LX + i * issqnW;
        const w = i === 3 ? PW - issqnW * 3 : issqnW;
        box(fx, y, w, RH);
        label(fx, y, f.l);
        val(fx, y, f.v, { w, align: i >= 1 ? 'right' : 'left' });
      });
      y += RH;

      // ══════════════════════════════════════════════════════════
      // DADOS ADICIONAIS
      // ══════════════════════════════════════════════════════════
      y += 1;
      sectionTitle('DADOS ADICIONAIS', y + 7);
      y += 8;

      const infoText = [data.infoFisco, data.info].filter(Boolean).join('\n');
      const infoH = Math.max(45, Math.min(80, Math.ceil((infoText.length || 1) / 100) * 8 + 10));

      // Page break check
      if (y + infoH > PH) {
        doc.addPage();
        y = 15;
        sectionTitle('DADOS ADICIONAIS', y + 7);
        y += 8;
      }

      const infoLeftW = Math.round(PW * 0.65);
      const infoRightW = PW - infoLeftW;
      box(LX, y, infoLeftW, infoH);
      label(LX, y, 'INFORMAÇÕES COMPLEMENTARES');
      doc.font('Helvetica').fontSize(F5).fillColor('#000')
        .text(infoText, LX + 2, y + 8, { width: infoLeftW - 4, lineBreak: true });
      box(LX + infoLeftW, y, infoRightW, infoH);
      label(LX + infoLeftW, y, 'RESERVADO AO FISCO');

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
