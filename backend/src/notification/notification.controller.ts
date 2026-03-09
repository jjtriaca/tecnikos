import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.companyId);
  }

  @Get('count')
  countUnread(@CurrentUser() user: AuthenticatedUser) {
    return this.service.countUnread(user.companyId);
  }

  @Post('mark-read')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user.companyId);
  }
}
