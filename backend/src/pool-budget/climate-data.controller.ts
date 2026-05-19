import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ClimateDataService } from './climate-data.service';
import { AddCustomCityDto, UpdateClimateDataDto } from './dto/climate-data.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Settings - Climate Data')
@Controller('settings/climate-data')
export class ClimateDataController {
  constructor(private readonly climateData: ClimateDataService) {}

  @ApiOperation({ summary: 'Lista todos os dados climaticos (27 estados + cidades-polo) do tenant' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('uf') uf?: string) {
    if (uf) return this.climateData.findByUf(user.companyId, uf);
    return this.climateData.findAll(user.companyId);
  }

  @ApiOperation({ summary: 'Adiciona cidade especifica a um UF existente' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Post('custom-city')
  addCustomCity(@Body() dto: AddCustomCityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.climateData.addCustomCity(user.companyId, dto);
  }

  @ApiOperation({ summary: 'Atualiza dados climaticos de um registro (marca isCustom=true)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClimateDataDto, @CurrentUser() user: AuthenticatedUser) {
    return this.climateData.update(user.companyId, id, dto);
  }

  @ApiOperation({ summary: 'Restaura padrao INMET de um registro (so funciona em seed records)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Post(':id/restore-seed')
  restoreSeed(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.climateData.restoreSeed(user.companyId, id);
  }

  @ApiOperation({ summary: 'Remove cidade custom (nao remove o registro padrao do estado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async deleteCustomCity(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.climateData.deleteCustomCity(user.companyId, id);
    return { ok: true };
  }
}
