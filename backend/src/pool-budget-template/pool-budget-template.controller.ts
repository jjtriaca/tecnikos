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
import { PoolBudgetTemplateService } from './pool-budget-template.service';
import { CreatePoolBudgetTemplateDto } from './dto/create-pool-budget-template.dto';
import { UpdatePoolBudgetTemplateDto } from './dto/update-pool-budget-template.dto';
import { QueryPoolBudgetTemplateDto } from './dto/query-pool-budget-template.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Pool Budget Templates')
@Controller('pool-budget-templates')
export class PoolBudgetTemplateController {
  constructor(private readonly service: PoolBudgetTemplateService) {}

  @ApiOperation({ summary: 'Cria template de orçamento de piscina' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(
    @Body() body: CreatePoolBudgetTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Lista templates do tenant' })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query() filters: QueryPoolBudgetTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, filters);
  }

  @ApiOperation({ summary: 'Busca template por ID' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza template' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePoolBudgetTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @ApiOperation({ summary: 'Remove template (soft delete; falha se em uso)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId, user);
  }
}
