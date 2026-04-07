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
 * Sicredi (748) — Provider de boleto via API REST.
 * Docs: https://developer.sicredi.com.br/
 *
 * Auth: OAuth2 client_credentials + API Key.
 */
@Injectable()
export class BankSicrediProvider implements BoletoProvider {
  private readonly logger = new Logger(BankSicrediProvider.name);

  readonly bankCode = '748';
  readonly bankName = 'Sicredi';

  private readonly SANDBOX_URL = 'https://api-parceiro.sicredi.com.br/sb';
  private readonly PRODUCTION_URL = 'https://api-parceiro.sicredi.com.br';

  getRequiredFields(): BankConfigField[] {
    return [
      {
        key: 'apiKey',
        label: 'API Key (x-api-key)',
        type: 'password',
        required: true,
        helpText: 'Obtida no portal developer.sicredi.com.br > Minhas Apps',
        group: 'credentials',
      },
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        helpText: 'Gerado ao criar aplicacao no portal Sicredi',
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
        key: 'bankSpecificConfig.cooperativa',
        label: 'Cooperativa',
        type: 'text',
        required: true,
        helpText: 'Codigo da cooperativa (4 digitos)',
        placeholder: '0101',
        group: 'bank',
      },
      {
        key: 'bankSpecificConfig.posto',
        label: 'Posto',
        type: 'text',
        required: true,
        helpText: 'Numero do posto (2 digitos)',
        placeholder: '08',
        group: 'bank',
      },
      {
        key: 'convenio',
        label: 'Conta Beneficiario',
        type: 'text',
        required: true,
        helpText: 'Numero da conta corrente do beneficiario',
        placeholder: '12345',
        group: 'bank',
      },
      {
        key: 'carteira',
        label: 'Tipo Cobranca',
        type: 'select',
        required: false,
        helpText: 'Tipo de cobranca Sicredi',
        options: [
          { value: '1', label: 'Cobranca Simples' },
          { value: '3', label: 'Cobranca Caucionada' },
        ],
        group: 'bank',
      },
    ];
  }

  private getBaseUrl(environment: string): string {
    return environment === 'PRODUCTION' ? this.PRODUCTION_URL : this.SANDBOX_URL;
  }

  private async getAccessToken(credentials: BoletoProviderCredentials): Promise<string> {
    const baseUrl = this.getBaseUrl(credentials.environment);
    const url = `${baseUrl}/auth/openapi/token`;

    const params = new URLSearchParams();
    params.append('client_id', credentials.clientId || '');
    params.append('client_secret', credentials.clientSecret || '');
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'cobranca');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': credentials.apiKey || '',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sicredi OAuth error: ${response.status} - ${error}`);
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
        return { valid: true, message: 'Conexao com Sicredi estabelecida com sucesso' };
      }
      return { valid: false, message: 'Token nao retornado pelo Sicredi' };
    } catch (error) {
      this.logger.error('Sicredi testConnection failed', error);
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
      const bankConfig = credentials.bankSpecificConfig || {};

      const body: any = {
        tipoCobranca: credentials.carteira || '1',
        cooperativa: bankConfig.cooperativa,
        posto: bankConfig.posto,
        codigoBeneficiario: credentials.convenio,
        nossoNumero: request.nossoNumero,
        seuNumero: request.seuNumero || request.nossoNumero,
        valor: request.amountCents / 100,
        dataVencimento: this.formatDate(request.dueDate),
        especieDocumento: request.especieDoc || 'DM',
        pagador: {
          tipoPessoa: request.payerDocumentType === 'CPF' ? '1' : '2',
          documento: request.payerDocument.replace(/\D/g, ''),
          nome: request.payerName,
          endereco: request.payerAddress || '',
          cidade: request.payerCity || '',
          uf: request.payerState || '',
          cep: request.payerCep?.replace(/\D/g, '') || '',
        },
      };

      // Juros
      if (request.interestType && request.interestValue) {
        body.juros = {
          tipo: request.interestType === 'VALOR_DIA' ? 'B' : 'A',
          valor: request.interestValue,
        };
      }

      // Multa
      if (request.penaltyPercent) {
        body.multa = {
          tipo: 'B',
          valor: request.penaltyPercent,
        };
      }

      // Mensagens
      if (request.instructions?.length) {
        body.informativo = request.instructions.slice(0, 3);
      }

      const response = await fetch(`${baseUrl}/cobranca/boleto/v1/boletos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-key': credentials.apiKey || '',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          nossoNumero: request.nossoNumero,
          errorMessage: data.mensagem || data.message || JSON.stringify(data),
          rawResponse: data,
        };
      }

      return {
        success: true,
        bankProtocol: data.protocolo,
        nossoNumero: data.nossoNumero || request.nossoNumero,
        linhaDigitavel: data.linhaDigitavel,
        codigoBarras: data.codigoBarras,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Sicredi register failed', error);
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
  ): Promise<BoletoCancellationResponse> {
    try {
      const token = await this.getAccessToken(credentials);
      const baseUrl = this.getBaseUrl(credentials.environment);

      const response = await fetch(
        `${baseUrl}/cobranca/boleto/v1/boletos/${nossoNumero}/baixa`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-api-key': credentials.apiKey || '',
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          errorMessage: data.mensagem || data.message || `Status ${response.status}`,
          rawResponse: data,
        };
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Sicredi cancel failed', error);
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
        `${baseUrl}/cobranca/boleto/v1/boletos?nossoNumero=${nossoNumero}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': credentials.apiKey || '',
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return { status: 'ERROR', rawResponse: data };
      }

      const boleto = Array.isArray(data) ? data[0] : data;

      const statusMap: Record<string, string> = {
        'ABERTO': 'REGISTERED',
        'LIQUIDADO': 'PAID',
        'BAIXADO': 'WRITTEN_OFF',
        'PROTESTADO': 'PROTESTED',
        'EM CARTORIO': 'PROTESTED',
      };

      return {
        status: statusMap[boleto?.situacao] || boleto?.situacao || 'UNKNOWN',
        paidAmountCents: boleto?.valorPago ? Math.round(boleto.valorPago * 100) : undefined,
        paidAt: boleto?.dataPagamento ? new Date(boleto.dataPagamento) : undefined,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Sicredi query failed', error);
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
      `${baseUrl}/cobranca/boleto/v1/boletos/${nossoNumero}/pdf`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': credentials.apiKey || '',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Sicredi PDF download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  parseWebhook(payload: any): BoletoWebhookEvent | null {
    if (!payload) return null;

    try {
      const eventMap: Record<string, BoletoWebhookEvent['eventType']> = {
        'LIQUIDACAO': 'PAID',
        'BAIXA': 'WRITTEN_OFF',
        'PROTESTO': 'PROTESTED',
      };

      const eventType = eventMap[payload.tipoEvento || payload.evento];
      if (!eventType) return null;

      return {
        nossoNumero: payload.nossoNumero,
        eventType,
        paidAmountCents: payload.valorPago ? Math.round(payload.valorPago * 100) : undefined,
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
