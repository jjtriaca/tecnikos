import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const FONT_SIZE = 8;
const FONT_SIZE_SM = 7;
const FONT_SIZE_LG = 10;
const FONT_SIZE_XL = 14;

const ITEM_TYPE_LABELS: Record<string, string> = {
  SERVICE: 'Serviço',
  PRODUCT: 'Produto',
  LABOR: 'Mão de Obra',
};

function formatMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const c = cnpj.replace(/\D/g, '');
  if (c.length === 14) {
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  }
  if (c.length === 11) {
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }
  return cnpj;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return phone || '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

// Theme definitions per layout
interface PdfTheme {
  titleBarBg: string;
  titleBarText: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  totalBg: string;
  totalText: string;
  sectionLabelColor: string;
  accentColor: string;
}

const THEMES: Record<number, PdfTheme> = {
  1: { titleBarBg: '#111827', titleBarText: '#ffffff', tableHeaderBg: '#f3f4f6', tableHeaderText: '#374151', totalBg: '#111827', totalText: '#ffffff', sectionLabelColor: '#9ca3af', accentColor: '#111827' },
  2: { titleBarBg: '#1f2937', titleBarText: '#ffffff', tableHeaderBg: '#1f2937', tableHeaderText: '#ffffff', totalBg: '#1f2937', totalText: '#ffffff', sectionLabelColor: '#6b7280', accentColor: '#1f2937' },
  3: { titleBarBg: '#5b8bc9', titleBarText: '#ffffff', tableHeaderBg: '#93b5e1', tableHeaderText: '#374151', totalBg: '#5b8bc9', totalText: '#ffffff', sectionLabelColor: '#4a7ab5', accentColor: '#5b8bc9' },
  4: { titleBarBg: '#f3f4f6', titleBarText: '#374151', tableHeaderBg: '#f3f4f6', tableHeaderText: '#374151', totalBg: '#111827', totalText: '#ffffff', sectionLabelColor: '#9ca3af', accentColor: '#374151' },
};

@Injectable()
export class QuotePdfService {
  constructor(private readonly prisma: PrismaService) {}

