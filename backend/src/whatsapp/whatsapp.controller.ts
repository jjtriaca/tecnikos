import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  // ── Instance Management (ADMIN only) ───────────────────────

  /**
   * GET /whatsapp/status — Connection status
   */
  @Get('status')
  @Roles('ADMIN')
  async getStatus() {
    const status = await this.whatsAppService.getConnectionStatus();
    return { instance: process.env.EVOLUTION_INSTANCE_NAME || 'tecnikos', ...status };
  }

  /**
   * GET /whatsapp/qrcode — Get QR code to connect
   */
  @Get('qrcode')
  @Roles('ADMIN')
  async getQRCode() {
    return this.whatsAppService.getQRCode();
  }

  /**
   * POST /whatsapp/connect — Create instance + get QR
   */
  @Post('connect')
  @Roles('ADMIN')
  async connect() {
    await this.whatsAppService.createInstance();
    const qr = await this.whatsAppService.getQRCode();
    return { message: 'Instância criada. Escaneie o QR Code.', ...qr };
  }

  /**
   * DELETE /whatsapp/logout — Disconnect WhatsApp
   */
  @Delete('logout')
  @Roles('ADMIN')
  async logout() {
    await this.whatsAppService.logout();
    return { message: 'WhatsApp desconectado' };
  }

  /**
   * POST /whatsapp/restart — Restart instance
   */
  @Post('restart')
  @Roles('ADMIN')
  async restart() {
    await this.whatsAppService.restart();
    return { message: 'Instância reiniciada' };
  }

  /**
   * POST /whatsapp/configure-webhook — Set webhook URL
   */
  @Post('configure-webhook')
  @Roles('ADMIN')
  async configureWebhook(@Body() body: { url: string }) {
    const url = body.url || `https://${process.env.DOMAIN || 'tecnikos.com.br'}/api/whatsapp/webhook`;
    await this.whatsAppService.configureWebhook(url);
    return { message: 'Webhook configurado', url };
  }

  // ── Webhook (PUBLIC — called by Evolution API) ─────────────

  /**
   * POST /whatsapp/webhook — Receive events from Evolution API
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: any) {
    await this.whatsAppService.processWebhook(body);
    return { ok: true };
  }

  // ── Messaging ──────────────────────────────────────────────

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

  // ── Chat / Conversations ───────────────────────────────────

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
