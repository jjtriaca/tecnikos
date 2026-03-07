import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FiscalGuard } from '../auth/guards/fiscal.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { FiscalPeriodService } from './fiscal-period.service';

@Controller('fiscal-periods')
@UseGuards(JwtAuthGuard, RolesGuard, FiscalGuard)
export class FiscalPeriodController {
  constructor(private readonly service: FiscalPeriodService) {}

  /* ── Dashboard Fiscal ──────────────────────────── */

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async getDashboard(@Req() req: any) {
    return this.service.getDashboard(req.user.companyId);
  }

  /* ── List Periods ──────────────────────────────── */

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async findAll(
    @Req() req: any,
    @Query('year') year?: string,
  ) {
    return this.service.findAll(
      req.user.companyId,
      year ? parseInt(year) : undefined,
    );
  }

  /* ── Apuração (preview sem fechar) ─────────────── */

  @Get('apuracao')
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async getApuracao(
    @Req() req: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.service.calculate(
      req.user.companyId,
      parseInt(year),
      parseInt(month),
    );
  }

  /* ── Livro de Entradas (NFe) ───────────────────── */

  @Get('livro-entradas')
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async getLivroEntradas(
    @Req() req: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.service.getLivroEntradas(
      req.user.companyId,
      parseInt(year),
      parseInt(month),
    );
  }

  /* ── Serviços Tomados (NFS-e Entrada) ──────────── */

  @Get('servicos-tomados')
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async getServicosTomados(
    @Req() req: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.service.getServicosTomados(
      req.user.companyId,
      parseInt(year),
      parseInt(month),
    );
  }

  /* ── Get Single Period ─────────────────────────── */

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.FISCAL, UserRole.FINANCEIRO, UserRole.LEITURA)
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.companyId);
  }

  /* ── Close Period ──────────────────────────────── */

  @Post('close')
  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  async close(
    @Req() req: any,
    @Body() body: { year: number; month: number },
  ) {
    return this.service.close(
      req.user.companyId,
      body.year,
      body.month,
      req.user.name || 'Sistema',
    );
  }

  /* ── Reopen Period ─────────────────────────────── */

  @Post(':id/reopen')
  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  async reopen(@Param('id') id: string, @Req() req: any) {
    return this.service.reopen(id, req.user.companyId);
  }

  /* ── Update Notes ──────────────────────────────── */

  @Patch(':id/notes')
  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  async updateNotes(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { notes: string },
  ) {
    return this.service.updateNotes(id, req.user.companyId, body.notes);
  }
}
