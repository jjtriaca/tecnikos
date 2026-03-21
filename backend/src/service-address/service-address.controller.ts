import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ServiceAddressService } from './service-address.service';
import { CreateServiceAddressDto, UpdateServiceAddressDto } from './dto/service-address.dto';

@ApiTags('Service Addresses')
@Controller('service-addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceAddressController {
  constructor(private readonly service: ServiceAddressService) {}

  @Get()
  @Roles('ADMIN', 'DESPACHO', 'FINANCEIRO')
  async findByPartner(
    @Req() req: any,
    @Query('partnerId') partnerId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findByPartner(
      req.user.companyId,
      partnerId,
      activeOnly !== 'false',
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'DESPACHO', 'FINANCEIRO')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.companyId, id);
  }

  @Post()
  @Roles('ADMIN', 'DESPACHO', 'FINANCEIRO')
  async create(@Req() req: any, @Body() dto: CreateServiceAddressDto) {
    return this.service.create(req.user.companyId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'DESPACHO', 'FINANCEIRO')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateServiceAddressDto) {
    return this.service.update(req.user.companyId, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN', 'DESPACHO', 'FINANCEIRO')
  async toggleActive(@Req() req: any, @Param('id') id: string) {
    return this.service.toggleActive(req.user.companyId, id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.companyId, id);
  }
}
