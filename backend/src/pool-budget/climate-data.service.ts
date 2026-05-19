// CRUD de ClimateData (dados climaticos por UF/cidade pro Simulador de Aquecimento).
// Semente automatica via ensureSeeded() — popula o tenant na 1a leitura.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildClimateSeed, findSeedRecord, ClimateSeedRecord } from './climate-seed';
import { AddCustomCityDto, UpdateClimateDataDto } from './dto/climate-data.dto';

export interface MonthlyData {
  temp: number[];
  humidity: number[];
  radSol: number[];
}

export interface ClimateDataView {
  id: string;
  uf: string;
  ufName: string;
  cidade: string | null;
  monthlyData: MonthlyData;
  isCustom: boolean;
  isActive: boolean;
  isSeedAvailable: boolean; // se true, botao "Restaurar padrao INMET" aparece
}

@Injectable()
export class ClimateDataService {
  constructor(private readonly prisma: PrismaService) {}

  /** Popula o tenant com seed completo na 1a leitura (idempotente). */
  async ensureSeeded(companyId: string): Promise<void> {
    const count = await this.prisma.climateData.count({ where: { companyId } });
    if (count > 0) return;

    const seed = buildClimateSeed();
    await this.prisma.climateData.createMany({
      data: seed.map((r) => ({
        companyId,
        uf: r.uf,
        cidade: r.cidade,
        ufName: r.ufName,
        monthlyData: r.monthlyData as any,
        isCustom: false,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  async findAll(companyId: string): Promise<ClimateDataView[]> {
    await this.ensureSeeded(companyId);
    const rows = await this.prisma.climateData.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ uf: 'asc' }, { cidade: 'asc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  async findByUf(companyId: string, uf: string): Promise<ClimateDataView[]> {
    await this.ensureSeeded(companyId);
    const rows = await this.prisma.climateData.findMany({
      where: { companyId, uf, isActive: true },
      orderBy: [{ cidade: 'asc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Busca o registro mais especifico: (uf, cidade) primeiro, depois (uf, NULL).
   * Usado pelos services do Simulador.
   */
  async findForLookup(companyId: string, uf: string, cidade?: string | null): Promise<MonthlyData | null> {
    await this.ensureSeeded(companyId);
    if (cidade) {
      const specific = await this.prisma.climateData.findUnique({
        where: { companyId_uf_cidade: { companyId, uf, cidade } },
      });
      if (specific && specific.isActive) return specific.monthlyData as unknown as MonthlyData;
    }
    const capital = await this.prisma.climateData.findUnique({
      where: { companyId_uf_cidade: { companyId, uf, cidade: null as any } },
    });
    if (capital && capital.isActive) return capital.monthlyData as unknown as MonthlyData;
    return null;
  }

  async update(companyId: string, id: string, dto: UpdateClimateDataDto): Promise<ClimateDataView> {
    const row = await this.prisma.climateData.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Registro climatico nao encontrado');

    const updated = await this.prisma.climateData.update({
      where: { id },
      data: {
        monthlyData: dto.monthlyData ? (dto.monthlyData as any) : undefined,
        isActive: dto.isActive ?? undefined,
        isCustom: dto.monthlyData ? true : undefined,
      },
    });
    return this.toView(updated);
  }

  async addCustomCity(companyId: string, dto: AddCustomCityDto): Promise<ClimateDataView> {
    await this.ensureSeeded(companyId);
    // valida UF existe no seed
    const capital = await this.prisma.climateData.findUnique({
      where: { companyId_uf_cidade: { companyId, uf: dto.uf, cidade: null as any } },
    });
    if (!capital) throw new BadRequestException(`UF ${dto.uf} nao encontrada no cadastro climatico`);

    const existing = await this.prisma.climateData.findUnique({
      where: { companyId_uf_cidade: { companyId, uf: dto.uf, cidade: dto.cidade } },
    });
    if (existing) throw new BadRequestException(`Cidade "${dto.cidade}" ja existe em ${dto.uf}`);

    const created = await this.prisma.climateData.create({
      data: {
        companyId,
        uf: dto.uf,
        cidade: dto.cidade,
        ufName: capital.ufName,
        monthlyData: dto.monthlyData as any,
        isCustom: true,
        isActive: true,
      },
    });
    return this.toView(created);
  }

  async restoreSeed(companyId: string, id: string): Promise<ClimateDataView> {
    const row = await this.prisma.climateData.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Registro climatico nao encontrado');

    const seed = findSeedRecord(row.uf, row.cidade);
    if (!seed) throw new BadRequestException('Sem padrao INMET para essa cidade (foi adicionada manualmente)');

    const updated = await this.prisma.climateData.update({
      where: { id },
      data: {
        monthlyData: seed.monthlyData as any,
        isCustom: false,
      },
    });
    return this.toView(updated);
  }

  async deleteCustomCity(companyId: string, id: string): Promise<void> {
    const row = await this.prisma.climateData.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Registro climatico nao encontrado');
    if (row.cidade === null) throw new BadRequestException('Nao eh possivel deletar o registro padrao do estado (capital)');
    await this.prisma.climateData.delete({ where: { id } });
  }

  private toView(row: any): ClimateDataView {
    const seed = findSeedRecord(row.uf, row.cidade);
    return {
      id: row.id,
      uf: row.uf,
      ufName: row.ufName,
      cidade: row.cidade,
      monthlyData: row.monthlyData as MonthlyData,
      isCustom: row.isCustom,
      isActive: row.isActive,
      isSeedAvailable: seed !== null,
    };
  }
}
