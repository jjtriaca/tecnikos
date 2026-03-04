import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

/* ══════════════════════════════════════════════════════════════════════
   FinancialReportService — Generates Financial Report PDF
   ══════════════════════════════════════════════════════════════════════ */

interface ReportFilters {
  partnerId?: string;
  type?: 'RECEIVABLE' | 'PAYABLE';
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

interface ReportEntry {
  date: string;
  description: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  partnerName: string;
  paymentMethod: string;
  grossCents: number;
  netCents: number;
  status: string;
}

interface ReportData {
  company: {
    name: string;
    tradeName?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    email?: string | null;
    address: string;
    city?: string | null;
    state?: string | null;
    cep?: string | null;
  };
  partner?: {
    name: string;
    document?: string | null;
    documentType?: string | null;
    phone?: string | null;
    email?: string | null;
    address: string;
    city?: string | null;
    state?: string | null;
  } | null;
  filters: ReportFilters;
  entries: ReportEntry[];
  totals: {
    totalReceivableCents: number;
    totalPayableCents: number;
    balanceCents: number;
    entryCount: number;
  };
  generatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartao Cred.',
  CARTAO_DEBITO: 'Cartao Deb.',
  DINHEIRO: 'Dinheiro',
  TRANSFERENCIA: 'Transferencia',
  BOLETO: 'Boleto',
  CHEQUE: 'Cheque',
  OUTROS: 'Outros',
};

@Injectable()
export class FinancialReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(
    companyId: string,
    filters: ReportFilters,
  ): Promise<Buffer> {
    const data = await this.fetchReportData(companyId, filters);
    return this.buildPdf(data);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Fetch report data from database
     ═══════════════════════════════════════════════════════════════════ */

  private async fetchReportData(
    companyId: string,
    filters: ReportFilters,
  ): Promise<ReportData> {
    // Fetch company
    const company = await this.prisma.company.findFirstOrThrow({
      where: { id: companyId },
    });

    // Fetch partner if filtered
    let partner: ReportData['partner'] = null;
    if (filters.partnerId) {
      const p = await this.prisma.partner.findFirst({
        where: { id: filters.partnerId, companyId, deletedAt: null },
      });
      if (p) {
        partner = {
          name: p.name,
          document: p.document,
          documentType: p.documentType,
          phone: p.phone,
          email: p.email,
          address: [p.addressStreet, p.addressNumber, p.addressComp]
            .filter(Boolean)
            .join(', '),
          city: p.city,
          state: p.state,
        };
      }
    }

    // Build where clause
    const where: any = { companyId, deletedAt: null };
    if (filters.type) where.type = filters.type;
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = { not: 'CANCELLED' };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.dueDate = {};
      if (filters.dateFrom) where.dueDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo)
        where.dueDate.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }

