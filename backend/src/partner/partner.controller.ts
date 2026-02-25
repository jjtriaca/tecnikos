import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { UpdatePartnerStatusDto } from './dto/update-status.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@Controller('partners')
export class PartnerController {
  constructor(private readonly service: PartnerService) {}

  @Get()
  findAll(
    @Query('type') type: string | undefined,
    @Query('status') status: string | undefined,
    @Query('personType') personType: string | undefined,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, { type, status, personType }, pagination);
  }

  @Get('by-specializations')
  findBySpecializations(
    @Query('ids') ids: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const specializationIds = ids ? ids.split(',').filter(Boolean) : [];
    return this.service.findBySpecializations(user.companyId, specializationIds);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreatePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.companyId, body, user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @Roles(UserRole.ADMIN)
  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdatePartnerStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, user.companyId, body.status, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId, user);
  }
}
