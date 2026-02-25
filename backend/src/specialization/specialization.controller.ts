import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SpecializationService } from './specialization.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Specializations')
@Controller('specializations')
export class SpecializationController {
  constructor(private readonly service: SpecializationService) {}

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.companyId, body.name, body.description);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post('seed-defaults')
  seedDefaults(@CurrentUser() user: AuthenticatedUser) {
    return this.service.seedDefaults(user.companyId);
  }
}
