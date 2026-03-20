import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Workflow')
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findAll(user.companyId, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      activeOnly: activeOnly === 'true',
    });
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
    @Body() body: { name: string; steps: any; requiredSpecializationIds?: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.companyId, body.name, body.steps, body.requiredSpecializationIds);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; steps?: any; isActive?: boolean; requiredSpecializationIds?: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Patch('reorder')
  reorder(
    @Body() body: { orderedIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reorder(user.companyId, body.orderedIds);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test workflow notification with sample data' })
  testWorkflow(
    @Body() body: { blocks: any[]; phone: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.testNotification(user.companyId, body.blocks, body.phone);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Post(':id/preview-os')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create a preview OS for tech portal emulator' })
  previewOs(
    @Param('id') id: string,
    @Body() body: { triggerLabel: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getOrCreatePreviewOs(id, user.companyId, body.triggerLabel);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId);
  }
}
