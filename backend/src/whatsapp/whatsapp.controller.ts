import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateWhatsAppConfigDto } from './dto/whatsapp-config.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  // ── Config Management (ADMIN only) ────────────────────────

  /**
   * GET /whatsapp/config — Get WhatsApp config for the company
   */
  @Get('config')
  @Roles('ADMIN')
  async getConfig(@Req() req: any) {
    return this.whatsAppService.getConfig(req.user.companyId);
  }

  /**
   * PUT /whatsapp/config — Save/update Meta Cloud API config
   */
  @Put('config')
  @Roles('ADMIN')
  async updateConfig(@Req() req: any, @Body() dto: UpdateWhatsAppConfigDto) {
    return this.whatsAppService.saveConfig(req.user.companyId, {
      metaAccessToken: dto.metaAccessToken,
      metaPhoneNumberId: dto.metaPhoneNumberId,
      metaWabaId: dto.metaWabaId,
    });
  }

  /**
   * POST /whatsapp/test-connection — Test Meta credentials before saving
   */
  @Post('test-connection')
  @Roles('ADMIN')
  async testConnection(@Body() dto: UpdateWhatsAppConfigDto) {
    return this.whatsAppService.testConnection(
      dto.metaAccessToken,
      dto.metaPhoneNumberId,
    );
  }

  /**
   * GET /whatsapp/status — Connection status (compatible with existing frontend)
   */
  @Get('status')
  @Roles('ADMIN')
  async getStatus(@Req() req: any) {
    const status = await this.whatsAppService.getConnectionStatus(req.user.companyId);
    return { instance: 'meta-cloud', ...status };
  }

  /**
   * DELETE /whatsapp/disconnect — Disconnect WhatsApp
   */
  @Delete('disconnect')
  @Roles('ADMIN')
  async disconnect(@Req() req: any) {
    await this.whatsAppService.disconnect(req.user.companyId);
    return { message: 'WhatsApp desconectado' };
  }

  // ── Meta Webhook (PUBLIC — called by Meta) ────────────────

  /**
   * GET /whatsapp/webhook/meta/:companyId — Webhook verification (Meta challenge)
   * Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
   * Must return the challenge string as plain text.
   */
  @Public()
  @Get('webhook/meta/:companyId')
  async verifyWebhook(
    @Param('companyId') companyId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    const result = await this.whatsAppService.verifyWebhook(
      companyId,
      mode,
      token,
      challenge,
    );

    if (result) {
      return result;
    }

    throw new HttpException('Verification failed', HttpStatus.FORBIDDEN);
  }

  /**
   * POST /whatsapp/webhook/meta/:companyId — Receive events from Meta Cloud API
   */
  @Public()
  @Post('webhook/meta/:companyId')
  @HttpCode(HttpStatus.OK)
  async metaWebhook(@Param('companyId') companyId: string, @Body() body: any) {
    await this.whatsAppService.processMetaWebhook(companyId, body);
    return { ok: true };
  }

  // ── Messaging ─────────────────────────────────────────────

  /**
   * POST /whatsapp/send — Send message manually
   */
  @Post('send')
  @Roles('ADMIN', 'DESPACHO')
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    const companyId = req.user.companyId;

    const result = await this.whatsAppService.sendAndSave(
      companyId,
      dto.phone,
      dto.message,
      dto.mediaUrl,
    );

    return result;
  }

  // ── Chat / Conversations ──────────────────────────────────

  /**
   * GET /whatsapp/conversations — List all conversations
   */
  @Get('conversations')
  @Roles('ADMIN', 'DESPACHO')
  async listConversations(@Req() req: any, @Query('search') search?: string) {
    return this.whatsAppService.listConversations(req.user.companyId, search);
  }

  /**
   * GET /whatsapp/messages/:phone — Get messages for a phone
   */
  @Get('messages/:phone')
  @Roles('ADMIN', 'DESPACHO')
  async getMessages(
    @Req() req: any,
    @Param('phone') phone: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const messages = await this.whatsAppService.getMessages(
      req.user.companyId,
      phone,
      take ? parseInt(take) : 50,
      skip ? parseInt(skip) : 0,
    );

    // Mark as read
    await this.whatsAppService.markAsRead(req.user.companyId, phone);

    return messages;
  }
}
