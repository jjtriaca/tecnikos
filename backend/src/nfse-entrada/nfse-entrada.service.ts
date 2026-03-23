import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NfseEntradaParserService, ParsedNfseEntrada } from './nfse-entrada-parser.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreateNfseEntradaDto } from './dto/create-nfse-entrada.dto';
import { FocusNfeProvider, FocusNfseRecebida } from '../nfse-emission/focus-nfe.provider';
import { EncryptionService } from '../common/encryption.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { buildSearchWhere } from '../common/util/build-search-where';

@Injectable()
export class NfseEntradaService {
  private readonly logger = new Logger(NfseEntradaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: NfseEntradaParserService,
    private readonly focusNfe: FocusNfeProvider,
    private readonly encryption: EncryptionService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  /* ═══════════════════════════════════════════════════════════════════
     uploadXml — Parse XML and create NfseEntrada
     ═══════════════════════════════════════════════════════════════════ */

  async uploadXml(xmlContent: string, companyId: string) {
    const parsed = this.parser.parse(xmlContent);

    // Try to find existing prestador by CNPJ/CPF
    let prestadorId: string | null = null;
    if (parsed.prestadorCnpjCpf) {
      const prestador = await this.prisma.partner.findFirst({
        where: {
          companyId,
          document: parsed.prestadorCnpjCpf,
          deletedAt: null,
        },
      });
      if (prestador) {
        prestadorId = prestador.id;
      }
    }

    const nfseEntrada = await this.prisma.nfseEntrada.create({
      data: {
        companyId,
        layout: parsed.layout,
        numero: parsed.numero,
        codigoVerificacao: parsed.codigoVerificacao,
        dataEmissao: parsed.dataEmissao ? new Date(parsed.dataEmissao) : null,
        competencia: parsed.competencia,
        // Prestador
        prestadorId,
        prestadorCnpjCpf: parsed.prestadorCnpjCpf,
        prestadorRazaoSocial: parsed.prestadorRazaoSocial,
        prestadorIm: parsed.prestadorIm,
        prestadorMunicipio: parsed.prestadorMunicipio,
        prestadorUf: parsed.prestadorUf,
        // Tomador
        tomadorCnpj: parsed.tomadorCnpj,
        // Service
        itemListaServico: parsed.itemListaServico,
        codigoCnae: parsed.codigoCnae,
        codigoTribMunicipio: parsed.codigoTribMunicipio,
        codigoTribNacional: parsed.codigoTribNacional,
        discriminacao: parsed.discriminacao,
        municipioServico: parsed.municipioServico,
        naturezaOperacao: parsed.naturezaOperacao,
        exigibilidadeIss: parsed.exigibilidadeIss,
        // Values
        valorServicosCents: parsed.valorServicosCents,
        valorDeducoesCents: parsed.valorDeducoesCents,
        baseCalculoCents: parsed.baseCalculoCents,
        aliquotaIss: parsed.aliquotaIss,
        issRetido: parsed.issRetido,
        valorIssCents: parsed.valorIssCents,
        valorPisCents: parsed.valorPisCents,
        valorCofinsCents: parsed.valorCofinsCents,
        valorInssCents: parsed.valorInssCents,
        valorIrCents: parsed.valorIrCents,
        valorCsllCents: parsed.valorCsllCents,
        outrasRetCents: parsed.outrasRetCents,
        descontoIncondCents: parsed.descontoIncondCents,
        descontoCondCents: parsed.descontoCondCents,
        valorLiquidoCents: parsed.valorLiquidoCents,
        // Construction
        codigoObra: parsed.codigoObra,
        art: parsed.art,
        // XML
        xmlContent,
        status: 'ACTIVE',
      },
      include: {
        prestador: { select: { id: true, name: true, document: true } },
      },
    });

    return nfseEntrada;
  }

  /* ═══════════════════════════════════════════════════════════════════
     createManual — Create NfseEntrada from manual form
     ═══════════════════════════════════════════════════════════════════ */

  async createManual(companyId: string, dto: CreateNfseEntradaDto) {
    // Try to find existing prestador by CNPJ/CPF
    let prestadorId: string | null = dto.prestadorId || null;
    if (!prestadorId && dto.prestadorCnpjCpf) {
      const prestador = await this.prisma.partner.findFirst({
        where: {
          companyId,
          document: dto.prestadorCnpjCpf,
          deletedAt: null,
        },
      });
      if (prestador) {
        prestadorId = prestador.id;
      }
    }

    const nfseEntrada = await this.prisma.nfseEntrada.create({
      data: {
        companyId,
        layout: 'MANUAL',
        numero: dto.numero || null,
        codigoVerificacao: dto.codigoVerificacao || null,
        dataEmissao: dto.dataEmissao ? new Date(dto.dataEmissao) : null,
        competencia: dto.competencia || null,
        // Prestador
        prestadorId,
        prestadorCnpjCpf: dto.prestadorCnpjCpf || null,
        prestadorRazaoSocial: dto.prestadorRazaoSocial || null,
        prestadorIm: dto.prestadorIm || null,
        prestadorMunicipio: dto.prestadorMunicipio || null,
        prestadorUf: dto.prestadorUf || null,
        // Service
        itemListaServico: dto.itemListaServico || null,
        codigoCnae: dto.codigoCnae || null,
        codigoTribMunicipio: dto.codigoTribMunicipio || null,
        discriminacao: dto.discriminacao || null,
        municipioServico: dto.municipioServico || null,
        // Values
        valorServicosCents: dto.valorServicosCents ?? null,
        baseCalculoCents: dto.baseCalculoCents ?? null,
        aliquotaIss: dto.aliquotaIss ?? null,
        issRetido: dto.issRetido ?? false,
        valorIssCents: dto.valorIssCents ?? null,
        valorPisCents: dto.valorPisCents ?? null,
        valorCofinsCents: dto.valorCofinsCents ?? null,
        valorInssCents: dto.valorInssCents ?? null,
        valorIrCents: dto.valorIrCents ?? null,
        valorCsllCents: dto.valorCsllCents ?? null,
        outrasRetCents: dto.outrasRetCents ?? null,
        descontoIncondCents: dto.descontoIncondCents ?? null,
        valorLiquidoCents: dto.valorLiquidoCents ?? null,
        // Construction
        codigoObra: dto.codigoObra || null,
        art: dto.art || null,
        status: 'ACTIVE',
      },
      include: {
        prestador: { select: { id: true, name: true, document: true } },
      },
    });

    return nfseEntrada;
  }

  /* ═══════════════════════════════════════════════════════════════════
     findAll — Paginated list
     ═══════════════════════════════════════════════════════════════════ */

  async findAll(
    companyId: string,
    pagination?: PaginationDto,
    competencia?: string,
    status?: string,
  ): Promise<PaginatedResult<any>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (competencia) {
      where.competencia = competencia;
    }

    if (status === 'DOWNLOADED') {
      where.status = 'ACTIVE';
      where.financialEntryId = null;
    } else if (status === 'IMPORTED') {
      where.status = 'ACTIVE';
      where.financialEntryId = { not: null };
    } else if (status === 'CANCELLED') {
      where.status = 'CANCELLED';
    } else {
      // "Todas" — no filter by status (show all)
    }

    if (pagination?.search) {
      const searchWhere = buildSearchWhere(pagination.search, [
        { field: 'numero', mode: 'insensitive' },
        { field: 'prestadorRazaoSocial', mode: 'insensitive' },
        { field: 'prestadorCnpjCpf', mode: 'insensitive' },
        { field: 'discriminacao', mode: 'insensitive' },
      ]);
      if (searchWhere) Object.assign(where, searchWhere);
    }

    // Dynamic sorting
    const validSortFields = ['numero', 'prestadorRazaoSocial', 'valorServicosCents', 'dataEmissao', 'competencia', 'createdAt'];
    const orderBy: Record<string, string> = {};
    if (pagination?.sortBy && validSortFields.includes(pagination.sortBy)) {
      orderBy[pagination.sortBy] = pagination.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.nfseEntrada.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          prestador: { select: { id: true, name: true, document: true } },
        },
      }),
      this.prisma.nfseEntrada.count({ where }),
    ]);

    const mapped = data.map(({ xmlContent, ...rest }) => ({
      ...rest,
      hasXml: !!xmlContent,
    }));

    return {
      data: mapped,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     findOne — Single entry detail
     ═══════════════════════════════════════════════════════════════════ */

  async findOne(id: string, companyId: string) {
    const entry = await this.prisma.nfseEntrada.findFirst({
      where: { id, companyId },
      include: {
        prestador: { select: { id: true, name: true, document: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException('NFS-e de entrada nao encontrada');
    }

    return entry;
  }

  /* ═══════════════════════════════════════════════════════════════════
     update — Update entry fields
     ═══════════════════════════════════════════════════════════════════ */

  async update(id: string, companyId: string, data: Partial<CreateNfseEntradaDto>) {
    const entry = await this.findOne(id, companyId);

    const ALLOWED_FIELDS = [
      'numero', 'codigoVerificacao', 'dataEmissao', 'competencia',
      'prestadorId', 'prestadorCnpjCpf', 'prestadorRazaoSocial', 'prestadorIm',
      'prestadorMunicipio', 'prestadorUf',
      'itemListaServico', 'codigoCnae', 'codigoTribMunicipio', 'discriminacao',
      'municipioServico',
      'valorServicosCents', 'baseCalculoCents', 'aliquotaIss', 'issRetido',
      'valorIssCents', 'valorPisCents', 'valorCofinsCents', 'valorInssCents',
      'valorIrCents', 'valorCsllCents', 'outrasRetCents',
      'descontoIncondCents', 'valorLiquidoCents',
      'codigoObra', 'art',
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if ((data as any)[key] !== undefined) {
        if (key === 'dataEmissao' && (data as any)[key]) {
          updateData[key] = new Date((data as any)[key]);
        } else {
          updateData[key] = (data as any)[key];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return entry;
    }

    return this.prisma.nfseEntrada.update({
      where: { id },
      data: updateData,
      include: {
        prestador: { select: { id: true, name: true, document: true } },
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     cancel — Soft cancel (mark as CANCELLED)
     ═══════════════════════════════════════════════════════════════════ */

  async cancel(id: string, companyId: string) {
    await this.findOne(id, companyId);

    return this.prisma.nfseEntrada.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     linkPrestador — Link to existing Partner
     ═══════════════════════════════════════════════════════════════════ */

  async linkPrestador(id: string, companyId: string, partnerId: string) {
    await this.findOne(id, companyId);

    const partner = await this.prisma.partner.findFirst({
      where: { id: partnerId, companyId, deletedAt: null },
    });

    if (!partner) {
      throw new NotFoundException('Parceiro nao encontrado');
    }

    // Ensure FORNECEDOR type
    if (!partner.partnerTypes.includes('FORNECEDOR')) {
      await this.prisma.partner.update({
        where: { id: partnerId },
        data: { partnerTypes: [...partner.partnerTypes, 'FORNECEDOR'] },
      });
    }

    return this.prisma.nfseEntrada.update({
      where: { id },
      data: { prestadorId: partnerId },
      include: {
        prestador: { select: { id: true, name: true, document: true } },
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     getImportUsage — NFS-e import quota usage
     ═══════════════════════════════════════════════════════════════════ */

  async getImportUsage(companyId: string): Promise<{ used: number; limit: number; percentage: number; enabled: boolean }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { maxNfseImports: true },
    });

    const limit = company?.maxNfseImports || 0;
    if (limit === 0) {
      return { used: 0, limit: 0, percentage: 0, enabled: false };
    }

    // Use billing cycle for counting
    const now = new Date();
    let periodStart: Date = new Date(now.getFullYear(), now.getMonth(), 1);
    let periodEnd: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const tenant = await this.prisma.tenant.findFirst({
      where: { companyId },
      select: { id: true },
    });
    if (tenant) {
      const sub = await this.prisma.subscription.findFirst({
        where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        select: { currentPeriodStart: true, currentPeriodEnd: true },
        orderBy: { createdAt: 'desc' },
      });
      if (sub) {
        periodStart = sub.currentPeriodStart;
        periodEnd = sub.currentPeriodEnd;
      }
    }

    const used = await this.prisma.nfseEntrada.count({
      where: { companyId, focusSource: true, createdAt: { gte: periodStart, lte: periodEnd } },
    });

    const percentage = Math.min(100, Math.round((used / limit) * 100));
    return { used, limit, percentage, enabled: true };
  }

  /* ═══════════════════════════════════════════════════════════════════
     syncFromFocus — Import NFS-e recebidas from Focus NFe API
     ═══════════════════════════════════════════════════════════════════ */

  async syncFromFocus(companyId: string, dateFrom?: string): Promise<{ imported: number; skipped: number; total: number; limitReached: boolean; monthlyLimit: number; usedThisMonth: number }> {
    const dateFilter = dateFrom ? new Date(dateFrom) : null;
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config?.focusNfeToken) {
      throw new BadRequestException('Token Focus NFe nao configurado');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { cnpj: true, maxNfseImports: true, maxOsPerMonth: true },
    });
    if (!company?.cnpj) {
      throw new BadRequestException('CNPJ da empresa nao cadastrado');
    }

    // Monthly limit from plan. 0 = feature disabled (not unlimited).
    const monthlyLimit = company.maxNfseImports || 0;
    if (monthlyLimit === 0) {
      throw new BadRequestException('Importacao automatica de NFS-e nao esta inclusa no seu plano');
    }

    // Use billing cycle dates (not calendar month)
    const tenant = await this.prisma.tenant.findFirst({
      where: { companyId },
      select: { id: true },
    });
    let periodStart: Date;
    let periodEnd: Date;
    const now = new Date();

    if (tenant) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        select: { currentPeriodStart: true, currentPeriodEnd: true, extraOsPurchased: true },
        orderBy: { createdAt: 'desc' },
      });
      if (subscription) {
        periodStart = subscription.currentPeriodStart;
        periodEnd = subscription.currentPeriodEnd;
      }
    }
    if (!periodStart! || !periodEnd!) {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Count Focus imports already done this billing cycle
    const usedThisMonth = await this.prisma.nfseEntrada.count({
      where: { companyId, focusSource: true, createdAt: { gte: periodStart, lte: periodEnd } },
    });

    const remaining = monthlyLimit > 0 ? Math.max(0, monthlyLimit - usedThisMonth) : Infinity;
    if (remaining === 0) {
      return { imported: 0, skipped: 0, total: 0, limitReached: true, monthlyLimit, usedThisMonth };
    }

    const token = this.getActiveToken(config);
    if (!token) {
      throw new BadRequestException('Token Focus NFe invalido');
    }

    let imported = 0;
    let skipped = 0;
    let totalFetched = 0;
    let currentVersion = config.lastNfseSyncVersion || 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.focusNfe.listNfsesRecebidas(
        token,
        config.focusNfeEnvironment,
        company.cnpj,
        currentVersion,
      );

      totalFetched += result.data.length;

      for (const nfse of result.data) {
        if (!nfse.chave_nfse) {
          skipped++;
          continue;
        }

        // Skip notes older than dateFrom filter (don't count against quota)
        if (dateFilter && nfse.data_emissao) {
          const emissao = new Date(nfse.data_emissao);
          if (emissao < dateFilter) {
            skipped++;
            continue;
          }
        }

        // Check if already imported (deduplication by chaveNfse)
        const existing = await this.prisma.nfseEntrada.findFirst({
          where: { companyId, chaveNfse: nfse.chave_nfse },
        });

        if (existing) {
          // Update situacao if changed (e.g., autorizado → cancelado)
          if (existing.situacaoFocus !== nfse.situacao) {
            await this.prisma.nfseEntrada.update({
              where: { id: existing.id },
              data: {
                situacaoFocus: nfse.situacao,
                status: nfse.situacao === 'cancelado' ? 'CANCELLED' : 'ACTIVE',
              },
            });
          }
          skipped++;
          continue;
        }

        // Fetch detailed JSON for complete data
        let detail: any = null;
        try {
          detail = await this.focusNfe.getNfseRecebidaJson(token, config.focusNfeEnvironment, nfse.chave_nfse);
        } catch (err) {
          this.logger.warn(`Failed to get detail for ${nfse.chave_nfse}: ${(err as Error).message}`);
        }

        // Parse valor from string to cents
        const valorCents = nfse.valor_total ? Math.round(parseFloat(nfse.valor_total) * 100) : null;

        // Auto-link prestador by CNPJ
        let prestadorId: string | null = null;
        if (nfse.documento_prestador) {
          const prestador = await this.prisma.partner.findFirst({
            where: { companyId, document: nfse.documento_prestador, deletedAt: null },
          });
          if (prestador) prestadorId = prestador.id;
        }

        // Parse competencia from data_emissao
        const dataEmissao = nfse.data_emissao ? new Date(nfse.data_emissao) : null;
        const competencia = dataEmissao
          ? `${dataEmissao.getFullYear()}-${String(dataEmissao.getMonth() + 1).padStart(2, '0')}`
          : null;

        await this.prisma.nfseEntrada.create({
          data: {
            companyId,
            layout: 'NACIONAL',
            focusSource: true,
            chaveNfse: nfse.chave_nfse,
            situacaoFocus: nfse.situacao,
            versaoFocus: nfse.versao,
            numero: detail?.numero || null,
            dataEmissao,
            competencia,
            prestadorId,
            prestadorCnpjCpf: nfse.documento_prestador || null,
            prestadorRazaoSocial: nfse.nome_prestador || null,
            tomadorCnpj: company.cnpj.replace(/\D/g, ''),
            discriminacao: detail?.descricao_servico || null,
            codigoCnae: detail?.codigo_nbs || null,
            valorServicosCents: valorCents,
            baseCalculoCents: detail?.iss_base_calculo ? Math.round(parseFloat(detail.iss_base_calculo) * 100) : null,
            aliquotaIss: detail?.iss_aliquota ? parseFloat(detail.iss_aliquota) : null,
            valorIssCents: detail?.iss_valor ? Math.round(parseFloat(detail.iss_valor) * 100) : null,
            valorLiquidoCents: detail?.valor_liquido ? Math.round(parseFloat(detail.valor_liquido) * 100) : null,
            status: nfse.situacao === 'cancelado' ? 'CANCELLED' : 'ACTIVE',
          },
        });

        imported++;

        // Stop if monthly limit reached
        if (imported >= remaining) {
          hasMore = false;
          break;
        }
      }

      // Update version for incremental pagination
      if (result.maxVersion > currentVersion) {
        currentVersion = result.maxVersion;
      }

      // If we got fewer than 100 results, there are no more pages
      if (hasMore) {
        hasMore = result.data.length >= 100;
      }
    }

    const limitReached = monthlyLimit > 0 && (usedThisMonth + imported) >= monthlyLimit;

    // Save last sync version
    await this.prisma.nfseConfig.update({
      where: { companyId },
      data: { lastNfseSyncVersion: currentVersion },
    });

    this.logger.log(`Focus NFe sync for company ${companyId}: imported=${imported}, skipped=${skipped}, total=${totalFetched}, limitReached=${limitReached}, used=${usedThisMonth + imported}/${monthlyLimit}`);
    return { imported, skipped, total: totalFetched, limitReached, monthlyLimit, usedThisMonth: usedThisMonth + imported };
  }

  /* ═══════════════════════════════════════════════════════════════════
     process — Link prestador + create FinancialEntry (Contas a Pagar)
     ═══════════════════════════════════════════════════════════════════ */

  async process(
    id: string,
    companyId: string,
    decisions: {
      prestador: { action: 'CREATE' | 'LINK'; partnerId?: string };
      finance: { createEntry: boolean; dueDate?: string; paymentMethod?: string };
    },
  ) {
    const entry = await this.prisma.nfseEntrada.findFirst({
      where: { id, companyId },
    });

    if (!entry) throw new NotFoundException('NFS-e de entrada não encontrada');
    if (entry.status !== 'ACTIVE') throw new BadRequestException('NFS-e não está ativa');
    if (entry.financialEntryId) throw new BadRequestException('NFS-e já possui lançamento financeiro');

    const result = await this.prisma.$transaction(async (tx) => {
      // ── 1. Prestador: CREATE or LINK ────────────────────────────
      let prestadorId = entry.prestadorId;

      if (decisions.prestador.action === 'CREATE') {
        const partnerCode = await this.codeGenerator.generateCode(companyId, 'PARTNER');
        const newPartner = await tx.partner.create({
          data: {
            companyId,
            code: partnerCode,
            partnerTypes: ['FORNECEDOR'],
            personType: entry.prestadorCnpjCpf && entry.prestadorCnpjCpf.length === 14 ? 'PJ' : 'PF',
            name: entry.prestadorRazaoSocial || 'Prestador NFS-e',
            document: entry.prestadorCnpjCpf || undefined,
            documentType: entry.prestadorCnpjCpf
              ? (entry.prestadorCnpjCpf.length === 14 ? 'CNPJ' : 'CPF')
              : undefined,
            status: 'ATIVO',
          },
        });
        prestadorId = newPartner.id;
      } else if (decisions.prestador.action === 'LINK' && decisions.prestador.partnerId) {
        const partner = await tx.partner.findFirst({
          where: { id: decisions.prestador.partnerId, companyId, deletedAt: null },
        });
        if (!partner) throw new NotFoundException('Prestador vinculado não encontrado');

        if (!partner.partnerTypes.includes('FORNECEDOR')) {
          await tx.partner.update({
            where: { id: partner.id },
            data: { partnerTypes: [...partner.partnerTypes, 'FORNECEDOR'] },
          });
        }
        prestadorId = partner.id;
      }

      // ── 2. Create FinancialEntry PAYABLE ────────────────────────
      let financialEntryId: string | null = null;

      if (decisions.finance.createEntry) {
        const totalCents = entry.valorServicosCents || 0;
        const dueDate = decisions.finance.dueDate
          ? new Date(decisions.finance.dueDate)
          : (entry.dataEmissao ?? undefined);

        const finCode = await this.codeGenerator.generateCode(companyId, 'FINANCIAL_ENTRY');
        const financialEntry = await tx.financialEntry.create({
          data: {
            companyId,
            code: finCode,
            partnerId: prestadorId,
            type: 'PAYABLE',
            status: 'PENDING',
            description: `NFS-e ${entry.numero || ''} — ${entry.prestadorRazaoSocial || 'Prestador'}`,
            grossCents: totalCents,
            netCents: totalCents,
            dueDate,
            paymentMethod: decisions.finance.paymentMethod || undefined,
          },
        });
        financialEntryId = financialEntry.id;
      }

      // ── 3. Update NfseEntrada ───────────────────────────────────
      await tx.nfseEntrada.update({
        where: { id },
        data: {
          prestadorId,
          financialEntryId,
        },
      });

      return { financialEntryId, prestadorId };
    });

    return result;
  }

  /* ═══════════════════════════════════════════════════════════════════
     revert — Delete FinancialEntry linked to NFS-e
     ═══════════════════════════════════════════════════════════════════ */

  async revert(id: string, companyId: string) {
    const entry = await this.prisma.nfseEntrada.findFirst({
      where: { id, companyId },
    });

    if (!entry) throw new NotFoundException('NFS-e de entrada não encontrada');
    if (!entry.financialEntryId) throw new BadRequestException('NFS-e não possui lançamento financeiro para reverter');

    // Block revert if financial entry is paid
    const finEntry = await this.prisma.financialEntry.findUnique({
      where: { id: entry.financialEntryId },
    });
    if (finEntry && finEntry.status === 'PAID') {
      throw new BadRequestException('Lançamento financeiro já está pago. Cancele o pagamento antes de reverter.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete financial entry (cascades installments)
      if (entry.financialEntryId) {
        await tx.financialEntry.delete({
          where: { id: entry.financialEntryId },
        });
      }

      // Clear financialEntryId
      await tx.nfseEntrada.update({
        where: { id },
        data: { financialEntryId: null },
      });
    });

    return { reverted: true };
  }

  /* ═══════════════════════════════════════════════════════════════════
     fetchFocusXml / fetchFocusPdf — Get XML/PDF from Focus NFe API
     ═══════════════════════════════════════════════════════════════════ */

  async fetchFocusXml(companyId: string, chaveNfse: string): Promise<string | null> {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) return null;
    const token = this.getActiveToken(config);
    if (!token) return null;
    try {
      return await this.focusNfe.getNfseRecebidaXml(token, config.focusNfeEnvironment, chaveNfse);
    } catch (err) {
      this.logger.warn(`fetchFocusXml failed for ${chaveNfse}: ${(err as Error).message}`);
      return null;
    }
  }

  async fetchFocusPdf(companyId: string, chaveNfse: string): Promise<Buffer | null> {
    const config = await this.prisma.nfseConfig.findUnique({ where: { companyId } });
    if (!config) return null;
    const token = this.getActiveToken(config);
    if (!token) return null;
    try {
      return await this.focusNfe.getNfseRecebidaPdf(token, config.focusNfeEnvironment, chaveNfse);
    } catch (err) {
      this.logger.warn(`fetchFocusPdf failed for ${chaveNfse}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Get decrypted active token from NfseConfig */
  private getActiveToken(config: { focusNfeToken: string | null; focusNfeTokenHomolog: string | null; focusNfeEnvironment: string }): string | null {
    const encrypted = config.focusNfeEnvironment === 'HOMOLOGATION'
      ? (config.focusNfeTokenHomolog || config.focusNfeToken)
      : config.focusNfeToken;
    if (!encrypted) return null;
    return this.encryption.decrypt(encrypted);
  }
}
