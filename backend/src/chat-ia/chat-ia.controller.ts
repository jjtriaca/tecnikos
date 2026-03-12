import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatIAService } from './chat-ia.service';
import { ChatIAOnboardingService } from './chat-ia.onboarding';
import { ChatIASendMessageDto } from './dto/send-message.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Chat IA')
@Controller('chat-ia')
export class ChatIAController {
  constructor(
    private readonly service: ChatIAService,
    private readonly onboarding: ChatIAOnboardingService,
  ) {}

  @Post('message')
  async sendMessage(
    @Body() dto: ChatIASendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.sendMessage(
      user.companyId,
      user.id,
      dto.content,
      dto.conversationId,
      req.tenantSchema,
    );
  }

  @Post('message-stream')
  async sendMessageStream(
    @Body() dto: ChatIASendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await this.service.sendMessageStream(
        user.companyId,
        user.id,
        dto.content,
        dto.conversationId,
        req.tenantSchema,
        emit,
      );
    } catch (err: any) {
      emit('error', { message: err.message || 'Erro interno' });
    }

    res.end();
  }

  @Get('welcome')
  async getWelcome(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.getWelcomeMessage(user.companyId, req.tenantSchema, req.tenantStatus);
  }

  @Get('onboarding-status')
  async getOnboardingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.onboarding.getStatus(user.companyId, req.tenantSchema);
  }

  @Get('usage')
  async getUsage(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.getUsage(user.companyId, req.tenantSchema);
  }

  @Get('conversations')
  async listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.listConversations(user.companyId, user.id, req.tenantSchema);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.getMessages(id, user.companyId, req.tenantSchema);
  }

  @Delete('conversations/:id')
  async archiveConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.archiveConversation(id, user.companyId, req.tenantSchema);
  }

  @Get('status')
  getStatus() {
    return { available: this.service.isConfigured };
  }
}
