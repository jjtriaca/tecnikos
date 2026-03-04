import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

/* ══════════════════════════════════════════════════════════════════════
   DanfeService — Generates simplified DANFE PDF from NFe XML
   ══════════════════════════════════════════════════════════════════════ */

interface DanfeData {
  nfeKey: string;
  nfeNumber: string;
  nfeSeries: string;
  issueDate: string;
  natOp: string;
  emitter: {
    name: string;
    cnpj: string;
    ie: string;
    address: string;
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
    city: string;
    uf: string;
    cep: string;
    phone: string;
  };
  items: Array<{
    num: number;
    code: string;
    description: string;
    ncm: string;
    cfop: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
    products: number;
    discount: number;
    freight: number;
    insurance: number;
    otherExpenses: number;
    ipi: number;
    icms: number;
    icmsSt: number;
    total: number;
  };
  info: string;
}

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

    if (!infNFe) {
      throw new Error('XML invalido: infNFe nao encontrado');
    }

    const ide = infNFe.ide ?? {};
    const emit = infNFe.emit ?? {};
    const dest = infNFe.dest ?? {};
    const total = infNFe.total?.ICMSTot ?? {};
    const infAdic = infNFe.infAdic ?? {};

    // NFe Key
    let nfeKey = '';
    const protNFe = nfeProc?.protNFe;
    if (protNFe?.infProt?.chNFe) {
      nfeKey = String(protNFe.infProt.chNFe);
    } else if (infNFe['@_Id']) {
      nfeKey = String(infNFe['@_Id']).replace(/^NFe/, '');
    }

    // Emitter address
    const emitEnd = emit.enderEmit ?? {};
    // Recipient address
    const destEnd = dest.enderDest ?? {};

    // Items
    const detRaw = infNFe.det;
    const detArray = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

    const items = detArray.map((det: any) => {
      const prod = det.prod ?? {};
      return {
        num: Number(det['@_nItem'] ?? 0),
        code: String(prod.cProd ?? ''),
        description: String(prod.xProd ?? ''),
        ncm: String(prod.NCM ?? ''),
        cfop: String(prod.CFOP ?? ''),
        unit: String(prod.uCom ?? 'UN'),
        quantity: parseFloat(String(prod.qCom ?? '0')),
        unitPrice: parseFloat(String(prod.vUnCom ?? '0')),
        total: parseFloat(String(prod.vProd ?? '0')),
      };
    });

    // Format date
    const dhEmi = String(ide.dhEmi ?? '');
    let issueDate = dhEmi;
    try {
      const d = new Date(dhEmi);
      if (!isNaN(d.getTime())) {
        issueDate = d.toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      }
    } catch { /* keep raw */ }

    return {
      nfeKey,
      nfeNumber: String(ide.nNF ?? ''),
      nfeSeries: String(ide.serie ?? ''),
      issueDate,
      natOp: String(ide.natOp ?? ''),
      emitter: {
        name: String(emit.xNome ?? ''),
        cnpj: this.formatCnpj(String(emit.CNPJ ?? emit.CPF ?? '')),
        ie: String(emit.IE ?? ''),
        address: `${emitEnd.xLgr ?? ''}, ${emitEnd.nro ?? 'S/N'}${emitEnd.xCpl ? ' - ' + emitEnd.xCpl : ''}`,
        city: String(emitEnd.xMun ?? ''),
        uf: String(emitEnd.UF ?? ''),
        cep: this.formatCep(String(emitEnd.CEP ?? '')),
        phone: this.formatPhone(String(emitEnd.fone ?? emit.fone ?? '')),
      },
      recipient: {
        name: String(dest.xNome ?? ''),
        cnpj: this.formatCnpj(String(dest.CNPJ ?? dest.CPF ?? '')),
        ie: String(dest.IE ?? ''),
        address: `${destEnd.xLgr ?? ''}, ${destEnd.nro ?? 'S/N'}${destEnd.xCpl ? ' - ' + destEnd.xCpl : ''}`,
        city: String(destEnd.xMun ?? ''),
        uf: String(destEnd.UF ?? ''),
        cep: this.formatCep(String(destEnd.CEP ?? '')),
        phone: this.formatPhone(String(destEnd.fone ?? '')),
      },
      items,
      totals: {
        products: parseFloat(String(total.vProd ?? '0')),
        discount: parseFloat(String(total.vDesc ?? '0')),
        freight: parseFloat(String(total.vFrete ?? '0')),
        insurance: parseFloat(String(total.vSeg ?? '0')),
        otherExpenses: parseFloat(String(total.vOutro ?? '0')),
        ipi: parseFloat(String(total.vIPI ?? '0')),
        icms: parseFloat(String(total.vICMS ?? '0')),
        icmsSt: parseFloat(String(total.vST ?? '0')),
        total: parseFloat(String(total.vNF ?? '0')),
      },
      info: String(infAdic.infCpl ?? ''),
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Build PDF using PDFKit
     ═══════════════════════════════════════════════════════════════════ */

  private buildPdf(data: DanfeData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 50; // 25+25 margins
      const leftX = 25;
      let y = 20;

      const FONT_SIZE = 7;
      const FONT_SIZE_SM = 6;
      const FONT_SIZE_LG = 9;
      const FONT_SIZE_XL = 11;
      const LINE_HEIGHT = 10;

      // ── Helper: draw box ──────────────────────────────────────
      const drawBox = (x: number, bY: number, w: number, h: number) => {
        doc.rect(x, bY, w, h).stroke('#999999');
      };

      const drawLabel = (x: number, bY: number, label: string) => {
        doc.font('Helvetica').fontSize(FONT_SIZE_SM).fillColor('#666666')
          .text(label, x + 2, bY + 2, { width: 200 });
      };

      const drawValue = (x: number, bY: number, value: string, opts?: { width?: number; align?: 'left' | 'right' | 'center'; bold?: boolean }) => {
        doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(FONT_SIZE)
          .fillColor('#000000')
          .text(value, x + 2, bY + 10, {
            width: (opts?.width ?? 200) - 4,
            align: opts?.align ?? 'left',
          });
      };

      // ── HEADER ────────────────────────────────────────────────
      const headerH = 80;
      drawBox(leftX, y, pageWidth, headerH);

      // DANFE title
      const titleW = 80;
      drawBox(leftX, y, titleW, headerH);
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_XL).fillColor('#000000')
        .text('DANFE', leftX + 2, y + 5, { width: titleW - 4, align: 'center' });
      doc.font('Helvetica').fontSize(FONT_SIZE_SM).fillColor('#333333')
        .text('Documento Auxiliar da\nNota Fiscal Eletronica', leftX + 2, y + 20, { width: titleW - 4, align: 'center' });
      doc.font('Helvetica').fontSize(FONT_SIZE_SM)
        .text('0 - ENTRADA\n1 - SAIDA', leftX + 2, y + 45, { width: titleW - 4, align: 'center' });

      // Emitter info (center)
      const emitX = leftX + titleW;
      const emitW = pageWidth - titleW - 120;
      drawBox(emitX, y, emitW, headerH);
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_LG).fillColor('#000000')
        .text(data.emitter.name, emitX + 4, y + 5, { width: emitW - 8 });
      doc.font('Helvetica').fontSize(FONT_SIZE).fillColor('#333333')
        .text(data.emitter.address, emitX + 4, y + 20, { width: emitW - 8 });
      doc.text(`${data.emitter.city} - ${data.emitter.uf}  CEP: ${data.emitter.cep}`, emitX + 4, y + 30, { width: emitW - 8 });
      doc.text(`Fone: ${data.emitter.phone}`, emitX + 4, y + 40, { width: emitW - 8 });
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE)
        .text(`CNPJ: ${data.emitter.cnpj}   IE: ${data.emitter.ie}`, emitX + 4, y + 55, { width: emitW - 8 });

      // NFe number (right)
      const nfeNumX = leftX + pageWidth - 120;
      drawBox(nfeNumX, y, 120, headerH);
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_LG).fillColor('#000000')
        .text(`No. ${data.nfeNumber}`, nfeNumX + 4, y + 8, { width: 112, align: 'center' });
      doc.font('Helvetica').fontSize(FONT_SIZE)
        .text(`Serie ${data.nfeSeries}`, nfeNumX + 4, y + 25, { width: 112, align: 'center' });

      y += headerH;

      // ── CHAVE DE ACESSO ───────────────────────────────────────
      const keyH = 25;
      drawBox(leftX, y, pageWidth, keyH);
      drawLabel(leftX, y, 'CHAVE DE ACESSO');
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE)
        .text(this.formatNfeKey(data.nfeKey), leftX + 2, y + 10, { width: pageWidth - 4, align: 'center' });
      y += keyH;

      // ── NAT. OPERACAO + DATA EMISSAO ──────────────────────────
      const natH = 22;
      const natW = pageWidth - 120;
      drawBox(leftX, y, natW, natH);
      drawLabel(leftX, y, 'NATUREZA DA OPERACAO');
      drawValue(leftX, y, data.natOp, { width: natW });

      drawBox(leftX + natW, y, 120, natH);
      drawLabel(leftX + natW, y, 'DATA DE EMISSAO');
      drawValue(leftX + natW, y, data.issueDate, { width: 120, align: 'center' });
      y += natH;

      // ── DESTINATARIO / REMETENTE ──────────────────────────────
      y += 3;
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SM).fillColor('#333333')
        .text('DESTINATARIO / REMETENTE', leftX + 2, y);
      y += 10;

      const destRowH = 22;

      // Row 1: Nome + CNPJ
      const nameW = pageWidth - 140;
      drawBox(leftX, y, nameW, destRowH);
      drawLabel(leftX, y, 'NOME / RAZAO SOCIAL');
      drawValue(leftX, y, data.recipient.name, { width: nameW, bold: true });

      drawBox(leftX + nameW, y, 140, destRowH);
      drawLabel(leftX + nameW, y, 'CNPJ / CPF');
      drawValue(leftX + nameW, y, data.recipient.cnpj, { width: 140 });
      y += destRowH;

      // Row 2: Endereco + Cidade/UF + CEP
      const addrW = pageWidth - 180 - 80;
      drawBox(leftX, y, addrW, destRowH);
      drawLabel(leftX, y, 'ENDERECO');
      drawValue(leftX, y, data.recipient.address, { width: addrW });

      drawBox(leftX + addrW, y, 180, destRowH);
      drawLabel(leftX + addrW, y, 'MUNICIPIO / UF');
      drawValue(leftX + addrW, y, `${data.recipient.city} / ${data.recipient.uf}`, { width: 180 });

      drawBox(leftX + addrW + 180, y, 80, destRowH);
      drawLabel(leftX + addrW + 180, y, 'CEP');
      drawValue(leftX + addrW + 180, y, data.recipient.cep, { width: 80 });
      y += destRowH;

      // ── TOTALS ROW ────────────────────────────────────────────
      y += 3;
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SM).fillColor('#333333')
        .text('CALCULO DO IMPOSTO', leftX + 2, y);
      y += 10;

      const totRowH = 22;
      const totColW = pageWidth / 5;

      const totals = [
        { label: 'VALOR PRODUTOS', value: data.totals.products },
        { label: 'VALOR ICMS', value: data.totals.icms },
        { label: 'VALOR FRETE', value: data.totals.freight },
        { label: 'VALOR DESCONTO', value: data.totals.discount },
        { label: 'VALOR TOTAL NF', value: data.totals.total },
      ];

      totals.forEach((t, i) => {
        const tx = leftX + i * totColW;
        drawBox(tx, y, totColW, totRowH);
        drawLabel(tx, y, t.label);
        drawValue(tx, y, this.formatMoney(t.value), {
          width: totColW,
          align: 'right',
          bold: i === totals.length - 1,
        });
      });
      y += totRowH;

      // ── ITEMS TABLE ───────────────────────────────────────────
      y += 3;
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SM).fillColor('#333333')
        .text('DADOS DOS PRODUTOS / SERVICOS', leftX + 2, y);
      y += 10;

      // Column widths
      const colWidths = [30, 50, 160, 50, 35, 30, 50, 55, 55];
      const colHeaders = ['ITEM', 'CODIGO', 'DESCRICAO', 'NCM', 'CFOP', 'UN', 'QUANT', 'V.UNIT', 'V.TOTAL'];

      // Header row
      const itemHeaderH = 14;
      let cx = leftX;
      colHeaders.forEach((h, i) => {
        drawBox(cx, y, colWidths[i], itemHeaderH);
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SM).fillColor('#333333')
          .text(h, cx + 2, y + 3, { width: colWidths[i] - 4, align: 'center' });
        cx += colWidths[i];
      });
      y += itemHeaderH;

      // Item rows
      const itemRowH = 12;
      for (const item of data.items) {
        // Check page break
        if (y + itemRowH > doc.page.height - 60) {
          doc.addPage();
          y = 20;
        }

        const values = [
          String(item.num),
          item.code,
          item.description,
          item.ncm,
          item.cfop,
          item.unit,
          this.formatQty(item.quantity),
          this.formatMoney(item.unitPrice),
          this.formatMoney(item.total),
        ];

        cx = leftX;
        values.forEach((v, i) => {
          drawBox(cx, y, colWidths[i], itemRowH);
          const align = i >= 6 ? 'right' : i <= 1 ? 'center' : 'left';
          doc.font('Helvetica').fontSize(FONT_SIZE_SM).fillColor('#000000')
            .text(v, cx + 1, y + 2, {
              width: colWidths[i] - 2,
              align,
              ellipsis: true,
              lineBreak: false,
            });
          cx += colWidths[i];
        });
        y += itemRowH;
      }

      // ── INFORMACOES ADICIONAIS ────────────────────────────────
      if (data.info) {
        y += 5;
        if (y + 40 > doc.page.height - 30) {
          doc.addPage();
          y = 20;
        }
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_SM).fillColor('#333333')
          .text('INFORMACOES COMPLEMENTARES', leftX + 2, y);
        y += 10;

        const infoH = Math.min(60, Math.max(30, Math.ceil(data.info.length / 100) * LINE_HEIGHT + 10));
        drawBox(leftX, y, pageWidth, infoH);
        doc.font('Helvetica').fontSize(FONT_SIZE_SM).fillColor('#333333')
          .text(data.info, leftX + 3, y + 3, { width: pageWidth - 6 });
      }

      doc.end();
    });
  }

  /* ── Formatters ────────────────────────────────────────────── */

  private formatCnpj(cnpj: string): string {
    if (cnpj.length === 14) {
      return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (cnpj.length === 11) {
      return cnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return cnpj;
  }

  private formatCep(cep: string): string {
    if (cep.length === 8) {
      return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    }
    return cep;
  }

  private formatPhone(phone: string): string {
    if (phone.length === 10) {
      return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }
    if (phone.length === 11) {
      return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }
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
}
