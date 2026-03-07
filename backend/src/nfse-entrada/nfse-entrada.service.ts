import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NfseEntradaParserService, ParsedNfseEntrada } from './nfse-entrada-parser.service';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { CreateNfseEntradaDto } from './dto/create-nfse-entrada.dto';

@Injectable()
export class NfseEntradaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: NfseEntradaParserService,
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

    if (status) {
      where.status = status;
    } else {
      where.status = 'ACTIVE';
    }

    if (pagination?.search) {
      where.OR = [
        { numero: { contains: pagination.search, mode: 'insensitive' } },
        { prestadorRazaoSocial: { contains: pagination.search, mode: 'insensitive' } },
        { prestadorCnpjCpf: { contains: pagination.search, mode: 'insensitive' } },
        { discriminacao: { contains: pagination.search, mode: 'insensitive' } },
      ];
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

    return {
      data,
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
}
