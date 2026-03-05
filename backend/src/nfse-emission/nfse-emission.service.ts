import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { FocusNfeProvider, FocusNfseRequest } from './focus-nfe.provider';
import { SaveNfseConfigDto, EmitNfseDto, CancelNfseDto } from './dto/nfse-emission.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class NfseEmissionService {
  private readonly logger = new Logger(NfseEmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly focusNfe: FocusNfeProvider,
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
    let discriminacao = config.defaultDiscriminacao || '';
    if (entry.serviceOrder) {
      discriminacao = discriminacao
        .replace('{titulo_os}', entry.serviceOrder.title || '')
        .replace('{descricao_os}', entry.serviceOrder.description || '')
        .replace('{tecnico}', entry.serviceOrder.assignedPartner?.name || '');
    } else {
      // No service order linked — remove template variables
      discriminacao = discriminacao
        .replace(/\{titulo_os\}/g, '')
        .replace(/\{descricao_os\}/g, '')
        .replace(/\{tecnico\}/g, '');
    }
    // Clean up multiple spaces and trim
    discriminacao = discriminacao.replace(/\s{2,}/g, ' ').trim();
    if (!discriminacao) {
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
        codigoMunicipio: (tomador as any)?.ibgeCode || '',
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
    const valorServicos = dto.valorServicosCents / 100;
    const aliquota = dto.aliquotaIss ?? config.aliquotaIss ?? 0;
    const baseCalculo = valorServicos;
    const valorIss = Math.round(baseCalculo * aliquota) / 100;

    const request: FocusNfseRequest = {
      data_emissao: new Date().toISOString(),
      natureza_operacao: dto.naturezaOperacao || config.naturezaOperacao || '1',
      regime_especial_tributacao: config.regimeEspecialTributacao || undefined,
      optante_simples_nacional: config.optanteSimplesNacional,
      incentivador_cultural: false,
      prestador: {
        cnpj: company.cnpj.replace(/\D/g, ''),
        inscricao_municipal: config.inscricaoMunicipal || company.im || '',
        codigo_municipio: config.codigoMunicipio || '',
      },
      tomador: {
        cnpj: dto.tomadorCnpjCpf && dto.tomadorCnpjCpf.replace(/\D/g, '').length === 14
          ? dto.tomadorCnpjCpf.replace(/\D/g, '') : undefined,
        cpf: dto.tomadorCnpjCpf && dto.tomadorCnpjCpf.replace(/\D/g, '').length === 11
          ? dto.tomadorCnpjCpf.replace(/\D/g, '') : undefined,
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
    };

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
      const result = await this.focusNfe.emit(token, config.focusNfeEnvironment, ref, request);
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

    const result = await this.focusNfe.cancel(
      token,
      config.focusNfeEnvironment,
      emission.focusNfeRef,
      dto.justificativa,
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
    const result = await this.focusNfe.query(token, config.focusNfeEnvironment, emission.focusNfeRef);

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
    const buffer = await this.focusNfe.downloadPdf(token, config.focusNfeEnvironment, emission.focusNfeRef);

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
    const targetEmails = emails?.length ? emails : (emission.tomadorEmail ? [emission.tomadorEmail] : []);
    if (!targetEmails.length) throw new BadRequestException('Nenhum email disponível para envio');

    await this.focusNfe.resendEmail(token, config.focusNfeEnvironment, emission.focusNfeRef, targetEmails);
    return { ok: true, sentTo: targetEmails };
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
