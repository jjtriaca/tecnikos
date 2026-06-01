import { Module } from '@nestjs/common';
import { PoolBudgetService } from './pool-budget.service';
import { PoolBudgetController } from './pool-budget.controller';
import { PoolFormulaService } from './pool-formula.service';
import { HeatingService } from './heating.service';
import { HeatingBudgetService } from './heating-budget.service';
import { EnergyTariffController } from './energy-tariff.controller';
import { ClimateDataController } from './climate-data.controller';
import { ClimateDataService } from './climate-data.service';
import { SolarService } from './solar.service';
import { SolarBudgetService } from './solar-budget.service';
import { TrocadorBudgetService } from './trocador-budget.service';
import { ThermalDemandService } from './thermal-demand.service';
import { PipeHeadLossService } from './pipe-head-loss.service';
import { GravityFlowService } from './gravity-flow.service';
import { ReservoirVolumeService } from './reservoir-volume.service';
import { BordaInfinitaService } from './borda-infinita.service';
import { AuditModule } from '../common/audit/audit.module';
import { CodeGeneratorService } from '../common/code-generator.service';

@Module({
  imports: [AuditModule],
  controllers: [PoolBudgetController, EnergyTariffController, ClimateDataController],
  providers: [
    PoolBudgetService,
    PoolFormulaService,
    HeatingService,
    HeatingBudgetService,
    ClimateDataService,
    SolarService,
    SolarBudgetService,
    TrocadorBudgetService,
    ThermalDemandService,
    PipeHeadLossService,
    GravityFlowService,
    ReservoirVolumeService,
    BordaInfinitaService,
    CodeGeneratorService,
  ],
  exports: [PoolBudgetService, PoolFormulaService, HeatingService, HeatingBudgetService, ClimateDataService, SolarService, SolarBudgetService, TrocadorBudgetService, ThermalDemandService, PipeHeadLossService, GravityFlowService, ReservoirVolumeService, BordaInfinitaService],
})
export class PoolBudgetModule {}
