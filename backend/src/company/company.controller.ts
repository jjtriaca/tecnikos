import {
  Body, Controller, Get, Param, Put, Delete,
  Post, Patch, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Company')
@Controller('companies')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  /** Get own company info */
  @Get('me')
  findOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(user.companyId);
  }

  /** Admin-only: update company */
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, body, user.companyId);
  }

  /* ── Logo (must be before :id routes) ──────────────── */

  @Roles(UserRole.ADMIN)
  @Post('logo')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.service.uploadLogo(user.companyId, file);
  }

  @Roles(UserRole.ADMIN)
  @Delete('logo')
  removeLogo(@CurrentUser() user: AuthenticatedUser) {
    return this.service.removeLogo(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('logo-dimensions')
  updateLogoDimensions(
    @Body('logoWidth') logoWidth: number,
    @Body('logoHeight') logoHeight: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateLogoDimensions(user.companyId, logoWidth, logoHeight);
  }

  /* ── Fiscal Module Toggle ──────────────── */

  @Get('fiscal-module')
  getFiscalModule(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getFiscalModule(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('fiscal-module')
  toggleFiscalModule(
    @Body('fiscalEnabled') fiscalEnabled: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.toggleFiscalModule(user.companyId, fiscalEnabled);
  }

  /* ── Fiscal Config (Tax Regime + Accountant) ──── */

  @Roles(UserRole.ADMIN, UserRole.FISCAL)
  @Get('fiscal-config')
  getFiscalConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getFiscalConfig(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('fiscal-config')
  updateFiscalConfig(
    @Body() body: Record<string, any>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateFiscalConfig(user.companyId, body);
  }

  @Get('system-config')
  getSystemConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSystemConfig(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('system-config')
  updateSystemConfig(
    @Body() body: Record<string, any>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSystemConfig(user.companyId, body);
  }

  /** Admin-only: soft delete */
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId);
  }
}
