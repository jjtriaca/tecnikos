import { Injectable, Logger } from '@nestjs/common';

// ========== MUNICIPAL layout (/v2/nfse) — ABRASF ==========

export interface FocusNfseRequest {
  data_emissao: string;
  natureza_operacao: string;
  regime_especial_tributacao?: string;
  optante_simples_nacional: boolean;
  incentivador_cultural: boolean;
  prestador: {
    cnpj: string;
    inscricao_municipal: string;
    codigo_municipio: string;
  };
  tomador: {
    cnpj?: string;
    cpf?: string;
    razao_social: string;
    email?: string;
    telefone?: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      codigo_municipio: string;
      uf: string;
      cep: string;
    };
  };
  servico: {
    valor_servicos: number;
    iss_retido: boolean;
    valor_iss_retido?: number;
    item_lista_servico: string;
    codigo_cnae?: string;
    codigo_tributario_municipio?: string;
    codigo_tributacao_nacional_iss?: string;
    discriminacao: string;
    aliquota: number;
    base_calculo?: number;
    codigo_municipio?: string;
  };
}

// ========== NACIONAL layout (/v2/nfsen) — Layout Nacional ==========

export interface FocusNfsenRequest {
  data_emissao: string;
  data_competencia: string;
  codigo_municipio_emissora: number;
  cnpj_prestador: string;
  inscricao_municipal_prestador?: string;
  codigo_opcao_simples_nacional: number; // 1=Não optante, 2=Optante MEI, 3=Optante ME/EPP
  regime_especial_tributacao: number;     // 0=Sem, 1=Microempresa municipal, etc.
  // Tomador
  cnpj_tomador?: string;
  cpf_tomador?: string;
  razao_social_tomador: string;
  codigo_municipio_tomador?: number;
  cep_tomador?: string;
  logradouro_tomador?: string;
  numero_tomador?: string;
  complemento_tomador?: string;
  bairro_tomador?: string;
  telefone_tomador?: string;
  email_tomador?: string;
  // Serviço
  codigo_municipio_prestacao: number;
  codigo_tributacao_nacional_iss: string; // 6 dígitos obrigatório
  codigo_tributacao_municipal_iss?: string;
  codigo_nbs?: string;
  descricao_servico: string;
  valor_servico: number;
  tributacao_iss: number;     // 1=Operação normal, 2=Imunidade, 3=Isenção, etc.
  tipo_retencao_iss: number;  // 1=Não retido, 2=Retido pelo tomador, etc.
  indicador_total_tributacao?: string; // "0" ou "1"
}

// ========== Response (mesma para ambos) ==========

export interface FocusNfseResponse {
  cnpj_prestador?: string;
  ref?: string;
  numero_rps?: string;
  serie_rps?: string;
  tipo_rps?: string;
  status: string;
  numero?: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  url?: string;
  caminho_xml_nota_fiscal?: string;
  url_danfse?: string;
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>;
}

export type NfseLayout = 'MUNICIPAL' | 'NACIONAL';

@Injectable()
export class FocusNfeProvider {
  private readonly logger = new Logger(FocusNfeProvider.name);

  private getBaseUrl(environment: string): string {
    return environment === 'PRODUCTION'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';
  }

  private getHeaders(token: string): Record<string, string> {
    return {
      Authorization: 'Basic ' + Buffer.from(`${token}:`).toString('base64'),
      'Content-Type': 'application/json',
    };
  }

  private getEndpointPath(layout: NfseLayout): string {
    return layout === 'NACIONAL' ? '/v2/nfsen' : '/v2/nfse';
  }

  // ========== EMIT ==========

  async emit(
    token: string,
    environment: string,
    ref: string,
    data: FocusNfseRequest | FocusNfsenRequest,
    layout: NfseLayout = 'MUNICIPAL',
  ): Promise<FocusNfseResponse> {
    const endpoint = this.getEndpointPath(layout);
    const url = `${this.getBaseUrl(environment)}${endpoint}?ref=${encodeURIComponent(ref)}`;
    this.logger.log(`Emitting NFS-e ref=${ref} layout=${layout} to ${environment} via ${endpoint}`);

    const body = JSON.stringify(data);
    this.logger.debug(`Focus NFe payload: ${body}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(token),
      body,
    });

    const result = await response.json();

    if (!response.ok && response.status !== 201) {
      this.logger.error(`Focus NFe error: ${response.status} ${JSON.stringify(result)}`);
      throw new Error(result.mensagem || `Focus NFe error: ${response.status}`);
    }

    return result as FocusNfseResponse;
  }

  // ========== QUERY ==========

  async query(
    token: string,
    environment: string,
    ref: string,
    layout: NfseLayout = 'MUNICIPAL',
  ): Promise<FocusNfseResponse> {
    const endpoint = this.getEndpointPath(layout);
    const url = `${this.getBaseUrl(environment)}${endpoint}/${encodeURIComponent(ref)}?completa=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.mensagem || `Focus NFe query error: ${response.status}`);
    }

    return (await response.json()) as FocusNfseResponse;
  }

  // ========== CANCEL ==========

  async cancel(
    token: string,
    environment: string,
    ref: string,
    justificativa: string,
    layout: NfseLayout = 'MUNICIPAL',
  ): Promise<FocusNfseResponse> {
    const endpoint = this.getEndpointPath(layout);
    const url = `${this.getBaseUrl(environment)}${endpoint}/${encodeURIComponent(ref)}`;
    this.logger.log(`Cancelling NFS-e ref=${ref} layout=${layout}`);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(token),
      body: JSON.stringify({ justificativa }),
    });

    const result = await response.json();

    if (!response.ok) {
      this.logger.error(`Focus NFe cancel error: ${response.status} ${JSON.stringify(result)}`);
      throw new Error(result.mensagem || `Focus NFe cancel error: ${response.status}`);
    }

    return result as FocusNfseResponse;
  }

  // ========== DOWNLOAD PDF ==========

  async downloadPdf(
    token: string,
    environment: string,
    ref: string,
    layout: NfseLayout = 'MUNICIPAL',
  ): Promise<Buffer> {
    const endpoint = this.getEndpointPath(layout);
    const url = `${this.getBaseUrl(environment)}${endpoint}/${encodeURIComponent(ref)}/pdf`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.getHeaders(token).Authorization },
    });

    if (!response.ok) {
      throw new Error(`Focus NFe PDF error: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  // ========== RESEND EMAIL ==========

  async resendEmail(
    token: string,
    environment: string,
    ref: string,
    emails: string[],
    layout: NfseLayout = 'MUNICIPAL',
  ): Promise<void> {
    const endpoint = this.getEndpointPath(layout);
    const url = `${this.getBaseUrl(environment)}${endpoint}/${encodeURIComponent(ref)}/email`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ emails }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.mensagem || `Focus NFe email error: ${response.status}`);
    }
  }
}
