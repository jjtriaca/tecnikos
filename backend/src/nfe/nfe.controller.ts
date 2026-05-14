import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { NfeService, ProcessDecisions } from './nfe.service';
import { DanfeService } from './danfe.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('NFe')
@Controller('nfe')
export class NfeController {
  constructor(
    private readonly service: NfeService,
    private readonly danfeService: DanfeService,
    private readonly prisma: PrismaService,
  ) {}

  /* ── Download DANFE PDF da NFe importada (v1.10.79) ──────────
     PADRAO TECNIKOS: gera DANFE on-demand a partir do xmlContent armazenado em NfeImport.
     Tela de detalhe de FinancialEntry usa este endpoint pra mostrar o PDF da nota fiscal
     vinculada. Mesmo gerador (DanfeService) usado pelo SefazDocument — codigo compartilhado.
  */
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO)
  @Get('imports/:id/danfe')
  async downloadImportDanfe(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const imp = await this.prisma.nfeImport.findFirst({
      where: { id, companyId: user.companyId },
      select: { xmlContent: true, nfeKey: true, nfeNumber: true },
    });
    if (!imp) throw new BadRequestException('NFe import nao encontrada');
    if (!imp.xmlContent) {
      throw new BadRequestException('XML nao disponivel pra gerar DANFE (NFe importada sem xmlContent)');
    }
    const pdfBuffer = await this.danfeService.generate(imp.xmlContent);
    const filename = imp.nfeKey ? `DANFE_${imp.nfeKey}.pdf` : `DANFE_NFe_${imp.nfeNumber || id}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  }

  /* ── Upload XML ──────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('upload')
  upload(
    @Body('xml') xml: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(xml, user.companyId);
  }

  /* ── List imports (paginated) ────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('imports')
  findImports(
    @Query() pagination: PaginationDto,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findImports(user.companyId, pagination, status);
  }

  /* ── Import detail ───────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('imports/:id')
  findOneImport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneImport(id, user.companyId);
  }

  /* ── Process import with decisions ───────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('imports/:id/process')
  process(
    @Param('id') id: string,
    @Body() decisions: ProcessDecisions,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.process(id, user.companyId, decisions);
  }

  /* ── Revert processed import ───────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('imports/:id/revert')
  revert(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.revert(id, user.companyId);
  }
}
