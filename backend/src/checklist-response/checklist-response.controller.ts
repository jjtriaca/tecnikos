import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { ChecklistResponseService } from './checklist-response.service';

@ApiTags('Checklist Responses')
@Controller('service-orders')
export class ChecklistResponseController {
  constructor(private readonly service: ChecklistResponseService) {}

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get(':id/checklists')
  findByServiceOrder(
    @Param('id') serviceOrderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findByServiceOrder(user.companyId, serviceOrderId);
  }

  @Roles(UserRole.ADMIN, UserRole.DESPACHO)
  @Get(':id/checklists/items/:checklistClass')
  getAggregatedItems(
    @Param('id') serviceOrderId: string,
    @Param('checklistClass') checklistClass: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getAggregatedItems(user.companyId, serviceOrderId, checklistClass);
  }
}
