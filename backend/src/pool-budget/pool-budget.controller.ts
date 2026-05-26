import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PoolBudgetService } from './pool-budget.service';
import { HeatingBudgetService } from './heating-budget.service';
import { HeatingService } from './heating.service';
import { SolarBudgetService } from './solar-budget.service';
import { SolarPipeDto } from './dto/solar-pipe.dto';
import { CreatePoolBudgetDto } from './dto/create-pool-budget.dto';
import { UpdatePoolBudgetDto } from './dto/update-pool-budget.dto';
import { QueryPoolBudgetDto } from './dto/query-pool-budget.dto';
import { CreateBudgetItemDto, UpdateBudgetItemDto } from './dto/budget-item.dto';
import { HeatingSimulateDto } from './dto/heating-simulate.dto';
import { SolarSimulateDto, SolarRecomputeDto } from './dto/solar-simulate.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Pool Budgets')
@Controller('pool-budgets')
export class PoolBudgetController {
  constructor(
    private readonly service: PoolBudgetService,
    private readonly heatingBudget: HeatingBudgetService,
    private readonly heating: HeatingService,
    private readonly solarBudget: SolarBudgetService,
  ) {}

  // ============ Simulador de Aquecimento ============

  @ApiOperation({ summary: 'Lista UFs + cidades disponiveis para o simulador de aquecimento (le do banco ClimateData)' })
  @Get('heating/cities')
  listHeatingCities(@CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.listAvailableCities(user.companyId);
  }

  @ApiOperation({ summary: 'Retorna relatorio do simulador (cache ou recomputa)' })
  @Get(':id/heating-report')
  getHeatingReport(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.getReport(id, user.companyId);
  }

