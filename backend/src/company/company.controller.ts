import { Body, Controller, Get, Param, Put, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
}
