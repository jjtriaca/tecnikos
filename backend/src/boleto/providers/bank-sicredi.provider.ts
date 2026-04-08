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
 * Auth: OAuth2 password grant + API Key (x-api-key).
 * Token endpoint: POST /auth/openapi/token
 *   - username = codigoBeneficiario (5d) + cooperativa (4d)
 *   - password = codigo de acesso gerado no Internet Banking
 *   - grant_type = password
 *   - scope = cobranca
 *
 * Headers obrigatorios em TODAS requests:
 *   - x-api-key
 *   - Authorization: Bearer {token}
 *   - cooperativa (4 digitos)
 *   - posto (2 digitos)
 *   - context: COBRANCA (exceto no token endpoint)
 */
@Injectable()
export class BankSicrediProvider implements BoletoProvider {
  private readonly logger = new Logger(BankSicrediProvider.name);

  readonly bankCode = '748';
  readonly bankName = 'Sicredi';

  private readonly SANDBOX_URL = 'https://api-parceiro.sicredi.com.br/sb';
  private readonly PRODUCTION_URL = 'https://api-parceiro.sicredi.com.br';

  // Cache de token (evita gerar token a cada request)
  private tokenCache: { token: string; expiresAt: number; key: string } | null = null;

  getRequiredFields(): BankConfigField[] {
    return [
      {
        key: 'apiKey',
        label: 'API Key (x-api-key)',
        type: 'password',
        required: true,
        helpText: 'Token obtido no portal developer.sicredi.com.br > Minhas Apps > Tokens de Acesso',
        group: 'credentials',
      },
      {
        key: 'clientId',
        label: 'Codigo Beneficiario',
        type: 'text',
        required: true,
        helpText: 'Conta beneficiario (5 digitos) — mesmo usado no Internet Banking',
        placeholder: '12345',
        group: 'credentials',
      },
      {
        key: 'clientSecret',
        label: 'Senha de Acesso (Codigo Acesso)',
        type: 'password',
        required: true,
        helpText: 'Gerado no Internet Banking: Cobranca > Codigo de acesso > Gerar',
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
        helpText: 'Numero do posto/agencia (2 digitos)',
        placeholder: '08',
        group: 'bank',
      },
      {
        key: 'carteira',
        label: 'Tipo Cobranca',
        type: 'select',
        required: false,
        helpText: 'HIBRIDO gera boleto + PIX QR Code',
        options: [
          { value: 'NORMAL', label: 'Normal (somente boleto)' },
          { value: 'HIBRIDO', label: 'Hibrido (boleto + PIX)' },
        ],
        group: 'bank',
      },
    ];
  }

  private getBaseUrl(environment: string): string {
    return environment === 'PRODUCTION' ? this.PRODUCTION_URL : this.SANDBOX_URL;
  }

  private getBankConfig(credentials: BoletoProviderCredentials) {
    const bankConfig = credentials.bankSpecificConfig || {};
    const codigoBeneficiario = credentials.clientId || '';
    const cooperativa = bankConfig.cooperativa || '';
    const posto = bankConfig.posto || '';
    return { codigoBeneficiario, cooperativa, posto };
  }