  @ApiOperation({ summary: 'Recomputa o relatorio do simulador e salva em cache' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/heating-report/recompute')
  recomputeHeatingReport(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.computeAndSaveReport(id, user.companyId);
  }

  @ApiOperation({ summary: 'Simulacao do simulador — calculo rapido sem salvar (modo livre)' })
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('heating/simulate')
  simulateHeating(@Body() dto: HeatingSimulateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.simulate(user.companyId, dto as any);
  }

  @ApiOperation({ summary: 'Lista candidatos disponiveis (Bomba de Calor/Aquecedor) pra dropdown' })
  @Get('heating/candidates')
  listHeatingCandidates(@CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.listCandidates(user.companyId);
  }

  @ApiOperation({ summary: 'Override manual do equipamento selecionado — salva no environmentParams + recomputa' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id/heating-report/equipment')
  selectHeatingEquipment(
    @Param('id') id: string,
    @Body() body: { productId: string | null; quantity?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.heatingBudget.selectEquipmentOverride(id, user.companyId, body?.productId ?? null, body?.quantity ?? 1);
  }

  // ============ Simulador Solar (Fase 4) ============

  @ApiOperation({ summary: 'Lista coletores solares aplicando a regra do tenant (vazia se sem regra)' })
  @Get('solar/collectors')
  listSolarCollectors(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.listSolarCollectors(user.companyId);
  }

  // ============ Regras de auto-selecao (config do tenant) ============

  @ApiOperation({ summary: 'Retorna a regra de auto-selecao do coletor solar do tenant' })
  @Get('solar/collector-rule')
  getSolarCollectorRule(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.getSolarCollectorRule(user.companyId).then((rule) => ({ rule }));
  }

  @ApiOperation({ summary: 'Salva a regra de auto-selecao do coletor solar no tenant (body.rule pode ser null)' })
  @Post('solar/collector-rule')
  setSolarCollectorRule(
    @Body() body: { rule: any | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarBudget.setSolarCollectorRule(user.companyId, body?.rule ?? null);
  }

  @ApiOperation({ summary: 'Retorna a regra de auto-selecao da bomba do coletor solar' })
  @Get('solar/bomba-rule')
  getSolarBombaRule(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.getSolarBombaRule(user.companyId).then((rule) => ({ rule }));
  }

  @ApiOperation({ summary: 'Salva a regra de auto-selecao da bomba (body.rule pode ser null)' })
  @Post('solar/bomba-rule')
  setSolarBombaRule(
    @Body() body: { rule: any | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarBudget.setSolarBombaRule(user.companyId, body?.rule ?? null);
  }

  @ApiOperation({ summary: 'Lista candidatos a bomba do Coletor Solar que passam na regra (ordenados pelo orderBy). v1.12.43.' })
  @Get(':id/solar-bomba-candidates')
  listSolarBombaCandidates(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.listSolarBombaCandidates(id, user.companyId).then((candidates) => ({ candidates }));
  }

  @ApiOperation({ summary: 'Persiste a bomba escolhida pelo operador no dropdown do Simulador Solar. body.productId=null limpa. v1.12.43.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/solar-bomba-selection')
  setSelectedBomba(
    @Param('id') id: string,
    @Body() body: { productId: string | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarBudget.setSelectedBomba(id, user.companyId, body?.productId ?? null);
  }

  @ApiOperation({ summary: 'Salva override de area/volume manuais em environmentParams.solarOverride. body null/{} limpa. v1.12.52.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/solar-override')
  setSolarOverride(
    @Param('id') id: string,
    @Body() body: { areaPiscinaM2?: number | null; volumeM3?: number | null } | null,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarBudget.setSolarOverride(id, user.companyId, body ?? null);
  }

  @ApiOperation({ summary: 'Simulacao solar — calculo rapido sem salvar' })
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('solar/simulate')
  simulateSolar(@Body() dto: SolarSimulateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.simulate(user.companyId, dto);
  }

  @ApiOperation({ summary: 'Retorna report solar cacheado em environmentParams.solarReport' })
  @Get(':id/solar-report')
  getSolarReport(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.getReport(id, user.companyId);
  }

  @ApiOperation({ summary: 'Recomputa report solar e salva em environmentParams.solarReport' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/solar-report/recompute')
  async recomputeSolarReport(@Param('id') id: string, @Body() body: SolarRecomputeDto, @CurrentUser() user: AuthenticatedUser) {
    const report = await this.solarBudget.computeAndSaveReport(id, user.companyId, body);
    // v1.12.28: ao trocar coletor / qtd no Simulador, recalcula totais do orcamento
    // pra que linhas com formulaExpr=solarQty atualizem a quantidade e linhas com
    // autoSelectRule.useSolarCollector vinculem ao novo coletor automaticamente.
    await this.service.recalculateTotals(id);
    return report;
  }

  @ApiOperation({ summary: 'Calcula perda de carga da tubulacao (Darcy-Weisbach + Haaland) e persiste em environmentParams.solarPipe. v1.12.34.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/solar-pipe/recompute')
  async recomputeSolarPipe(@Param('id') id: string, @Body() body: SolarPipeDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.solarBudget.computeAndSavePipe(id, user.companyId, body);
    // Como a perda de carga alimenta alturaTelhadoMca usada na auto-selecao da
    // bomba, recalcular totais aqui ja atualiza linhas com regra "Bomba do
    // Coletor Solar" automaticamente.
    await this.service.recalculateTotals(id);
    return result;
  }

  @ApiOperation({ summary: 'Upload da imagem do header da aba Solar (foto/render da piscina) — JPEG/PNG/WebP, max 5MB' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/solar-header-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadSolarHeaderImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.solarBudget.uploadHeaderImage(id, user.companyId, file);
  }

  @ApiOperation({ summary: 'Remove a imagem do header da aba Solar' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete(':id/solar-header-image')
  removeSolarHeaderImage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.removeHeaderImage(id, user.companyId);
  }

  // ============ Defaults do simulador ============

  @ApiOperation({ summary: 'Retorna environmentParams padrao do tenant (herdado em novos orcamentos)' })
  @Get('heating/defaults')
  getHeatingDefaults(@CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.getDefaultEnvironmentParams(user.companyId).then((env) => ({ defaultEnvironmentParams: env }));
  }

  @ApiOperation({ summary: 'Salva environmentParams padrao do tenant (usado em novos orcamentos)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('heating/defaults')
  saveHeatingDefaults(@Body() body: { defaultEnvironmentParams: any }, @CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.saveDefaultEnvironmentParams(user.companyId, body?.defaultEnvironmentParams ?? {});
  }

  @ApiOperation({ summary: 'Cria orçamento de piscina (auto-aplica template se enviado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(@Body() body: CreatePoolBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Lista orçamentos com paginação e filtros' })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query() filters: QueryPoolBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, filters);
  }

  @ApiOperation({ summary: 'Busca orçamento por ID (com items)' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza orçamento (não permite se aprovado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePoolBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @ApiOperation({ summary: 'Atualiza configuracao de etapas customizadas do orcamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/sections')
  updateSections(
    @Param('id') id: string,
    @Body() body: { labels?: Record<string, string>; order?: string[]; hidden?: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSections(id, user.companyId, body);
  }

  @ApiOperation({ summary: 'Soft delete (não permite se aprovado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId, user);
  }

  // ============== ITEMS ==============

  @ApiOperation({ summary: 'Adiciona item ao orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/items')
  addItem(
    @Param('id') budgetId: string,
    @Body() body: CreateBudgetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addItem(budgetId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Atualiza item do orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() body: UpdateBudgetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateItem(itemId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Remove item do orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('items/:itemId')
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeItem(itemId, user.companyId, user);
  }

  // ============== STATUS TRANSITIONS ==============

  @ApiOperation({
    summary: 'Aplica template Linear (Padrao Juliano) ao orçamento',
    description: 'So funciona em orçamentos sem items (RASCUNHO ou similar). Cria 125 items distribuidos em 12 etapas com slotName/descricao/qty/valor extraidos da planilha original.',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/apply-linear')
  applyLinear(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.applyLinearTemplate(id, user.companyId, user);
  }

  @ApiOperation({ summary: 'Aprova orçamento (gera obra automaticamente)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: { approverName?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user.companyId, user, body?.approverName);
  }

  @ApiOperation({ summary: 'Rejeita orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(id, user.companyId, user, body?.reason);
  }

  @ApiOperation({ summary: 'Cancela orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, user.companyId, user, body?.reason);
  }

  @ApiOperation({
    summary: 'Salva o orcamento atual como modelo (PoolBudgetTemplate)',
    description: 'Captura todos os items + impostos/desconto/garantias/forma pagamento. Se templateId enviado, ATUALIZA o modelo existente (sobrescreve items e defaults). Senao, cria novo.',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/save-as-template')
  saveAsTemplate(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isDefault?: boolean; templateId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveAsTemplate(id, user.companyId, user, body);
  }
}
