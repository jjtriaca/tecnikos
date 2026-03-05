import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { FocusNfeProvider, FocusNfseRequest, FocusNfsenRequest, NfseLayout } from './focus-nfe.provider';
import { SaveNfseConfigDto, EmitNfseDto, CancelNfseDto } from './dto/nfse-emission.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
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
    private readonly focusNfe: FocusNfeProvider,
    private readonly whatsApp: WhatsAppService,
  ) {}

  // ========== CONFIG ==========

  async getConfig(companyId: string) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) return null;
    // Never return decrypted token
    return {
      ...config,
      focusNfeToken: config.focusNfeToken ? '••••••••' : null,
    };
  }

  async saveConfig(companyId: string, dto: SaveNfseConfigDto) {
    const data: any = { ...dto };

    // Encrypt token if provided
    if (dto.focusNfeToken && dto.focusNfeToken !== '••••••••') {
      data.focusNfeToken = this.encryption.encrypt(dto.focusNfeToken);
    } else {
      delete data.focusNfeToken;
    }

    const config = await this.prisma.nfseConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    return {
      ...config,
      focusNfeToken: config.focusNfeToken ? '••••••••' : null,
    };
  }

  // ========== PREVIEW (dados para tela de confirmação) ==========

  async getEmissionPreview(companyId: string, financialEntryId: string) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuração fiscal não encontrada. Configure em Configurações > Fiscal.');

    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: financialEntryId, companyId, deletedAt: null },
      include: {
        serviceOrder: { include: { clientPartner: true, assignedPartner: true } },
        partner: true,
        company: true,
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
    };
  }

  // ========== EMISSÃO ==========

  async emit(companyId: string, dto: EmitNfseDto) {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Configuração fiscal não encontrada');
    if (!config.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');

    // Check entry
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: dto.financialEntryId, companyId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Lançamento financeiro não encontrado');
    if (entry.nfseStatus === 'AUTHORIZED') throw new BadRequestException('NFS-e já emitida para este lançamento');
    if (entry.nfseStatus === 'PROCESSING') throw new BadRequestException('NFS-e em processamento');

    // Decrypt token
    const token = this.encryption.decrypt(config.focusNfeToken);

    // Generate unique ref
    const ref = `tk-${companyId.substring(0, 8)}-${randomUUID().substring(0, 8)}`;

    // Get next RPS number and increment atomically
    const rpsNumber = config.rpsNextNumber;
    await this.prisma.nfseConfig.update({
      where: { companyId },
      data: { rpsNextNumber: rpsNumber + 1 },
    });

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
        codigo_tributacao_nacional_iss: config.codigoTributarioNacional || '',
        codigo_tributacao_municipal_iss: dto.codigoTributarioMunicipio || config.codigoTributarioMunicipio || undefined,
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
          codigo_tributacao_nacional_iss: config.codigoTributarioNacional || undefined,
          discriminacao: dto.discriminacao || '',
          aliquota,
          base_calculo: baseCalculo,
          codigo_municipio: dto.codigoMunicipioServico || config.codigoMunicipio || undefined,
        },
      } as FocusNfseRequest;
    }

    this.logger.log(`NFS-e layout=${layout}, cTribNac="${config.codigoTributarioNacional}"`);

    // Create emission record + update entry status in transaction
    const emission = await this.prisma.$transaction(async (tx) => {
      const em = await tx.nfseEmission.create({
        data: {
          companyId,
          serviceOrderId: dto.serviceOrderId || entry.serviceOrderId,
          rpsNumber,
          rpsSeries: config.rpsSeries,
          focusNfeRef: ref,
          status: 'PROCESSING',
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
        },
      });

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
      await this.prisma.$transaction([
        this.prisma.nfseEmission.update({
          where: { id: emission.id },
          data: { status: 'ERROR', errorMessage: error.message },
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
      const errorMsg = payload.erros?.map((e: any) => e.mensagem).join('; ') || 'Erro desconhecido';
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
        ...(entryId ? [this.prisma.financialEntry.update({
          where: { id: entryId },
          data: { nfseStatus: 'CANCELLED' },
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
    if (emission.status !== 'AUTHORIZED') throw new BadRequestException('Apenas NFS-e autorizadas podem ser canceladas');

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');

    const token = this.encryption.decrypt(config.focusNfeToken);

    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
    const result = await this.focusNfe.cancel(
      token,
      config.focusNfeEnvironment,
      emission.focusNfeRef,
      dto.justificativa,
      layout,
    );

    if (result.status === 'cancelado') {
      const entryId = emission.financialEntries[0]?.id;
      await this.prisma.$transaction([
        this.prisma.nfseEmission.update({
          where: { id: emissionId },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: dto.justificativa },
        }),
        ...(entryId ? [this.prisma.financialEntry.update({
          where: { id: entryId },
          data: { nfseStatus: 'CANCELLED' },
        })] : []),
      ]);
    }

    return result;
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
    if (emission.status !== 'PROCESSING') return emission;

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');

    const token = this.encryption.decrypt(config.focusNfeToken);
    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
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

    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) throw new BadRequestException('Token Focus NFe não configurado');

    const token = this.encryption.decrypt(config.focusNfeToken);
    const layout = (config.nfseLayout || 'MUNICIPAL') as NfseLayout;
    const buffer = await this.focusNfe.downloadPdf(token, config.focusNfeEnvironment, emission.focusNfeRef, layout);

    return { buffer, filename: `nfse-${emission.nfseNumber || emission.rpsNumber}.pdf` };
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

    const token = this.encryption.decrypt(config.focusNfeToken);
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

    await this.whatsApp.sendText(companyId, phone, message);

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
}
