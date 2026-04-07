/**
 * Interface abstrata para providers de boleto bancario.
 * Cada banco implementa esta interface com sua API especifica.
 */

export interface BoletoRegistrationRequest {
  nossoNumero: string;
  seuNumero?: string;
  amountCents: number;
  dueDate: Date;
  issueDate: Date;

  // Sacado (pagador)
  payerName: string;
  payerDocument: string;
  payerDocumentType: 'CPF' | 'CNPJ';
  payerAddress?: string;
  payerCity?: string;
  payerState?: string;
  payerCep?: string;

  // Cedente (beneficiario) — dados da empresa
  beneficiaryName: string;
  beneficiaryDocument: string;

  // Config
  convenio?: string;
  carteira?: string;
  especie?: string;
  especieDoc?: string;

  // Juros/multa/desconto
  interestType?: string;
  interestValue?: number;
  penaltyPercent?: number;
  discountType?: string;
  discountValue?: number;
  discountDeadline?: Date;

  // Instrucoes
  instructions?: string[];
}

export interface BoletoRegistrationResponse {
  success: boolean;
  bankProtocol?: string;
  nossoNumero: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pixCopiaECola?: string;
  pdfUrl?: string;
  pdfBase64?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface BoletoCancellationResponse {
  success: boolean;
  bankProtocol?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface BoletoQueryResponse {
  status: string;
  paidAmountCents?: number;
  paidAt?: Date;
  rawResponse?: any;
}

export interface BoletoProviderCredentials {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  certificateBase64?: string;
  certificatePassword?: string;
  bankSpecificConfig?: Record<string, any>;
  environment: 'SANDBOX' | 'PRODUCTION';
  convenio?: string;
  carteira?: string;
}

export interface BankConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'file' | 'select' | 'number';
  required: boolean;
  helpText?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  group?: string;
}

export interface BoletoWebhookEvent {
  nossoNumero: string;
  eventType: 'PAID' | 'CANCELLED' | 'REJECTED' | 'PROTESTED' | 'WRITTEN_OFF';
  paidAmountCents?: number;
  paidAt?: Date;
  rawPayload: any;
}

export interface BoletoProvider {
  readonly bankCode: string;
  readonly bankName: string;

  /** Campos que este banco requer para configuracao */
  getRequiredFields(): BankConfigField[];

  /** Testar conexao com credenciais fornecidas */
  testConnection(credentials: BoletoProviderCredentials): Promise<{
    valid: boolean;
    message: string;
  }>;

  /** Registrar um novo boleto no banco */
  register(
    credentials: BoletoProviderCredentials,
    request: BoletoRegistrationRequest,
  ): Promise<BoletoRegistrationResponse>;

  /** Cancelar/baixar um boleto */
  cancel(
    credentials: BoletoProviderCredentials,
    nossoNumero: string,
    bankProtocol?: string,
  ): Promise<BoletoCancellationResponse>;

  /** Consultar status do boleto no banco */
  query(
    credentials: BoletoProviderCredentials,
    nossoNumero: string,
    bankProtocol?: string,
  ): Promise<BoletoQueryResponse>;

  /** Baixar PDF do boleto */
  downloadPdf(
    credentials: BoletoProviderCredentials,
    nossoNumero: string,
    bankProtocol?: string,
  ): Promise<Buffer>;

  /** Parsear payload de webhook do banco em evento normalizado */
  parseWebhook(payload: any, headers?: Record<string, string>): BoletoWebhookEvent | null;
}
