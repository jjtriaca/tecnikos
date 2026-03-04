import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res,
  UseGuards, HttpCode, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { NfseEmissionService } from './nfse-emission.service';
import { SaveNfseConfigDto, EmitNfseDto, CancelNfseDto } from './dto/nfse-emission.dto';
import type { Response } from 'express';

@ApiTags('NFS-e Emission')
@Controller('nfse-emission')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NfseEmissionController {
  private readonly logger = new Logger(NfseEmissionController.name);

  constructor(private readonly nfseService: NfseEmissionService) {}

  // ========== CONFIG ==========

  @Get('config')
  @Roles('ADMIN')
  async getConfig(@Req() req: any) {
    return this.nfseService.getConfig(req.user.companyId);
  }

  @Put('config')
  @Roles('ADMIN')
  async saveConfig(@Req() req: any, @Body() dto: SaveNfseConfigDto) {
    return this.nfseService.saveConfig(req.user.companyId, dto);
  }

  // ========== PREVIEW ==========

  @Get('preview/:financialEntryId')
  @Roles('ADMIN', 'FINANCEIRO')
  async getPreview(@Req() req: any, @Param('financialEntryId') financialEntryId: string) {
    return this.nfseService.getEmissionPreview(req.user.companyId, financialEntryId);
  }

  // ========== EMISSÃO ==========

  @Post('emit')
  @Roles('ADMIN', 'FINANCEIRO')
  async emit(@Req() req: any, @Body() dto: EmitNfseDto) {
    return this.nfseService.emit(req.user.companyId, dto);
  }

  // ========== CANCELAMENTO ==========

  @Delete(':id')
  @Roles('ADMIN')
  async cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelNfseDto) {
    return this.nfseService.cancel(req.user.companyId, id, dto);
  }

  // ========== CONSULTAS ==========

  @Get('emissions')
  @Roles('ADMIN', 'FINANCEIRO')
  async findEmissions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('serviceOrderId') serviceOrderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nfseService.findEmissions(req.user.companyId, {
      status,
      serviceOrderId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('emissions/:id')
  @Roles('ADMIN', 'FINANCEIRO')
  async findOneEmission(@Req() req: any, @Param('id') id: string) {
    return this.nfseService.findOneEmission(req.user.companyId, id);
  }

  // ========== REFRESH STATUS ==========

  @Post('emissions/:id/refresh')
  @Roles('ADMIN', 'FINANCEIRO')
  async refreshStatus(@Req() req: any, @Param('id') id: string) {
    return this.nfseService.refreshStatus(req.user.companyId, id);
  }

  // ========== PDF ==========

  @Get('emissions/:id/pdf')
  @Roles('ADMIN', 'FINANCEIRO')
  async downloadPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.nfseService.downloadPdf(req.user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ========== CHECK BEFORE PAYMENT ==========

  @Get('check-payment/:financialEntryId')
  @Roles('ADMIN', 'FINANCEIRO')
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

  constructor(private readonly nfseService: NfseEmissionService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.log(`Webhook received: ref=${body.ref} status=${body.status}`);
    if (body.ref) {
      await this.nfseService.handleWebhook(body.ref, body);
    }
    return { ok: true };
  }
}
