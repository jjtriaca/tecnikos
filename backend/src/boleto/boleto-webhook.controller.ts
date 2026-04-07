import { Controller, Post, Body, Param, Req, Logger, HttpCode } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BoletoService } from './boleto.service';

@ApiTags('Boleto Webhooks')
@Controller('webhooks/boleto')
export class BoletoWebhookController {
  private readonly logger = new Logger(BoletoWebhookController.name);

  constructor(private readonly boletoService: BoletoService) {}

  @Public()
  @Post(':bankCode')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de boleto bancario (publico)' })
  async handleWebhook(
    @Param('bankCode') bankCode: string,
    @Body() payload: any,
    @Req() req: any,
  ) {
    this.logger.log(`Boleto webhook received: bank=${bankCode}`);

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[key] = value;
      }

      return await this.boletoService.handleWebhook(bankCode, payload, headers);
    } catch (error) {
      this.logger.error(`Boleto webhook error: bank=${bankCode}`, error);
      // Sempre retornar 200 para evitar retries infinitos
      return { received: true, error: 'Processing error' };
    }
  }
}
