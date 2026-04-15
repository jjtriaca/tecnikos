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
    informacoes_complementares?: string;
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
  regime_tributario_simples_nacional?: number; // regApTribSN — 1=Federal+Municipal pelo SN, 2=Federal SN + ISS fora, 3=Tudo fora
  regime_especial_tributacao: number;     // 0=Sem, 1=Microempresa municipal, etc.
  // Tomador
  cnpj_tomador?: string;
  cpf_tomador?: string;
  caepf_tomador?: string;  // CAEPF - Produtor Rural PF
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
  percentual_aliquota_relativa_municipio?: number; // pAliq — % ISS do município
  percentual_total_tributos_simples_nacional?: number; // pTotTribSN — obrigatório para SN
  tributacao_iss: number;     // 1=Operação normal, 2=Imunidade, 3=Isenção, etc.
  tipo_retencao_iss: number;  // 1=Não retido, 2=Retido pelo tomador, etc.
  // Para NÃO optantes SN, usar estes campos no lugar de pTotTribSN:
  percentual_total_tributos_federais?: string;
  percentual_total_tributos_estaduais?: string;
  percentual_total_tributos_municipais?: string;
  // Informações complementares (texto livre no PDF)
  informacoes_complementares?: string;
  // Informações de Obra (obrigatório para cTribNac 07.02.xx, 07.04.xx, etc.)
  codigo_obra?: string;           // CNO - Cadastro Nacional de Obras
  logradouro_obra?: string;
  numero_obra?: string;
  complemento_obra?: string;
  bairro_obra?: string;
  cep_obra?: number;              // CEP numérico (sem hífen)
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

// ========== API de Empresas (Revenda) ==========

export interface FocusEmpresaRequest {
  nome: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_municipal?: string | number;
  regime_tributario: number; // 1=SN, 2=SN excesso, 3=Normal, 4=MEI
  logradouro?: string;
  numero?: string | number;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  cep?: string | number;
  uf?: string;
  telefone?: string;
  email?: string;
  habilita_nfse?: boolean;
  habilita_nfsen_producao?: boolean;
  habilita_nfsen_homologacao?: boolean;
  enviar_email_destinatario?: boolean;
  arquivo_certificado_base64?: string;
  senha_certificado?: string;
}

export interface FocusEmpresaResponse {
  id: number;
  nome: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_municipal?: string;
  regime_tributario?: string;
  token_producao?: string;
  token_homologacao?: string;
  certificado_valido_ate?: string;
  certificado_valido_de?: string;
  certificado_cnpj?: string;
  habilita_nfse?: boolean;
  habilita_nfsen_producao?: boolean;
  habilita_nfsen_homologacao?: boolean;
  erros?: Array<{ codigo: string; mensagem: string; campo?: string }>;
}

// ========== NFS-e Recebida (Serviços Tomados) ==========

export interface FocusNfseRecebida {
  nome_prestador: string;
  documento_prestador: string;
  chave_nfse: string;
  valor_total: string;
  data_emissao: string;
  data_geracao?: string;
  situacao: 'autorizado' | 'cancelado' | 'substituido';
  versao: number;
  data_cancelamento?: string;
  motivo_cancelamento?: string;
  chave_nfse_substituta?: string;
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

