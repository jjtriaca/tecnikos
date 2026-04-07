import { Injectable, Logger } from '@nestjs/common';
import {
  BoletoProvider,
  BoletoProviderCredentials,
  BoletoRegistrationRequest,
  BoletoRegistrationResponse,
  BoletoCancellationResponse,
  BoletoQueryResponse,
  BoletoWebhookEvent,
  BankConfigField,
} from './boleto-provider.interface';

/**
 * Banco Inter (077) — Provider de boleto via API REST v2.
 * Docs: https://developers.inter.co/
 *
 * Auth: OAuth2 client_credentials + mTLS (certificado PFX).
 * Endpoints: /cobranca/v3/cobrancas
 */
@Injectable()
export class BankInterProvider implements BoletoProvider {
  private readonly logger = new Logger(BankInterProvider.name);

  readonly bankCode = '077';
  readonly bankName = 'Banco Inter';

  private readonly SANDBOX_URL = 'https://cdpj-sandbox.partners.uatinter.co';
  private readonly PRODUCTION_URL = 'https://cdpj.inter.co';

  getRequiredFields(): BankConfigField[] {
    return [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        helpText: 'Obtido no portal developers.inter.co > Aplicacoes',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        group: 'credentials',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        helpText: 'Gerado junto com o Client ID',
        group: 'credentials',
      },
      {
        key: 'certificateBase64',
        label: 'Certificado (.crt ou .pem)',
        type: 'file',
        required: true,
        helpText: 'Certificado digital gerado no portal Inter (formato PEM/CRT)',
        group: 'credentials',
      },
      {
        key: 'certificatePassword',
        label: 'Chave Privada (.key)',
        type: 'file',
        required: true,
        helpText: 'Chave privada do certificado (formato KEY)',
        group: 'credentials',
      },
      {
        key: 'convenio',
        label: 'Conta Corrente',
        type: 'text',
        required: true,
        helpText: 'Numero da conta corrente Inter PJ',
        placeholder: '12345678',
        group: 'bank',
      },
    ];
  }

  private getBaseUrl(environment: string): string {
    return environment === 'PRODUCTION' ? this.PRODUCTION_URL : this.SANDBOX_URL;
  }

  private async getAccessToken(credentials: BoletoProviderCredentials): Promise<string> {
    const baseUrl = this.getBaseUrl(credentials.environment);
    const url = `${baseUrl}/oauth/v2/token`;

    const params = new URLSearchParams();
    params.append('client_id', credentials.clientId || '');
    params.append('client_secret', credentials.clientSecret || '');
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'boleto-cobranca.read boleto-cobranca.write');

    // Inter requires mTLS — certificate and key must be provided
    // In production, we'd use https.Agent with cert/key
    // For now, using fetch with TLS options via undici or node-fetch agent
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Inter OAuth error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async testConnection(credentials: BoletoProviderCredentials): Promise<{
    valid: boolean;
    message: string;
  }> {
    try {
      const token = await this.getAccessToken(credentials);
      if (token) {
        return { valid: true, message: 'Conexao com Banco Inter estabelecida com sucesso' };
      }
      return { valid: false, message: 'Token nao retornado pelo Inter' };
    } catch (error) {
      this.logger.error('Inter testConnection failed', error);
      return {
        valid: false,
        message: `Falha na conexao: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }

  async register(
    credentials: BoletoProviderCredentials,
    request: BoletoRegistrationRequest,
  ): Promise<BoletoRegistrationResponse> {
    try {
      const token = await this.getAccessToken(credentials);
      const baseUrl = this.getBaseUrl(credentials.environment);

      const body: any = {
        seuNumero: request.seuNumero || request.nossoNumero,
        valorNominal: request.amountCents / 100,
        dataVencimento: this.formatDate(request.dueDate),
        numDiasAgenda: 60,
        pagador: {
          tipoPessoa: request.payerDocumentType === 'CPF' ? 'FISICA' : 'JURIDICA',
          nome: request.payerName,
          cpfCnpj: request.payerDocument.replace(/\D/g, ''),
          endereco: request.payerAddress || '',
          cidade: request.payerCity || '',
          uf: request.payerState || '',
          cep: request.payerCep?.replace(/\D/g, '') || '',
        },
      };

      // Juros
      if (request.interestType && request.interestValue) {
        body.mora = {
          codigoMora: request.interestType === 'VALOR_DIA' ? 'VALORDIA' : 'TAXAMENSAL',
          valor: request.interestValue,
          taxa: request.interestType === 'PERCENTUAL_MES' ? request.interestValue : undefined,
        };
      }

      // Multa
      if (request.penaltyPercent) {
        body.multa = {
          codigoMulta: 'PERCENTUAL',
          taxa: request.penaltyPercent,
        };
      }

      // Desconto
      if (request.discountType && request.discountValue && request.discountDeadline) {
        body.desconto = {
          codigoDesconto: request.discountType === 'VALOR_FIXO' ? 'VALORFIXODATAINFORMADA' : 'PERCENTUALDATAINFORMADA',
          quantidadeDias: 0,
          taxa: request.discountType === 'PERCENTUAL' ? request.discountValue : undefined,
          valor: request.discountType === 'VALOR_FIXO' ? request.discountValue / 100 : undefined,
          data: this.formatDate(request.discountDeadline),
        };
      }

      // Mensagens
      if (request.instructions?.length) {
        body.mensagem = {
          linha1: request.instructions[0] || '',
          linha2: request.instructions[1] || '',
          linha3: request.instructions[2] || '',
        };
      }

      const response = await fetch(`${baseUrl}/cobranca/v3/cobrancas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          nossoNumero: request.nossoNumero,
          errorMessage: data.message || data.detail || JSON.stringify(data),
          rawResponse: data,
        };
      }

      return {
        success: true,
        bankProtocol: data.codigoSolicitacao,
        nossoNumero: data.nossoNumero || request.nossoNumero,
        linhaDigitavel: data.linhaDigitavel,
        codigoBarras: data.codigoBarras,
        pixCopiaECola: data.pixCopiaECola,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Inter register failed', error);
      return {
        success: false,
        nossoNumero: request.nossoNumero,
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  async cancel(
    credentials: BoletoProviderCredentials,
    nossoNumero: string,
    bankProtocol?: string,
  ): Promise<BoletoCancellationResponse> {
    try {
      const token = await this.getAccessToken(credentials);
      const baseUrl = this.getBaseUrl(credentials.environment);

      const response = await fetch(
        `${baseUrl}/cobranca/v3/cobrancas/${nossoNumero}/cancelar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ motivoCancelamento: 'APEDIDODOCLIENTE' }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          errorMessage: data.message || data.detail || `Status ${response.status}`,
          rawResponse: data,
        };
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Inter cancel failed', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  async query(
    credentials: BoletoProviderCredentials,
    nossoNumero: string,
  ): Promise<BoletoQueryResponse> {
    try {
      const token = await this.getAccessToken(credentials);
      const baseUrl = this.getBaseUrl(credentials.environment);

      const response = await fetch(
        `${baseUrl}/cobranca/v3/cobrancas/${nossoNumero}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return { status: 'ERROR', rawResponse: data };
      }

      // Map Inter status to our BoletoStatus
      const statusMap: Record<string, string> = {
        'EMABERTO': 'REGISTERED',
        'PAGO': 'PAID',
        'CANCELADO': 'CANCELLED',
        'EXPIRADO': 'WRITTEN_OFF',
        'VENCIDO': 'OVERDUE',
      };

      return {
        status: statusMap[data.situacao] || data.situacao,
        paidAmountCents: data.valorTotalRecebido ? Math.round(data.valorTotalRecebido * 100) : undefined,
        paidAt: data.dataPagamento ? new Date(data.dataPagamento) : undefined,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Inter query failed', error);
      return { status: 'ERROR' };
    }
  }

  async downloadPdf(
    credentials: BoletoProviderCredentials,
    nossoNumero: string,
  ): Promise<Buffer> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.getBaseUrl(credentials.environment);

    const response = await fetch(
      `${baseUrl}/cobranca/v3/cobrancas/${nossoNumero}/pdf`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Inter PDF download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  parseWebhook(payload: any, headers?: Record<string, string>): BoletoWebhookEvent | null {
    if (!payload) return null;

    try {
      // Inter webhook payload structure
      const eventMap: Record<string, BoletoWebhookEvent['eventType']> = {
        'BAIXA': 'WRITTEN_OFF',
        'PAGAMENTO': 'PAID',
        'CANCELAMENTO': 'CANCELLED',
      };

      const eventType = eventMap[payload.tipoEvento];
      if (!eventType) return null;

      return {
        nossoNumero: payload.nossoNumero || payload.cobranca?.nossoNumero,
        eventType,
        paidAmountCents: payload.valorRecebido ? Math.round(payload.valorRecebido * 100) : undefined,
        paidAt: payload.dataPagamento ? new Date(payload.dataPagamento) : undefined,
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
