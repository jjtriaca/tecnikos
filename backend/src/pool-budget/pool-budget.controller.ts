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
import { PoolBudgetService } from './pool-budget.service';
import { CreatePoolBudgetDto } from './dto/create-pool-budget.dto';
import { UpdatePoolBudgetDto } from './dto/update-pool-budget.dto';
import { QueryPoolBudgetDto } from './dto/query-pool-budget.dto';
import { CreateBudgetItemDto, UpdateBudgetItemDto } from './dto/budget-item.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireVerification } from '../auth/decorators/require-verification.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Pool Budgets')
@Controller('pool-budgets')
export class PoolBudgetController {
  constructor(private readonly service: PoolBudgetService) {}

  @ApiOperation({ summary: 'Cria orçamento de piscina (auto-aplica template se enviado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post()
  create(@Body() body: CreatePoolBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Lista orçamentos com paginação e filtros' })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query() filters: QueryPoolBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(user.companyId, pagination, filters);
  }

  @ApiOperation({ summary: 'Busca orçamento por ID (com items)' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user.companyId);
  }

  @ApiOperation({ summary: 'Atualiza orçamento (não permite se aprovado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePoolBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @ApiOperation({ summary: 'Soft delete (não permite se aprovado)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.companyId, user);
  }

  // ============== ITEMS ==============

  @ApiOperation({ summary: 'Adiciona item ao orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/items')
  addItem(
    @Param('id') budgetId: string,
    @Body() body: CreateBudgetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addItem(budgetId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Atualiza item do orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() body: UpdateBudgetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateItem(itemId, body, user.companyId, user);
  }

  @ApiOperation({ summary: 'Remove item do orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Delete('items/:itemId')
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeItem(itemId, user.companyId, user);
  }

  // ============== STATUS TRANSITIONS ==============

  @ApiOperation({
    summary: 'Aplica template Linear (Padrao Juliano) ao orçamento',
    description: 'So funciona em orçamentos sem items (RASCUNHO ou similar). Cria 125 items distribuidos em 12 etapas com slotName/descricao/qty/valor extraidos da planilha original.',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/apply-linear')
  applyLinear(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.applyLinearTemplate(id, user.companyId, user);
  }

  @ApiOperation({ summary: 'Aprova orçamento (gera obra automaticamente)' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: { approverName?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user.companyId, user, body?.approverName);
  }

  @ApiOperation({ summary: 'Rejeita orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(id, user.companyId, user, body?.reason);
  }

  @ApiOperation({ summary: 'Cancela orçamento' })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, user.companyId, user, body?.reason);
  }

  @ApiOperation({
    summary: 'Salva o orcamento atual como modelo (PoolBudgetTemplate)',
    description: 'Captura todos os items + impostos/desconto/garantias/forma pagamento/etc. Proximo orcamento criado com esse modelo ja vem populado.',
  })
  @RequireVerification()
  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/save-as-template')
  saveAsTemplate(
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; isDefault?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveAsTemplate(id, user.companyId, user, body);
  }
}