  private async getLayoutConfig(companyId: string): Promise<number> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { systemConfig: true },
    });
    return (company?.systemConfig as any)?.pdf?.osLayout || 1;
  }

  async generatePdf(quoteId: string, companyId: string): Promise<Buffer> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      include: {
        company: true,
        clientPartner: true,
        items: { orderBy: { sortOrder: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!quote) throw new NotFoundException('Orçamento não encontrado');

    const layout = await this.getLayoutConfig(companyId);
    const theme = THEMES[layout] || THEMES[1];
    const mainPdf = await this.buildPdf(quote, theme);

    // Merge with attachment PDFs if any
    const pdfAttachments = (quote.attachments || []).filter(
      (a: any) => a.mimeType === 'application/pdf',
    );
    if (pdfAttachments.length === 0) return mainPdf;

    try {
      const merged = await PDFLibDocument.create();
      const mainDoc = await PDFLibDocument.load(mainPdf);
      const mainPages = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
      mainPages.forEach((p) => merged.addPage(p));

      for (const att of pdfAttachments) {
        const filePath = path.join(
          UPLOAD_DIR,
          (att as any).filePath.replace(/^\/?uploads\//, ''),
        );
        if (!fs.existsSync(filePath)) continue;
        try {
          const attBytes = fs.readFileSync(filePath);
          const attDoc = await PDFLibDocument.load(attBytes, { ignoreEncryption: true });
          const attPages = await merged.copyPages(attDoc, attDoc.getPageIndices());
          attPages.forEach((p) => merged.addPage(p));
        } catch {
          // Skip invalid PDFs
        }
      }

      const mergedBytes = await merged.save();
      return Buffer.from(mergedBytes);
    } catch {
      // If merge fails, return main PDF only
      return mainPdf;
    }
  }

  private buildPdf(quote: any, theme: PdfTheme): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - 60; // margin * 2
      const company = quote.company;
      const client = quote.clientPartner;
      let y = 30;

      // ---- Header: Company info + Logo ----
      const logoPath = company.logoUrl
        ? path.resolve(UPLOAD_DIR, company.logoUrl.replace(/^\/uploads\//, ''))
        : null;

      let logoBuffer: Buffer | null = null;
      if (logoPath && fs.existsSync(logoPath)) {
        logoBuffer = fs.readFileSync(logoPath);
      }

      if (logoBuffer) {
        doc.image(logoBuffer, 30, y, {
          width: company.logoWidth || 100,
          height: company.logoHeight || 35,
        });
      }

      // Company name + address (right side)
      const companyX = 200;
      doc.font('Helvetica-Bold').fontSize(FONT_SIZE_LG);
      doc.text(company.tradeName || company.name, companyX, y, { width: pageW - 170 });
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(FONT_SIZE_SM);
      if (company.cnpj) {
        doc.text(`CNPJ: ${formatCnpj(company.cnpj)}`, companyX, y);
        y = doc.y + 1;
      }
      const addr = [
        company.addressStreet,
        company.addressNumber ? `, ${company.addressNumber}` : '',
        company.neighborhood ? ` - ${company.neighborhood}` : '',
        company.city ? `, ${company.city}` : '',
        company.state ? ` - ${company.state}` : '',
        company.cep ? ` | CEP: ${company.cep}` : '',
      ].join('');
      if (addr.trim()) {
        doc.text(addr, companyX, y, { width: pageW - 170 });
        y = doc.y + 1;
      }
      const contacts = [
        company.phone ? `Tel: ${formatPhone(company.phone)}` : '',
        company.email ? `Email: ${company.email}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      if (contacts) {
        doc.text(contacts, companyX, y, { width: pageW - 170 });
      }

      y = Math.max(doc.y, y) + 15;

      // ---- Title Bar ----
      doc.rect(30, y, pageW, 22).fill(theme.titleBarBg);
      doc.fill(theme.titleBarText).font('Helvetica-Bold').fontSize(FONT_SIZE_XL);
      doc.text('ORÇAMENTO', 35, y + 4, { width: pageW - 10 });
      doc.fill(theme.titleBarText).font('Helvetica').fontSize(FONT_SIZE);
      doc.text(`${quote.code || ''}  |  ${formatDate(quote.createdAt)}`, 35, y + 5, {
        width: pageW - 10,
        align: 'right',
      });
      y += 30;

      // ---- Client Info ----
      doc.fill('#000000').font('Helvetica-Bold').fontSize(FONT_SIZE);
      doc.text('CLIENTE', 30, y);
      y = doc.y + 3;
      doc.font('Helvetica').fontSize(FONT_SIZE);
      doc.text(client.name, 30, y);
      y = doc.y + 1;
      if (client.document) {
        doc.text(`${client.documentType || 'Doc'}: ${formatCnpj(client.document)}`, 30, y);
        y = doc.y + 1;
      }
      const clientContacts = [
        client.phone ? `Tel: ${formatPhone(client.phone)}` : '',
        client.email ? `Email: ${client.email}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      if (clientContacts) {
        doc.text(clientContacts, 30, y);
        y = doc.y + 1;
      }
      y += 8;

      // ---- Quote Title & Description ----
      if (quote.title) {
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_LG);
        doc.text(quote.title, 30, y, { width: pageW });
        y = doc.y + 3;
      }
      if (quote.description) {
        doc.font('Helvetica').fontSize(FONT_SIZE);
        doc.text(quote.description, 30, y, { width: pageW });
        y = doc.y + 5;
      }

      y += 5;

      // ---- Items Table ----
      const cols = [
        { label: '#', w: 25, align: 'center' },
        { label: 'Descrição', w: 195, align: 'left' },
        { label: 'Tipo', w: 55, align: 'center' },
        { label: 'Unid.', w: 35, align: 'center' },
        { label: 'Qtde', w: 40, align: 'right' },
        { label: 'Valor Unit.', w: 65, align: 'right' },
        { label: 'Desc.%', w: 40, align: 'right' },
        { label: 'Total', w: 75, align: 'right' },
      ];

      // Table header
      let x = 30;
      doc.rect(30, y, pageW, 16).fill(theme.tableHeaderBg);
      doc.fill(theme.tableHeaderText).font('Helvetica-Bold').fontSize(FONT_SIZE_SM);
      for (const col of cols) {
        doc.text(col.label, x + 2, y + 4, {
          width: col.w - 4,
          align: col.align as any,
        });
        x += col.w;
      }
      y += 16;

      // Table rows
      doc.fill('#000000').font('Helvetica').fontSize(FONT_SIZE_SM);
      for (let i = 0; i < quote.items.length; i++) {
        const item = quote.items[i];

        // Check page break
        if (y > doc.page.height - 120) {
          doc.addPage();
          y = 30;
        }

        // Alternating row bg
        if (i % 2 === 1) {
          doc.rect(30, y, pageW, 14).fill('#f8fafc');
          doc.fill('#000000');
        }

        x = 30;
        const rowY = y + 3;

        doc.text(String(i + 1), x + 2, rowY, { width: cols[0].w - 4, align: 'center' });
        x += cols[0].w;

        doc.text(item.description, x + 2, rowY, { width: cols[1].w - 4, align: 'left' });
        x += cols[1].w;

        doc.text(ITEM_TYPE_LABELS[item.type] || item.type, x + 2, rowY, {
          width: cols[2].w - 4,
          align: 'center',
        });
        x += cols[2].w;

        doc.text(item.unit, x + 2, rowY, { width: cols[3].w - 4, align: 'center' });
        x += cols[3].w;

        doc.text(String(item.quantity), x + 2, rowY, { width: cols[4].w - 4, align: 'right' });
        x += cols[4].w;

        doc.text(formatMoney(item.unitPriceCents), x + 2, rowY, {
          width: cols[5].w - 4,
          align: 'right',
        });
        x += cols[5].w;

        doc.text(
          item.discountPercent ? `${item.discountPercent}%` : '-',
          x + 2,
          rowY,
          { width: cols[6].w - 4, align: 'right' },
        );
        x += cols[6].w;

        doc.font('Helvetica-Bold').text(formatMoney(item.totalCents), x + 2, rowY, {
          width: cols[7].w - 4,
          align: 'right',
        });
        doc.font('Helvetica');

        y += 14;
      }

      // Table bottom line
      doc.moveTo(30, y).lineTo(30 + pageW, y).stroke('#cbd5e1');
      y += 8;

      // ---- Totals ----
      const totalsX = 30 + pageW - 200;
      doc.font('Helvetica').fontSize(FONT_SIZE);
      doc.text('Subtotal:', totalsX, y, { width: 120, align: 'right' });
      doc.text(formatMoney(quote.subtotalCents), totalsX + 125, y, {
        width: 75,
        align: 'right',
      });
      y += 14;

      if (
        (quote.discountPercent && quote.discountPercent > 0) ||
        (quote.discountCents && quote.discountCents > 0)
      ) {
        const discountLabel = quote.discountPercent
          ? `Desconto (${quote.discountPercent}%):`
          : 'Desconto:';
        const discountValue = quote.subtotalCents - quote.totalCents;
        doc.fill('#dc2626');
        doc.text(discountLabel, totalsX, y, { width: 120, align: 'right' });
        doc.text(`- ${formatMoney(discountValue)}`, totalsX + 125, y, {
          width: 75,
          align: 'right',
        });
        doc.fill('#000000');
        y += 14;
      }

      // Product value
      if (quote.productValueCents && quote.productValueCents > 0) {
        doc.text('Valor Produtos:', totalsX, y, { width: 120, align: 'right' });
        doc.text(formatMoney(quote.productValueCents), totalsX + 125, y, {
          width: 75,
          align: 'right',
        });
        y += 14;
      }

      // Total (bold, larger)
      doc.rect(totalsX, y, 200, 20).fill(theme.totalBg);
      doc.fill(theme.totalText).font('Helvetica-Bold').fontSize(FONT_SIZE_LG);
      doc.text('TOTAL:', totalsX + 5, y + 4, { width: 110, align: 'right' });
      doc.text(formatMoney(quote.totalCents), totalsX + 125, y + 4, {
        width: 70,
        align: 'right',
      });
      doc.fill('#000000');
      y += 28;

      // ---- Terms & Conditions ----
      if (quote.termsConditions) {
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 30;
        }
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
        doc.text('TERMOS E CONDIÇÕES', 30, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(FONT_SIZE_SM);
        doc.text(quote.termsConditions, 30, y, { width: pageW });
        y = doc.y + 8;
      }

      // ---- Validity ----
      y += 5;
      doc.font('Helvetica').fontSize(FONT_SIZE);
      const validText = quote.expiresAt
        ? `Válido até ${formatDate(quote.expiresAt)} (${quote.validityDays} dias)`
        : `Validade: ${quote.validityDays} dias`;
      doc.text(validText, 30, y, { width: pageW });
      y = doc.y + 15;

      // ---- Footer ----
      const footerY = doc.page.height - 40;
      doc
        .moveTo(30, footerY - 5)
        .lineTo(30 + pageW, footerY - 5)
        .stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(6).fill('#94a3b8');
      doc.text(
        `Gerado por Tecnikos em ${new Date().toLocaleString('pt-BR')}`,
        30,
        footerY,
        { width: pageW, align: 'center' },
      );

      doc.end();
    });
  }
}
