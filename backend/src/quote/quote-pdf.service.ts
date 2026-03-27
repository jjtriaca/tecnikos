import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const ITEM_TYPE_LABELS: Record<string, string> = {
  SERVICE: 'Serviço',
  PRODUCT: 'Produto',
  LABOR: 'Mão de Obra',
};

function formatMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDoc(doc: string | null | undefined, type?: string | null): string {
  if (!doc) return '';
  const c = doc.replace(/\D/g, '');
  if (c.length === 14) return `CNPJ: ${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  if (c.length === 11) return `CPF: ${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  return `${type || 'Doc'}: ${doc}`;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
}

function loadLogo(company: any): Buffer | null {
  const logoPath = company.logoUrl
    ? path.resolve(UPLOAD_DIR, company.logoUrl.replace(/^\/uploads\//, ''))
    : null;
  if (logoPath && fs.existsSync(logoPath)) return fs.readFileSync(logoPath);
  return null;
}

function buildAddress(obj: any): string {
  return [obj.addressStreet, obj.addressNumber ? `, ${obj.addressNumber}` : '', obj.neighborhood ? ` - ${obj.neighborhood}` : '', obj.city ? `, ${obj.city}` : '', obj.state ? `/${obj.state}` : '', obj.cep ? ` - CEP: ${obj.cep}` : ''].join('').trim();
}

// Shared: draw quote items table
function drawQuoteItems(doc: any, items: any[], y: number, margin: number, pageW: number, headerBg: string, headerText: string): number {
  if (!items || items.length === 0) return y;

  const cols = [
    { label: '#', w: 22, align: 'center' },
    { label: 'Descrição', w: 0, align: 'left' },
    { label: 'Tipo', w: 48, align: 'center' },
    { label: 'Unid.', w: 35, align: 'center' },
    { label: 'Qtde', w: 35, align: 'right' },
    { label: 'Valor Unit.', w: 65, align: 'right' },
    { label: 'Desc.%', w: 38, align: 'right' },
    { label: 'Total', w: 70, align: 'right' },
  ];
  const fixedW = cols.reduce((s, c) => s + c.w, 0);
  cols[1].w = pageW - fixedW;

  let x = margin;
  doc.rect(margin, y, pageW, 15).fill(headerBg);
  doc.fill(headerText).font('Helvetica-Bold').fontSize(7);
  for (const col of cols) {
    doc.text(col.label, x + 3, y + 4, { width: col.w - 6, align: col.align as any });
    x += col.w;
  }
  y += 15;

  doc.font('Helvetica').fontSize(7);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (y > doc.page.height - 100) { doc.addPage(); y = 30; }
    if (i % 2 === 0) { doc.rect(margin, y, pageW, 14).fill('#f9fafb'); doc.fill('#111827'); } else { doc.fill('#111827'); }

    x = margin;
    const rowY = y + 3;
    doc.text(String(i + 1), x + 3, rowY, { width: cols[0].w - 6, align: 'center' }); x += cols[0].w;
    doc.text(item.description || '', x + 3, rowY, { width: cols[1].w - 6, align: 'left' }); x += cols[1].w;
    doc.text(ITEM_TYPE_LABELS[item.type] || item.type || '', x + 3, rowY, { width: cols[2].w - 6, align: 'center' }); x += cols[2].w;
    doc.text(item.unit || '', x + 3, rowY, { width: cols[3].w - 6, align: 'center' }); x += cols[3].w;
    doc.text(String(item.quantity || 1), x + 3, rowY, { width: cols[4].w - 6, align: 'right' }); x += cols[4].w;
    doc.text(formatMoney(item.unitPriceCents || 0), x + 3, rowY, { width: cols[5].w - 6, align: 'right' }); x += cols[5].w;
    doc.text(item.discountPercent ? `${item.discountPercent}%` : '-', x + 3, rowY, { width: cols[6].w - 6, align: 'right' }); x += cols[6].w;
    doc.font('Helvetica-Bold').text(formatMoney(item.totalCents || 0), x + 3, rowY, { width: cols[7].w - 6, align: 'right' });
    doc.font('Helvetica');
    y += 14;
  }

  doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
  return y + 6;
}

// Shared: draw totals section
function drawTotals(doc: any, quote: any, y: number, margin: number, pageW: number, totalBg: string, totalText: string): number {
  const totalsX = margin + pageW - 200;
  doc.font('Helvetica').fontSize(8).fill('#374151');
  doc.text('Subtotal:', totalsX, y, { width: 120, align: 'right' });
  doc.text(formatMoney(quote.subtotalCents), totalsX + 125, y, { width: 75, align: 'right' });
  y += 14;

  if ((quote.discountPercent && quote.discountPercent > 0) || (quote.discountCents && quote.discountCents > 0)) {
    const discountLabel = quote.discountPercent ? `Desconto (${quote.discountPercent}%):` : 'Desconto:';
    const discountValue = quote.subtotalCents - quote.totalCents;
    doc.fill('#dc2626');
    doc.text(discountLabel, totalsX, y, { width: 120, align: 'right' });
    doc.text(`- ${formatMoney(discountValue)}`, totalsX + 125, y, { width: 75, align: 'right' });
    doc.fill('#374151');
    y += 14;
  }

  if (quote.productValueCents && quote.productValueCents > 0) {
    doc.text('Valor Produtos:', totalsX, y, { width: 120, align: 'right' });
    doc.text(formatMoney(quote.productValueCents), totalsX + 125, y, { width: 75, align: 'right' });
    y += 14;
  }

  doc.rect(totalsX, y, 200, 20).fill(totalBg);
  doc.fill(totalText).font('Helvetica-Bold').fontSize(10);
  doc.text('TOTAL:', totalsX + 5, y + 4, { width: 110, align: 'right' });
  doc.text(formatMoney(quote.totalCents), totalsX + 125, y + 4, { width: 70, align: 'right' });
  doc.fill('#000000');
  return y + 28;
}

// Shared: draw terms, validity, footer
function drawQuoteFooterContent(doc: any, quote: any, y: number, margin: number, pageW: number, labelColor: string): number {
  if (quote.termsConditions) {
    if (y > doc.page.height - 100) { doc.addPage(); y = 30; }
    doc.font('Helvetica-Bold').fontSize(7).fill(labelColor).text('TERMOS E CONDIÇÕES', margin, y);
    y = doc.y + 3;
    doc.font('Helvetica').fontSize(7).fill('#4b5563').text(quote.termsConditions, margin, y, { width: pageW });
    y = doc.y + 8;
  }
  doc.font('Helvetica').fontSize(7.5).fill('#6b7280');
  const validText = quote.expiresAt ? `Válido até ${formatDate(quote.expiresAt)} (${quote.validityDays} dias)` : `Validade: ${quote.validityDays} dias`;
  doc.text(validText, margin, y, { width: pageW });
  return doc.y + 10;
}

function drawFooter(doc: any, margin: number, pageW: number) {
  const footerY = doc.page.height - 35;
  doc.moveTo(margin, footerY - 3).lineTo(margin + pageW, footerY - 3).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6).fill('#9ca3af');
  doc.text(`Gerado por Tecnikos em ${new Date().toLocaleString('pt-BR')}`, margin, footerY, { width: pageW, align: 'center' });
}

@Injectable()
export class QuotePdfService {
  constructor(private readonly prisma: PrismaService) {}

  private async getLayoutConfig(companyId: string): Promise<number> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { systemConfig: true } });
    return (company?.systemConfig as any)?.pdf?.osLayout || 1;
  }

  async generatePdf(quoteId: string, companyId: string): Promise<Buffer> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      include: { company: true, clientPartner: true, items: { orderBy: { sortOrder: 'asc' } }, attachments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');

    const layout = await this.getLayoutConfig(companyId);
    let mainPdf: Buffer;
    switch (layout) {
      case 2: mainPdf = await this.buildLayout2(quote); break;
      case 3: mainPdf = await this.buildLayout3(quote); break;
      case 4: mainPdf = await this.buildLayout4(quote); break;
      default: mainPdf = await this.buildLayout1(quote); break;
    }

    const pdfAttachments = (quote.attachments || []).filter((a: any) => a.mimeType === 'application/pdf');
    if (pdfAttachments.length === 0) return mainPdf;

    try {
      const merged = await PDFLibDocument.create();
      const mainDoc = await PDFLibDocument.load(mainPdf);
      (await merged.copyPages(mainDoc, mainDoc.getPageIndices())).forEach((p) => merged.addPage(p));
      for (const att of pdfAttachments) {
        const filePath = path.join(UPLOAD_DIR, (att as any).filePath.replace(/^\/?uploads\//, ''));
        if (!fs.existsSync(filePath)) continue;
        try {
          const attDoc = await PDFLibDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true });
          (await merged.copyPages(attDoc, attDoc.getPageIndices())).forEach((p) => merged.addPage(p));
        } catch { /* skip */ }
      }
      return Buffer.from(await merged.save());
    } catch { return mainPdf; }
  }

  // Layout 1 — Executivo (same structure as OS layout 1)
  private buildLayout1(quote: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 40;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const pageW = doc.page.width - margin * 2;
      const company = quote.company;
      const client = quote.clientPartner;
      const logo = loadLogo(company);
      let y = margin;

      if (logo) doc.image(logo, margin, y, { width: company.logoWidth || 90, height: company.logoHeight || 32 });
      const compX = 200;
      doc.font('Helvetica-Bold').fontSize(11).fill('#111827').text(company.tradeName || company.name, compX, y, { width: pageW - 160 });
      y = doc.y + 1;
      doc.font('Helvetica').fontSize(7).fill('#6b7280');
      if (company.cnpj) { doc.text(formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, ''), compX, y); y = doc.y; }
      const compAddr = buildAddress(company);
      if (compAddr) { doc.text(compAddr, compX, y, { width: pageW - 160 }); y = doc.y; }
      const compContacts = [company.phone ? formatPhone(company.phone) : '', company.email || ''].filter(Boolean).join('  |  ');
      if (compContacts) doc.text(compContacts, compX, y);
      y = Math.max(doc.y, y) + 12;

      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      y += 10;

      doc.font('Helvetica-Bold').fontSize(16).fill('#111827').text(`${quote.code || 'ORC'}`, margin, y);
      doc.font('Helvetica').fontSize(8).fill('#6b7280').text(formatDate(quote.createdAt), margin, y + 4, { width: pageW, align: 'right' });
      y = doc.y + 8;

      if (quote.title) { doc.font('Helvetica-Bold').fontSize(11).fill('#374151').text(quote.title, margin, y, { width: pageW }); y = doc.y + 3; }
      if (quote.description) { doc.font('Helvetica').fontSize(8).fill('#4b5563').text(quote.description, margin, y, { width: pageW }); y = doc.y + 6; }
      y += 4;

      // Two columns: client | validity info
      const colW = (pageW - 20) / 2;
      const infoY = y;
      doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af').text('CLIENTE', margin, infoY);
      let ly = infoY + 11;
      if (client) {
        doc.font('Helvetica-Bold').fontSize(8.5).fill('#111827').text(client.name, margin, ly, { width: colW }); ly = doc.y + 1;
        doc.font('Helvetica').fontSize(7).fill('#4b5563');
        if (client.document) { doc.text(formatDoc(client.document, client.documentType), margin, ly, { width: colW }); ly = doc.y; }
        if (client.phone) { doc.text(`Tel: ${formatPhone(client.phone)}`, margin, ly); ly = doc.y; }
        if (client.email) { doc.text(client.email, margin, ly); ly = doc.y; }
      }
      const rX = margin + colW + 20;
      doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af').text('INFORMAÇÕES', rX, infoY);
      let ry = infoY + 11;
      doc.font('Helvetica').fontSize(7.5).fill('#4b5563');
      const validText = quote.expiresAt ? `Válido até ${formatDate(quote.expiresAt)} (${quote.validityDays} dias)` : `${quote.validityDays} dias`;
      doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('Validade', rX, ry); ry = doc.y;
      doc.font('Helvetica').fontSize(7.5).fill('#111827').text(validText, rX, ry); ry = doc.y + 5;
      y = Math.max(ly, ry) + 14;

      y = drawQuoteItems(doc, quote.items, y, margin, pageW, '#f3f4f6', '#374151');
      y += 4;
      y = drawTotals(doc, quote, y, margin, pageW, '#111827', '#ffffff');

      if (quote.termsConditions) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; }
        doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af').text('TERMOS E CONDIÇÕES', margin, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(quote.termsConditions, margin, y, { width: pageW });
        y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }

  // Layout 2 — Corporativo (dark header band)
  private buildLayout2(quote: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 35;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const pageW = doc.page.width - margin * 2;
      const company = quote.company;
      const client = quote.clientPartner;
      const logo = loadLogo(company);

      doc.rect(0, 0, doc.page.width, 80).fill('#1f2937');
      if (logo) doc.image(logo, margin, 15, { width: company.logoWidth || 80, height: company.logoHeight || 30 });
      const compX = 180;
      doc.font('Helvetica-Bold').fontSize(12).fill('#ffffff').text(company.tradeName || company.name, compX, 18, { width: pageW - 140 });
      doc.font('Helvetica').fontSize(7).fill('#d1d5db');
      const headerInfo = [company.cnpj ? formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, '') : '', company.phone ? formatPhone(company.phone) : '', company.email || ''].filter(Boolean).join('  |  ');
      doc.text(headerInfo, compX, doc.y + 1, { width: pageW - 140 });
      doc.font('Helvetica-Bold').fontSize(18).fill('#ffffff').text(quote.code || 'ORC', margin, 16, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(8).fill('#9ca3af').text(`Orçamento  |  ${formatDate(quote.createdAt)}`, margin, 38, { width: pageW, align: 'right' });

      let y = 95;
      if (quote.title) { doc.font('Helvetica-Bold').fontSize(12).fill('#1f2937').text(quote.title, margin, y, { width: pageW }); y = doc.y + 2; }
      if (quote.description) { doc.font('Helvetica').fontSize(8).fill('#4b5563').text(quote.description, margin, y, { width: pageW }); y = doc.y + 4; }
      y += 8;

      // Client box
      const clientH = client ? 68 : 20;
      doc.rect(margin, y, pageW, clientH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.rect(margin, y, pageW, 14).fill('#f9fafb');
      doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('CLIENTE', margin + 8, y + 4);
      y += 18;
      if (client) {
        doc.font('Helvetica-Bold').fontSize(8.5).fill('#111827').text(client.name, margin + 8, y); y = doc.y + 1;
        doc.font('Helvetica').fontSize(7).fill('#4b5563');
        if (client.document) doc.text(formatDoc(client.document, client.documentType), margin + 8, y);
        if (client.phone) doc.text(`Tel: ${formatPhone(client.phone)}`, margin + pageW / 2, y - (client.document ? 9 : 0));
        y = doc.y + 1;
        if (client.email) doc.text(client.email, margin + 8, y);
      }
      y += 18;

      y = drawQuoteItems(doc, quote.items, y, margin, pageW, '#1f2937', '#ffffff');
      y += 4;
      y = drawTotals(doc, quote, y, margin, pageW, '#1f2937', '#ffffff');
      y = drawQuoteFooterContent(doc, quote, y, margin, pageW, '#6b7280');
      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }

  // Layout 3 — Moderno (stipple stripe, soft blue)
  private buildLayout3(quote: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 40;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const pageW = doc.page.width - margin * 2;
      const company = quote.company;
      const client = quote.clientPartner;
      const logo = loadLogo(company);
      const ACCENT = '#93b5e1';
      const ACCENT_DARK = '#5b8bc9';
      const ACCENT_TEXT = '#4a7ab5';
      let y = margin;

      // Stipple stripe
      doc.save();
      for (let dy = 0; dy < doc.page.height; dy += 3.5) {
        for (let dx = 1; dx < 8; dx += 3.5) {
          const offset = (Math.floor(dy / 3.5) % 2 === 0) ? 0 : 1.75;
          doc.circle(dx + offset, dy, 0.7).fill(ACCENT);
        }
      }
      doc.restore();

      if (logo) doc.image(logo, margin, y, { width: company.logoWidth || 80, height: company.logoHeight || 30 });
      doc.font('Helvetica-Bold').fontSize(9).fill('#374151').text(company.tradeName || company.name, margin, y, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(7).fill('#6b7280');
      if (company.cnpj) doc.text(formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, 'CNPJ '), margin, doc.y, { width: pageW, align: 'right' });
      const compAddr = buildAddress(company);
      if (compAddr) doc.text(compAddr, margin, doc.y, { width: pageW, align: 'right' });
      const compContacts = [company.phone ? formatPhone(company.phone) : '', company.email || ''].filter(Boolean).join('  |  ');
      if (compContacts) doc.text(compContacts, margin, doc.y, { width: pageW, align: 'right' });
      y = Math.max(doc.y, y) + 20;

      doc.font('Helvetica-Bold').fontSize(22).fill(ACCENT_DARK).text(quote.code || 'ORC', margin, y);
      const codeBottom = doc.y;
      doc.font('Helvetica').fontSize(9).fill('#9ca3af').text('ORÇAMENTO', margin, codeBottom + 1);
      doc.font('Helvetica').fontSize(7).fill('#9ca3af').text(formatDate(quote.createdAt), margin, y + 16, { width: pageW, align: 'right' });
      y = codeBottom + 18;

      doc.save();
      doc.moveTo(margin, y).lineTo(margin + pageW, y).dash(2, { space: 3 }).strokeColor(ACCENT).lineWidth(1).stroke();
      doc.undash();
      doc.restore();
      y += 12;

      if (quote.title) { doc.font('Helvetica-Bold').fontSize(11).fill('#111827').text(quote.title, margin, y, { width: pageW }); y = doc.y + 2; }
      if (quote.description) { doc.font('Helvetica').fontSize(8).fill('#4b5563').text(quote.description, margin, y, { width: pageW }); y = doc.y + 6; }
      y += 6;

      // Two columns
      const colW = (pageW - 16) / 2;
      const gridY = y;
      doc.font('Helvetica-Bold').fontSize(8).fill(ACCENT_TEXT).text('Cliente', margin, gridY);
      let ly = gridY + 12;
      if (client) {
        doc.font('Helvetica-Bold').fontSize(8.5).fill('#111827').text(client.name, margin, ly, { width: colW }); ly = doc.y + 1;
        doc.font('Helvetica').fontSize(7).fill('#4b5563');
        if (client.document) { doc.text(formatDoc(client.document, client.documentType), margin, ly, { width: colW }); ly = doc.y; }
        if (client.phone) { doc.text(formatPhone(client.phone), margin, ly); ly = doc.y; }
        if (client.email) { doc.text(client.email, margin, ly); ly = doc.y; }
      }
      const rX = margin + colW + 16;
      doc.font('Helvetica-Bold').fontSize(8).fill(ACCENT_TEXT).text('Informações', rX, gridY);
      let ry = gridY + 12;
      doc.font('Helvetica-Bold').fontSize(6.5).fill('#9ca3af').text('Validade', rX, ry);
      const validText = quote.expiresAt ? `Até ${formatDate(quote.expiresAt)} (${quote.validityDays} dias)` : `${quote.validityDays} dias`;
      doc.font('Helvetica').fontSize(7.5).fill('#111827').text(validText, rX, doc.y); ry = doc.y + 5;
      y = Math.max(ly, ry) + 14;

      y = drawQuoteItems(doc, quote.items, y, margin, pageW, ACCENT, '#374151');
      y += 4;
      y = drawTotals(doc, quote, y, margin, pageW, ACCENT_DARK, '#ffffff');

      if (quote.termsConditions) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; }
        doc.font('Helvetica-Bold').fontSize(8).fill(ACCENT_TEXT).text('Termos e Condições', margin, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(quote.termsConditions, margin, y, { width: pageW });
        y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }

  // Layout 4 — Minimalista
  private buildLayout4(quote: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 50;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const pageW = doc.page.width - margin * 2;
      const company = quote.company;
      const client = quote.clientPartner;
      const logo = loadLogo(company);
      let y = margin;

      if (logo) doc.image(logo, margin, y, { width: company.logoWidth || 70, height: company.logoHeight || 26 });
      doc.font('Helvetica-Bold').fontSize(20).fill('#374151').text(quote.code || 'ORC', margin, y, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(7).fill('#9ca3af').text('Orçamento', margin, doc.y, { width: pageW, align: 'right' });
      y = Math.max(doc.y, y + 30) + 6;
      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      y += 8;

      const compLine = [company.tradeName || company.name, company.cnpj ? formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, '') : '', company.phone ? formatPhone(company.phone) : ''].filter(Boolean).join('  |  ');
      doc.font('Helvetica').fontSize(7).fill('#9ca3af').text(compLine, margin, y, { width: pageW });
      doc.text(formatDate(quote.createdAt), margin, y, { width: pageW, align: 'right' });
      y = doc.y + 16;

      if (quote.title) { doc.font('Helvetica-Bold').fontSize(13).fill('#111827').text(quote.title, margin, y, { width: pageW }); y = doc.y + 3; }
      if (quote.description) { doc.font('Helvetica').fontSize(8).fill('#6b7280').text(quote.description, margin, y, { width: pageW }); y = doc.y + 8; }
      y += 4;

      // Field cards
      const drawField = (label: string, value: string, x: number, w: number) => {
        doc.font('Helvetica').fontSize(6).fill('#9ca3af').text(label.toUpperCase(), x, y);
        doc.font('Helvetica').fontSize(8).fill('#111827').text(value, x, doc.y + 1, { width: w });
      };

      const c3w = (pageW - 20) / 3;
      if (client) {
        drawField('Cliente', client.name, margin, c3w);
        if (client.document) drawField('Documento', formatDoc(client.document, client.documentType).replace(/^(CNPJ|CPF): /, ''), margin + c3w + 10, c3w);
        if (client.phone) drawField('Telefone', formatPhone(client.phone), margin + (c3w + 10) * 2, c3w);
        y = doc.y + 8;
      }
      const validText = quote.expiresAt ? `Até ${formatDate(quote.expiresAt)} (${quote.validityDays} dias)` : `${quote.validityDays} dias`;
      drawField('Validade', validText, margin, pageW);
      y = doc.y + 10;

      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      y += 10;

      y = drawQuoteItems(doc, quote.items, y, margin, pageW, '#f3f4f6', '#374151');
      y += 6;

      // Minimalist total
      doc.font('Helvetica').fontSize(8).fill('#9ca3af').text('Total', margin, y, { width: pageW - 5, align: 'right' }); y = doc.y + 1;
      doc.font('Helvetica-Bold').fontSize(14).fill('#111827').text(formatMoney(quote.totalCents), margin, y, { width: pageW - 5, align: 'right' });
      y = doc.y + 16;

      if (quote.termsConditions) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; }
        doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke(); y += 8;
        doc.font('Helvetica').fontSize(6).fill('#9ca3af').text('TERMOS E CONDIÇÕES', margin, y); y = doc.y + 3;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(quote.termsConditions, margin, y, { width: pageW }); y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }
}
