import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
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
