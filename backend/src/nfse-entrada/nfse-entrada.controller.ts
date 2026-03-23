import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { NfseEntradaService } from './nfse-entrada.service';
import { CreateNfseEntradaDto } from './dto/create-nfse-entrada.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('NFS-e Entrada')
@Controller('nfse-entrada')
export class NfseEntradaController {
  constructor(private readonly service: NfseEntradaService) {}

  /* ── Upload XML ────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const xmlContent = file.buffer.toString('utf-8');
    return this.service.uploadXml(xmlContent, user.companyId);
  }

  /* ── Create Manual ─────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('manual')
  async createManual(
    @Body() dto: CreateNfseEntradaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createManual(user.companyId, dto);
  }

  /* ── NFS-e Import Usage (must be before :id route) ── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  @Get('import-usage')
  async getImportUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getImportUsage(user.companyId);
  }

  /* ── List ──────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('competencia') competencia?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.service.findAll(
      user.companyId,
      {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        search,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
      },
      competencia,
      status,
    );
  }

  /* ── Detail ────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  /* ── Update ────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateNfseEntradaDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, dto);
  }

  /* ── Download XML ─────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  @Get(':id/xml')
  async downloadXml(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const entry = await this.service.findOne(id, user.companyId);
    let xml = entry.xmlContent;

    // If no stored XML, try fetching from Focus NFe
    if (!xml && entry.focusSource && entry.chaveNfse) {
      xml = await this.service.fetchFocusXml(user.companyId, entry.chaveNfse);
    }

    if (!xml) {
      throw new BadRequestException('XML não disponível para esta NFS-e');
    }
    const filename = `nfse-${entry.numero || entry.id}.xml`;
    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    res.send(xml);
  }

  /* ── View PDF ─────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  @Get(':id/pdf')
  async viewPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const entry = await this.service.findOne(id, user.companyId);

    // Try Focus NFe PDF first
    if (entry.focusSource && entry.chaveNfse) {
      const pdfBuffer = await this.service.fetchFocusPdf(user.companyId, entry.chaveNfse);
      if (pdfBuffer) {
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="nfse-${entry.numero || entry.id}.pdf"`,
        });
        res.send(pdfBuffer);
        return;
      }
    }

    // Fallback: generate HTML printable
    const fmtCents = (c: number | null) => c != null ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
    const fmtDoc = (d: string | null) => {
      if (!d) return '—';
      if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
      return d;
    };
    const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>NFS-e ${entry.numero || ''}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#333;padding:20px;max-width:800px;margin:0 auto}
h1{font-size:16px;text-align:center;margin-bottom:4px}h2{font-size:12px;background:#f1f5f9;padding:6px 10px;margin:12px 0 6px;border-left:3px solid #3b82f6}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:8px}.grid3{grid-template-columns:1fr 1fr 1fr}
.label{color:#64748b;font-size:9px;text-transform:uppercase}.value{font-weight:600;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #e2e8f0;padding:4px 8px;text-align:left;font-size:10px}
th{background:#f8fafc;font-weight:600}td.r{text-align:right}.disc{white-space:pre-wrap;font-size:10px;margin-top:4px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px}
@media print{body{padding:10px}}</style></head><body>
<h1>NFS-e de Entrada${entry.numero ? ' N° ' + entry.numero : ''}</h1>
<p style="text-align:center;color:#64748b;font-size:10px;margin-bottom:12px">${entry.competencia ? 'Competência: ' + entry.competencia + ' | ' : ''}Emissão: ${fmtDate(entry.dataEmissao)}</p>
<h2>Prestador</h2>
<div class="grid"><div><p class="label">Razão Social</p><p class="value">${entry.prestadorRazaoSocial || '—'}</p></div>
<div><p class="label">CNPJ/CPF</p><p class="value">${fmtDoc(entry.prestadorCnpjCpf)}</p></div>
<div><p class="label">Inscrição Municipal</p><p class="value">${entry.prestadorIm || '—'}</p></div>
<div><p class="label">Município/UF</p><p class="value">${entry.prestadorMunicipio || '—'}${entry.prestadorUf ? '/' + entry.prestadorUf : ''}</p></div></div>
<h2>Serviço</h2>
<div class="grid"><div><p class="label">Item LC 116</p><p class="value">${entry.itemListaServico || '—'}</p></div>
<div><p class="label">CNAE</p><p class="value">${entry.codigoCnae || '—'}</p></div></div>
${entry.discriminacao ? '<p class="label" style="margin-top:4px">Discriminação</p><div class="disc">' + entry.discriminacao + '</div>' : ''}
<h2>Valores</h2>
<table><tr><th>Valor Serviços</th><th>Base Cálculo</th><th>Alíquota ISS</th><th>ISS</th><th>ISS Retido</th></tr>
<tr><td class="r">${fmtCents(entry.valorServicosCents)}</td><td class="r">${fmtCents(entry.baseCalculoCents)}</td>
<td class="r">${entry.aliquotaIss != null ? entry.aliquotaIss + '%' : '—'}</td><td class="r">${fmtCents(entry.valorIssCents)}</td>
<td>${entry.issRetido ? 'Sim' : 'Não'}</td></tr></table>
${(entry.valorPisCents || entry.valorCofinsCents || entry.valorInssCents || entry.valorIrCents || entry.valorCsllCents) ?
'<table style="margin-top:6px"><tr><th>PIS</th><th>COFINS</th><th>INSS</th><th>IR</th><th>CSLL</th><th>Outras Ret.</th></tr>' +
'<tr><td class="r">' + fmtCents(entry.valorPisCents) + '</td><td class="r">' + fmtCents(entry.valorCofinsCents) + '</td>' +
'<td class="r">' + fmtCents(entry.valorInssCents) + '</td><td class="r">' + fmtCents(entry.valorIrCents) + '</td>' +
'<td class="r">' + fmtCents(entry.valorCsllCents) + '</td><td class="r">' + fmtCents(entry.outrasRetCents) + '</td></tr></table>' : ''}
<div class="grid" style="margin-top:8px"><div><p class="label">Desconto Incond.</p><p class="value">${fmtCents(entry.descontoIncondCents)}</p></div>
<div><p class="label">Valor Líquido</p><p class="value" style="font-size:13px;color:#1e40af">${fmtCents(entry.valorLiquidoCents)}</p></div></div>
${entry.codigoObra || entry.art ? '<h2>Construção Civil</h2><div class="grid"><div><p class="label">CNO Obra</p><p class="value">' + (entry.codigoObra || '—') + '</p></div><div><p class="label">ART</p><p class="value">' + (entry.art || '—') + '</p></div></div>' : ''}
<p style="text-align:center;color:#94a3b8;font-size:9px;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:8px">Tecnikos — Gestão Inteligente | ${entry.focusSource ? 'Importada via Focus NFe' : 'Layout: ' + (entry.layout || 'Manual')}</p>
<script>window.print()</script></body></html>`;

    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  /* ── Process (gerar financeiro) ────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post(':id/process')
  async process(
    @Param('id') id: string,
    @Body() decisions: {
      prestador: { action: 'CREATE' | 'LINK'; partnerId?: string };
      finance: { createEntry: boolean; dueDate?: string };
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.process(id, user.companyId, decisions);
  }

  /* ── Revert (reverter financeiro) ─────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post(':id/revert')
  async revert(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.revert(id, user.companyId);
  }

  /* ── Cancel ────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, user.companyId);
  }

  /* ── Sync from Focus NFe ─────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('sync-focus')
  async syncFocus(@CurrentUser() user: AuthenticatedUser) {
    return this.service.syncFromFocus(user.companyId);
  }

  /* ── Link Prestador ────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Patch(':id/link-prestador')
  async linkPrestador(
    @Param('id') id: string,
    @Body('partnerId') partnerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.linkPrestador(id, user.companyId, partnerId);
  }
}
