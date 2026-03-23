import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { SaasConfigService } from '../common/saas-config.service';
import { FocusNfeProvider, FocusNfseRequest, FocusNfsenRequest, NfseLayout } from './focus-nfe.provider';
import { SaveNfseConfigDto, EmitNfseDto, CancelNfseDto, CreateNfseServiceCodeDto, UpdateNfseServiceCodeDto } from './dto/nfse-emission.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { DanfseService, DanfseData } from './danfse.service';
import { randomUUID } from 'crypto';

/** Retorna data/hora atual no fuso de Brasilia (UTC-3) em formato ISO sem 'Z'. */
function brazilNow(): string {
  const now = new Date();
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 19) + '-03:00';
}

/** Retorna data atual no fuso de Brasilia como YYYY-MM-DD. */
function brazilToday(): string {
  const now = new Date();
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

@Injectable()
export class NfseEmissionService {
  private readonly logger = new Logger(NfseEmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly saasConfig: SaasConfigService,
    private readonly focusNfe: FocusNfeProvider,
    private readonly whatsApp: WhatsAppService,
    private readonly danfseService: DanfseService,
  ) {}

  /** Map Focus NFe technical errors to user-friendly messages */
  private mapFocusError(raw: string): string {
    const msg = raw || '';
    if (/401.*access denied/i.test(msg)) return 'Token Focus NFe inválido para este ambiente. Verifique o token em Configurações > Fiscal.';
    if (/município.*não existe|não está ativo no convênio/i.test(msg)) return 'O município informado não está ativo na NFS-e Nacional. Verifique o código IBGE em Configurações > Fiscal.';
    if (/cTribNac.*inválido|codigo_tributacao_nacional/i.test(msg)) return 'O código tributário (cTribNac) não é válido para este município. Consulte os serviços habilitados na sua prefeitura.';
    if (/alíquota|aliquota.*não permitida/i.test(msg)) return 'A alíquota ISS configurada não é aceita pelo município. Verifique o valor correto na prefeitura.';
    if (/inscrição municipal|inscricao_municipal.*obrigatór/i.test(msg)) return 'Inscrição Municipal obrigatória para este município. Configure em Configurações > Fiscal > Dados do Prestador.';
    if (/tomador.*endereço|endereco.*tomador/i.test(msg)) return 'Endereço do tomador incompleto. Edite o cadastro do parceiro e preencha o endereço.';
    if (/CNPJ.*inválido|CPF.*inválido/i.test(msg)) return 'CPF/CNPJ do tomador inválido. Verifique o documento no cadastro do parceiro.';
    if (/erro interno|internal.*error/i.test(msg)) return 'Erro temporário do Focus NFe. Aguarde alguns minutos e tente novamente.';
    if (/Unsupported state|unable to authenticate/i.test(msg)) return 'Erro de autenticação interna. Re-salve o token Focus NFe em Configurações > Fiscal.';
    return msg; // fallback: return original
  }

  // ========== CONFIG ==========

  async getConfig(companyId: string) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) return null;
    // Never return decrypted tokens
    return {
      ...config,
      focusNfeToken: config.focusNfeToken ? '••••••••' : null,
      focusNfeTokenHomolog: config.focusNfeTokenHomolog ? '••••••••' : null,
    };
  }

  /** Get the active token based on environment */
  private getActiveToken(config: { focusNfeToken: string | null; focusNfeTokenHomolog: string | null; focusNfeEnvironment: string }): string | null {
    const encrypted = config.focusNfeEnvironment === 'HOMOLOGATION'
      ? (config.focusNfeTokenHomolog || config.focusNfeToken)
      : config.focusNfeToken;
    if (!encrypted) return null;
    return this.encryption.decrypt(encrypted);
  }

  async saveConfig(companyId: string, dto: SaveNfseConfigDto) {
    const data: any = { ...dto };

    // Encrypt production token if provided
    if (dto.focusNfeToken && dto.focusNfeToken !== '••••••••') {
      data.focusNfeToken = this.encryption.encrypt(dto.focusNfeToken);
    } else {
      delete data.focusNfeToken;
    }

    // Encrypt homologation token if provided
    if (dto.focusNfeTokenHomolog && dto.focusNfeTokenHomolog !== '••••••••') {
      data.focusNfeTokenHomolog = this.encryption.encrypt(dto.focusNfeTokenHomolog);
    } else {
      delete data.focusNfeTokenHomolog;
    }

    const config = await this.prisma.nfseConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    return {
      ...config,
      focusNfeToken: config.focusNfeToken ? '••••••••' : null,
      focusNfeTokenHomolog: config.focusNfeTokenHomolog ? '••••••••' : null,
    };
  }

  // ========== TEST CONNECTION ==========

  async testToken(companyId: string, environment?: string) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuração fiscal não encontrada');

    const env = environment || config.focusNfeEnvironment || 'HOMOLOGATION';
    const encrypted = env === 'HOMOLOGATION' ? (config.focusNfeTokenHomolog || config.focusNfeToken) : config.focusNfeToken;
    if (!encrypted) return { valid: false, message: `Token ${env === 'HOMOLOGATION' ? 'homologação' : 'produção'} não configurado` };

    try {
      const token = this.encryption.decrypt(encrypted);
      return await this.focusNfe.testConnection(token, env);
    } catch {
      return { valid: false, message: 'Erro ao decriptar token. Re-salve o token nas configurações.' };
    }
  }

  // ========== API DE EMPRESAS (REVENDA) ==========

  /** Mapeia taxRegime do Tecnikos para regime_tributario da Focus NFe */
  private mapTaxRegime(taxRegime: string, crt: number): number {
    // Focus NFe: 1=Simples Nacional, 2=SN Excesso, 3=Normal, 4=MEI
    if (taxRegime === 'SN') return crt === 2 ? 2 : 1;
    return 3; // LP e LR = Normal
  }

  /** Registrar ou atualizar empresa na Focus NFe (revenda centralizada) */
  async registerOrUpdateEmpresa(companyId: string): Promise<{
    success: boolean;
    message: string;
    focusNfeCompanyId?: string;
    tokenProducao?: boolean;
    tokenHomologacao?: boolean;
    certificadoValido?: string;
  }> {
    const resellerToken = await this.saasConfig.get('FOCUS_NFE_RESELLER_TOKEN');
    if (!resellerToken) {
      throw new BadRequestException('Token de revenda Focus NFe não configurado. Configure em Configurações do Admin.');
    }

    const company = await this.prisma.company.findFirst({
      select: {
        id: true, name: true, tradeName: true, cnpj: true,
        addressStreet: true, addressNumber: true, addressComp: true,
        neighborhood: true, city: true, state: true, cep: true,
        phone: true, email: true, taxRegime: true, crt: true,
      },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!company.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    const layout = config?.nfseLayout || 'MUNICIPAL';
    const environment = config?.focusNfeEnvironment || 'HOMOLOGATION';

    // Build empresa request
    const empresaData: any = {
      nome: company.name,
      nome_fantasia: company.tradeName || undefined,
      cnpj: company.cnpj.replace(/\D/g, ''),
      inscricao_municipal: config?.inscricaoMunicipal || undefined,
      regime_tributario: this.mapTaxRegime(company.taxRegime, company.crt),
      logradouro: company.addressStreet || undefined,
      numero: company.addressNumber || undefined,
      complemento: company.addressComp || undefined,
      bairro: company.neighborhood || undefined,
      municipio: company.city || undefined,
      cep: company.cep?.replace(/\D/g, '') || undefined,
      uf: company.state || undefined,
      telefone: company.phone?.replace(/\D/g, '') || undefined,
      email: company.email || undefined,
      enviar_email_destinatario: config?.sendEmailToTomador ?? true,
    };

    // Enable NFS-e based on layout
    if (layout === 'NACIONAL') {
      empresaData.habilita_nfsen_producao = environment === 'PRODUCTION';
      empresaData.habilita_nfsen_homologacao = environment === 'HOMOLOGATION';
      // Enable receiving NFS-e Nacional (serviços tomados)
      empresaData.habilita_nfsen_recebidas_producao = true;
      empresaData.habilita_nfsen_recebidas_homologacao = true;
    } else {
      empresaData.habilita_nfse = true;
    }

    // Remove undefined fields
    Object.keys(empresaData).forEach((k) => empresaData[k] === undefined && delete empresaData[k]);

    try {
      // Check if empresa already exists
      const existing = await this.focusNfe.getEmpresa(resellerToken, environment, company.cnpj);
      let result: any;

      if (existing) {
        // Update existing
        result = await this.focusNfe.updateEmpresa(resellerToken, environment, company.cnpj, empresaData);
        this.logger.log(`Empresa updated at Focus NFe: id=${result.id}`);
      } else {
        // Create new
        result = await this.focusNfe.createEmpresa(resellerToken, environment, empresaData);
        this.logger.log(`Empresa created at Focus NFe: id=${result.id}`);
      }

      // Save Focus NFe company ID and emission tokens
      const updateData: any = {
        focusNfeCompanyId: String(result.id),
      };

      // Save emission tokens returned by Focus NFe (encrypted)
      if (result.token_producao) {
        updateData.focusNfeToken = this.encryption.encrypt(result.token_producao);
      }
      if (result.token_homologacao) {
        updateData.focusNfeTokenHomolog = this.encryption.encrypt(result.token_homologacao);
      }

      await this.prisma.nfseConfig.upsert({
        where: { companyId },
        create: { companyId, ...updateData },
        update: updateData,
      });

      return {
        success: true,
        message: existing
          ? `Empresa atualizada na Focus NFe (ID: ${result.id})`
          : `Empresa registrada na Focus NFe (ID: ${result.id})`,
        focusNfeCompanyId: String(result.id),
        tokenProducao: !!result.token_producao,
        tokenHomologacao: !!result.token_homologacao,
        certificadoValido: result.certificado_valido_ate || undefined,
      };
    } catch (err: any) {
      this.logger.error(`Focus NFe empresa registration failed: ${err.message}`);
      return {
        success: false,
        message: `Erro ao registrar empresa na Focus NFe: ${err.message}`,
      };
    }
  }

  /** Upload certificado digital A1 para a Focus NFe */
  async uploadCertificate(companyId: string, certBase64: string, senha: string): Promise<{
    success: boolean;
    message: string;
    validoAte?: string;
  }> {
    const resellerToken = await this.saasConfig.get('FOCUS_NFE_RESELLER_TOKEN');
    if (!resellerToken) {
      throw new BadRequestException('Token de revenda Focus NFe não configurado. Configure em Configurações do Admin.');
    }

    const company = await this.prisma.company.findFirst({ select: { cnpj: true } });
    if (!company?.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    const environment = config?.focusNfeEnvironment || 'HOMOLOGATION';

    try {
      const result = await this.focusNfe.updateEmpresa(
        resellerToken,
        environment,
        company.cnpj,
        { arquivo_certificado_base64: certBase64, senha_certificado: senha } as any,
      );

      return {
        success: true,
        message: `Certificado digital instalado com sucesso${result.certificado_valido_ate ? `. Válido até: ${result.certificado_valido_ate}` : ''}`,
        validoAte: result.certificado_valido_ate || undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao instalar certificado: ${err.message}`,
      };
    }
  }

  // ========== PREVIEW (dados para tela de confirmação) ==========

  async getEmissionPreview(companyId: string, financialEntryId: string) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuração fiscal não encontrada. Configure em Configurações > Fiscal.');

    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: financialEntryId, companyId, deletedAt: null },
      include: {
        serviceOrder: { include: { clientPartner: true, assignedPartner: true, obra: true } },
        partner: true,
        company: true,
        obra: true,
      },
    });
    if (!entry) throw new NotFoundException('Lançamento financeiro não encontrado');

    const company = entry.company;
    const tomador = entry.serviceOrder?.clientPartner || entry.partner;

    // Build discriminacao from template
    let discriminacao = '';
    if (entry.serviceOrder) {
      // Has OS — use template with variables
      discriminacao = (config.defaultDiscriminacao || '')
        .replace('{titulo_os}', entry.serviceOrder.title || '')
        .replace('{descricao_os}', entry.serviceOrder.description || '')
        .replace('{tecnico}', entry.serviceOrder.assignedPartner?.name || '');
      discriminacao = discriminacao.replace(/\s{2,}/g, ' ').trim();
    }
    if (!discriminacao) {
      // No OS or template resulted in empty — use financial entry description
      discriminacao = entry.description || 'Prestacao de servicos';
    }

    return {
      // Prestador (empresa)
      prestador: {
        cnpj: company.cnpj,
        inscricaoMunicipal: config.inscricaoMunicipal || company.im,
        codigoMunicipio: config.codigoMunicipio,
        razaoSocial: company.name,
      },
      // Tomador (cliente/parceiro)
      tomador: {
        partnerId: tomador?.id || null,
        cnpjCpf: tomador?.document || '',
        razaoSocial: tomador?.name || '',
        email: tomador?.email || '',
        telefone: tomador?.phone || '',
        logradouro: tomador?.addressStreet || '',
        numero: tomador?.addressNumber || '',
        complemento: tomador?.addressComp || '',
        bairro: tomador?.neighborhood || '',
        codigoMunicipio: (tomador as any)?.ibgeCode || config.codigoMunicipio || '',
        uf: tomador?.state || '',
        cep: tomador?.cep || '',
        city: tomador?.city || '',
      },
      // Serviço
      servico: {
        valorServicosCents: entry.netCents,
        aliquotaIss: config.aliquotaIss || 0,
        issRetido: false,
        itemListaServico: config.itemListaServico || '',
        codigoCnae: config.codigoCnae || '',
        codigoTributarioMunicipio: config.codigoTributarioMunicipio || '',
        discriminacao,
        naturezaOperacao: config.naturezaOperacao || '1',
        codigoMunicipioServico: config.codigoMunicipio || '',
      },
      // Config
      config: {
        optanteSimplesNacional: config.optanteSimplesNacional,
        regimeEspecialTributacao: config.regimeEspecialTributacao,
        sendEmailToTomador: config.sendEmailToTomador,
        afterEmissionSendWhatsApp: config.afterEmissionSendWhatsApp,
        codigoTributarioNacional: config.codigoTributarioNacional || '',
        codigoTributarioNacionalServico: config.codigoTributarioNacionalServico || '',
        focusNfeEnvironment: config.focusNfeEnvironment || 'HOMOLOGATION',
      },
      // Entry info
      financialEntry: {
        id: entry.id,
        serviceOrderId: entry.serviceOrderId,
        grossCents: entry.grossCents,
        netCents: entry.netCents,
        description: entry.description,
        nfseStatus: entry.nfseStatus,
      },
      // Obra vinculada (da OS ou do lançamento)
      obra: entry.obra || entry.serviceOrder?.obra || null,
      // Service codes cadastrados
      serviceCodes: await this.prisma.nfseServiceCode.findMany({
        where: { companyId, active: true },
        orderBy: { descricao: 'asc' },
      }),
      // Pre-flight validation issues
      validationIssues: (() => {
        const issues: { field: string; message: string; link?: string }[] = [];
        const activeToken = config.focusNfeEnvironment === 'HOMOLOGATION' ? (config.focusNfeTokenHomolog || config.focusNfeToken) : config.focusNfeToken;
        if (!activeToken) issues.push({ field: 'token', message: `Token Focus NFe (${config.focusNfeEnvironment === 'HOMOLOGATION' ? 'homologação' : 'produção'}) não configurado`, link: '/settings/fiscal' });
        if (!config.codigoMunicipio) issues.push({ field: 'codigoMunicipio', message: 'Código do município (IBGE) não configurado', link: '/settings/fiscal' });
        if (!config.aliquotaIss && config.aliquotaIss !== 0) issues.push({ field: 'aliquotaIss', message: 'Alíquota ISS não configurada', link: '/settings/fiscal' });
        if (!tomador?.document) issues.push({ field: 'tomadorDoc', message: 'Tomador (parceiro) sem CPF/CNPJ cadastrado', link: '/partners' });
        if (!tomador?.addressStreet) issues.push({ field: 'tomadorEndereco', message: 'Tomador sem endereço cadastrado', link: '/partners' });
        return issues;
      })(),
    };
  }

  // ========== EMISSÃO ==========

  async emit(companyId: string, dto: EmitNfseDto) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuração fiscal não encontrada');
    const activeToken = config.focusNfeEnvironment === 'HOMOLOGATION' ? (config.focusNfeTokenHomolog || config.focusNfeToken) : config.focusNfeToken;
    if (!activeToken) throw new BadRequestException(`Token Focus NFe (${config.focusNfeEnvironment === 'HOMOLOGATION' ? 'homologação' : 'produção'}) não configurado`);

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');

    // ── Enforce transaction limit (OS + NFS-e avulsa share maxOsPerMonth) ──
    // NFS-e linked to an OS doesn't count extra (already counted by OS creation)
    // NFS-e without OS (avulsa) counts as 1 transaction
    const maxTransactions = company.maxOsPerMonth || 0;
    if (maxTransactions > 0 && !dto.serviceOrderId) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [osCount, avulsaNfseCount] = await Promise.all([
        this.prisma.serviceOrder.count({
          where: { companyId, createdAt: { gte: startOfMonth } },
        }),
        this.prisma.nfseEmission.count({
          where: {
            companyId,
            serviceOrderId: null, // avulsa (sem OS)
            status: { not: 'ERROR' }, // erros não contam
            createdAt: { gte: startOfMonth },
          },
        }),
      ]);
      const totalTransactions = osCount + avulsaNfseCount;
      if (totalTransactions >= maxTransactions) {
        throw new ForbiddenException(
          `Limite de ${maxTransactions} transações por mês atingido (${osCount} OS + ${avulsaNfseCount} NFS-e avulsas). Faça upgrade do plano ou adquira OS adicionais.`,
        );
      }
    }

    // Check entry
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: dto.financialEntryId, companyId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Lançamento financeiro não encontrado');
    if (entry.nfseStatus === 'AUTHORIZED') throw new BadRequestException('NFS-e já emitida para este lançamento');
    if (entry.nfseStatus === 'PROCESSING') throw new BadRequestException('NFS-e em processamento');

    // Decrypt token
    const token = this.getActiveToken(config)!;

    // Check for existing ERROR emission for this entry — reuse instead of duplicating
    const existingErrorEmission = await this.prisma.nfseEmission.findFirst({
      where: {
        companyId,
        status: 'ERROR',
        financialEntries: { some: { id: dto.financialEntryId } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate unique ref (new ref even for retry, since the old ref may be stuck in Focus NFe)
    const ref = `tk-${companyId.substring(0, 8)}-${randomUUID().substring(0, 8)}`;

    // Load Obra if tipoNota=OBRA
    let obra: any = null;
    const isObra = dto.tipoNota === 'OBRA';
    if (isObra) {
      if (!dto.obraId) throw new BadRequestException('Obra é obrigatória para NFS-e de tipo OBRA');
      obra = await this.prisma.obra.findFirst({
        where: { id: dto.obraId, companyId, active: true },
      });
      if (!obra) throw new NotFoundException('Obra não encontrada ou inativa');
    }

    // Resolve service code if selected
    let serviceCode: any = null;
    if (dto.serviceCodeId) {
      serviceCode = await this.prisma.nfseServiceCode.findFirst({
        where: { id: dto.serviceCodeId, companyId, active: true },
      });
      if (!serviceCode) throw new NotFoundException('Código de serviço não encontrado');
    }

    // Determine cTribNac: service code > config fallback
    const codigoTribNac = serviceCode?.codigo
      || (isObra
        ? (config.codigoTributarioNacional || '')
        : (config.codigoTributarioNacionalServico || config.codigoTributarioNacional || ''));

    // Override aliquota/codes from service code if available
    if (serviceCode) {
      if (serviceCode.aliquotaIss != null && dto.aliquotaIss == null) dto.aliquotaIss = serviceCode.aliquotaIss;
      if (serviceCode.itemListaServico && !dto.itemListaServico) dto.itemListaServico = serviceCode.itemListaServico;
      if (serviceCode.codigoCnae && !dto.codigoCnae) dto.codigoCnae = serviceCode.codigoCnae;
      if (serviceCode.codigoTribMunicipal && !dto.codigoTributarioMunicipio) dto.codigoTributarioMunicipio = serviceCode.codigoTribMunicipal;
    }

    // Reuse RPS from existing error emission, or get next RPS number
    let rpsNumber: number;
    if (existingErrorEmission) {
      rpsNumber = existingErrorEmission.rpsNumber;
      this.logger.log(`Reusing RPS ${rpsNumber} from failed emission ${existingErrorEmission.id}`);
    } else {
      rpsNumber = config.rpsNextNumber;
      await this.prisma.nfseConfig.update({
        where: { companyId },
        data: { rpsNextNumber: rpsNumber + 1 },
      });
    }

    // Build request
    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
    const valorServicos = dto.valorServicosCents / 100;
    const aliquota = dto.aliquotaIss ?? config.aliquotaIss ?? 0;
    const baseCalculo = valorServicos;
    const valorIss = Math.round(baseCalculo * aliquota) / 100;
    const cnpjClean = company.cnpj.replace(/\D/g, '');
    const tomadorDoc = (dto.tomadorCnpjCpf || '').replace(/\D/g, '');

    let request: FocusNfseRequest | FocusNfsenRequest;

    if (layout === 'NACIONAL') {
      // ===== Layout Nacional (flat) — endpoint /v2/nfsen =====
      const codigoMunicipioNum = parseInt(config.codigoMunicipio || '0', 10);
      const tomadorMunicipioNum = parseInt(dto.tomadorCodigoMunicipio || config.codigoMunicipio || '0', 10);

      // codigo_opcao_simples_nacional: 1=Não optante, 2=MEI, 3=ME/EPP
      const codigoOpcaoSN = config.optanteSimplesNacional ? 3 : 1;
      // regime_especial_tributacao: 0=Sem regime especial
      const regimeEspecial = parseInt(config.regimeEspecialTributacao || '0', 10);
      // tributacao_iss: 1=Operação normal (tributação no município)
      const tributacaoIss = 1;
      // tipo_retencao_iss: 1=Não retido, 2=Retido pelo tomador
      const tipoRetencaoIss = (dto.issRetido ?? false) ? 2 : 1;

      const nfsenPayload: FocusNfsenRequest = {
        data_emissao: brazilNow(),
        data_competencia: brazilToday(),
        codigo_municipio_emissora: codigoMunicipioNum,
        cnpj_prestador: cnpjClean,
        inscricao_municipal_prestador: config.inscricaoMunicipal || company.im || undefined,
        codigo_opcao_simples_nacional: codigoOpcaoSN,
        // regApTribSN — obrigatório para optantes SN (ME/EPP): 1=Tudo pelo SN
        ...(config.optanteSimplesNacional ? { regime_tributario_simples_nacional: 1 } : {}),
        regime_especial_tributacao: regimeEspecial,
        // Tomador
        cnpj_tomador: tomadorDoc.length === 14 ? tomadorDoc : undefined,
        cpf_tomador: tomadorDoc.length === 11 ? tomadorDoc : undefined,
        razao_social_tomador: dto.tomadorRazaoSocial || '',
        codigo_municipio_tomador: tomadorMunicipioNum || undefined,
        cep_tomador: (dto.tomadorCep || '').replace(/\D/g, '') || undefined,
        logradouro_tomador: dto.tomadorLogradouro || undefined,
        numero_tomador: dto.tomadorNumero || 'S/N',
        complemento_tomador: dto.tomadorComplemento || undefined,
        bairro_tomador: dto.tomadorBairro || undefined,
        email_tomador: dto.tomadorEmail || undefined,
        // Serviço
        codigo_municipio_prestacao: codigoMunicipioNum,
        codigo_tributacao_nacional_iss: codigoTribNac,
        codigo_tributacao_municipal_iss: dto.codigoTributarioMunicipio || config.codigoTributarioMunicipio || undefined,
        codigo_nbs: dto.codigoNbs || undefined,
        descricao_servico: dto.discriminacao || '',
        valor_servico: valorServicos,
        percentual_aliquota_relativa_municipio: aliquota || undefined,
        // pTotTribSN obrigatório para Simples Nacional
        percentual_total_tributos_simples_nacional: config.optanteSimplesNacional
          ? (aliquota || 2) // % aproximado total tributos SN
          : undefined,
        tributacao_iss: tributacaoIss,
        tipo_retencao_iss: tipoRetencaoIss,
        // Para não-SN, informar tributos individuais
        ...(!config.optanteSimplesNacional ? {
          percentual_total_tributos_federais: '0.00',
          percentual_total_tributos_estaduais: '0.00',
          percentual_total_tributos_municipais: String(aliquota || 0),
        } : {}),
        // Campos de obra (obrigatório para cTribNac 07.02.xx, 07.04.xx, etc.)
        ...(isObra && obra ? {
          codigo_obra: obra.cno?.replace(/\D/g, '') || '',
          logradouro_obra: obra.addressStreet || undefined,
          numero_obra: obra.addressNumber || undefined,
          complemento_obra: obra.addressComp || undefined,
          bairro_obra: obra.neighborhood || undefined,
          cep_obra: parseInt((obra.cep || '').replace(/\D/g, ''), 10) || undefined,
        } : {}),
      };
      request = nfsenPayload;
    } else {
      // ===== Layout Municipal (nested) — endpoint /v2/nfse =====
      request = {
        data_emissao: brazilNow(),
        natureza_operacao: dto.naturezaOperacao || config.naturezaOperacao || '1',
        regime_especial_tributacao: config.regimeEspecialTributacao || undefined,
        optante_simples_nacional: config.optanteSimplesNacional,
        incentivador_cultural: false,
        prestador: {
          cnpj: cnpjClean,
          inscricao_municipal: config.inscricaoMunicipal || company.im || '',
          codigo_municipio: config.codigoMunicipio || '',
        },
        tomador: {
          cnpj: tomadorDoc.length === 14 ? tomadorDoc : undefined,
          cpf: tomadorDoc.length === 11 ? tomadorDoc : undefined,
          razao_social: dto.tomadorRazaoSocial || '',
          email: dto.tomadorEmail || undefined,
          endereco: {
            logradouro: dto.tomadorLogradouro || '',
            numero: dto.tomadorNumero || 'S/N',
            complemento: dto.tomadorComplemento || undefined,
            bairro: dto.tomadorBairro || '',
            codigo_municipio: dto.tomadorCodigoMunicipio || '',
            uf: dto.tomadorUf || '',
            cep: (dto.tomadorCep || '').replace(/\D/g, ''),
          },
        },
        servico: {
          valor_servicos: valorServicos,
          iss_retido: dto.issRetido ?? false,
          item_lista_servico: (dto.itemListaServico || config.itemListaServico || '').replace(/\./g, ''),
          codigo_cnae: dto.codigoCnae || config.codigoCnae || undefined,
          codigo_tributario_municipio: dto.codigoTributarioMunicipio || config.codigoTributarioMunicipio || undefined,
          codigo_tributacao_nacional_iss: codigoTribNac || undefined,
          discriminacao: dto.discriminacao || '',
          aliquota,
          base_calculo: baseCalculo,
          codigo_municipio: dto.codigoMunicipioServico || config.codigoMunicipio || undefined,
        },
      } as FocusNfseRequest;
    }

    this.logger.log(`NFS-e layout=${layout}, tipoNota=${dto.tipoNota || 'SERVICO'}, cTribNac="${codigoTribNac}"${isObra ? `, obra=${obra?.name} CNO=${obra?.cno}` : ''}`);

    // Create or update emission record + update entry status in transaction
    const emissionData = {
      companyId,
      serviceOrderId: dto.serviceOrderId || entry.serviceOrderId,
      rpsNumber,
      rpsSeries: config.rpsSeries,
      focusNfeRef: ref,
      status: 'PROCESSING',
      errorMessage: null,
      prestadorCnpj: company.cnpj!,
      prestadorIm: config.inscricaoMunicipal,
      prestadorCodigoMunicipio: config.codigoMunicipio,
      tomadorCnpjCpf: dto.tomadorCnpjCpf,
      tomadorRazaoSocial: dto.tomadorRazaoSocial,
      tomadorEmail: dto.tomadorEmail,
      valorServicos: dto.valorServicosCents,
      aliquotaIss: aliquota,
      issRetido: dto.issRetido ?? false,
      valorIss: Math.round(valorIss * 100),
      itemListaServico: dto.itemListaServico || config.itemListaServico,
      codigoCnae: dto.codigoCnae || config.codigoCnae,
      discriminacao: dto.discriminacao,
      codigoMunicipioServico: dto.codigoMunicipioServico || config.codigoMunicipio,
      naturezaOperacao: dto.naturezaOperacao || config.naturezaOperacao,
      obraId: isObra ? dto.obraId : undefined,
    };

    const emission = await this.prisma.$transaction(async (tx) => {
      let em;
      if (existingErrorEmission) {
        // Retry: update existing failed emission instead of creating new
        em = await tx.nfseEmission.update({
          where: { id: existingErrorEmission.id },
          data: emissionData,
        });
        this.logger.log(`Retrying emission ${em.id} with new ref=${ref}`);
      } else {
        em = await tx.nfseEmission.create({ data: emissionData });
      }

      await tx.financialEntry.update({
        where: { id: dto.financialEntryId },
        data: { nfseStatus: 'PROCESSING', nfseEmissionId: em.id },
      });

      return em;
    });

    // Send to Focus NFe (fire-and-forget, webhook will update status)
    try {
      const result = await this.focusNfe.emit(token, config.focusNfeEnvironment, ref, request, layout);
      this.logger.log(`Focus NFe response: status=${result.status} ref=${ref}`);

      // If synchronous response with authorized status
      if (result.status === 'autorizado') {
        await this.handleAuthorized(emission.id, dto.financialEntryId, result);
      }
    } catch (error) {
      this.logger.error(`Focus NFe emission failed: ${error.message}`, error.stack);
      const friendlyError = this.mapFocusError(error.message);
      await this.prisma.$transaction([
        this.prisma.nfseEmission.update({
          where: { id: emission.id },
          data: { status: 'ERROR', errorMessage: friendlyError },
        }),
        this.prisma.financialEntry.update({
          where: { id: dto.financialEntryId },
          data: { nfseStatus: 'ERROR' },
        }),
      ]);
    }

    return emission;
  }

  // ========== WEBHOOK CALLBACK ==========

  /** Check if an emission with this focusNfeRef exists in the current schema */
  async findEmissionByRef(ref: string): Promise<{ id: string } | null> {
    return this.prisma.nfseEmission.findUnique({
      where: { focusNfeRef: ref },
      select: { id: true },
    });
  }

  async handleWebhook(ref: string, payload: any) {
    const emission = await this.prisma.nfseEmission.findUnique({
      where: { focusNfeRef: ref },
      include: { financialEntries: true },
    });
    if (!emission) {
      this.logger.warn(`Webhook for unknown ref: ${ref}`);
      return;
    }

    const entryId = emission.financialEntries[0]?.id;

    if (payload.status === 'autorizado') {
      await this.handleAuthorized(emission.id, entryId, payload);
    } else if (payload.status === 'erro_autorizacao') {
      const rawError = payload.erros?.map((e: any) => e.mensagem).join('; ') || 'Erro desconhecido';
      const errorMsg = this.mapFocusError(rawError);
      await this.prisma.$transaction([
        this.prisma.nfseEmission.update({
          where: { id: emission.id },
          data: { status: 'ERROR', errorMessage: errorMsg },
        }),
        ...(entryId ? [this.prisma.financialEntry.update({
          where: { id: entryId },
          data: { nfseStatus: 'ERROR' },
        })] : []),
      ]);
    } else if (payload.status === 'cancelado') {
      await this.prisma.$transaction([
        this.prisma.nfseEmission.update({
          where: { id: emission.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        }),
        // Liberar lançamento para reemissão (limpa vínculo)
        ...(entryId ? [this.prisma.financialEntry.update({
          where: { id: entryId },
          data: { nfseStatus: null, nfseEmissionId: null },
        })] : []),
      ]);
    }
  }

  private async handleAuthorized(emissionId: string, entryId: string | undefined, payload: any) {
    await this.prisma.$transaction([
      this.prisma.nfseEmission.update({
        where: { id: emissionId },
        data: {
          status: 'AUTHORIZED',
          nfseNumber: payload.numero,
          codigoVerificacao: payload.codigo_verificacao,
          xmlUrl: payload.caminho_xml_nota_fiscal,
          pdfUrl: payload.url_danfse,
          issuedAt: payload.data_emissao ? new Date(payload.data_emissao) : new Date(),
        },
      }),
      ...(entryId ? [this.prisma.financialEntry.update({
        where: { id: entryId },
        data: { nfseStatus: 'AUTHORIZED' },
      })] : []),
    ]);
  }

  // ========== CANCELAMENTO ==========

  async cancel(companyId: string, emissionId: string, dto: CancelNfseDto) {
    const emission = await this.prisma.nfseEmission.findFirst({
      where: { id: emissionId, companyId },
      include: { financialEntries: true },
    });
    if (!emission) throw new NotFoundException('NFS-e não encontrada');

    // Allow re-cancel for CANCELLING status (2-step cancellation municipalities)
    if (emission.status !== 'AUTHORIZED' && emission.status !== 'CANCELLING') {
      throw new BadRequestException('Apenas NFS-e autorizadas ou em cancelamento podem ser canceladas');
    }

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');

    const token = this.getActiveToken(config)!;

    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
    const justificativa = dto.justificativa || emission.cancelReason || 'Cancelamento solicitado';
    const result = await this.focusNfe.cancel(
      token,
      config.focusNfeEnvironment,
      emission.focusNfeRef,
      justificativa,
      layout,
    );

    const entryId = emission.financialEntries[0]?.id;

    if (result.status === 'cancelado') {
      // Cancelamento imediato (maioria dos municípios)
      await this.prisma.$transaction([
        this.prisma.nfseEmission.update({
          where: { id: emissionId },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: justificativa },
        }),
        ...(entryId ? [this.prisma.financialEntry.update({
          where: { id: entryId },
          data: { nfseStatus: null, nfseEmissionId: null },
        })] : []),
      ]);
    } else {
      // Cancelamento em 2 etapas (alguns municípios geram pedido de cancelamento primeiro)
      // Marcar como CANCELLING para permitir re-tentativa
      this.logger.warn(`Cancel 2-step: ref=${emission.focusNfeRef} status=${result.status} — requires second request`);
      await this.prisma.nfseEmission.update({
        where: { id: emissionId },
        data: { status: 'CANCELLING', cancelReason: justificativa },
      });

      // Tentar segunda requisição automaticamente após 3 segundos
      setTimeout(async () => {
        try {
          this.logger.log(`Cancel 2-step retry: ref=${emission.focusNfeRef}`);
          const retryResult = await this.focusNfe.cancel(
            token,
            config.focusNfeEnvironment,
            emission.focusNfeRef,
            justificativa,
            layout,
          );

          if (retryResult.status === 'cancelado') {
            await this.prisma.$transaction([
              this.prisma.nfseEmission.update({
                where: { id: emissionId },
                data: { status: 'CANCELLED', cancelledAt: new Date() },
              }),
              ...(entryId ? [this.prisma.financialEntry.update({
                where: { id: entryId },
                data: { nfseStatus: null, nfseEmissionId: null },
              })] : []),
            ]);
            this.logger.log(`Cancel 2-step completed: ref=${emission.focusNfeRef}`);
          } else {
            this.logger.warn(`Cancel 2-step retry not yet resolved: status=${retryResult.status}`);
          }
        } catch (err: any) {
          this.logger.error(`Cancel 2-step retry failed: ${err.message}`);
        }
      }, 3000);
    }

    return {
      ...result,
      message: result.status === 'cancelado'
        ? 'NFS-e cancelada com sucesso'
        : 'Pedido de cancelamento enviado à prefeitura. O sistema tentará confirmar automaticamente.',
    };
  }

  // ========== CONSULTAS ==========

  async findEmissions(companyId: string, query: {
    status?: string; serviceOrderId?: string; search?: string;
    dateFrom?: string; dateTo?: string; nfseNumber?: string;
    sortBy?: string; sortOrder?: 'asc' | 'desc';
    page?: number; limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId };
    if (query.status) where.status = query.status;
    if (query.serviceOrderId) where.serviceOrderId = query.serviceOrderId;
    if (query.nfseNumber) where.nfseNumber = { contains: query.nfseNumber, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { tomadorRazaoSocial: { contains: query.search, mode: 'insensitive' } },
        { tomadorCnpjCpf: { contains: query.search, mode: 'insensitive' } },
        { nfseNumber: { contains: query.search, mode: 'insensitive' } },
        { discriminacao: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const validSortFields = ['createdAt', 'nfseNumber', 'rpsNumber', 'valorServicos', 'status'];
    const orderField = validSortFields.includes(query.sortBy || '') ? query.sortBy! : 'createdAt';
    const orderDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.nfseEmission.findMany({
        where,
        orderBy: { [orderField]: orderDir },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          serviceOrder: { select: { id: true, title: true } },
          financialEntries: { select: { id: true, netCents: true, description: true } },
        },
      }),
      this.prisma.nfseEmission.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOneEmission(companyId: string, id: string) {
    const emission = await this.prisma.nfseEmission.findFirst({
      where: { id, companyId },
      include: {
        serviceOrder: { select: { id: true, title: true, status: true } },
        financialEntries: { select: { id: true, netCents: true, description: true, status: true } },
      },
    });
    if (!emission) throw new NotFoundException('NFS-e não encontrada');
    return emission;
  }

  // ========== REFRESH STATUS ==========

  async refreshStatus(companyId: string, emissionId: string) {
    const emission = await this.prisma.nfseEmission.findFirst({
      where: { id: emissionId, companyId },
      include: { financialEntries: true },
    });
    if (!emission) throw new NotFoundException('NFS-e não encontrada');

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');
    const token = this.getActiveToken(config)!;
    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;

    // Handle CANCELLING status — query status first, then retry cancel if needed
    if (emission.status === 'CANCELLING') {
      this.logger.log(`Refresh CANCELLING: checking status for ref=${emission.focusNfeRef}`);
      const entryId = emission.financialEntries[0]?.id;

      try {
        // Step 1: Query current status (GET) to check if already cancelled
        const queryResult = await this.focusNfe.query(token, config.focusNfeEnvironment, emission.focusNfeRef, layout);

        if (queryResult.status === 'cancelado') {
          this.logger.log(`Cancel confirmed via query: ref=${emission.focusNfeRef}`);
          await this.prisma.$transaction([
            this.prisma.nfseEmission.update({
              where: { id: emissionId },
              data: { status: 'CANCELLED', cancelledAt: new Date() },
            }),
            ...(entryId ? [this.prisma.financialEntry.update({
              where: { id: entryId },
              data: { nfseStatus: null, nfseEmissionId: null },
            })] : []),
          ]);
          return this.prisma.nfseEmission.findUnique({ where: { id: emissionId } });
        }

        // Step 2: If still "autorizado", try re-sending cancel (2-step municipality)
        this.logger.log(`Still ${queryResult.status}, retrying cancel for ref=${emission.focusNfeRef}`);
        try {
          const cancelResult = await this.focusNfe.cancel(
            token, config.focusNfeEnvironment, emission.focusNfeRef,
            emission.cancelReason || 'Cancelamento solicitado', layout,
          );
          if (cancelResult.status === 'cancelado') {
            await this.prisma.$transaction([
              this.prisma.nfseEmission.update({
                where: { id: emissionId },
                data: { status: 'CANCELLED', cancelledAt: new Date() },
              }),
              ...(entryId ? [this.prisma.financialEntry.update({
                where: { id: entryId },
                data: { nfseStatus: null, nfseEmissionId: null },
              })] : []),
            ]);
          }
        } catch (cancelErr: any) {
          // "Cancelamento já solicitado" is expected — cancel is pending at prefeitura
          this.logger.warn(`Cancel retry response: ${cancelErr.message}`);
        }
      } catch (err: any) {
        this.logger.error(`Refresh CANCELLING failed: ${err.message}`);
      }
      return this.prisma.nfseEmission.findUnique({ where: { id: emissionId } });
    }

    // Handle PROCESSING status — query emission status
    if (emission.status !== 'PROCESSING') return emission;

    const result = await this.focusNfe.query(token, config.focusNfeEnvironment, emission.focusNfeRef, layout);
    await this.handleWebhook(emission.focusNfeRef, result);

    return this.prisma.nfseEmission.findUnique({ where: { id: emissionId } });
  }

  // ========== PDF ==========

  async downloadPdf(companyId: string, emissionId: string): Promise<{ buffer: Buffer; filename: string }> {
    const emission = await this.prisma.nfseEmission.findFirst({
      where: { id: emissionId, companyId },
    });
    if (!emission) throw new NotFoundException('NFS-e não encontrada');
    if (emission.status !== 'AUTHORIZED') throw new BadRequestException('NFS-e não autorizada');

    const clientName = (emission.tomadorRazaoSocial || '').replace(/[^\w\s\-.,()]/g, '').trim();
    const nfseNum = emission.nfseNumber || String(emission.rpsNumber);
    const filename = clientName
      ? `NFS-e ${nfseNum} ${clientName}.pdf`
      : `NFS-e ${nfseNum}.pdf`;

    // Use stored pdfUrl (direct S3 link) if available
    if (emission.pdfUrl) {
      const response = await fetch(emission.pdfUrl);
      if (response.ok) {
        return { buffer: Buffer.from(await response.arrayBuffer()), filename };
      }
      this.logger.warn(`pdfUrl fetch failed (${response.status}), falling back to API`);
    }

    // Fallback to Focus NFe API
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (config?.focusNfeToken && !emission.focusNfeRef.startsWith('manual-')) {
      try {
        const token = this.getActiveToken(config)!;
        const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
        const buffer = await this.focusNfe.downloadPdf(token, config.focusNfeEnvironment, emission.focusNfeRef, layout);
        return { buffer, filename };
      } catch (err) {
        this.logger.warn(`Focus NFe PDF download failed: ${(err as Error).message}, falling back to local generation`);
      }
    }

    // Fallback: Generate DANFSe locally from database data
    const [company, nfseConfig] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true, cnpj: true, phone: true, addressStreet: true, addressNumber: true, neighborhood: true, city: true, state: true, cep: true, email: true } }),
      this.prisma.nfseConfig.findUnique({ where: { companyId }, select: { optanteSimplesNacional: true, codigoTributarioNacional: true, codigoTributarioMunicipio: true, codigoMunicipio: true } }).catch(() => null),
    ]);

    const issueDate = emission.issuedAt ? new Date(emission.issuedAt) : new Date(emission.createdAt);
    const fmtDateTime = (dt: Date) => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fmtDate = (dt: Date) => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const danfseData: DanfseData = {
      nfseNumber: emission.nfseNumber || '',
      rpsNumber: emission.rpsNumber,
      rpsSeries: emission.rpsSeries,
      codigoVerificacao: emission.codigoVerificacao || '',
      issuedAt: fmtDateTime(issueDate),
      competencia: fmtDate(issueDate),
      prestadorCnpj: emission.prestadorCnpj,
      prestadorRazaoSocial: company?.name || '',
      prestadorIm: emission.prestadorIm || undefined,
      prestadorEmail: company?.email || undefined,
      prestadorTelefone: company?.phone || undefined,
      prestadorEndereco: [company?.addressStreet, company?.addressNumber, company?.neighborhood].filter(Boolean).join(', ') || undefined,
      prestadorMunicipio: company?.city || undefined,
      prestadorUf: company?.state || undefined,
      prestadorCep: company?.cep || undefined,
      simplesNacional: nfseConfig?.optanteSimplesNacional ?? undefined,
      tomadorCnpjCpf: emission.tomadorCnpjCpf || undefined,
      tomadorRazaoSocial: emission.tomadorRazaoSocial || undefined,
      tomadorEmail: emission.tomadorEmail || undefined,
      discriminacao: emission.discriminacao || undefined,
      itemListaServico: emission.itemListaServico || undefined,
      codigoCnae: emission.codigoCnae || undefined,
      codigoTributacaoNacional: nfseConfig?.codigoTributarioNacional || undefined,
      codigoTributacaoMunicipal: nfseConfig?.codigoTributarioMunicipio || undefined,
      codigoMunicipioServico: emission.codigoMunicipioServico || undefined,
      naturezaOperacao: emission.naturezaOperacao || undefined,
      valorServicosCents: emission.valorServicos,
      aliquotaIss: emission.aliquotaIss || undefined,
      valorIssCents: emission.valorIss || undefined,
      issRetido: emission.issRetido,
      status: emission.status,
    };

    const buffer = await this.danfseService.generate(danfseData);
    return { buffer, filename };
  }

  // ========== RESEND EMAIL ==========

  async resendEmail(companyId: string, emissionId: string, emails?: string[]) {
    const emission = await this.prisma.nfseEmission.findFirst({
      where: { id: emissionId, companyId },
    });
    if (!emission) throw new NotFoundException('NFS-e não encontrada');
    if (emission.status !== 'AUTHORIZED') throw new BadRequestException('NFS-e não autorizada — só é possível reenviar email de notas autorizadas');

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');

    const token = this.getActiveToken(config)!;
    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
    const targetEmails = emails?.length ? emails : (emission.tomadorEmail ? [emission.tomadorEmail] : []);
    if (!targetEmails.length) throw new BadRequestException('Nenhum email disponível para envio');

    await this.focusNfe.resendEmail(token, config.focusNfeEnvironment, emission.focusNfeRef, targetEmails, layout);
    return { ok: true, sentTo: targetEmails };
  }

  // ========== SEND WHATSAPP ==========

  async sendWhatsApp(companyId: string, emissionId: string): Promise<{ ok: boolean; sentTo?: string }> {
    const emission = await this.prisma.nfseEmission.findFirst({
      where: { id: emissionId, companyId },
      include: { financialEntries: { include: { partner: true } } },
    });
    if (!emission) throw new NotFoundException('NFS-e não encontrada');
    if (emission.status !== 'AUTHORIZED') throw new BadRequestException('NFS-e não autorizada');

    // Find phone from partner
    const partner = emission.financialEntries[0]?.partner;
    const phone = partner?.phone || '';
    if (!phone) throw new BadRequestException('Telefone do tomador não encontrado');

    const valorFormatted = ((emission.valorServicos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const message = [
      `*NFS-e Autorizada*`,
      ``,
      `Número: ${emission.nfseNumber || 'N/A'}`,
      `Cód. Verificação: ${emission.codigoVerificacao || 'N/A'}`,
      `Valor: ${valorFormatted}`,
      `Tomador: ${emission.tomadorRazaoSocial || 'N/A'}`,
      emission.discriminacao ? `Serviço: ${emission.discriminacao}` : '',
      ``,
      emission.pdfUrl ? `PDF: ${emission.pdfUrl}` : '',
    ].filter(Boolean).join('\n');

    // Use template fallback — sendText silently fails outside 24h window
    await this.whatsApp.sendTextWithTemplateFallback(companyId, phone, message, true);

    // Try to send PDF as document if available
    if (emission.pdfUrl) {
      try {
        await this.whatsApp.sendMedia(companyId, phone, emission.pdfUrl, `NFS-e ${emission.nfseNumber || emission.rpsNumber}`, 'document');
      } catch (err) {
        this.logger.warn(`Failed to send NFS-e PDF via WhatsApp: ${err.message}`);
      }
    }

    return { ok: true, sentTo: phone };
  }

  // ========== CHECK BEFORE PAYMENT ==========

  async checkNfseBeforePayment(companyId: string, financialEntryId: string): Promise<{
    requiresNfse: boolean;
    behavior: string;
    nfseStatus: string | null;
  }> {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) return { requiresNfse: false, behavior: 'IGNORE', nfseStatus: null };

    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: financialEntryId, companyId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado');

    // Only check for RECEIVABLE entries
    if (entry.type !== 'RECEIVABLE') return { requiresNfse: false, behavior: 'IGNORE', nfseStatus: entry.nfseStatus };

    return {
      requiresNfse: entry.nfseStatus !== 'AUTHORIZED',
      behavior: config.receiveWithoutNfse, // WARN | BLOCK | IGNORE
      nfseStatus: entry.nfseStatus,
    };
  }

  // ========== SERVICE CODES (CRUD) ==========

  async listServiceCodes(companyId: string) {
    return this.prisma.nfseServiceCode.findMany({
      where: { companyId },
      orderBy: [{ active: 'desc' }, { descricao: 'asc' }],
    });
  }

  async createServiceCode(companyId: string, dto: CreateNfseServiceCodeDto) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configure a NFS-e antes de cadastrar serviços');

    return this.prisma.nfseServiceCode.create({
      data: {
        companyId,
        configId: config.id,
        codigo: dto.codigo,
        codigoNbs: dto.codigoNbs || null,
        descricao: dto.descricao,
        tipo: dto.tipo || 'SERVICO',
        aliquotaIss: dto.aliquotaIss ?? null,
        itemListaServico: dto.itemListaServico || null,
        codigoCnae: dto.codigoCnae || null,
        codigoTribMunicipal: dto.codigoTribMunicipal || null,
      },
    });
  }

  async updateServiceCode(companyId: string, id: string, dto: UpdateNfseServiceCodeDto) {
    const existing = await this.prisma.nfseServiceCode.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Código de serviço não encontrado');

    return this.prisma.nfseServiceCode.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.codigoNbs !== undefined && { codigoNbs: dto.codigoNbs || null }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.aliquotaIss !== undefined && { aliquotaIss: dto.aliquotaIss }),
        ...(dto.itemListaServico !== undefined && { itemListaServico: dto.itemListaServico || null }),
        ...(dto.codigoCnae !== undefined && { codigoCnae: dto.codigoCnae || null }),
        ...(dto.codigoTribMunicipal !== undefined && { codigoTribMunicipal: dto.codigoTribMunicipal || null }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async deleteServiceCode(companyId: string, id: string) {
    const existing = await this.prisma.nfseServiceCode.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Código de serviço não encontrado');

    await this.prisma.nfseServiceCode.delete({ where: { id } });
    return { deleted: true };
  }
}
