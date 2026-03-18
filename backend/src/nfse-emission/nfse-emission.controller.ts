import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res,
  UseGuards, HttpCode, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { FiscalGuard } from '../auth/guards/fiscal.guard';
import { NfseEmissionService } from './nfse-emission.service';
import { SaveNfseConfigDto, EmitNfseDto, CancelNfseDto, CreateNfseServiceCodeDto, UpdateNfseServiceCodeDto, UploadCertificateDto } from './dto/nfse-emission.dto';
import type { Response } from 'express';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { runInTenantContext } from '../tenant/tenant-context';

@ApiTags('NFS-e Emission')
@Controller('nfse-emission')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NfseEmissionController {
  private readonly logger = new Logger(NfseEmissionController.name);

  constructor(private readonly nfseService: NfseEmissionService) {}

  // ========== CONFIG ==========

  @Get('config')
  @Roles('ADMIN', 'FISCAL')
  async getConfig(@Req() req: any) {
    return this.nfseService.getConfig(req.user.companyId);
  }

  @Put('config')
  @Roles('ADMIN', 'FISCAL')
  async saveConfig(@Req() req: any, @Body() dto: SaveNfseConfigDto) {
    return this.nfseService.saveConfig(req.user.companyId, dto);
  }

  @Post('config/test-token')
  @Roles('ADMIN', 'FISCAL')
  async testToken(@Req() req: any, @Body() body: { environment?: string }) {
    return this.nfseService.testToken(req.user.companyId, body?.environment);
  }

  // ========== API DE EMPRESAS (REVENDA) ==========

  @Post('config/register-empresa')
  @Roles('ADMIN', 'FISCAL')
  async registerEmpresa(@Req() req: any) {
    return this.nfseService.registerOrUpdateEmpresa(req.user.companyId);
  }

  @Post('config/upload-certificate')
  @Roles('ADMIN', 'FISCAL')
  async uploadCertificate(@Req() req: any, @Body() dto: UploadCertificateDto) {
    return this.nfseService.uploadCertificate(req.user.companyId, dto.certBase64, dto.senha);
  }

  // ========== SERVICE CODES ==========

  @Get('service-codes')
  @Roles('ADMIN', 'FISCAL')
  async listServiceCodes(@Req() req: any) {
    return this.nfseService.listServiceCodes(req.user.companyId);
  }

  @Post('service-codes')
  @Roles('ADMIN', 'FISCAL')
  async createServiceCode(@Req() req: any, @Body() dto: CreateNfseServiceCodeDto) {
    return this.nfseService.createServiceCode(req.user.companyId, dto);
  }

  @Put('service-codes/:id')
  @Roles('ADMIN', 'FISCAL')
  async updateServiceCode(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateNfseServiceCodeDto) {
    return this.nfseService.updateServiceCode(req.user.companyId, id, dto);
  }

  @Delete('service-codes/:id')
  @Roles('ADMIN', 'FISCAL')
  async deleteServiceCode(@Req() req: any, @Param('id') id: string) {
    return this.nfseService.deleteServiceCode(req.user.companyId, id);
  }

  // ========== PREVIEW ==========

  @Get('preview/:financialEntryId')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async getPreview(@Req() req: any, @Param('financialEntryId') financialEntryId: string) {
    return this.nfseService.getEmissionPreview(req.user.companyId, financialEntryId);
  }

  // ========== EMISSÃO ==========

  @Post('emit')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async emit(@Req() req: any, @Body() dto: EmitNfseDto) {
    return this.nfseService.emit(req.user.companyId, dto);
  }

  // ========== CANCELAMENTO ==========

  @Delete(':id')
  @Roles('ADMIN', 'FISCAL')
  @UseGuards(FiscalGuard)
  async cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelNfseDto) {
    return this.nfseService.cancel(req.user.companyId, id, dto);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'FISCAL')
  @UseGuards(FiscalGuard)
  async cancelPost(@Req() req: any, @Param('id') id: string, @Body() dto: CancelNfseDto) {
    return this.nfseService.cancel(req.user.companyId, id, dto);
  }

  // ========== CONSULTAS ==========

  @Get('emissions')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async findEmissions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('serviceOrderId') serviceOrderId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('nfseNumber') nfseNumber?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nfseService.findEmissions(req.user.companyId, {
      status,
      serviceOrderId,
      search,
      dateFrom,
      dateTo,
      nfseNumber,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('emissions/:id')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async findOneEmission(@Req() req: any, @Param('id') id: string) {
    return this.nfseService.findOneEmission(req.user.companyId, id);
  }

  // ========== REFRESH STATUS ==========

  @Post('emissions/:id/refresh')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async refreshStatus(@Req() req: any, @Param('id') id: string) {
    return this.nfseService.refreshStatus(req.user.companyId, id);
  }

  // ========== PDF ==========

  @Get('emissions/:id/pdf')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async downloadPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.nfseService.downloadPdf(req.user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ========== RESEND EMAIL ==========

  @Post('emissions/:id/resend-email')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async resendEmail(@Req() req: any, @Param('id') id: string, @Body() body: { emails?: string[] }) {
    return this.nfseService.resendEmail(req.user.companyId, id, body.emails);
  }

  // ========== SEND WHATSAPP ==========

  @Post('emissions/:id/send-whatsapp')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  @UseGuards(FiscalGuard)
  async sendWhatsApp(@Req() req: any, @Param('id') id: string) {
    return this.nfseService.sendWhatsApp(req.user.companyId, id);
  }

  // ========== CHECK BEFORE PAYMENT ==========

  @Get('check-payment/:financialEntryId')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL')
  async checkBeforePayment(@Req() req: any, @Param('financialEntryId') financialEntryId: string) {
    return this.nfseService.checkNfseBeforePayment(req.user.companyId, financialEntryId);
  }
}

// ========== WEBHOOK (público, sem auth JWT) ==========

@ApiTags('NFS-e Webhook')
@Controller('webhooks/focusnfe')
@Public()
export class NfseWebhookController {
  private readonly logger = new Logger(NfseWebhookController.name);

  constructor(
    private readonly nfseService: NfseEmissionService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  /**
   * POST /webhooks/focusnfe — Receive NFS-e status updates from Focus NFe.
   *
   * The ref format is `tk-{companyIdPrefix}-{uuid}`. Since the webhook arrives
   * without a subdomain (no tenant context), we iterate all active tenants
   * to find the one owning this ref.
   */
  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.log(`Webhook received: ref=${body.ref} status=${body.status}`);
    if (!body.ref) return { ok: true };

    // Try each active tenant to find the NfseEmission with this ref
    const tenants = await this.tenantResolver.getActiveTenants();
    let handled = false;

    for (const tenant of tenants) {
      try {
        await runInTenantContext(
          { tenantId: tenant.id, tenantSchema: tenant.schemaName },
          async () => {
            // Check if this tenant has the emission
            const emission = await this.nfseService.findEmissionByRef(body.ref);
            if (emission) {
              await this.nfseService.handleWebhook(body.ref, body);
              handled = true;
            }
          },
        );
        if (handled) break;
      } catch (err) {
        this.logger.error(
          `Error checking tenant "${tenant.slug}" for ref=${body.ref}: ${(err as Error).message}`,
        );
      }
    }

    if (!handled) {
      this.logger.warn(`No tenant found for webhook ref=${body.ref}`);
    }

    return { ok: true };
  }
}
