import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

/* ══════════════════════════════════════════════════════════════════════
   DanfseService — Generates DANFSe PDF from NfseEmission database data.
   Fallback for when Focus NFe PDF is unavailable (manual imports, etc.)
   Layout follows Padrão Nacional DANFSe v1.0 format.
   ══════════════════════════════════════════════════════════════════════ */

export interface DanfseData {
  // NFS-e identification
  nfseNumber: string;
  rpsNumber: number;
  rpsSeries: string;
  codigoVerificacao: string;
  issuedAt: string; // formatted date/time
  competencia: string; // formatted date (month/year)

  // Prestador
  prestadorCnpj: string;
  prestadorRazaoSocial: string;
  prestadorIm?: string;
  prestadorEmail?: string;
  prestadorTelefone?: string;
  prestadorEndereco?: string;
  prestadorMunicipio?: string;
  prestadorUf?: string;
  prestadorCep?: string;
  simplesNacional?: boolean;

  // Tomador
  tomadorCnpjCpf?: string;
  tomadorRazaoSocial?: string;
  tomadorIm?: string;
  tomadorEmail?: string;
  tomadorTelefone?: string;
  tomadorEndereco?: string;
  tomadorMunicipio?: string;
  tomadorUf?: string;
  tomadorCep?: string;

  // Serviço
  discriminacao?: string;
  itemListaServico?: string;
  codigoCnae?: string;
  codigoTributacaoNacional?: string;
  codigoTributacaoMunicipal?: string;
  codigoMunicipioServico?: string;
  municipioServico?: string;
  naturezaOperacao?: string;

  // Valores (em centavos)
  valorServicosCents: number;
  aliquotaIss?: number;
  valorIssCents?: number;
  issRetido: boolean;
  baseCalculoCents?: number;

  // Status
  status: string;

  // Informações complementares
  infComplementares?: string;
}

const RH = 22; // standard row height for label+value cells

@Injectable()
export class DanfseService {

  async generate(data: DanfseData): Promise<Buffer> {
    return this.buildPdf(data);
  }

