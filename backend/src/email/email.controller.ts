import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Req,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { UpdateEmailConfigDto, TestEmailConnectionDto, TestEmailSendDto } from './dto/email-config.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * GET /email/config — Get email config for the company
   */
  @Get('config')
  @Roles('ADMIN')
  async getConfig(@Req() req: any) {
    return this.emailService.getConfig(req.user.companyId);
  }

  /**
   * PUT /email/config — Save/update SMTP config
   */
  @Put('config')
  @Roles('ADMIN')
  async updateConfig(@Req() req: any, @Body() dto: UpdateEmailConfigDto) {
    return this.emailService.saveConfig(req.user.companyId, {
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure,
      smtpUser: dto.smtpUser,
      smtpPass: dto.smtpPass,
      fromName: dto.fromName,
      fromEmail: dto.fromEmail,
    });
  }

  /**
   * POST /email/test-connection — Test SMTP credentials without saving
   */
  @Post('test-connection')
  @Roles('ADMIN')
  async testConnection(@Body() dto: TestEmailConnectionDto) {
    return this.emailService.testConnection(
      dto.smtpHost,
      dto.smtpPort,
      dto.smtpSecure,
      dto.smtpUser,
      dto.smtpPass,
    );
  }

  /**
   * POST /email/test-send — Send a test email using saved config
   */
  @Post('test-send')
  @Roles('ADMIN')
  async testSend(@Req() req: any, @Body() dto: TestEmailSendDto) {
    const connected = await this.emailService.isConnected(req.user.companyId);
    if (!connected) {
      return { success: false, error: 'Email nao esta configurado' };
    }

    return this.emailService.sendTestEmail(req.user.companyId, dto.toEmail);
  }

  /**
   * DELETE /email/disconnect — Disconnect email config
   */
  @Delete('disconnect')
  @Roles('ADMIN')
  async disconnect(@Req() req: any) {
    await this.emailService.disconnect(req.user.companyId);
    return { message: 'Email desconectado' };
  }
}
