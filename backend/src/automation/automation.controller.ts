import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { AutomationEngineService } from './automation-engine.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/create-automation.dto';
import { SimulateAutomationDto } from './dto/simulate-automation.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Automation')
@Controller('automations')
export class AutomationController {
  constructor(
    private readonly service: AutomationService,
    private readonly engine: AutomationEngineService,
  ) {}

  /**
   * GET /automations — List all automation rules (paginated)
   */
  @Get()
  @Roles('ADMIN')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findAll(user.companyId, pagination);
  }

  /**
   * GET /automations/:id — Get a single automation rule
   */
  @Get(':id')
  @Roles('ADMIN')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  /**
   * POST /automations — Create a new automation rule
   */
  @Post()
  @Roles('ADMIN')
  create(
    @Body() dto: CreateAutomationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.companyId);
  }

  /**
   * PUT /automations/:id — Update an automation rule
   */
  @Put(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user.companyId);
  }

  /**
   * DELETE /automations/:id — Soft delete an automation rule
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId);
  }

  /**
   * PATCH /automations/:id/toggle — Toggle active/inactive
   */
  @Patch(':id/toggle')
  @Roles('ADMIN')
  toggle(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.toggle(id, user.companyId);
  }

  /**
   * GET /automations/:id/executions — Execution history for a rule
   */
  @Get(':id/executions')
  @Roles('ADMIN')
  getExecutions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.getExecutions(id, user.companyId, pagination);
  }

  /**
   * POST /automations/:id/simulate — Dry run a rule against a real entity
   * Returns condition evaluation results and which actions would execute.
   */
  @Post(':id/simulate')
  @Roles('ADMIN')
  simulate(
    @Param('id') id: string,
    @Body() dto: SimulateAutomationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engine.simulateRule(id, user.companyId, dto.entityType, dto.entityId, dto.eventType);
  }
}