  private buildPdf(d: DanfseData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 25 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PW = 545; // page width (A4 - margins*2)
      const LM = 25; // left margin
      let y = 25;

      // ── Helpers ──
      const fmtDoc = (v: string) => {
        if (!v) return '';
        const n = v.replace(/\D/g, '');
        if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return v;
      };
      const fmtCep = (v?: string) => {
        if (!v) return '';
        const n = v.replace(/\D/g, '');
        return n.length === 8 ? `${n.slice(0, 2)}.${n.slice(2, 5)}-${n.slice(5)}` : v;
      };
      const fmtMoney = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fmtPct = (v?: number) => v != null ? `${v.toFixed(2).replace('.', ',')}%` : '-';
      const dash = (v?: string | null) => v || '-';

      const drawBox = (x: number, bY: number, w: number, h: number) => {
        doc.rect(x, bY, w, h).lineWidth(0.5).strokeColor('#000000').stroke();
      };

      const cell = (label: string, value: string, x: number, bY: number, w: number, h: number = RH) => {
        drawBox(x, bY, w, h);
        doc.font('Helvetica').fontSize(5.5).fillColor('#333333').text(label, x + 2, bY + 1.5, { width: w - 4 });
        doc.font('Helvetica').fontSize(7.5).fillColor('#000000').text(value || '-', x + 2, bY + 9, { width: w - 4, lineGap: 1 });
      };

      const sectionHeader = (title: string, sY: number) => {
        const h = 14;
        doc.rect(LM, sY, PW, h).fill('#e8e8e8').stroke();
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000').text(title, LM + 4, sY + 3.5, { width: PW - 8 });
        doc.font('Helvetica');
        return sY + h;
      };

      // ═══════════════════════════════════════════════════
      // HEADER — DANFSe v1.0
      // ═══════════════════════════════════════════════════

      drawBox(LM, y, PW, 50);

      // Center title
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
        .text('DANFSe v1.0', LM, y + 6, { width: PW, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#333333')
        .text('Documento Auxiliar da NFS-e', LM, y + 20, { width: PW, align: 'center' });

      y += 50;

      // Chave de acesso
      if (d.codigoVerificacao) {
        const keyH = 22;
        drawBox(LM, y, PW, keyH);
        doc.font('Helvetica').fontSize(5.5).fillColor('#333333').text('Chave de Acesso da NFS-e', LM + 3, y + 2);
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000').text(d.codigoVerificacao, LM + 3, y + 10);
        doc.font('Helvetica');
        y += keyH;
      }

      // ── Identification row ──
      const idH = RH;
      const col3 = PW / 3;
      cell('Número da NFS-e', d.nfseNumber || '-', LM, y, col3, idH);
      cell('Competência da NFS-e', d.competencia, LM + col3, y, col3, idH);
      cell('Data e Hora da emissão da NFS-e', d.issuedAt, LM + col3 * 2, y, PW - col3 * 2, idH);
      y += idH;

      // DPS row
      cell('Número da DPS', String(d.rpsNumber), LM, y, col3, idH);
      cell('Série da DPS', d.rpsSeries, LM + col3, y, col3, idH);
      cell('Data e Hora da emissão da DPS', d.issuedAt, LM + col3 * 2, y, PW - col3 * 2, idH);
      y += idH + 4;

      // ═══════════════════════════════════════════════════
      // EMITENTE DA NFS-e
      // ═══════════════════════════════════════════════════

      y = sectionHeader('EMITENTE DA NFS-e', y);

      // Prestador row 1: label + CNPJ, IM, Telefone
      const pCol = PW / 4;
      cell('Prestador do Serviço', '', LM, y, pCol, RH);
      cell('CNPJ / CPF / NIF', fmtDoc(d.prestadorCnpj), LM + pCol, y, pCol, RH);
      cell('Inscrição Municipal', dash(d.prestadorIm), LM + pCol * 2, y, pCol, RH);
      cell('Telefone', dash(d.prestadorTelefone), LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH;

      // Row 2: Nome, Email
      const halfW = PW / 2;
      cell('Nome / Nome Empresarial', d.prestadorRazaoSocial, LM, y, halfW, RH);
      cell('E-mail', dash(d.prestadorEmail), LM + halfW, y, PW - halfW, RH);
      y += RH;

      // Row 3: Endereço, Município, CEP
      const addrW = PW * 0.45;
      const munW = PW * 0.35;
      const cepW = PW - addrW - munW;
      cell('Endereço', dash(d.prestadorEndereco), LM, y, addrW, RH);
      cell('Município', d.prestadorMunicipio && d.prestadorUf ? `${d.prestadorMunicipio} - ${d.prestadorUf}` : dash(d.prestadorMunicipio), LM + addrW, y, munW, RH);
      cell('CEP', fmtCep(d.prestadorCep), LM + addrW + munW, y, cepW, RH);
      y += RH;

      // Row 4: Simples Nacional
      if (d.simplesNacional != null) {
        cell('Simples Nacional na Data de Competência', d.simplesNacional ? 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)' : 'Não Optante', LM, y, PW, RH);
        y += RH;
      }

      y += 4;

      // ═══════════════════════════════════════════════════
      // TOMADOR DO SERVIÇO
      // ═══════════════════════════════════════════════════

      y = sectionHeader('TOMADOR DO SERVIÇO', y);

      cell('CNPJ / CPF / NIF', fmtDoc(d.tomadorCnpjCpf || ''), LM, y, pCol, RH);
      cell('Inscrição Municipal', dash(d.tomadorIm), LM + pCol, y, pCol, RH);
      cell('Telefone', dash(d.tomadorTelefone), LM + pCol * 2, y, PW - pCol * 2, RH);
      y += RH;

      cell('Nome / Nome Empresarial', dash(d.tomadorRazaoSocial), LM, y, halfW, RH);
      cell('E-mail', dash(d.tomadorEmail), LM + halfW, y, PW - halfW, RH);
      y += RH;

      cell('Endereço', dash(d.tomadorEndereco), LM, y, addrW, RH);
      cell('Município', d.tomadorMunicipio && d.tomadorUf ? `${d.tomadorMunicipio} - ${d.tomadorUf}` : dash(d.tomadorMunicipio), LM + addrW, y, munW, RH);
      cell('CEP', fmtCep(d.tomadorCep), LM + addrW + munW, y, cepW, RH);
      y += RH + 4;

      // ═══════════════════════════════════════════════════
      // SERVIÇO PRESTADO
      // ═══════════════════════════════════════════════════

      y = sectionHeader('SERVIÇO PRESTADO', y);

      cell('Código de Tributação Nacional', dash(d.codigoTributacaoNacional), LM, y, pCol, RH);
      cell('Código de Tributação Municipal', dash(d.codigoTributacaoMunicipal), LM + pCol, y, pCol, RH);
      cell('Local da Prestação', d.municipioServico || dash(d.codigoMunicipioServico), LM + pCol * 2, y, pCol, RH);
      cell('País da Prestação', '-', LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH;

      // Discriminação
      const discText = d.discriminacao || '';
      const discH = Math.max(30, Math.min(80, Math.ceil(discText.length / 100) * 11 + 14));
      drawBox(LM, y, PW, discH);
      doc.font('Helvetica').fontSize(5.5).fillColor('#333333').text('Descrição do Serviço', LM + 2, y + 1.5);
      doc.font('Helvetica').fontSize(7.5).fillColor('#000000').text(discText, LM + 2, y + 9, { width: PW - 4, height: discH - 12, lineGap: 1 });
      y += discH + 4;

      // ═══════════════════════════════════════════════════
      // TRIBUTAÇÃO MUNICIPAL
      // ═══════════════════════════════════════════════════

      y = sectionHeader('TRIBUTAÇÃO MUNICIPAL', y);

      cell('Tributação do ISSQN', 'Operação tributável', LM, y, pCol, RH);
      cell('País Resultado da Prestação', '-', LM + pCol, y, pCol, RH);
      cell('Município de Incidência do ISSQN', d.municipioServico || '-', LM + pCol * 2, y, pCol, RH);
      cell('Regime Especial de Tributação', 'Nenhum', LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH;

      // Values row
      cell('Valor do Serviço', fmtMoney(d.valorServicosCents), LM, y, pCol, RH);
      cell('Desconto Incondicionado', '-', LM + pCol, y, pCol, RH);
      cell('Total Deduções/Reduções', '-', LM + pCol * 2, y, pCol, RH);
      cell('Cálculo do BM', '-', LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH;

      // ISS row
      const bcCents = d.baseCalculoCents ?? d.valorServicosCents;
      cell('BC ISSQN', fmtMoney(bcCents), LM, y, pCol, RH);
      cell('Alíquota Aplicada', fmtPct(d.aliquotaIss), LM + pCol, y, pCol, RH);
      cell('Retenção do ISSQN', d.issRetido ? 'Retido' : 'Não Retido', LM + pCol * 2, y, pCol, RH);
      cell('ISSQN Apurado', d.valorIssCents != null ? fmtMoney(d.valorIssCents) : '-', LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH + 4;

      // ═══════════════════════════════════════════════════
      // TRIBUTAÇÃO FEDERAL
      // ═══════════════════════════════════════════════════

      y = sectionHeader('TRIBUTAÇÃO FEDERAL', y);

      cell('IRRF', '-', LM, y, pCol, RH);
      cell('Contribuição Previdenciária - Retida', '-', LM + pCol, y, pCol, RH);
      cell('Contribuições Sociais - Retidas', '-', LM + pCol * 2, y, pCol, RH);
      cell('Descrição Contrib. Sociais - Retidas', '-', LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH;

      cell('PIS - Débito Apuração Própria', '-', LM, y, pCol, RH);
      cell('COFINS - Débito Apuração Própria', '-', LM + pCol, y, PW - pCol, RH);
      y += RH + 4;

      // ═══════════════════════════════════════════════════
      // VALOR TOTAL DA NFS-E
      // ═══════════════════════════════════════════════════

      y = sectionHeader('VALOR TOTAL DA NFS-E', y);

      const liquidoCents = d.issRetido ? d.valorServicosCents - (d.valorIssCents || 0) : d.valorServicosCents;
      cell('Valor do Serviço', fmtMoney(d.valorServicosCents), LM, y, pCol, RH);
      cell('Desconto Condicionado', '-', LM + pCol, y, pCol, RH);
      cell('Desconto Incondicionado', '-', LM + pCol * 2, y, pCol, RH);
      cell('ISSQN Retido', d.issRetido ? fmtMoney(d.valorIssCents || 0) : '-', LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH;

      cell('Total das Retenções Federais', '-', LM, y, pCol, RH);
      cell('PIS/COFINS - Débito Apur. Própria', '-', LM + pCol, y, pCol, RH);
      // Empty cell for spacing
      drawBox(LM + pCol * 2, y, pCol, RH);
      // Valor líquido (highlighted)
      cell('Valor Líquido da NFS-e', fmtMoney(liquidoCents), LM + pCol * 3, y, PW - pCol * 3, RH);
      y += RH + 4;

      // ═══════════════════════════════════════════════════
      // TOTAIS APROXIMADOS DOS TRIBUTOS
      // ═══════════════════════════════════════════════════

      y = sectionHeader('TOTAIS APROXIMADOS DOS TRIBUTOS', y);

      const tCol = PW / 3;
      cell('Federais', '-', LM, y, tCol, RH);
      cell('Estaduais', '-', LM + tCol, y, tCol, RH);
      cell('Municipais', '-', LM + tCol * 2, y, PW - tCol * 2, RH);
      y += RH + 4;

      // ═══════════════════════════════════════════════════
      // INFORMAÇÕES COMPLEMENTARES
      // ═══════════════════════════════════════════════════

      y = sectionHeader('INFORMAÇÕES COMPLEMENTARES', y);

      const infoText = d.infComplementares || '';
      const infoH = Math.max(20, Math.min(60, Math.ceil(infoText.length / 100) * 10 + 12));
      drawBox(LM, y, PW, infoH);
      doc.font('Helvetica').fontSize(7).fillColor('#000000').text(infoText, LM + 3, y + 3, { width: PW - 6, height: infoH - 6 });
      y += infoH + 8;

      // ═══════════════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════════════

      doc.font('Helvetica').fontSize(6).fillColor('#999999')
        .text('Documento gerado pelo sistema Tecnikos — tecnikos.com.br', LM, y, { width: PW, align: 'center' });

      doc.end();
    });
  }
}
