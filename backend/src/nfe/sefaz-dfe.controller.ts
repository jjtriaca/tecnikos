import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { SefazDfeService } from './sefaz-dfe.service';
import { DanfeService } from './danfe.service';
import { UpdateSefazConfigDto, SefazDocumentFilterDto, ManifestDocumentDto } from './dto/sefaz-config.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('NFe SEFAZ')
@Controller('nfe/sefaz')
export class SefazDfeController {
  private readonly logger = new Logger(SefazDfeController.name);

  constructor(
    private readonly service: SefazDfeService,
    private readonly danfeService: DanfeService,
  ) {}

  /* ── Upload PFX Certificate ──────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('certificate')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Body('pfxPassword') pfxPassword: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo PFX é obrigatório');
    }
    if (!pfxPassword) {
      throw new BadRequestException('Senha do certificado é obrigatória');
    }

    this.logger.log(
      `Certificate upload: name=${file.originalname}, size=${file.size}, ` +
      `bufferLen=${file.buffer?.length}, mimetype=${file.mimetype}`,
    );

    // Validate file size (max 50KB for certificates)
    const PFX_MAX_SIZE = 50 * 1024; // 50KB
    if (file.size > PFX_MAX_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Certificados devem ter no máximo 50KB.');
    }

    // Validate file extension
    const ext = file.originalname?.toLowerCase();
    if (!ext?.endsWith('.pfx') && !ext?.endsWith('.p12')) {
      throw new BadRequestException('Arquivo deve ser do tipo .pfx ou .p12');
    }

    return this.service.saveCertificate(user.companyId, file.buffer, pfxPassword);
  }

  /* ── Get Config (no secrets) ─────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('config')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getConfig(user.companyId);
  }

  /* ── Update Config ───────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Put('config')
  updateConfig(
    @Body() dto: UpdateSefazConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateConfig(user.companyId, dto);
  }

  /* ── Delete Certificate ──────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Delete('certificate')
  deleteCertificate(@CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteCertificate(user.companyId);
  }

  /* ── Manual Fetch ────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('fetch')
  fetch(@CurrentUser() user: AuthenticatedUser) {
    return this.service.fetchDistDFe(user.companyId);
  }

  /* ── Fetch NFe por chave de acesso (recupera notas que o sync pulou) ── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('fetch-by-key')
  fetchByKey(
    @Body() body: { nfeKey: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.fetchNfeByKey(user.companyId, body.nfeKey, user.email);
  }

  /* ── List Documents (paginated + filtered) ───────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('documents')
  findDocuments(
    @Query() filters: SefazDocumentFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findDocuments(user.companyId, filters);
  }

  /* ── Document Detail ─────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('documents/:id')
  findOneDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneDocument(user.companyId, id);
  }

  /* ── Import Document into NfeImport ──────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('documents/:id/import')
  importDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.importDocument(user.companyId, id);
  }

  /* ── Manifest Document (Manifestação do Destinatário) ────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('documents/:id/manifest')
  manifestDocument(
    @Param('id') id: string,
    @Body() dto: ManifestDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.manifestDocument(user.companyId, id, dto.tipo, dto.justificativa);
  }

  /* ── Ignore Document ─────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('documents/:id/ignore')
  ignoreDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.ignoreDocument(user.companyId, id);
  }

  /* ── Download XML ──────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('documents/:id/xml')
  async downloadXml(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const doc = await this.service.findOneDocument(user.companyId, id);
    if (!doc.xmlContent) {
      throw new BadRequestException('XML nao disponivel para este documento');
    }

    const filename = doc.nfeKey
      ? `NFe_${doc.nfeKey}.xml`
      : `NFe_${doc.nsu}.xml`;

    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(doc.xmlContent);
  }

  /* ── Download DANFE PDF ────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('documents/:id/danfe')
  async downloadDanfe(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const doc = await this.service.findOneDocument(user.companyId, id);
    if (!doc.xmlContent) {
      throw new BadRequestException('XML nao disponivel para gerar DANFE');
    }

    const pdfBuffer = await this.danfeService.generate(doc.xmlContent);

    const filename = doc.nfeKey
      ? `DANFE_${doc.nfeKey}.pdf`
      : `DANFE_${doc.nsu}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  }
}