  private async getAccessToken(credentials: BoletoProviderCredentials): Promise<string> {
    const { codigoBeneficiario, cooperativa } = this.getBankConfig(credentials);

    // Cache key basado nas credenciais
    const cacheKey = `${credentials.apiKey}-${codigoBeneficiario}-${cooperativa}`;
    if (this.tokenCache && this.tokenCache.key === cacheKey && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const baseUrl = this.getBaseUrl(credentials.environment);
    const url = `${baseUrl}/auth/openapi/token`;

    // username = codigoBeneficiario (5d) + cooperativa (4d)
    const username = `${codigoBeneficiario}${cooperativa}`;
    const password = credentials.clientSecret || '';

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('grant_type', 'password');
    params.append('scope', 'cobranca');

    this.logger.debug(`Sicredi auth: POST ${url} username=${username}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': credentials.apiKey || '',
        'context': 'COBRANCA',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Sicredi OAuth error: ${response.status} - ${error}`);
      throw new Error(`Sicredi OAuth error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Cache token (com margem de 60s antes do expiry)
    const expiresIn = data.expires_in || 300;
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
      key: cacheKey,
    };

    return data.access_token;
  }

  /**
   * Headers padrao para todas as chamadas da API Sicredi (exceto token)
   */
  private getHeaders(token: string, credentials: BoletoProviderCredentials): Record<string, string> {
    const { cooperativa, posto } = this.getBankConfig(credentials);
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-api-key': credentials.apiKey || '',
      'cooperativa': cooperativa,
      'posto': posto,
      'context': 'COBRANCA',
    };
  }

  async testConnection(credentials: BoletoProviderCredentials): Promise<{
    valid: boolean;
    message: string;
  }> {
    try {
      const token = await this.getAccessToken(credentials);
      if (token) {
        return { valid: true, message: 'Conexao com Sicredi estabelecida com sucesso!' };
      }
      return { valid: false, message: 'Token nao retornado pelo Sicredi' };
    } catch (error) {
      this.logger.error('Sicredi testConnection failed', error);
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      return { valid: false, message: `Falha na conexao: ${msg}` };
    }
  }

  async register(
    credentials: BoletoProviderCredentials,
    request: BoletoRegistrationRequest,
  ): Promise<BoletoRegistrationResponse> {
    try {
      const token = await this.getAccessToken(credentials);
      const baseUrl = this.getBaseUrl(credentials.environment);
      const { codigoBeneficiario } = this.getBankConfig(credentials);

      // Mapear especieDoc para enum Sicredi
      const especieMap: Record<string, string> = {
        'DM': 'DUPLICATA_MERCANTIL_INDICACAO',
        'DS': 'DUPLICATA_SERVICO_INDICACAO',
        'NP': 'NOTA_PROMISSORIA',
        'RC': 'RECIBO',
        'OU': 'OUTROS',
        // Valores completos passam direto
        'DUPLICATA_MERCANTIL_INDICACAO': 'DUPLICATA_MERCANTIL_INDICACAO',
        'DUPLICATA_SERVICO_INDICACAO': 'DUPLICATA_SERVICO_INDICACAO',
        'NOTA_PROMISSORIA': 'NOTA_PROMISSORIA',
        'RECIBO': 'RECIBO',
        'OUTROS': 'OUTROS',
      };

      const body: any = {
        tipoCobranca: credentials.carteira || 'NORMAL',
        codigoBeneficiario,
        nossoNumero: request.nossoNumero,
        seuNumero: request.seuNumero || request.nossoNumero,
        valor: Number((request.amountCents / 100).toFixed(2)),
        dataVencimento: this.formatDate(request.dueDate),
        especieDocumento: especieMap[request.especieDoc || 'DM'] || 'OUTROS',
        pagador: {
          tipoPessoa: request.payerDocumentType === 'CPF' ? 'PESSOA_FISICA' : 'PESSOA_JURIDICA',
          documento: request.payerDocument.replace(/\D/g, ''),
          nome: request.payerName?.substring(0, 40),
        },
      };

      // Endereco do pagador (opcional mas recomendado)
      if (request.payerAddress) {
        body.pagador.endereco = request.payerAddress.substring(0, 40);
      }
      if (request.payerCity) {
        body.pagador.cidade = request.payerCity.substring(0, 15);
      }
      if (request.payerState) {
        body.pagador.uf = request.payerState.substring(0, 2);
      }
      if (request.payerCep) {
        body.pagador.cep = request.payerCep.replace(/\D/g, '');
      }

      // Juros
      if (request.interestType && request.interestValue) {
        body.juros = request.interestValue;
        // A = percentual mensal, B = valor fixo por dia, C = isento
        body.tipoJuros = request.interestType === 'VALOR_DIA' ? 'B' : 'A';
      }

      // Multa
      if (request.penaltyPercent) {
        body.multa = request.penaltyPercent;
      }

      // Desconto
      if (request.discountType && request.discountValue && request.discountDeadline) {
        body.tipoDesconto = request.discountType === 'VALOR_FIXO' ? 'B' : 'A';
        body.descontos = [{
          valor: request.discountValue,
          data: this.formatDate(request.discountDeadline),
        }];
      }

      // Mensagens informativas (max 3, 80 chars cada)
      if (request.instructions?.length) {
        body.mensagens = request.instructions
          .filter(m => m && m.trim())
          .slice(0, 3)
          .map(m => m.substring(0, 80));
      }

      this.logger.debug(`Sicredi register: POST ${baseUrl}/cobranca/boleto/v1/boletos`);
      this.logger.debug(`Sicredi register body: ${JSON.stringify(body, null, 2)}`);

      const headers = this.getHeaders(token, credentials);
      const response = await fetch(`${baseUrl}/cobranca/boleto/v1/boletos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Sicredi register error ${response.status}: ${JSON.stringify(data)}`);
        return {
          success: false,
          nossoNumero: request.nossoNumero,
          errorMessage: data.mensagem || data.message || data.detail || JSON.stringify(data),
          rawResponse: data,
        };
      }

      this.logger.log(`Sicredi boleto registrado: nossoNumero=${data.nossoNumero}`);

      return {
        success: true,
        bankProtocol: data.protocolo,
        nossoNumero: data.nossoNumero || request.nossoNumero,
        linhaDigitavel: data.linhaDigitavel,
        codigoBarras: data.codigoBarras,
        pixCopiaECola: data.qrCode,
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
      const { codigoBeneficiario } = this.getBankConfig(credentials);

      const headers = this.getHeaders(token, credentials);
      const url = `${baseUrl}/cobranca/boleto/v1/boletos/${nossoNumero}/baixa?codigoBeneficiario=${codigoBeneficiario}`;

      this.logger.debug(`Sicredi cancel: PATCH ${url}`);

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
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
      const { codigoBeneficiario } = this.getBankConfig(credentials);

      const headers = this.getHeaders(token, credentials);
      delete (headers as any)['Content-Type']; // GET nao precisa

      const url = `${baseUrl}/cobranca/boleto/v1/boletos?nossoNumero=${nossoNumero}&codigoBeneficiario=${codigoBeneficiario}`;

      this.logger.debug(`Sicredi query: GET ${url}`);

      const response = await fetch(url, { headers });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Sicredi query error ${response.status}: ${JSON.stringify(data)}`);
        return { status: 'ERROR', rawResponse: data };
      }

      const boleto = Array.isArray(data) ? data[0] : data;

      const statusMap: Record<string, string> = {
        'ABERTO': 'REGISTERED',
        'LIQUIDADO': 'PAID',
        'BAIXADO': 'WRITTEN_OFF',
        'PROTESTADO': 'PROTESTED',
        'EM CARTORIO': 'PROTESTED',
        'EXPIRADO': 'OVERDUE',
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
    _bankProtocol?: string,
    linhaDigitavel?: string,
  ): Promise<Buffer> {
    const token = await this.getAccessToken(credentials);
    const baseUrl = this.getBaseUrl(credentials.environment);

    const headers = this.getHeaders(token, credentials);
    delete (headers as any)['Content-Type'];

    // Sicredi usa linhaDigitavel no endpoint de PDF, nao nossoNumero
    // Se nao tiver linhaDigitavel, tenta consultar primeiro
    let linha = linhaDigitavel;
    if (!linha) {
      const queryResult = await this.query(credentials, nossoNumero);
      linha = queryResult.rawResponse?.linhaDigitavel;
    }

    if (!linha) {
      throw new Error('Linha digitavel nao disponivel para download do PDF');
    }

    const url = `${baseUrl}/cobranca/boleto/v1/boletos/pdf?linhaDigitavel=${encodeURIComponent(linha)}`;
    this.logger.debug(`Sicredi PDF: GET ${url}`);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sicredi PDF download failed: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  parseWebhook(payload: any): BoletoWebhookEvent | null {
    if (!payload) return null;

    try {
      const movimento = payload.movimento || '';

      // Mapear eventos de movimento Sicredi para nosso enum
      const eventMap: Record<string, BoletoWebhookEvent['eventType']> = {
        'LIQUIDACAO': 'PAID',
        'LIQUIDACAO_PIX': 'PAID',
        'LIQUIDACAO_COMPE_H5': 'PAID',
        'LIQUIDACAO_COMPE_H6': 'PAID',
        'LIQUIDACAO_COMPE_H8': 'PAID',
        'LIQUIDACAO_REDE': 'PAID',
        'LIQUIDACAO_CARTORIO': 'PAID',
        'AVISO_PAGAMENTO_COMPE': 'PAID',
        'BAIXA': 'WRITTEN_OFF',
        'ESTORNO_LIQUIDACAO_REDE': 'CANCELLED',
      };

      const eventType = eventMap[movimento];
      if (!eventType) {
        this.logger.warn(`Sicredi webhook evento desconhecido: ${movimento}`);
        return null;
      }

      // valorLiquidacao vem como string
      const paidAmountCents = payload.valorLiquidacao
        ? Math.round(parseFloat(payload.valorLiquidacao) * 100)
        : undefined;

      // dataEvento vem como array [year, month, day, hour, min, sec, nano]
      let paidAt: Date | undefined;
      if (Array.isArray(payload.dataEvento) && payload.dataEvento.length >= 3) {
        const [year, month, day, hour = 0, min = 0, sec = 0] = payload.dataEvento;
        paidAt = new Date(year, month - 1, day, hour, min, sec);
      }

      return {
        nossoNumero: payload.nossoNumero,
        eventType,
        paidAmountCents,
        paidAt,
        rawPayload: payload,
      };
    } catch (error) {
      this.logger.error('Sicredi parseWebhook error', error);
      return null;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
