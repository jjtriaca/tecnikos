import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NfeService, ProcessDecisions } from './nfe.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('NFe')
@Controller('nfe')
export class NfeController {
  constructor(private readonly service: NfeService) {}

  /* ── Upload XML ──────────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('upload')
  upload(
    @Body('xml') xml: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(xml, user.companyId);
  }

  /* ── List imports (paginated) ────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('imports')
  findImports(
    @Query() pagination: PaginationDto,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findImports(user.companyId, pagination, status);
  }

  /* ── Import detail ───────────────────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('imports/:id')
  findOneImport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneImport(id, user.companyId);
  }

  /* ── Process import with decisions ───────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('imports/:id/process')
  process(
    @Param('id') id: string,
    @Body() decisions: ProcessDecisions,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.process(id, user.companyId, decisions);
  }

  /* ── Revert processed import ───────────────────────────────── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Post('imports/:id/revert')
  revert(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.revert(id, user.companyId);
  }
}
