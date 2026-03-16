import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly service: UserService,
    private readonly authService: AuthService,
  ) {}

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
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      roles: UserRole[];
      chatIAEnabled?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Create user without password — invite flow
    const created = await this.service.create({ ...body, companyId: user.companyId }, user);

    // Send invite email with set-password link
    const company = await this.service.getCompanyName(user.companyId);
    this.authService.sendInviteEmail(created.id, company).catch(() => {
      // Fire-and-forget: email failure doesn't block user creation
    });

    return created;
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  async resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Validate user belongs to same company
    await this.service.findOne(id, user.companyId);
    const company = await this.service.getCompanyName(user.companyId);
    await this.authService.resendInvite(id, company);
    return { ok: true, message: 'Convite reenviado com sucesso!' };
  }

  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: { name?: string; email?: string; roles?: UserRole[]; password?: string; chatIAEnabled?: boolean },
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
