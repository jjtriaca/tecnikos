import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly service: ServiceService) {}

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('category') category: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, { category, status });
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get('categories')
  getCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCategories(user.companyId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.companyId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId);
  }
}
