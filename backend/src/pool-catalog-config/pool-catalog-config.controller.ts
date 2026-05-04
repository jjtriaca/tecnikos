import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PoolCatalogConfigService } from './pool-catalog-config.service';
import { CreatePoolCatalogConfigDto } from './dto/create-pool-catalog-config.dto';
import { UpdatePoolCatalogConfigDto } from './dto/update-pool-catalog-config.dto';
import { QueryPoolCatalogConfigDto } from './dto/query-pool-catalog-config.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Pool Catalog Config')
@Controller('pool-catalog-config')
export class PoolCatalogConfigController {
  constructor(private readonly service: PoolCatalogConfigService) {}

  @ApiOperation({
    summary: 'Cria uma config de Piscina pra um Product OU Service',
    description:
      'Vincula um item do catálogo (produto ou serviço) ao módulo Piscina, com seção, fórmula de cálculo automático e specs técnicas',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreatePoolCatalogConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Lista configs de Piscina do tenant (com filtros e paginação)' })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query() filters: QueryPoolCatalogConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, filters);
  }

  @ApiOperation({
    summary: 'Lista configs ativas de uma seção (uso interno do budget builder)',
  })
  @Get('by-section/:section')
  listBySection(
    @Param('section') section: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listBySection(user.companyId, section);
  }

  @ApiOperation({ summary: 'Busca config por ID' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza config (parcial)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePoolCatalogConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @ApiOperation({
    summary: 'Remove config (hard delete; falha se em uso por orçamentos)',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId, user);
  }
}
