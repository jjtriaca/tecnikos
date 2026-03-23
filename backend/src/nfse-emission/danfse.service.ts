import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

/* ══════════════════════════════════════════════════════════════════════
   DanfseService — Generates DANFSe PDF from NfseEmission database data.
   Fallback for when Focus NFe PDF is unavailable (manual imports, etc.)
   Layout follows Padrão Nacional simplified format.
   ══════════════════════════════════════════════════════════════════════ */

export interface DanfseData {
  // NFS-e identification
  nfseNumber: string;
  rpsNumber: number;
  rpsSeries: string;
  codigoVerificacao: string;
  issuedAt: string; // formatted date

  // Prestador
  prestadorCnpj: string;
  prestadorRazaoSocial: string;
  prestadorIm?: string;
  prestadorEndereco?: string;
  prestadorMunicipio?: string;
  prestadorUf?: string;
  prestadorCep?: string;

  // Tomador
  tomadorCnpjCpf?: string;
  tomadorRazaoSocial?: string;
  tomadorEmail?: string;
  tomadorEndereco?: string;
  tomadorMunicipio?: string;
  tomadorUf?: string;
  tomadorCep?: string;

  // Serviço
  discriminacao?: string;
  itemListaServico?: string;
  codigoCnae?: string;
  codigoMunicipioServico?: string;
  naturezaOperacao?: string;

  // Valores (em centavos)
  valorServicosCents: number;
  aliquotaIss?: number;
  valorIssCents?: number;
  issRetido: boolean;

  // Status
  status: string;
}

@Injectable()
export class DanfseService {

