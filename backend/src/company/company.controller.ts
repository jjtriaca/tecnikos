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

  /** Admin-only: soft delete */
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId);
  }

  /* ── Logo ────────────────────────────────────────────── */

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
}
