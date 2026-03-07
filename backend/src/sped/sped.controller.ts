import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FiscalGuard } from '../auth/guards/fiscal.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SpedIcmsIpiGenerator } from './sped-icms-ipi.generator';
import { SpedContribuicoesGenerator } from './sped-contribuicoes.generator';

@Controller('sped')
@UseGuards(JwtAuthGuard, RolesGuard, FiscalGuard)
export class SpedController {
  constructor(
    private readonly icmsIpiGen: SpedIcmsIpiGenerator,
    private readonly contribGen: SpedContribuicoesGenerator,
  ) {}

  /* ── Generate EFD-ICMS/IPI ─────────────────────── */

  @Get('efd-icms-ipi')
  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  async generateEfdIcmsIpi(
    @Req() req: any,
    @Res() res: Response,
    @Query('year') yearStr: string,
    @Query('month') monthStr: string,
    @Query('preview') preview?: string,
  ) {
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('Ano e mes invalidos');
    }

    const content = await this.icmsIpiGen.generate(req.user.companyId, year, month);

    if (preview === 'true') {
      return res.json({ content, lines: content.split('\r\n').length });
    }

    const filename = `EFD_ICMS_IPI_${year}${String(month).padStart(2, '0')}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  /* ── Generate EFD-Contribuicoes ────────────────── */

  @Get('efd-contribuicoes')
  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  async generateEfdContribuicoes(
    @Req() req: any,
    @Res() res: Response,
    @Query('year') yearStr: string,
    @Query('month') monthStr: string,
    @Query('preview') preview?: string,
  ) {
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('Ano e mes invalidos');
    }

    const content = await this.contribGen.generate(req.user.companyId, year, month);

    if (preview === 'true') {
      return res.json({ content, lines: content.split('\r\n').length });
    }

    const filename = `EFD_CONTRIBUICOES_${year}${String(month).padStart(2, '0')}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  /* ── Info — which SPED files are applicable ────── */

  @Get('info')
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async getInfo(@Req() req: any) {
    const company = await this.icmsIpiGen['prisma'].company.findUnique({
      where: { id: req.user.companyId },
      select: { taxRegime: true, cnae: true, fiscalProfile: true },
    });

    const regime = company?.taxRegime || 'SN';

    return {
      taxRegime: regime,
      cnae: company?.cnae,
      fiscalProfile: company?.fiscalProfile,
      files: [
        {
          type: 'EFD_ICMS_IPI',
          name: 'EFD ICMS/IPI (SPED Fiscal)',
          applicable: regime !== 'SN',
          reason: regime === 'SN'
            ? 'Simples Nacional e dispensado do SPED Fiscal'
            : 'Obrigatorio para ' + (regime === 'LP' ? 'Lucro Presumido' : 'Lucro Real') + ' contribuinte ICMS',
          deadline: 'Dia 20 do mes seguinte',
        },
        {
          type: 'EFD_CONTRIBUICOES',
          name: 'EFD-Contribuicoes (PIS/COFINS)',
          applicable: regime !== 'SN',
          reason: regime === 'SN'
            ? 'Simples Nacional e dispensado da EFD-Contribuicoes'
            : regime === 'LP'
              ? 'Obrigatorio — PIS 0,65% + COFINS 3,00% (cumulativo)'
              : 'Obrigatorio — PIS 1,65% + COFINS 7,60% (nao-cumulativo)',
          deadline: '10o dia util do 2o mes subsequente',
        },
        {
          type: 'DESTDA',
          name: 'DeSTDA (SEDIF-SN)',
          applicable: regime === 'SN',
          reason: regime === 'SN'
            ? 'Obrigatorio para SN — ST, DIFAL, Antecipacao'
            : 'Nao aplicavel (somente Simples Nacional)',
          deadline: 'Dia 28 do mes seguinte',
          note: 'Gerado pelo SEDIF-SN (aplicativo oficial). O Tecnikos fornece os dados para preenchimento.',
        },
      ],
    };
  }
}
