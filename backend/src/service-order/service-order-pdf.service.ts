import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  OFERTADA: 'Ofertada',
  ATRIBUIDA: 'Atribuída',
  A_CAMINHO: 'A Caminho',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA: 'Concluída',
  APROVADA: 'Aprovada',
  AJUSTE: 'Ajuste',
  CANCELADA: 'Cancelada',
  RECUSADA: 'Recusada',
};

function formatMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDoc(doc: string | null | undefined, type?: string | null): string {
  if (!doc) return '';
  const c = doc.replace(/\D/g, '');
  if (c.length === 14) {
    return `CNPJ: ${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  }
  if (c.length === 11) {
    return `CPF: ${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }
  return `${type || 'Doc'}: ${doc}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function loadLogo(company: any): Buffer | null {
  const logoPath = company.logoUrl
    ? path.resolve(UPLOAD_DIR, company.logoUrl.replace(/^\/uploads\//, ''))
    : null;
  if (logoPath && fs.existsSync(logoPath)) {
    return fs.readFileSync(logoPath);
  }
  return null;
}

function buildAddress(obj: any): string {
  return [
    obj.addressStreet,
    obj.addressNumber ? `, ${obj.addressNumber}` : '',
    obj.neighborhood ? ` - ${obj.neighborhood}` : '',
    obj.city ? `, ${obj.city}` : '',
    obj.state ? `/${obj.state}` : '',
    obj.cep ? ` - CEP: ${obj.cep}` : '',
  ].join('').trim();
}

function buildClientAddress(client: any): string {
  return [
    client.addressStreet,
    client.addressNumber ? `, ${client.addressNumber}` : '',
    client.neighborhood ? ` - ${client.neighborhood}` : '',
    client.city ? `, ${client.city}` : '',
    client.state ? `/${client.state}` : '',
  ].join('').trim();
}

// Helper: draw items table (shared across layouts)
function drawItemsTable(doc: any, items: any[], y: number, margin: number, pageW: number, headerBg: string, headerText: string, accentColor: string): number {
  if (items.length === 0) return y;

  const cols = [
    { label: '#', w: 22, align: 'center' },
    { label: 'Descrição', w: 0, align: 'left' }, // fill remaining
    { label: 'Unid.', w: 40, align: 'center' },
    { label: 'Qtde', w: 40, align: 'right' },
    { label: 'Valor Unit.', w: 70, align: 'right' },
    { label: 'Total', w: 75, align: 'right' },
  ];
  const fixedW = cols.reduce((s, c) => s + c.w, 0);
  cols[1].w = pageW - fixedW;

  // Header
  let x = margin;
  doc.rect(margin, y, pageW, 15).fill(headerBg);
  doc.fill(headerText).font('Helvetica-Bold').fontSize(7);
  for (const col of cols) {
    doc.text(col.label, x + 3, y + 4, { width: col.w - 6, align: col.align as any });
    x += col.w;
  }
  y += 15;

  // Rows
  doc.font('Helvetica').fontSize(7);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (y > doc.page.height - 100) { doc.addPage(); y = 30; }

    if (i % 2 === 0) {
      doc.rect(margin, y, pageW, 14).fill('#f9fafb');
      doc.fill('#111827');
    } else {
      doc.fill('#111827');
    }

    x = margin;
    const rowY = y + 3;
    const description = item.service?.name || item.description || 'Serviço';
    const unit = item.unit || item.service?.unit || 'un';
    const qty = item.quantity || 1;
    const unitPrice = item.unitPriceCents || item.service?.priceCents || 0;
    const total = unitPrice * qty;

    doc.text(String(i + 1), x + 3, rowY, { width: cols[0].w - 6, align: 'center' });
    x += cols[0].w;
    doc.text(description, x + 3, rowY, { width: cols[1].w - 6, align: 'left' });
    x += cols[1].w;
    doc.text(unit, x + 3, rowY, { width: cols[2].w - 6, align: 'center' });
    x += cols[2].w;
    doc.text(String(qty), x + 3, rowY, { width: cols[3].w - 6, align: 'right' });
    x += cols[3].w;
    doc.text(formatMoney(unitPrice), x + 3, rowY, { width: cols[4].w - 6, align: 'right' });
    x += cols[4].w;
    doc.font('Helvetica-Bold').text(formatMoney(total), x + 3, rowY, { width: cols[5].w - 6, align: 'right' });
    doc.font('Helvetica');

    y += 14;
  }

  doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
  return y + 6;
}

// Helper: draw footer
function drawFooter(doc: any, margin: number, pageW: number) {
  const footerY = doc.page.height - 35;
  doc.moveTo(margin, footerY - 3).lineTo(margin + pageW, footerY - 3).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6).fill('#9ca3af');
  doc.text(`Gerado por Tecnikos em ${new Date().toLocaleString('pt-BR')}`, margin, footerY, { width: pageW, align: 'center' });
}

@Injectable()
export class ServiceOrderPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(serviceOrderId: string, companyId: string, layout = 1): Promise<Buffer> {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      include: {
        company: true,
        clientPartner: { select: { id: true, name: true, phone: true, email: true, document: true, documentType: true, addressStreet: true, addressNumber: true, neighborhood: true, city: true, state: true, cep: true } },
        assignedPartner: { select: { id: true, name: true, phone: true } },
        items: { include: { service: { select: { id: true, name: true, unit: true, priceCents: true } } } },
      },
    });
    if (!so) throw new NotFoundException('OS não encontrada');

    switch (layout) {
      case 2: return this.buildLayout2(so);
      case 3: return this.buildLayout3(so);
      case 4: return this.buildLayout4(so);
      default: return this.buildLayout1(so);
    }
  }

  // ============================================================
  // LAYOUT 1 — "Executivo"
  // Limpo, linhas finas cinza, tipografia elegante, sem cores pesadas
  // ============================================================
  private buildLayout1(so: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 40;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - margin * 2;
      const company = so.company;
      const client = so.clientPartner;
      const logo = loadLogo(company);
      let y = margin;

      // --- Header ---
      if (logo) {
        doc.image(logo, margin, y, { width: company.logoWidth || 90, height: company.logoHeight || 32 });
      }

      const compX = 200;
      doc.font('Helvetica-Bold').fontSize(11).fill('#111827');
      doc.text(company.tradeName || company.name, compX, y, { width: pageW - 160 });
      y = doc.y + 1;
      doc.font('Helvetica').fontSize(7).fill('#6b7280');
      const compAddr = buildAddress(company);
      if (company.cnpj) { doc.text(`CNPJ: ${formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, '')}`, compX, y); y = doc.y; }
      if (compAddr) { doc.text(compAddr, compX, y, { width: pageW - 160 }); y = doc.y; }
      const compContacts = [company.phone ? `Tel: ${formatPhone(company.phone)}` : '', company.email || ''].filter(Boolean).join('  |  ');
      if (compContacts) { doc.text(compContacts, compX, y); }
      y = Math.max(doc.y, y) + 12;

      // --- Thin separator ---
      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      y += 10;

      // --- OS Code + Status badge ---
      doc.font('Helvetica-Bold').fontSize(16).fill('#111827');
      doc.text(`${so.code || 'OS'}`, margin, y);
      const statusLabel = STATUS_LABELS[so.status] || so.status;
      doc.font('Helvetica').fontSize(8).fill('#6b7280');
      doc.text(`${statusLabel}  |  ${formatDate(so.createdAt)}`, margin, y + 4, { width: pageW, align: 'right' });
      y = doc.y + 8;

      // --- Title ---
      if (so.title) {
        doc.font('Helvetica-Bold').fontSize(11).fill('#374151');
        doc.text(so.title, margin, y, { width: pageW });
        y = doc.y + 3;
      }
      if (so.description) {
        doc.font('Helvetica').fontSize(8).fill('#4b5563');
        doc.text(so.description, margin, y, { width: pageW });
        y = doc.y + 6;
      }

      y += 4;

      // --- Two-column info: Cliente | Detalhes ---
      const colW = (pageW - 20) / 2;
      const leftX = margin;
      const rightX = margin + colW + 20;
      const infoY = y;

      // Left: Client
      doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af');
      doc.text('CLIENTE', leftX, infoY);
      let ly = infoY + 11;
      if (client) {
        doc.font('Helvetica-Bold').fontSize(8.5).fill('#111827');
        doc.text(client.name, leftX, ly, { width: colW }); ly = doc.y + 1;
        doc.font('Helvetica').fontSize(7).fill('#4b5563');
        if (client.document) { doc.text(formatDoc(client.document, client.documentType), leftX, ly, { width: colW }); ly = doc.y; }
        if (client.phone) { doc.text(`Tel: ${formatPhone(client.phone)}`, leftX, ly, { width: colW }); ly = doc.y; }
        if (client.email) { doc.text(client.email, leftX, ly, { width: colW }); ly = doc.y; }
        const cAddr = buildClientAddress(client);
        if (cAddr) { doc.text(cAddr, leftX, ly, { width: colW }); ly = doc.y; }
      }

      // Right: Details
      doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af');
      doc.text('DETALHES', rightX, infoY);
      let ry = infoY + 11;
      doc.font('Helvetica').fontSize(7.5).fill('#4b5563');
      if (so.addressText) {
        doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('Endereço do Serviço', rightX, ry, { width: colW }); ry = doc.y;
        doc.font('Helvetica').fontSize(7.5).fill('#111827').text(so.addressText, rightX, ry, { width: colW }); ry = doc.y + 4;
      }
      if (so.assignedPartner?.name) {
        doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('Técnico', rightX, ry); ry = doc.y;
        doc.font('Helvetica').fontSize(7.5).fill('#111827').text(`${so.assignedPartner.name}${so.assignedPartner.phone ? '  |  ' + formatPhone(so.assignedPartner.phone) : ''}`, rightX, ry, { width: colW }); ry = doc.y + 4;
      }
      if (so.scheduledStartAt) {
        doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('Agendamento', rightX, ry); ry = doc.y;
        doc.font('Helvetica').fontSize(7.5).fill('#111827').text(formatDateTime(so.scheduledStartAt), rightX, ry); ry = doc.y + 4;
      }
      if (so.deadlineAt) {
        doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('Prazo', rightX, ry); ry = doc.y;
        doc.font('Helvetica').fontSize(7.5).fill('#111827').text(formatDate(so.deadlineAt), rightX, ry); ry = doc.y + 4;
      }

      y = Math.max(ly, ry) + 14;

      // --- Items ---
      y = drawItemsTable(doc, so.items || [], y, margin, pageW, '#f3f4f6', '#374151', '#111827');
      y += 4;

      // --- Total ---
      const tX = margin + pageW - 180;
      doc.rect(tX, y, 180, 22).fill('#111827');
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text('TOTAL:', tX + 8, y + 5, { width: 90, align: 'right' });
      doc.text(formatMoney(so.valueCents || 0), tX + 105, y + 5, { width: 68, align: 'right' });
      doc.fill('#000000');
      y += 30;

      // --- Notes ---
      if (so.notes) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; }
        doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af').text('OBSERVAÇÕES', margin, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(so.notes, margin, y, { width: pageW });
        y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }

  // ============================================================
  // LAYOUT 2 — "Corporativo"
  // Header escuro, secoes com bordas e labels, profissional
  // ============================================================
  private buildLayout2(so: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 35;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - margin * 2;
      const company = so.company;
      const client = so.clientPartner;
      const logo = loadLogo(company);
      let y = margin;

      // --- Dark header band ---
      doc.rect(0, 0, doc.page.width, 80).fill('#1f2937');

      // Logo
      if (logo) {
        doc.image(logo, margin, 15, { width: company.logoWidth || 80, height: company.logoHeight || 30 });
      }

      // Company info on header
      const compX = 180;
      doc.font('Helvetica-Bold').fontSize(12).fill('#ffffff');
      doc.text(company.tradeName || company.name, compX, 18, { width: pageW - 140 });
      doc.font('Helvetica').fontSize(7).fill('#d1d5db');
      const headerInfo = [
        company.cnpj ? `CNPJ: ${formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, '')}` : '',
        company.phone ? formatPhone(company.phone) : '',
        company.email || '',
      ].filter(Boolean).join('  |  ');
      doc.text(headerInfo, compX, doc.y + 1, { width: pageW - 140 });

      // OS code on right side of header
      doc.font('Helvetica-Bold').fontSize(18).fill('#ffffff');
      doc.text(so.code || 'OS', margin, 16, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(8).fill('#9ca3af');
      doc.text(`${STATUS_LABELS[so.status] || so.status}  |  ${formatDate(so.createdAt)}`, margin, 38, { width: pageW, align: 'right' });

      y = 95;

      // --- Title ---
      if (so.title) {
        doc.font('Helvetica-Bold').fontSize(12).fill('#1f2937');
        doc.text(so.title, margin, y, { width: pageW });
        y = doc.y + 2;
      }
      if (so.description) {
        doc.font('Helvetica').fontSize(8).fill('#4b5563');
        doc.text(so.description, margin, y, { width: pageW });
        y = doc.y + 4;
      }
      y += 8;

      // --- Section: Client (boxed) ---
      const sectionH1 = client ? 68 : 20;
      doc.rect(margin, y, pageW, sectionH1).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.rect(margin, y, pageW, 14).fill('#f9fafb');
      doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280');
      doc.text('CLIENTE', margin + 8, y + 4);
      y += 18;

      if (client) {
        const col1X = margin + 8;
        const col2X = margin + pageW / 2;
        doc.font('Helvetica-Bold').fontSize(8.5).fill('#111827').text(client.name, col1X, y);
        y = doc.y + 1;
        doc.font('Helvetica').fontSize(7).fill('#4b5563');
        if (client.document) doc.text(formatDoc(client.document, client.documentType), col1X, y);
        const phoneY = y;
        if (client.phone) { doc.text(`Tel: ${formatPhone(client.phone)}`, col2X, phoneY); }
        y = doc.y + 1;
        if (client.email) doc.text(client.email, col1X, y);
        y = doc.y + 1;
        const cAddr = buildClientAddress(client);
        if (cAddr) doc.text(cAddr, col1X, y, { width: pageW - 16 });
      }
      y += 18;

      // --- Section: Details (boxed) ---
      const detailItems: [string, string][] = [];
      if (so.addressText) detailItems.push(['Endereço do Serviço', so.addressText]);
      if (so.assignedPartner?.name) detailItems.push(['Técnico', `${so.assignedPartner.name}${so.assignedPartner.phone ? '  |  ' + formatPhone(so.assignedPartner.phone) : ''}`]);
      if (so.scheduledStartAt) detailItems.push(['Agendamento', formatDateTime(so.scheduledStartAt)]);
      if (so.deadlineAt) detailItems.push(['Prazo', formatDate(so.deadlineAt)]);

      if (detailItems.length > 0) {
        const dH = 14 + detailItems.length * 22 + 6;
        doc.rect(margin, y, pageW, dH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        doc.rect(margin, y, pageW, 14).fill('#f9fafb');
        doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('DETALHES DA ORDEM DE SERVIÇO', margin + 8, y + 4);
        y += 18;

        for (const [label, value] of detailItems) {
          doc.font('Helvetica-Bold').fontSize(7).fill('#9ca3af').text(label, margin + 8, y);
          doc.font('Helvetica').fontSize(8).fill('#111827').text(value, margin + 8, doc.y + 1, { width: pageW - 16 });
          y = doc.y + 6;
        }
        y += 8;
      }

      // --- Items ---
      y = drawItemsTable(doc, so.items || [], y, margin, pageW, '#1f2937', '#ffffff', '#1f2937');
      y += 4;

      // Total
      const tX = margin + pageW - 180;
      doc.rect(tX, y, 180, 22).fill('#1f2937');
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text('TOTAL:', tX + 8, y + 5, { width: 90, align: 'right' });
      doc.text(formatMoney(so.valueCents || 0), tX + 105, y + 5, { width: 68, align: 'right' });
      doc.fill('#000000');
      y += 30;

      // Notes
      if (so.notes) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; }
        doc.rect(margin, y, pageW, 14).fill('#f9fafb');
        doc.font('Helvetica-Bold').fontSize(7).fill('#6b7280').text('OBSERVAÇÕES', margin + 8, y + 4);
        y += 18;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(so.notes, margin + 8, y, { width: pageW - 16 });
        y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }

  // ============================================================
  // LAYOUT 3 — "Moderno"
  // Faixa lateral esquerda colorida, secoes com titulos grandes, espaçoso
  // ============================================================
  private buildLayout3(so: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 40;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - margin * 2;
      const company = so.company;
      const client = so.clientPartner;
      const logo = loadLogo(company);
      const ACCENT = '#2563eb';
      let y = margin;

      // --- Left accent stripe ---
      doc.rect(0, 0, 5, doc.page.height).fill(ACCENT);

      // --- Header ---
      if (logo) {
        doc.image(logo, margin, y, { width: company.logoWidth || 80, height: company.logoHeight || 30 });
      }

      // Company right-aligned
      doc.font('Helvetica-Bold').fontSize(9).fill('#374151');
      doc.text(company.tradeName || company.name, margin, y, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(7).fill('#6b7280');
      if (company.cnpj) doc.text(formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, 'CNPJ '), margin, doc.y, { width: pageW, align: 'right' });
      const compAddr = buildAddress(company);
      if (compAddr) doc.text(compAddr, margin, doc.y, { width: pageW, align: 'right' });
      const compContacts = [company.phone ? formatPhone(company.phone) : '', company.email || ''].filter(Boolean).join('  |  ');
      if (compContacts) doc.text(compContacts, margin, doc.y, { width: pageW, align: 'right' });

      y = Math.max(doc.y, y) + 20;

      // --- Big OS Code + Status ---
      doc.font('Helvetica-Bold').fontSize(22).fill(ACCENT);
      doc.text(so.code || 'OS', margin, y);
      const codeBottom = doc.y;
      doc.font('Helvetica').fontSize(9).fill('#6b7280');
      doc.text('ORDEM DE SERVIÇO', margin, codeBottom + 1);
      // Status right
      doc.font('Helvetica-Bold').fontSize(9).fill('#374151');
      doc.text(STATUS_LABELS[so.status] || so.status, margin, y + 4, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(7).fill('#9ca3af');
      doc.text(formatDate(so.createdAt), margin, y + 16, { width: pageW, align: 'right' });

      y = codeBottom + 18;

      // --- Accent line ---
      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor(ACCENT).lineWidth(1.5).stroke();
      y += 12;

      // --- Title + description ---
      if (so.title) {
        doc.font('Helvetica-Bold').fontSize(11).fill('#111827');
        doc.text(so.title, margin, y, { width: pageW });
        y = doc.y + 2;
      }
      if (so.description) {
        doc.font('Helvetica').fontSize(8).fill('#4b5563');
        doc.text(so.description, margin, y, { width: pageW });
        y = doc.y + 6;
      }
      y += 6;

      // --- Info grid (2 col) ---
      const colW = (pageW - 16) / 2;
      const lX = margin;
      const rX = margin + colW + 16;
      const gridY = y;

      // Col 1: Client
      doc.font('Helvetica-Bold').fontSize(8).fill(ACCENT).text('Cliente', lX, gridY);
      let ly = gridY + 12;
      if (client) {
        doc.font('Helvetica-Bold').fontSize(8.5).fill('#111827').text(client.name, lX, ly, { width: colW }); ly = doc.y + 1;
        doc.font('Helvetica').fontSize(7).fill('#4b5563');
        if (client.document) { doc.text(formatDoc(client.document, client.documentType), lX, ly, { width: colW }); ly = doc.y; }
        if (client.phone) { doc.text(formatPhone(client.phone), lX, ly, { width: colW }); ly = doc.y; }
        if (client.email) { doc.text(client.email, lX, ly, { width: colW }); ly = doc.y; }
        const cAddr = buildClientAddress(client);
        if (cAddr) { doc.text(cAddr, lX, ly, { width: colW }); ly = doc.y; }
      }

      // Col 2: Details
      doc.font('Helvetica-Bold').fontSize(8).fill(ACCENT).text('Detalhes', rX, gridY);
      let ry = gridY + 12;
      doc.font('Helvetica').fontSize(7.5).fill('#4b5563');
      const details: [string, string][] = [];
      if (so.addressText) details.push(['Local', so.addressText]);
      if (so.assignedPartner?.name) details.push(['Técnico', `${so.assignedPartner.name} ${so.assignedPartner.phone ? formatPhone(so.assignedPartner.phone) : ''}`]);
      if (so.scheduledStartAt) details.push(['Agendamento', formatDateTime(so.scheduledStartAt)]);
      if (so.deadlineAt) details.push(['Prazo', formatDate(so.deadlineAt)]);

      for (const [label, val] of details) {
        doc.font('Helvetica-Bold').fontSize(6.5).fill('#9ca3af').text(label, rX, ry);
        doc.font('Helvetica').fontSize(7.5).fill('#111827').text(val, rX, doc.y, { width: colW }); ry = doc.y + 5;
      }

      y = Math.max(ly, ry) + 14;

      // --- Items ---
      y = drawItemsTable(doc, so.items || [], y, margin, pageW, ACCENT, '#ffffff', ACCENT);
      y += 4;

      // Total
      const tX = margin + pageW - 180;
      doc.rect(tX, y, 180, 22).fill(ACCENT);
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text('TOTAL:', tX + 8, y + 5, { width: 90, align: 'right' });
      doc.text(formatMoney(so.valueCents || 0), tX + 105, y + 5, { width: 68, align: 'right' });
      doc.fill('#000000');
      y += 30;

      // Notes
      if (so.notes) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; doc.rect(0, 0, 5, doc.page.height).fill(ACCENT); }
        doc.font('Helvetica-Bold').fontSize(8).fill(ACCENT).text('Observações', margin, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(so.notes, margin, y, { width: pageW });
        y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }

  // ============================================================
  // LAYOUT 4 — "Minimalista"
  // Ultra limpo, muito branco, tipografia leve, sem caixas pesadas
  // ============================================================
  private buildLayout4(so: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 50;
      const doc = new PDFDocument({ size: 'A4', margin });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - margin * 2;
      const company = so.company;
      const client = so.clientPartner;
      const logo = loadLogo(company);
      let y = margin;

      // --- Header: logo left, OS code right ---
      if (logo) {
        doc.image(logo, margin, y, { width: company.logoWidth || 70, height: company.logoHeight || 26 });
      }

      doc.font('Helvetica-Bold').fontSize(20).fill('#374151');
      doc.text(so.code || 'OS', margin, y, { width: pageW, align: 'right' });
      doc.font('Helvetica').fontSize(7).fill('#9ca3af');
      doc.text('Ordem de Serviço', margin, doc.y, { width: pageW, align: 'right' });

      y = Math.max(doc.y, y + 30) + 6;
      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      y += 8;

      // --- Company + Status line ---
      doc.font('Helvetica').fontSize(7).fill('#9ca3af');
      const compLine = [company.tradeName || company.name, company.cnpj ? formatDoc(company.cnpj).replace(/^(CNPJ|CPF): /, '') : '', company.phone ? formatPhone(company.phone) : ''].filter(Boolean).join('  |  ');
      doc.text(compLine, margin, y, { width: pageW });
      doc.text(`${STATUS_LABELS[so.status] || so.status}  |  ${formatDate(so.createdAt)}`, margin, y, { width: pageW, align: 'right' });
      y = doc.y + 16;

      // --- Title ---
      if (so.title) {
        doc.font('Helvetica-Bold').fontSize(13).fill('#111827');
        doc.text(so.title, margin, y, { width: pageW });
        y = doc.y + 3;
      }
      if (so.description) {
        doc.font('Helvetica').fontSize(8).fill('#6b7280');
        doc.text(so.description, margin, y, { width: pageW });
        y = doc.y + 8;
      }
      y += 4;

      // --- Horizontal detail cards ---
      const drawField = (label: string, value: string, x: number, w: number) => {
        doc.font('Helvetica').fontSize(6).fill('#9ca3af').text(label.toUpperCase(), x, y);
        doc.font('Helvetica').fontSize(8).fill('#111827').text(value, x, doc.y + 1, { width: w });
      };

      // Row 1
      const c3w = (pageW - 20) / 3;
      if (client) {
        drawField('Cliente', client.name, margin, c3w);
        if (client.document) drawField('Documento', formatDoc(client.document, client.documentType).replace(/^(CNPJ|CPF): /, ''), margin + c3w + 10, c3w);
        if (client.phone) drawField('Telefone', formatPhone(client.phone), margin + (c3w + 10) * 2, c3w);
        y = doc.y + 8;
      }

      // Row 2
      if (so.addressText) {
        drawField('Endereço do Serviço', so.addressText, margin, pageW);
        y = doc.y + 8;
      }

      // Row 3
      const row3: [string, string][] = [];
      if (so.assignedPartner?.name) row3.push(['Técnico', so.assignedPartner.name]);
      if (so.scheduledStartAt) row3.push(['Agendamento', formatDateTime(so.scheduledStartAt)]);
      if (so.deadlineAt) row3.push(['Prazo', formatDate(so.deadlineAt)]);
      if (row3.length > 0) {
        const rw = (pageW - (row3.length - 1) * 10) / row3.length;
        row3.forEach(([label, val], i) => drawField(label, val, margin + i * (rw + 10), rw));
        y = doc.y + 10;
      }

      y += 6;

      // --- Thin separator ---
      doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      y += 10;

      // --- Items ---
      y = drawItemsTable(doc, so.items || [], y, margin, pageW, '#f3f4f6', '#374151', '#374151');
      y += 6;

      // Total — minimalist right-aligned
      doc.font('Helvetica').fontSize(8).fill('#9ca3af');
      doc.text('Total', margin, y, { width: pageW - 5, align: 'right' });
      y = doc.y + 1;
      doc.font('Helvetica-Bold').fontSize(14).fill('#111827');
      doc.text(formatMoney(so.valueCents || 0), margin, y, { width: pageW - 5, align: 'right' });
      y = doc.y + 16;

      // Notes
      if (so.notes) {
        if (y > doc.page.height - 80) { doc.addPage(); y = margin; }
        doc.moveTo(margin, y).lineTo(margin + pageW, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
        y += 8;
        doc.font('Helvetica').fontSize(6).fill('#9ca3af').text('OBSERVAÇÕES', margin, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(7.5).fill('#4b5563').text(so.notes, margin, y, { width: pageW });
        y = doc.y + 8;
      }

      drawFooter(doc, margin, pageW);
      doc.end();
    });
  }
}
