import { Injectable, Logger } from '@nestjs/common';

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
    discriminacao: string;
    aliquota: number;
    base_calculo?: number;
    codigo_municipio?: string;
  };
}

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

  async emit(
    token: string,
    environment: string,
    ref: string,
    data: FocusNfseRequest,
  ): Promise<FocusNfseResponse> {
    const url = `${this.getBaseUrl(environment)}/v2/nfse?ref=${encodeURIComponent(ref)}`;
    this.logger.log(`Emitting NFS-e ref=${ref} to ${environment}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok && response.status !== 201) {
      this.logger.error(`Focus NFe error: ${response.status} ${JSON.stringify(result)}`);
      throw new Error(result.mensagem || `Focus NFe error: ${response.status}`);
    }

    return result as FocusNfseResponse;
  }

  async query(
    token: string,
    environment: string,
    ref: string,
  ): Promise<FocusNfseResponse> {
    const url = `${this.getBaseUrl(environment)}/v2/nfse/${encodeURIComponent(ref)}?completa=1`;

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

  async cancel(
    token: string,
    environment: string,
    ref: string,
    justificativa: string,
  ): Promise<FocusNfseResponse> {
    const url = `${this.getBaseUrl(environment)}/v2/nfse/${encodeURIComponent(ref)}`;
    this.logger.log(`Cancelling NFS-e ref=${ref}`);

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

  async downloadPdf(
    token: string,
    environment: string,
    ref: string,
  ): Promise<Buffer> {
    const url = `${this.getBaseUrl(environment)}/v2/nfse/${encodeURIComponent(ref)}/pdf`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.getHeaders(token).Authorization },
    });

    if (!response.ok) {
      throw new Error(`Focus NFe PDF error: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async resendEmail(
    token: string,
    environment: string,
    ref: string,
    emails: string[],
  ): Promise<void> {
    const url = `${this.getBaseUrl(environment)}/v2/nfse/${encodeURIComponent(ref)}/email`;

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
