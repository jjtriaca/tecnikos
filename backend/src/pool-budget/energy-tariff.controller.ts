import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { HeatingBudgetService } from './heating-budget.service';
import { UpsertEnergyTariffDto } from './dto/energy-tariff.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Settings - Energy Tariff')
@Controller('settings/energy-tariff')
export class EnergyTariffController {
  constructor(private readonly heatingBudget: HeatingBudgetService) {}

  @ApiOperation({ summary: 'Retorna tarifa de energia ativa do tenant (ou defaults se nao configurada)' })
  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.getEnergyTariff(user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza tarifa de energia do tenant (desativa anterior, cria nova ativa)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Put()
  upsert(@Body() dto: UpsertEnergyTariffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.heatingBudget.upsertEnergyTariff(user.companyId, dto);
  }
}
