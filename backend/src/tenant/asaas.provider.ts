import { Injectable, Logger } from '@nestjs/common';

/**
 * HTTP client for Asaas payment gateway API.
 * Handles all direct communication with Asaas REST API.
 */
@Injectable()
export class AsaasProvider {
  private readonly logger = new Logger(AsaasProvider.name);

  private get apiKey(): string {
    return process.env.ASAAS_API_KEY || '';
  }

  private get baseUrl(): string {
    const env = process.env.ASAAS_ENV || 'sandbox';
    return env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
  }

  get webhookToken(): string {
    return process.env.ASAAS_WEBHOOK_TOKEN || '';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: this.apiKey,
      },
    };
    if (body) options.body = JSON.stringify(body);

    this.logger.debug(`${method} ${path}`);

    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.errors?.[0]?.description || JSON.stringify(data);
      this.logger.error(`Asaas ${method} ${path} → ${res.status}: ${errMsg}`);
      throw new Error(`Asaas API error: ${errMsg}`);
    }

    return data as T;
  }

  // ─── CUSTOMERS ───────────────────────────────────────

  async createCustomer(data: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    externalReference?: string;
  }) {
    return this.request('POST', '/customers', {
      ...data,
      notificationDisabled: false,
    });
  }

  async getCustomer(id: string) {
    return this.request('GET', `/customers/${id}`);
  }

  // ─── SUBSCRIPTIONS ────────────────────────────────────

  async createSubscription(data: {
    customer: string;
    billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
    value: number;
    nextDueDate: string; // YYYY-MM-DD
    cycle: 'MONTHLY' | 'ANNUAL';
    description?: string;
    externalReference?: string;
    discount?: { value: number; type: 'FIXED' | 'PERCENTAGE'; dueDateLimitDays?: number };
    creditCard?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    };
    creditCardHolderInfo?: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber: string;
      phone?: string;
      mobilePhone?: string;
    };
    creditCardToken?: string;
  }) {
    return this.request('POST', '/subscriptions', data);
  }

  async getSubscription(id: string) {
    return this.request('GET', `/subscriptions/${id}`);
  }

  async updateSubscription(
    id: string,
    data: {
      value?: number;
      cycle?: string;
      nextDueDate?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      updatePendingPayments?: boolean;
      billingType?: string;
    },
  ) {
    return this.request('PUT', `/subscriptions/${id}`, data);
  }

  async cancelSubscription(id: string) {
    return this.request('DELETE', `/subscriptions/${id}`);
  }

  async getSubscriptionPayments(id: string) {
    return this.request('GET', `/subscriptions/${id}/payments`);
  }

  // ─── PAYMENTS ─────────────────────────────────────────

  async getPayment(id: string) {
    return this.request('GET', `/payments/${id}`);
  }

  /** Create a one-time payment (not tied to subscription) */
  async createPayment(data: {
    customer: string;
    billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
  }) {
    return this.request('POST', '/payments', data);
  }

  // ─── WEBHOOKS ─────────────────────────────────────────

  async createWebhook(url: string, authToken: string) {
    return this.request('POST', '/webhooks', {
      name: 'Tecnikos SaaS Billing',
      url,
      email: 'admin@tecnikos.com.br',
      enabled: true,
      interrupted: false,
      authToken,
      sendType: 'SEQUENTIALLY',
      events: [
        'PAYMENT_CREATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED',
        'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
        'SUBSCRIPTION_CREATED',
        'SUBSCRIPTION_UPDATED',
        'SUBSCRIPTION_INACTIVATED',
        'SUBSCRIPTION_DELETED',
      ],
    });
  }
}
