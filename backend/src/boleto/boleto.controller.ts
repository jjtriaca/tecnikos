import {
  Controller, Get, Post, Put, Body, Param, Query, Req, Res,
  UseGuards, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BoletoService } from './boleto.service';
import { BoletoConfigService } from './boleto-config.service';
import { BankProviderFactory } from './providers/bank-provider.factory';
import { SaveBoletoConfigDto } from './dto/save-boleto-config.dto';
import { CreateBoletoDto, CreateBoletosForEntryDto, CancelBoletoDto } from './dto/create-boleto.dto';
import type { Response } from 'express';

@ApiTags('Boleto')
@Controller('boleto')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoletoController {
  private readonly logger = new Logger(BoletoController.name);

  constructor(
    private readonly boletoService: BoletoService,
    private readonly configService: BoletoConfigService,
    private readonly bankFactory: BankProviderFactory,
  ) {}

  // ========== CONFIG ==========

  @Get('supported-banks')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Listar bancos suportados com campos necessarios' })
  async getSupportedBanks() {
    return this.bankFactory.getSupportedBanks();
  }

  @Get('detect-bank')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Auto-detectar banco das contas bancarias cadastradas' })
  async detectBank(@Req() req: any) {
    return this.configService.detectBankFromAccounts(req.user.companyId);
  }

  @Get('config')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Obter configuracao de boleto (mascarada)' })
  async getConfig(@Req() req: any) {
    return this.configService.getConfig(req.user.companyId);
  }

  @Put('config')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Salvar configuracao de boleto' })
  async saveConfig(@Req() req: any, @Body() dto: SaveBoletoConfigDto) {
    return this.configService.saveConfig(req.user.companyId, dto);
  }

  @Post('config/test-connection')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Testar conexao com banco' })
  async testConnection(@Req() req: any) {
    return this.configService.testConnection(req.user.companyId);
  }

  // ========== BOLETOS ==========

  @Get()
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Listar boletos' })
  async list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('partnerId') partnerId?: string,
    @Query('financialEntryId') financialEntryId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.boletoService.list(req.user.companyId, {
      status,
      partnerId,
      financialEntryId,
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Obter detalhes do boleto' })
  async getById(@Req() req: any, @Param('id') id: string) {
    return this.boletoService.getById(req.user.companyId, id);
  }

  @Get('by-entry/:entryId')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Listar boletos de um lancamento' })
  async getByEntry(@Req() req: any, @Param('entryId') entryId: string) {
    return this.boletoService.getByEntry(req.user.companyId, entryId);
  }

  @Post()
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Criar boleto avulso' })
  async create(@Req() req: any, @Body() dto: CreateBoletoDto) {
    return this.boletoService.createBoleto(req.user.companyId, dto);
  }

  @Post('for-entry')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Criar boletos para todas parcelas de um lancamento' })
  async createForEntry(@Req() req: any, @Body() dto: CreateBoletosForEntryDto) {
    return this.boletoService.createBoletosForEntry(req.user.companyId, dto);
  }

  @Post(':id/register')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Registrar boleto no banco' })
  async register(@Req() req: any, @Param('id') id: string) {
    return this.boletoService.registerBoleto(req.user.companyId, id);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Cancelar boleto no banco' })
  async cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelBoletoDto) {
    return this.boletoService.cancelBoleto(req.user.companyId, id, dto);
  }

  @Post(':id/refresh')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Atualizar status do boleto no banco' })
  async refresh(@Req() req: any, @Param('id') id: string) {
    return this.boletoService.refreshBoleto(req.user.companyId, id);
  }

  @Get(':id/pdf')
  @Roles('ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Download PDF do boleto' })
  async downloadPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.boletoService.downloadPdf(req.user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="boleto-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
