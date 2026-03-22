import { Body, Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkflowEngineService } from './workflow-engine.service';
import { StepProgressDto } from './dto/step-progress.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Workflow Engine')
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
   * POST /service-orders/:orderId/workflow/position — Submit GPS position for proximity tracking
   */
  @Post('position')
  submitPosition(
    @Param('orderId') orderId: string,
    @Body() body: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number; clientTimestamp?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const techId = user.partnerId || user.technicianId || user.id;
    return this.engine.submitProximityPosition(orderId, techId, user.companyId, body);
  }

  /**
   * DELETE /service-orders/:orderId/workflow/steps/:blockId
   * Resets workflow from the given blockId onwards.
   */
  @Delete('steps/:blockId')
  resetStep(
    @Param('orderId') orderId: string,
    @Param('blockId') blockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engine.resetStep(orderId, blockId, user.companyId);
  }
}
