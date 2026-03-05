import { Controller, Get, Post, Put, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ObraService } from './obra.service';
import { CreateObraDto, UpdateObraDto } from './dto/obra.dto';

@ApiTags('Obras')
@Controller('obras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObraController {
  constructor(private readonly obraService: ObraService) {}

  @Get()
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL', 'DESPACHO')
  async findByPartner(
    @Req() req: any,
    @Query('partnerId') partnerId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.obraService.findByPartner(
      req.user.companyId,
      partnerId,
      activeOnly !== 'false',
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL', 'DESPACHO')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.obraService.findOne(req.user.companyId, id);
  }

  @Post()
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL', 'DESPACHO')
  async create(@Req() req: any, @Body() dto: CreateObraDto) {
    return this.obraService.create(req.user.companyId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL', 'DESPACHO')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateObraDto) {
    return this.obraService.update(req.user.companyId, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN', 'FINANCEIRO', 'FISCAL', 'DESPACHO')
  async toggleActive(@Req() req: any, @Param('id') id: string) {
    return this.obraService.toggleActive(req.user.companyId, id);
  }
}
