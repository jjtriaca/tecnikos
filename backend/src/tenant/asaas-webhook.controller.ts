import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AsaasService } from './asaas.service';
import { AsaasProvider } from './asaas.provider';

/**
 * Public webhook endpoint for Asaas payment notifications.
 * No JWT auth — validated via asaas-access-token header.
 */
@Controller('webhooks/asaas')
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);

  constructor(
    private readonly asaasService: AsaasService,
    private readonly asaasProvider: AsaasProvider,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Headers('asaas-access-token') authToken: string,
    @Body() body: any,
  ) {
    // Validate webhook token
    const expectedToken = this.asaasProvider.webhookToken;
    if (expectedToken && authToken !== expectedToken) {
      this.logger.warn('Invalid webhook token received');
      throw new ForbiddenException('Invalid webhook token');
    }

    const { event } = body;
    if (!event) {
      this.logger.warn('Webhook without event field');
      return { received: true };
    }

    this.logger.log(`Webhook: ${event}`);

    try {
      if (event.startsWith('PAYMENT_')) {
        await this.asaasService.handlePaymentWebhook(event, body.payment);
      } else if (event.startsWith('SUBSCRIPTION_')) {
        await this.asaasService.handleSubscriptionWebhook(event, body.subscription);
      } else if (event.startsWith('INVOICE_')) {
        await this.asaasService.handleInvoiceWebhook(event, body.invoice);
      } else {
        this.logger.debug(`Unhandled webhook event: ${event}`);
      }
    } catch (err) {
      this.logger.error(`Webhook processing error: ${(err as Error).message}`);
      // Return 200 anyway to prevent Asaas from retrying
    }

    return { received: true };
  }
}