    // Fetch entries (all, no pagination)
    const rawEntries = await this.prisma.financialEntry.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        partner: { select: { name: true } },
      },
      take: 2000, // safety limit
    });

    const entries: ReportEntry[] = rawEntries.map((e) => ({
      date: e.dueDate
        ? e.dueDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : e.createdAt.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
      description: e.description || '-',
      type: e.type as 'RECEIVABLE' | 'PAYABLE',
      partnerName: e.partner?.name || '-',
      paymentMethod:
        PAYMENT_LABELS[e.paymentMethod ?? ''] || e.paymentMethod || '-',
      grossCents: e.grossCents,
      netCents: e.netCents,
      status: STATUS_LABELS[e.status] || e.status,
    }));

    // Compute totals
    const totalReceivableCents = rawEntries
      .filter((e) => e.type === 'RECEIVABLE')
      .reduce((s, e) => s + e.netCents, 0);
    const totalPayableCents = rawEntries
      .filter((e) => e.type === 'PAYABLE')
      .reduce((s, e) => s + e.netCents, 0);

    return {
      company: {
        name: company.name,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        phone: company.phone,
        email: company.email,
        address: [
          company.addressStreet,
          company.addressNumber,
          company.addressComp,
        ]
          .filter(Boolean)
          .join(', '),
        city: company.city,
        state: company.state,
        cep: company.cep,
      },
      partner,
      filters,
      entries,
      totals: {
        totalReceivableCents,
        totalPayableCents,
        balanceCents: totalReceivableCents - totalPayableCents,
        entryCount: entries.length,
      },
      generatedAt: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     Build PDF using PDFKit
     ═══════════════════════════════════════════════════════════════════ */

  private buildPdf(data: ReportData): Promise<Buffer> {
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

      // ── Helpers ─────────────────────────────────────────────
      const drawBox = (x: number, bY: number, w: number, h: number) => {
        doc.rect(x, bY, w, h).stroke('#999999');
      };

      const drawLabel = (x: number, bY: number, label: string) => {
        doc
          .font('Helvetica')
          .fontSize(FONT_SIZE_SM)
          .fillColor('#666666')
          .text(label, x + 2, bY + 2, { width: 200 });
      };

      const drawValue = (
        x: number,
        bY: number,
        value: string,
        opts?: {
          width?: number;
          align?: 'left' | 'right' | 'center';
          bold?: boolean;
          color?: string;
        },
      ) => {
        doc
          .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(FONT_SIZE)
          .fillColor(opts?.color ?? '#000000')
          .text(value, x + 2, bY + 10, {
            width: (opts?.width ?? 200) - 4,
            align: opts?.align ?? 'left',
          });
      };

      // ── HEADER ──────────────────────────────────────────────
      const headerH = 65;
      drawBox(leftX, y, pageWidth, headerH);

      // Company info (left)
      const companyW = pageWidth - 180;
      doc
        .font('Helvetica-Bold')
        .fontSize(FONT_SIZE_LG)
        .fillColor('#000000')
        .text(
          data.company.tradeName || data.company.name,
          leftX + 4,
          y + 5,
          { width: companyW - 8 },
        );

      doc
        .font('Helvetica')
        .fontSize(FONT_SIZE)
        .fillColor('#333333');
      if (data.company.cnpj) {
        doc.text(
          `CNPJ: ${this.formatCnpj(data.company.cnpj)}`,
          leftX + 4,
          y + 20,
          { width: companyW - 8 },
        );
      }
      if (data.company.address) {
        doc.text(data.company.address, leftX + 4, y + 30, {
          width: companyW - 8,
        });
      }
      const cityUf = [data.company.city, data.company.state]
        .filter(Boolean)
        .join(' - ');
      if (cityUf) {
        doc.text(cityUf, leftX + 4, y + 40, { width: companyW - 8 });
      }
      const contacts = [
        data.company.phone
          ? `Fone: ${this.formatPhone(data.company.phone)}`
          : '',
        data.company.email ? `Email: ${data.company.email}` : '',
      ]
        .filter(Boolean)
        .join('  |  ');
      if (contacts) {
        doc.text(contacts, leftX + 4, y + 50, { width: companyW - 8 });
      }

      // Title (right)
      const titleX = leftX + companyW;
      drawBox(titleX, y, 180, headerH);
      doc
        .font('Helvetica-Bold')
        .fontSize(FONT_SIZE_XL)
        .fillColor('#000000')
        .text('RELATORIO', titleX + 4, y + 8, { width: 172, align: 'center' });
      doc.text('FINANCEIRO', titleX + 4, y + 22, {
        width: 172,
        align: 'center',
      });
      doc
        .font('Helvetica')
        .fontSize(FONT_SIZE)
        .fillColor('#666666')
        .text(`Gerado em ${data.generatedAt}`, titleX + 4, y + 42, {
          width: 172,
          align: 'center',
        });

      y += headerH;

      // ── PARTNER SECTION (if filtered) ───────────────────────
      if (data.partner) {
        y += 3;
        doc
          .font('Helvetica-Bold')
          .fontSize(FONT_SIZE_SM)
          .fillColor('#333333')
          .text('CLIENTE / PARCEIRO', leftX + 2, y);
        y += 10;

        const partnerH = 22;

        // Row 1: Name + Document
        const nameW = pageWidth - 140;
        drawBox(leftX, y, nameW, partnerH);
        drawLabel(leftX, y, 'NOME / RAZAO SOCIAL');
        drawValue(leftX, y, data.partner.name, { width: nameW, bold: true });

        drawBox(leftX + nameW, y, 140, partnerH);
        drawLabel(leftX + nameW, y, data.partner.documentType || 'DOCUMENTO');
        drawValue(leftX + nameW, y, this.formatDocument(data.partner.document, data.partner.documentType), {
          width: 140,
        });
        y += partnerH;

        // Row 2: Address + City/UF + Phone
        const addrW = pageWidth - 180 - 100;
        drawBox(leftX, y, addrW, partnerH);
        drawLabel(leftX, y, 'ENDERECO');
        drawValue(leftX, y, data.partner.address || '-', { width: addrW });

        drawBox(leftX + addrW, y, 180, partnerH);
        drawLabel(leftX + addrW, y, 'MUNICIPIO / UF');
        const cityState = [data.partner.city, data.partner.state]
          .filter(Boolean)
          .join(' / ');
        drawValue(leftX + addrW, y, cityState || '-', { width: 180 });

        drawBox(leftX + addrW + 180, y, 100, partnerH);
        drawLabel(leftX + addrW + 180, y, 'TELEFONE');
        drawValue(
          leftX + addrW + 180,
          y,
          data.partner.phone ? this.formatPhone(data.partner.phone) : '-',
          { width: 100 },
        );
        y += partnerH;
      }

      // ── FILTERS SECTION ─────────────────────────────────────
      y += 3;
      const filterH = 22;
      drawBox(leftX, y, pageWidth, filterH);
      drawLabel(leftX, y, 'FILTROS APLICADOS');

      const filterParts: string[] = [];
      if (data.filters.type === 'RECEIVABLE') filterParts.push('Tipo: A Receber');
      else if (data.filters.type === 'PAYABLE') filterParts.push('Tipo: A Pagar');
      else filterParts.push('Tipo: Todos');

      if (data.filters.dateFrom || data.filters.dateTo) {
        const from = data.filters.dateFrom
          ? new Date(data.filters.dateFrom).toLocaleDateString('pt-BR')
          : '...';
        const to = data.filters.dateTo
          ? new Date(data.filters.dateTo).toLocaleDateString('pt-BR')
          : '...';
        filterParts.push(`Periodo: ${from} a ${to}`);
      }

      if (data.filters.status) {
        filterParts.push(`Status: ${STATUS_LABELS[data.filters.status] || data.filters.status}`);
      }

      filterParts.push(`Total: ${data.totals.entryCount} lancamento(s)`);

      drawValue(leftX, y, filterParts.join('   |   '), {
        width: pageWidth,
      });
      y += filterH;

      // ── ITEMS TABLE ─────────────────────────────────────────
      y += 5;
      doc
        .font('Helvetica-Bold')
        .fontSize(FONT_SIZE_SM)
        .fillColor('#333333')
        .text('LANCAMENTOS', leftX + 2, y);
      y += 10;

      // Column widths — adjusted for readability
      const colWidths = [52, 130, 80, 48, 52, 68, 68, 48];
      const colHeaders = [
        'DATA',
        'DESCRICAO',
        'PARCEIRO',
        'TIPO',
        'FORMA PGTO',
        'VALOR BRUTO',
        'VALOR LIQ.',
        'STATUS',
      ];

      // Draw table header
      const drawTableHeader = () => {
        const itemHeaderH = 16;
        let cx = leftX;
        colHeaders.forEach((h, i) => {
          drawBox(cx, y, colWidths[i], itemHeaderH);
          doc
            .font('Helvetica-Bold')
            .fontSize(FONT_SIZE_SM)
            .fillColor('#333333')
            .text(h, cx + 2, y + 4, {
              width: colWidths[i] - 4,
              align: 'center',
            });
          cx += colWidths[i];
        });
        y += itemHeaderH;
      };

      drawTableHeader();

      // Item rows — taller to fit wrapped text
      const itemRowH = 22;
      for (const entry of data.entries) {
        // Check page break
        if (y + itemRowH > doc.page.height - 80) {
          doc.addPage();
          y = 20;
          drawTableHeader();
        }

        const typeLabel = entry.type === 'RECEIVABLE' ? 'Entrada' : 'Saida';
        const values = [
          entry.date,
          entry.description,
          entry.partnerName,
          typeLabel,
          entry.paymentMethod,
          this.formatMoney(entry.grossCents / 100),
          this.formatMoney(entry.netCents / 100),
          entry.status,
        ];

        let cx = leftX;
        values.forEach((v, i) => {
          drawBox(cx, y, colWidths[i], itemRowH);
          const align = i >= 5 && i <= 6 ? 'right' : i === 0 ? 'center' : 'left';
          doc
            .font('Helvetica')
            .fontSize(FONT_SIZE_SM)
            .fillColor('#000000')
            .text(v, cx + 2, y + 3, {
              width: colWidths[i] - 4,
              align,
              height: itemRowH - 6,
              ellipsis: true,
              lineBreak: true,
            });
          cx += colWidths[i];
        });
        y += itemRowH;
      }

      // Empty state
      if (data.entries.length === 0) {
        const emptyH = 20;
        drawBox(leftX, y, pageWidth, emptyH);
        doc
          .font('Helvetica')
          .fontSize(FONT_SIZE)
          .fillColor('#666666')
          .text(
            'Nenhum lancamento encontrado para os filtros aplicados.',
            leftX + 4,
            y + 6,
            { width: pageWidth - 8, align: 'center' },
          );
        y += emptyH;
      }

      // ── TOTALS SECTION ──────────────────────────────────────
      y += 5;
      if (y + 30 > doc.page.height - 30) {
        doc.addPage();
        y = 20;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(FONT_SIZE_SM)
        .fillColor('#333333')
        .text('RESUMO', leftX + 2, y);
      y += 10;

      const totRowH = 22;
      const totColW = pageWidth / 3;

      // Total Entradas
      drawBox(leftX, y, totColW, totRowH);
      drawLabel(leftX, y, 'TOTAL ENTRADAS');
      drawValue(leftX, y, this.formatMoney(data.totals.totalReceivableCents / 100), {
        width: totColW,
        align: 'right',
        bold: true,
        color: '#16a34a',
      });

      // Total Saidas
      drawBox(leftX + totColW, y, totColW, totRowH);
      drawLabel(leftX + totColW, y, 'TOTAL SAIDAS');
      drawValue(
        leftX + totColW,
        y,
        this.formatMoney(data.totals.totalPayableCents / 100),
        {
          width: totColW,
          align: 'right',
          bold: true,
          color: '#dc2626',
        },
      );

      // Saldo
      drawBox(leftX + totColW * 2, y, totColW, totRowH);
      drawLabel(leftX + totColW * 2, y, 'SALDO');
      const balanceColor =
        data.totals.balanceCents >= 0 ? '#16a34a' : '#dc2626';
      drawValue(
        leftX + totColW * 2,
        y,
        this.formatMoney(data.totals.balanceCents / 100),
        {
          width: totColW,
          align: 'right',
          bold: true,
          color: balanceColor,
        },
      );

      y += totRowH;

      // ── FOOTER ──────────────────────────────────────────────
      y += 10;
      doc
        .font('Helvetica')
        .fontSize(FONT_SIZE_SM)
        .fillColor('#999999')
        .text(
          `Gerado em ${data.generatedAt} por Tecnikos  |  ${data.totals.entryCount} lancamento(s)`,
          leftX,
          y,
          { width: pageWidth, align: 'center' },
        );

      doc.end();
    });
  }

  /* ── Formatters ────────────────────────────────────────── */

  private formatCnpj(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5',
      );
    }
    if (clean.length === 11) {
      return clean.replace(
        /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
        '$1.$2.$3-$4',
      );
    }
    return cnpj;
  }

  private formatDocument(
    doc?: string | null,
    type?: string | null,
  ): string {
    if (!doc) return '-';
    return this.formatCnpj(doc);
  }

  private formatPhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }
    return phone;
  }

  private formatMoney(value: number): string {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