  async generate(data: DanfseData): Promise<Buffer> {
    return this.buildPdf(data);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Build PDF
     ═══════════════════════════════════════════════════════════════════ */

  private buildPdf(d: DanfseData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PW = 535; // page width (A4 - margins)
      const LM = 30; // left margin
      let y = 30;

      // ── Helper functions ──
      const formatCnpj = (v: string) => {
        if (!v) return '';
        const d = v.replace(/\D/g, '');
        if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return v;
      };
      const formatMoney = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const formatPct = (v?: number) => v != null ? `${v.toFixed(2)}%` : '';

      const drawBox = (x: number, bY: number, w: number, h: number) => {
        doc.rect(x, bY, w, h).stroke('#999999');
      };

      const drawLabel = (label: string, value: string, x: number, bY: number, w: number, h: number) => {
        drawBox(x, bY, w, h);
        doc.fontSize(6).fillColor('#666666').text(label, x + 3, bY + 2, { width: w - 6 });
        doc.fontSize(9).fillColor('#000000').text(value || '', x + 3, bY + 11, { width: w - 6 });
      };

      const drawSection = (title: string, sY: number) => {
        doc.fontSize(7).fillColor('#0066cc').text(title, LM, sY + 1);
        doc.moveTo(LM, sY + 10).lineTo(LM + PW, sY + 10).strokeColor('#cccccc').stroke();
        doc.strokeColor('#999999');
        return sY + 14;
      };

      // ═══════════════════════════════════════════════════
      // HEADER
      // ═══════════════════════════════════════════════════

      // Outer border
      drawBox(LM, y, PW, 70);

      // Title
      doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold')
        .text('DOCUMENTO AUXILIAR DA NFS-e', LM + 10, y + 8, { width: PW - 20, align: 'center' });

      doc.fontSize(8).font('Helvetica').fillColor('#666666')
        .text('DANFSe - Documento Auxiliar da Nota Fiscal de Serviço Eletrônica', LM + 10, y + 26, { width: PW - 20, align: 'center' });

      // Number + verification
      const numText = d.nfseNumber ? `NFS-e nº ${d.nfseNumber}` : `RPS nº ${d.rpsNumber}/${d.rpsSeries}`;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
        .text(numText, LM + 10, y + 42, { width: PW / 2 - 20 });

      if (d.issuedAt) {
        doc.fontSize(9).font('Helvetica').fillColor('#333333')
          .text(`Emissão: ${d.issuedAt}`, LM + PW / 2, y + 42, { width: PW / 2 - 20, align: 'right' });
      }

      // Status badge
      if (d.status === 'CANCELLED') {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#cc0000')
          .text('CANCELADA', LM + PW / 2, y + 55, { width: PW / 2 - 20, align: 'right' });
      }

      // Código de verificação
      if (d.codigoVerificacao) {
        doc.fontSize(7).font('Helvetica').fillColor('#666666')
          .text(`Código de Verificação: ${d.codigoVerificacao}`, LM + 10, y + 58, { width: PW - 20 });
      }

      y += 78;

      // ═══════════════════════════════════════════════════
      // PRESTADOR
      // ═══════════════════════════════════════════════════

      y = drawSection('PRESTADOR DE SERVIÇOS', y);
      const prestH = 38;

      drawLabel('CNPJ', formatCnpj(d.prestadorCnpj), LM, y, 160, prestH);
      drawLabel('Inscrição Municipal', d.prestadorIm || '', LM + 160, y, 120, prestH);
      drawLabel('Razão Social', d.prestadorRazaoSocial || '', LM + 280, y, PW - 280, prestH);

      y += prestH;

      if (d.prestadorEndereco || d.prestadorMunicipio) {
        const addrH = 28;
        const addr = [d.prestadorEndereco, d.prestadorMunicipio, d.prestadorUf].filter(Boolean).join(', ');
        drawLabel('Endereço', addr, LM, y, PW - 100, addrH);
        drawLabel('CEP', d.prestadorCep || '', LM + PW - 100, y, 100, addrH);
        y += addrH;
      }

      y += 6;

      // ═══════════════════════════════════════════════════
      // TOMADOR
      // ═══════════════════════════════════════════════════

      y = drawSection('TOMADOR DE SERVIÇOS', y);
      const tomH = 38;

      drawLabel('CNPJ/CPF', formatCnpj(d.tomadorCnpjCpf || ''), LM, y, 160, tomH);
      drawLabel('Razão Social / Nome', d.tomadorRazaoSocial || '', LM + 160, y, PW - 160, tomH);

      y += tomH;

      if (d.tomadorEndereco || d.tomadorMunicipio || d.tomadorEmail) {
        const addrH = 28;
        const addr = [d.tomadorEndereco, d.tomadorMunicipio, d.tomadorUf].filter(Boolean).join(', ');
        const emailW = 180;
        drawLabel('Endereço', addr, LM, y, PW - emailW, addrH);
        drawLabel('E-mail', d.tomadorEmail || '', LM + PW - emailW, y, emailW, addrH);
        y += addrH;
      }

      y += 6;

      // ═══════════════════════════════════════════════════
      // DISCRIMINAÇÃO DOS SERVIÇOS
      // ═══════════════════════════════════════════════════

      y = drawSection('DISCRIMINAÇÃO DOS SERVIÇOS', y);

      // Service codes
      const codesH = 24;
      const codeW = PW / 3;
      drawLabel('Item Lista Serviço', d.itemListaServico || '', LM, y, codeW, codesH);
      drawLabel('CNAE', d.codigoCnae || '', LM + codeW, y, codeW, codesH);
      drawLabel('Natureza da Operação', d.naturezaOperacao || '', LM + codeW * 2, y, PW - codeW * 2, codesH);
      y += codesH;

      // Discriminação text box
      const discText = d.discriminacao || '';
      const discLines = Math.max(3, Math.ceil(discText.length / 90));
      const discH = Math.min(150, Math.max(50, discLines * 12 + 16));

      drawBox(LM, y, PW, discH);
      doc.fontSize(6).fillColor('#666666').text('Discriminação', LM + 3, y + 2);
      doc.fontSize(8).fillColor('#000000').text(discText, LM + 4, y + 12, {
        width: PW - 8,
        height: discH - 16,
        lineGap: 2,
      });

      y += discH + 6;

      // ═══════════════════════════════════════════════════
      // VALORES
      // ═══════════════════════════════════════════════════

      y = drawSection('VALORES', y);
      const valH = 38;
      const valW = PW / 4;

      drawLabel('Valor dos Serviços', formatMoney(d.valorServicosCents), LM, y, valW, valH);
      drawLabel('Alíquota ISS', formatPct(d.aliquotaIss), LM + valW, y, valW, valH);
      drawLabel('Valor ISS', d.valorIssCents != null ? formatMoney(d.valorIssCents) : '', LM + valW * 2, y, valW, valH);
      drawLabel('ISS Retido', d.issRetido ? 'Sim' : 'Não', LM + valW * 3, y, PW - valW * 3, valH);

      y += valH + 6;

      // ═══════════════════════════════════════════════════
      // VALOR LÍQUIDO (destacado)
      // ═══════════════════════════════════════════════════

      const liquidoCents = d.issRetido ? d.valorServicosCents - (d.valorIssCents || 0) : d.valorServicosCents;
      const liqH = 36;
      drawBox(LM, y, PW, liqH);
      doc.fontSize(7).fillColor('#666666').text('VALOR LÍQUIDO DA NFS-e', LM + 3, y + 3);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
        .text(formatMoney(liquidoCents), LM + 3, y + 14, { width: PW - 6, align: 'right' });
      doc.font('Helvetica');

      y += liqH + 12;

      // ═══════════════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════════════

      doc.fontSize(7).fillColor('#999999')
        .text('Documento gerado pelo sistema Tecnikos — tecnikos.com.br', LM, y, { width: PW, align: 'center' });

      if (d.codigoVerificacao) {
        y += 14;
        doc.fontSize(6).fillColor('#666666')
          .text(`Autenticidade: consulte com o código de verificação ${d.codigoVerificacao}`, LM, y, { width: PW, align: 'center' });
      }

      doc.end();
    });
  }
}
