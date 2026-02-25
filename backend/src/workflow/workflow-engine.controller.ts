import { Body, Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { StepProgressDto } from './dto/step-progress.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('service-orders/:orderId/workflow')
export class WorkflowEngineController {
  constructor(private readonly engine: WorkflowEngineService) {}

  /**
   * GET /service-orders/:orderId/workflow — Get workflow progress (V1 or V2)
   */
  @Get()
  getProgress(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engine.getProgress(orderId, user.companyId);
  }

  /**
   * POST /service-orders/:orderId/workflow/advance — Advance to next step/block
   */
  @Post('advance')
  advanceStep(
    @Param('orderId') orderId: string,
    @Body() dto: StepProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const techId = user.partnerId || user.technicianId || user.id;
    return this.engine.advanceStep(orderId, techId, user.companyId, dto);
  }

  /**
   * DELETE /service-orders/:orderId/workflow/steps/:stepIdentifier
   * V1: stepIdentifier = stepOrder (integer)
   * V2: stepIdentifier = blockId (string)
   */
  @Delete('steps/:stepIdentifier')
  resetStep(
    @Param('orderId') orderId: string,
    @Param('stepIdentifier') stepIdentifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stepOrder = parseInt(stepIdentifier, 10);
    const param = isNaN(stepOrder) ? stepIdentifier : stepOrder;
    return this.engine.resetStep(orderId, param, user.companyId);
  }
}
