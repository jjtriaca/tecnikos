import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Audit')
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getForEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.auditService.getForEntity(
      entityType,
      entityId,
      user.companyId,
      limit ? Math.min(Number(limit), 50) : 10,
    );
  }
}
