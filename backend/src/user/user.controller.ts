import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create({ ...body, companyId: user.companyId }, user);
  }

  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: { name?: string; email?: string; role?: UserRole; password?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, user.companyId, body, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user.companyId, user);
  }
}
