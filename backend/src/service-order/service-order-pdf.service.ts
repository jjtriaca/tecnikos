import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const FONT_SIZE = 8;
const FONT_SIZE_SM = 7;
const FONT_SIZE_LG = 10;
const FONT_SIZE_XL = 14;

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

function formatDateTime(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

@Injectable()
export class ServiceOrderPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(serviceOrderId: string, companyId: string): Promise<Buffer> {
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
    return this.buildPdf(so);
  }

  private buildPdf(so: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - 60;
      const company = so.company;
      const client = so.clientPartner;
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
        company.phone ? `Tel: ${company.phone}` : '',
        company.email ? `Email: ${company.email}` : '',
      ].filter(Boolean).join(' | ');
      if (contacts) {
        doc.text(contacts, companyX, y, { width: pageW - 170 });
      }

      y = Math.max(doc.y, y) + 15;

      // ---- Title Bar ----
      const statusLabel = STATUS_LABELS[so.status] || so.status;
      doc.rect(30, y, pageW, 22).fill('#1e40af');
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(FONT_SIZE_XL);
      doc.text('ORDEM DE SERVIÇO', 35, y + 4, { width: pageW - 10 });
      doc.fill('#ffffff').font('Helvetica').fontSize(FONT_SIZE);
      doc.text(`${so.code || ''}  |  ${statusLabel}  |  ${formatDate(so.createdAt)}`, 35, y + 5, {
        width: pageW - 10,
        align: 'right',
      });
      y += 30;

      // ---- Client Info ----
      if (client) {
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
          client.phone ? `Tel: ${client.phone}` : '',
          client.email ? `Email: ${client.email}` : '',
        ].filter(Boolean).join(' | ');
        if (clientContacts) {
          doc.text(clientContacts, 30, y);
          y = doc.y + 1;
        }
        const clientAddr = [
          client.addressStreet,
          client.addressNumber ? `, ${client.addressNumber}` : '',
          client.neighborhood ? ` - ${client.neighborhood}` : '',
          client.city ? `, ${client.city}` : '',
          client.state ? ` - ${client.state}` : '',
        ].filter(Boolean).join('');
        if (clientAddr.trim()) {
          doc.text(`Endereço: ${clientAddr}`, 30, y, { width: pageW });
          y = doc.y + 1;
        }
        y += 8;
      }

      // ---- OS Details ----
      doc.fill('#000000').font('Helvetica-Bold').fontSize(FONT_SIZE);
      doc.text('DETALHES DA OS', 30, y);
      y = doc.y + 3;
      doc.font('Helvetica').fontSize(FONT_SIZE);

      // Title
      if (so.title) {
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE_LG);
        doc.text(so.title, 30, y, { width: pageW });
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(FONT_SIZE);
      }

      // Description
      if (so.description) {
        doc.text(so.description, 30, y, { width: pageW });
        y = doc.y + 5;
      }

      // Address
      if (so.addressText) {
        doc.font('Helvetica-Bold').text('Endereço: ', 30, y, { continued: true });
        doc.font('Helvetica').text(so.addressText);
        y = doc.y + 2;
      }

      // Technician
      if (so.assignedPartner?.name) {
        doc.font('Helvetica-Bold').text('Técnico: ', 30, y, { continued: true });
        doc.font('Helvetica').text(so.assignedPartner.name);
        y = doc.y + 2;
      }

      // Scheduling
      if (so.scheduledStartAt) {
        doc.font('Helvetica-Bold').text('Agendamento: ', 30, y, { continued: true });
        doc.font('Helvetica').text(formatDateTime(so.scheduledStartAt));
        y = doc.y + 2;
      }

      // Deadline
      if (so.deadlineAt) {
        doc.font('Helvetica-Bold').text('Prazo: ', 30, y, { continued: true });
        doc.font('Helvetica').text(formatDate(so.deadlineAt));
        y = doc.y + 2;
      }

      y += 8;

      // ---- Items Table ----
      const items = so.items || [];
      if (items.length > 0) {
        doc.fill('#000000').font('Helvetica-Bold').fontSize(FONT_SIZE);
        doc.text('ITENS / SERVIÇOS', 30, y);
        y = doc.y + 5;

        const cols = [
          { label: '#', w: 25, align: 'center' },
          { label: 'Descrição', w: 230, align: 'left' },
          { label: 'Unid.', w: 45, align: 'center' },
          { label: 'Qtde', w: 45, align: 'right' },
          { label: 'Valor Unit.', w: 75, align: 'right' },
          { label: 'Total', w: 85, align: 'right' },
        ];

        // Adjust last column to fill remaining width
        const usedW = cols.reduce((s, c) => s + c.w, 0);
        if (usedW < pageW) cols[cols.length - 1].w += pageW - usedW;

        // Table header
        let x = 30;
        doc.rect(30, y, pageW, 16).fill('#f1f5f9');
        doc.fill('#334155').font('Helvetica-Bold').fontSize(FONT_SIZE_SM);
        for (const col of cols) {
          doc.text(col.label, x + 2, y + 4, { width: col.w - 4, align: col.align as any });
          x += col.w;
        }
        y += 16;

        // Table rows
        doc.fill('#000000').font('Helvetica').fontSize(FONT_SIZE_SM);
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (y > doc.page.height - 120) {
            doc.addPage();
            y = 30;
          }

          if (i % 2 === 1) {
            doc.rect(30, y, pageW, 14).fill('#f8fafc');
            doc.fill('#000000');
          }

          x = 30;
          const rowY = y + 3;
          const description = item.service?.name || item.description || 'Serviço';
          const unit = item.unit || item.service?.unit || 'un';
          const qty = item.quantity || 1;
          const unitPrice = item.unitPriceCents || item.service?.priceCents || 0;
          const total = unitPrice * qty;

          doc.text(String(i + 1), x + 2, rowY, { width: cols[0].w - 4, align: 'center' });
          x += cols[0].w;

          doc.text(description, x + 2, rowY, { width: cols[1].w - 4, align: 'left' });
          x += cols[1].w;

          doc.text(unit, x + 2, rowY, { width: cols[2].w - 4, align: 'center' });
          x += cols[2].w;

          doc.text(String(qty), x + 2, rowY, { width: cols[3].w - 4, align: 'right' });
          x += cols[3].w;

          doc.text(formatMoney(unitPrice), x + 2, rowY, { width: cols[4].w - 4, align: 'right' });
          x += cols[4].w;

          doc.font('Helvetica-Bold').text(formatMoney(total), x + 2, rowY, { width: cols[5].w - 4, align: 'right' });
          doc.font('Helvetica');

          y += 14;
        }

        // Table bottom line
        doc.moveTo(30, y).lineTo(30 + pageW, y).stroke('#cbd5e1');
        y += 8;
      }

      // ---- Total ----
      const totalsX = 30 + pageW - 200;
      doc.rect(totalsX, y, 200, 20).fill('#1e40af');
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(FONT_SIZE_LG);
      doc.text('TOTAL:', totalsX + 5, y + 4, { width: 110, align: 'right' });
      doc.text(formatMoney(so.valueCents || 0), totalsX + 125, y + 4, { width: 70, align: 'right' });
      doc.fill('#000000');
      y += 28;

      // ---- Notes ----
      if (so.notes) {
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 30;
        }
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
        doc.text('OBSERVAÇÕES', 30, y);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(FONT_SIZE_SM);
        doc.text(so.notes, 30, y, { width: pageW });
        y = doc.y + 8;
      }

      // ---- Footer ----
      const footerY = doc.page.height - 40;
      doc.moveTo(30, footerY - 5).lineTo(30 + pageW, footerY - 5).stroke('#e2e8f0');
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