    const text = await response.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      this.logger.error(`Focus NFe returned non-JSON (${response.status}): ${text.substring(0, 200)}`);
      throw new Error(`Focus NFe error ${response.status}: ${text.substring(0, 200)}`);
    }

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

  // ========== MANIFEST NFe (Manifestação do Destinatário) ==========

  async manifestNfe(
    token: string,
    environment: string,
    nfeKey: string,
    tipo: 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada',
    justificativa?: string,
  ): Promise<{ status: string; protocolo?: string; mensagem?: string }> {
    // Endpoint oficial Focus NFe v2: POST /v2/nfes_recebidas/{chave}/manifesto
    // Body: { "tipo": "ciencia|confirmacao|desconhecimento|nao_realizada", "justificativa"?: "..." }
    const url = `${this.getBaseUrl(environment)}/v2/nfes_recebidas/${nfeKey}/manifesto`;
    this.logger.log(`Manifesting NFe key=${nfeKey} type=${tipo} env=${environment}`);

    const body: any = { tipo };
    if (justificativa) body.justificativa = justificativa;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      this.logger.error(`Focus NFe manifest non-JSON (${response.status}): ${text.substring(0, 200)}`);
      throw new Error(`Focus NFe manifest error ${response.status}: ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
      this.logger.error(`Focus NFe manifest error: ${response.status} ${JSON.stringify(result)}`);
      throw new Error(result.mensagem || `Focus NFe manifest error: ${response.status}`);
    }

    this.logger.log(`Manifest OK: key=${nfeKey} type=${tipo} status=${result.status}`);
    return result;
  }

  // ========== DOWNLOAD NFe XML (after manifest) ==========

  async downloadNfeXml(
    token: string,
    environment: string,
    nfeKey: string,
  ): Promise<string | null> {
    const url = `${this.getBaseUrl(environment)}/v2/nfes_recebidas/${nfeKey}.xml`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.getHeaders(token).Authorization },
    });

    if (!response.ok) {
      this.logger.warn(`Focus NFe XML download failed (${response.status}) for key=${nfeKey}`);
      return null;
    }

    return await response.text();
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

  // ========== API DE EMPRESAS (REVENDA) ==========

  /** Registrar nova empresa na conta de revenda */
  async createEmpresa(token: string, environment: string, data: FocusEmpresaRequest): Promise<FocusEmpresaResponse> {
    const url = `${this.getBaseUrl(environment)}/v2/empresas`;
    this.logger.log(`Creating empresa CNPJ=${data.cnpj} at Focus NFe (${environment})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = result?.erros?.[0]?.mensagem || result?.mensagem || `HTTP ${response.status}`;
      this.logger.error(`Focus NFe createEmpresa error: ${msg}`);
      throw new Error(msg);
    }

    this.logger.log(`Empresa created: id=${result.id}, CNPJ=${data.cnpj}`);
    return result as FocusEmpresaResponse;
  }

  /** Consultar empresa por CNPJ */
  async getEmpresa(token: string, environment: string, cnpj: string): Promise<FocusEmpresaResponse | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const url = `${this.getBaseUrl(environment)}/v2/empresas/${cleanCnpj}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result?.mensagem || `HTTP ${response.status}`);
    }

    return (await response.json()) as FocusEmpresaResponse;
  }

  /** Atualizar empresa existente */
  async updateEmpresa(token: string, environment: string, cnpj: string, data: Partial<FocusEmpresaRequest>): Promise<FocusEmpresaResponse> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const url = `${this.getBaseUrl(environment)}/v2/empresas/${cleanCnpj}`;
    this.logger.log(`Updating empresa CNPJ=${cleanCnpj} at Focus NFe`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = result?.erros?.[0]?.mensagem || result?.mensagem || `HTTP ${response.status}`;
      this.logger.error(`Focus NFe updateEmpresa error: ${msg}`);
      throw new Error(msg);
    }

    return result as FocusEmpresaResponse;
  }

  // ========== NFS-e RECEBIDAS (Serviços Tomados) ==========

  /** Listar NFS-e Nacional recebidas (serviços tomados) */
  async listNfsesRecebidas(
    token: string,
    environment: string,
    cnpj: string,
    versao?: number,
  ): Promise<{ data: FocusNfseRecebida[]; maxVersion: number; totalCount: number }> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    let url = `${this.getBaseUrl(environment)}/v2/nfsens_recebidas?cnpj=${cleanCnpj}`;
    if (versao && versao > 0) url += `&versao=${versao}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.mensagem || `Focus NFe listNfsesRecebidas error: ${response.status}`);
    }

    const data = (await response.json()) as FocusNfseRecebida[];
    const maxVersion = parseInt(response.headers.get('X-Max-Version') || '0', 10);
    const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);

    return { data, maxVersion, totalCount };
  }

  /** Consultar detalhes completos de uma NFS-e recebida */
  async getNfseRecebidaJson(
    token: string,
    environment: string,
    chave: string,
  ): Promise<any> {
    const url = `${this.getBaseUrl(environment)}/v2/nfsens_recebidas/${chave}.json?completa=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const err = await response.json().catch(() => ({}));
      throw new Error(err.mensagem || `Focus NFe getNfseRecebida error: ${response.status}`);
    }

    return await response.json();
  }

  /** Download PDF DANFSe de NFS-e recebida */
  async getNfseRecebidaPdf(
    token: string,
    environment: string,
    chave: string,
  ): Promise<Buffer> {
    const url = `${this.getBaseUrl(environment)}/v2/nfsens_recebidas/${chave}.pdf`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.getHeaders(token).Authorization },
    });

    if (!response.ok) {
      throw new Error(`Focus NFe NFS-e recebida PDF error: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /** Download XML de NFS-e recebida */
  async getNfseRecebidaXml(
    token: string,
    environment: string,
    chave: string,
  ): Promise<string | null> {
    const url = `${this.getBaseUrl(environment)}/v2/nfsens_recebidas/${chave}.xml`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.getHeaders(token).Authorization },
    });

    if (!response.ok) {
      this.logger.warn(`Focus NFe NFS-e recebida XML error: ${response.status}`);
      return null;
    }

    return await response.text();
  }

  // ========== TEST CONNECTION ==========

  async testConnection(token: string, environment: string): Promise<{ valid: boolean; message: string }> {
    const baseUrl = this.getBaseUrl(environment);
    try {
      // Use the /v2/nfse endpoint to check auth (GET returns 405 but proves auth works vs 401)
      const response = await fetch(`${baseUrl}/v2/nfse?ref=test-connection`, {
        method: 'GET',
        headers: this.getHeaders(token),
      });
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'Token inválido ou sem permissão' };
      }
      // Any other status (200, 404, 405) means auth worked
      return { valid: true, message: 'Conexão OK' };
    } catch (err) {
      return { valid: false, message: `Erro de conexão: ${(err as Error).message}` };
    }
  }
}
