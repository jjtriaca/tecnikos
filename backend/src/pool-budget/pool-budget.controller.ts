import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { TrocadorBudgetService } from './trocador-budget.service';
import { ThermalDemandService } from './thermal-demand.service';
import { BordaInfinitaService } from './borda-infinita.service';
import { SolarPipeDto } from './dto/solar-pipe.dto';
import { TrocadorPipeDto } from './dto/trocador-pipe.dto';
import { CreatePoolBudgetDto } from './dto/create-pool-budget.dto';
import { UpdatePoolBudgetDto } from './dto/update-pool-budget.dto';
import { QueryPoolBudgetDto } from './dto/query-pool-budget.dto';
import { CreateBudgetItemDto, UpdateBudgetItemDto, ReorderItemsDto } from './dto/budget-item.dto';
import { HeatingSimulateDto } from './dto/heating-simulate.dto';
import { SolarSimulateDto, SolarRecomputeDto } from './dto/solar-simulate.dto';
import { CreateSolarRuleDto, UpdateSolarRuleDto } from './dto/solar-rule.dto';
import { BordaInfinitaSimulateDto, BordaHeatingDemandDto } from './dto/borda-infinita-simulate.dto';
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
    private readonly trocadorBudget: TrocadorBudgetService,
    private readonly thermalDemand: ThermalDemandService,
    private readonly bordaInfinita: BordaInfinitaService,
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

  @ApiOperation({ summary: 'Sistema de Borda Infinita — dimensiona tubo de gravidade (Manning) + volume do master, sem salvar' })
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('borda-infinita/simulate')
  simulateBordaInfinita(@Body() dto: BordaInfinitaSimulateDto) {
    return this.bordaInfinita.compute(dto);
  }

  @ApiOperation({ summary: 'Borda Infinita — previa AO VIVO da demanda termica (kcal/h) COM vs SEM a borda (card de calorias necessarias)' })
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('borda-infinita/heating-demand')
  bordaHeatingDemand(@Body() dto: BordaHeatingDemandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.computeBordaDemandPreview(user.companyId, dto);
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

  @ApiOperation({ summary: 'Retorna a regra de auto-selecao da bomba de calor do tenant' })
  @Get('heating/rule')
  getHeatingRule(@CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.getHeatingRule(user.companyId).then((rule) => ({ rule }));
  }

  @ApiOperation({ summary: 'Salva a regra de auto-selecao da bomba de calor no tenant (body.rule pode ser null)' })
  @Post('heating/rule')
  setHeatingRule(
    @Body() body: { rule: any | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.heatingBudget.setHeatingRule(user.companyId, body?.rule ?? null);
  }

  // ============ Simulador Solar (Fase 4) ============

  @ApiOperation({ summary: 'Lista coletores solares aplicando a regra do tenant (vazia se sem regra)' })
  @Get('solar/collectors')
  listSolarCollectors(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.listSolarCollectors(user.companyId);
  }

  // ============ Simulador Trocador de Calor ============

  @ApiOperation({ summary: 'Lista trocadores de calor (poolType ~ Trocador) pro dropdown do Simulador' })
  @Get('trocador/candidates')
  listTrocadorCandidates(@CurrentUser() user: AuthenticatedUser) {
    return this.trocadorBudget.listTrocadorCandidates(user.companyId);
  }

  @ApiOperation({ summary: 'Bomba secundaria pro Trocador: candidatos que atendem a vazao-alvo (vazaoSecundaria × qtd) + altura. Reusa a regra de bomba do Solar. v1.12.94.' })
  @Get(':id/trocador-bomba-candidates')
  listTrocadorBombaCandidates(
    @Param('id') _id: string,
    @Query('vazao') vazao: string,
    @Query('altura') altura: string,
    @Query('vazaoMax') vazaoMax: string,
    @Query('maxParalelo') maxParalelo: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const v = Number(vazao) || 0;
    const a = Number(altura) || 0;
    const vmax = Number(vazaoMax) || 0; // vazao MAXIMA-alvo (× qtd) — alimenta indicador "dentro x fora da vazao"
    // v1.13.55: N em paralelo — quando nenhuma bomba atende sozinha, relaxa pra incluir
    // bombas usaveis com ate maxParalelo unidades. Default 1 = comportamento atual.
    const mp = Math.max(1, Math.min(20, Number(maxParalelo) || 1));
    // Regra INDEPENDENTE da bomba de circulacao do calor (trocadorBombaRule), com fallback
    // pra do Solar quando nao configurada — ver listBombaCandidatesByFlow.
    return this.solarBudget
      .listBombaCandidatesByFlow(user.companyId, v, a, 'trocadorBombaRule', vmax, mp)
      .then((candidates) => ({ candidates }));
  }

  @ApiOperation({ summary: 'Recalcula a perda de carga da tubulacao do lado piscina do trocador (perda interna do trocador entra aditiva). v1.13.57: persiste em environmentParams.trocadorPipe (DN do tubo vira var trocadorPipeDnMm pro auto-select + inputs deixam de ser efemeros).' })
  @Post(':id/trocador-pipe/recompute')
  async recomputeTrocadorPipe(
    @Param('id') id: string,
    @Body() body: TrocadorPipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const r = await this.trocadorBudget.computeTrocadorPipe(user.companyId, body, id);
    // v1.13.57 (Chunk C): recalcula pra a linha do tubo refletir o novo DN (template "Tubo da
    // tubulacao Bomba de Calor", where=tuboEntradaMm>=trocadorPipeDnMm). Espelha o
    // solar-pipe/recompute, que ja recalcula pela mesma razao. recalculateTotals devolve
    // cache se o orcamento estiver congelado (frozen) — seguro.
    await this.service.recalculateTotals(id);
    return r;
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

  @ApiOperation({ summary: 'Retorna a regra de auto-selecao da bomba de CIRCULACAO da Bomba de Calor (Trocador) — INDEPENDENTE da do Solar. Fallback pra solarBombaRule quando vazia.' })
  @Get('heating/bomba-rule')
  getTrocadorBombaRule(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.getTrocadorBombaRule(user.companyId).then((rule) => ({ rule }));
  }

  @ApiOperation({ summary: 'Salva a regra de auto-selecao da bomba de circulacao da Bomba de Calor (body.rule pode ser null pra limpar e voltar ao fallback do Solar).' })
  @Post('heating/bomba-rule')
  setTrocadorBombaRule(
    @Body() body: { rule: any | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarBudget.setTrocadorBombaRule(user.companyId, body?.rule ?? null);
  }

  @ApiOperation({ summary: 'Lista candidatos a bomba do Coletor Solar que passam na regra (ordenados pelo orderBy). v1.12.43.' })
  @Get(':id/solar-bomba-candidates')
  listSolarBombaCandidates(@Param('id') id: string, @Query('maxParalelo') maxParalelo: string, @CurrentUser() user: AuthenticatedUser) {
    const mp = Math.max(1, Math.min(20, Number(maxParalelo) || 1));
    return this.solarBudget.listSolarBombaCandidates(id, user.companyId, mp).then((candidates) => ({ candidates }));
  }

  @ApiOperation({ summary: 'Persiste a bomba escolhida pelo operador no dropdown do Simulador Solar. body.productId=null limpa. body.manual=false marca como default automatico (recalculavel). v1.12.43/62.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/solar-bomba-selection')
  async setSelectedBomba(
    @Param('id') id: string,
    @Body() body: { productId: string | null; manual?: boolean; qty?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const r = await this.solarBudget.setSelectedBomba(id, user.companyId, body?.productId ?? null, body?.manual !== false, Number(body?.qty) || 1);
    // v1.13.52: recalcula pra linhas com regra useSolarBomba vincularem ao novo produto na hora.
    await this.service.recalculateTotals(id);
    return r;
  }

  @ApiOperation({ summary: 'Persiste a bomba de recirculacao da Bomba de Calor (trocador) escolhida no Simulador em environmentParams.trocadorBombaId. Linhas com regra useTrocadorBomba vinculam a ela. v1.13.52.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/trocador-bomba-selection')
  async setSelectedTrocadorBomba(
    @Param('id') id: string,
    @Body() body: { productId: string | null; qty?: number; vazaoOperM3h?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const r = await this.solarBudget.setSelectedTrocadorBomba(id, user.companyId, body?.productId ?? null, Number(body?.qty) || 1, Number(body?.vazaoOperM3h) || undefined);
    await this.service.recalculateTotals(id);
    return r;
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

  // ========== Regras Solares Configuraveis (v1.12.63) ==========
  // Storage: Company.systemConfig.pool.solarRules. Vinculacao 1 regra ↔ 1 (poolType, model).
  // Ver memory/project_solar_regras_configuraveis.md.

  @ApiOperation({ summary: 'Lista regras solares cadastradas no tenant + cobertura (produtos por regra) + defaults do sistema. v1.12.63.' })
  @Get('solar-rules')
  listSolarRules(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.listSolarRulesWithCoverage(user.companyId);
  }

  @ApiOperation({ summary: 'Lista modelos DISTINCT cadastrados para um poolType (alimenta dropdown "Modelo" do form de regra). v1.12.63.' })
  @Get('solar-rules/models')
  listModelsForRule(
    @Query('poolType') poolType: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!poolType?.trim()) throw new BadRequestException('poolType eh obrigatorio.');
    return this.solarBudget.listModelsByPoolType(user.companyId, poolType.trim());
  }

  @ApiOperation({ summary: 'Resolve a regra ativa para o coletor selecionado no orcamento. Usado pelo badge do Simulador. v1.12.63.' })
  @Get(':id/solar-active-rule')
  getActiveSolarRule(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.getActiveSolarRuleForBudget(id, user.companyId);
  }

  @ApiOperation({ summary: 'Cria nova regra solar. v1.12.63.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('solar-rules')
  createSolarRule(@Body() dto: CreateSolarRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.createSolarRule(user.companyId, dto);
  }

  @ApiOperation({ summary: 'Edita regra solar existente. v1.12.63.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('solar-rules/:ruleId')
  updateSolarRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateSolarRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarBudget.updateSolarRule(user.companyId, ruleId, dto);
  }

  @ApiOperation({ summary: 'Exclui regra solar. Produtos vinculados passam a usar defaults do sistema. v1.12.63.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('solar-rules/:ruleId')
  deleteSolarRule(@Param('ruleId') ruleId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.deleteSolarRule(user.companyId, ruleId).then(() => ({ deleted: true }));
  }

  // ========== Tarifa de energia (v1.12.78) ==========
  // Storage: Company.systemConfig.pool.tarifaKwhBRLCents. Default 95 (= R$ 0,95/kWh).
  // Usada no card da bomba do Simulador pra estimar custo eletrico mensal.

  @ApiOperation({ summary: 'Le a tarifa de energia configurada (centavos por kWh). Default 95. v1.12.78.' })
  @Get('solar-tarifa-kwh')
  async getSolarTarifaKwh(@CurrentUser() user: AuthenticatedUser) {
    const cents = await this.solarBudget.getTarifaKwhBRLCents(user.companyId);
    return { tarifaKwhBRLCents: cents };
  }

  @ApiOperation({ summary: 'Salva tarifa de energia (centavos por kWh). v1.12.78.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Patch('solar-tarifa-kwh')
  async setSolarTarifaKwh(
    @Body() body: { tarifaKwhBRLCents: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cents = await this.solarBudget.setTarifaKwhBRLCents(user.companyId, body.tarifaKwhBRLCents);
    return { tarifaKwhBRLCents: cents };
  }

  // ========== Defaults de tubulacao comprimento/desnivel (v1.13.64) ==========
  // Storage: Company.systemConfig.pool.pipeDefaults. O card do Simulador inicia desses valores
  // quando nao ha pipe salvo (antes hardcode 30/4). Operador grava pelo icone ao lado dos campos.
  @ApiOperation({ summary: 'Le os defaults de comprimento/desnivel da tubulacao (solar + bomba de calor). v1.13.64.' })
  @Get('pipe-dim-defaults')
  async getPipeDimDefaults(@CurrentUser() user: AuthenticatedUser) {
    return this.solarBudget.getPipeDimDefaults(user.companyId);
  }

  @ApiOperation({ summary: 'Salva defaults da tubulacao por contexto (solar|trocador): comprimento/desnivel + conexoes (material/fator/joelhos/tes/registros/valvulas). Merge parcial. v1.13.64/65.' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('pipe-dim-defaults')
  async setPipeDimDefault(
    @Body() body: { context?: string; comprimentoM?: number; desnivelM?: number; material?: string; fatorSegurancaPct?: number; joelho90Qty?: number; teQty?: number; registroQty?: number; valvulaQty?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const context = body?.context === 'trocador' ? 'trocador' : 'solar';
    return this.solarBudget.setPipeDimDefault(user.companyId, context, body);
  }

  // ========== Demanda Termica Unificada (v1.12.84) ==========
  // Calculo central que retorna kWh/mes necessario (perdas) + oferta solar (coletores)
  // + horas/dia da bomba + consumo eletrico. Usa heating.service (Tabela78) por composicao.
  // Aceita overrides pra UI testar cenarios sem salvar.

  @ApiOperation({ summary: 'Demanda termica unificada do orcamento — kWh/mes perdas + oferta solar + bomba. v1.12.84.' })
  @Post(':id/thermal-demand')
  computeThermalDemand(
    @Param('id') id: string,
    @Body() overrides: {
      tempAlvo?: number;
      tempInicial?: number;
      capaTermica?: boolean;
      vento?: 'FRACO' | 'MODERADO' | 'FORTE';
      qtdColetores?: number;
      orientacaoTelhado?: string;
      inclinacaoTelhadoGraus?: number;
      potenciaCv?: number;
      areaPiscinaM2?: number;
      volumeM3?: number;
    } = {},
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.thermalDemand.computeForBudget(id, user.companyId, overrides);
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
    // v1.12.87: anexa pipeResult atualizado na resposta (computeAndSaveReport
    // ja recalcula o pipe internamente quando ha solarPipe configurado). Frontend
    // usa isso pra atualizar o card de tubulacao sem precisar de chamada separada.
    (report as any).solarPipeAfter = await this.solarBudget.getSolarPipeFromBudget(id, user.companyId);
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

  @ApiOperation({ summary: 'Retorna padrões da proposta do tenant (ex.: validade em dias)' })
  @Get('settings/proposal-defaults')
  getProposalDefaults(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getProposalDefaults(user.companyId);
  }

  @ApiOperation({ summary: 'Salva a validade padrão do tenant (novos orçamentos herdam)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('settings/validity')
  saveDefaultValidity(@Body() body: { defaultValidityDays: number }, @CurrentUser() user: AuthenticatedUser) {
    return this.service.saveDefaultValidityDays(user.companyId, body?.defaultValidityDays);
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

  @ApiOperation({ summary: 'Reordena items de uma etapa em lote (1 request — evita burst no Throttler)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id/items/reorder')
  reorderItems(
    @Param('id') id: string,
    @Body() body: ReorderItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reorderItems(id, body.orderedIds, user.companyId, user);
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
    summary: 'Cadastrar (congelar) orçamento',
    description: 'Finaliza o orçamento: congela edição + recálculo automático (totais/qty/heating/solar) e libera o PDF. Reversível via /unregister (Editar).',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/register')
  register(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.register(id, user.companyId, user);
  }

  @ApiOperation({
    summary: 'Editar (descongelar) orçamento cadastrado',
    description: 'Libera o orçamento cadastrado para edição de novo (limpa frozenAt). As edições voltam a recalcular aplicando a lógica atual.',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/unregister')
  unregister(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.unregister(id, user.companyId, user);
  }

  @ApiOperation({
    summary: 'Duplica o orçamento',
    description: 'Cria uma cópia fiel (mesmas dimensões/etapas/linhas/qty), ligada ao original (histórico). updatePrices=true refresca os preços com o catálogo atual; false mantém os do original. A cópia nasce como rascunho editável (descongelada).',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Body() body: { title?: string; updatePrices?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.duplicate(id, user.companyId, user, { title: body?.title, updatePrices: body?.updatePrices });
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
