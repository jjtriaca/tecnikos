import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/* ══════════════════════════════════════════════════════════════════════
   Interfaces
   ══════════════════════════════════════════════════════════════════════ */

export interface FiscalPeriodSummary {
  id: string;
  year: number;
  month: number;
  status: string;
  // Quantities
  totalNfeEntrada: number;
  totalNfeSaida: number;
  totalNfseEntrada: number;
  totalNfseSaida: number;
  // ICMS
  icmsDebitoCents: number;
  icmsCreditoCents: number;
  icmsSaldoCents: number;
  icmsStCents: number;
  // IPI
  ipiDebitoCents: number;
  ipiCreditoCents: number;
  ipiSaldoCents: number;
  // PIS
  pisDebitoCents: number;
  pisCreditoCents: number;
  pisSaldoCents: number;
  // COFINS
  cofinsDebitoCents: number;
  cofinsCreditoCents: number;
  cofinsSaldoCents: number;
  // ISS
  issDevidoCents: number;
  issRetidoCents: number;
  // Totals
  totalEntradaCents: number;
  totalSaidaCents: number;
  // Control
  closedAt: Date | null;
  closedByName: string | null;
  filedAt: Date | null;
  notes: string | null;
}

export interface LivroEntradaItem {
  id: string;
  dataEmissao: Date | null;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  emitenteCnpj: string | null;
  emitenteRazaoSocial: string | null;
  cfop: string | null;
  valorTotalCents: number | null;
  baseIcmsCents: number | null;
  icmsCents: number | null;
  icmsStCents: number | null;
  ipiCents: number | null;
  pisCents: number | null;
  cofinsCents: number | null;
  freteCents: number | null;
  seguroCents: number | null;
  descontoCents: number | null;
}

export interface ServicoTomadoItem {
  id: string;
  dataEmissao: Date | null;
  numero: string | null;
  competencia: string | null;
  prestadorCnpjCpf: string | null;
  prestadorRazaoSocial: string | null;
  prestadorMunicipio: string | null;
  itemListaServico: string | null;
  discriminacao: string | null;
  valorServicosCents: number | null;
  baseCalculoCents: number | null;
  aliquotaIss: number | null;
  issRetido: boolean;
  valorIssCents: number | null;
  valorPisCents: number | null;
  valorCofinsCents: number | null;
  valorInssCents: number | null;
  valorIrCents: number | null;
  valorCsllCents: number | null;
  valorLiquidoCents: number | null;
}

export interface ApuracaoResumo {
  period: { year: number; month: number };
  taxRegime: string;
  // Quantidades
  totalNfeEntrada: number;
  totalNfseEntrada: number;
  totalNfseSaida: number;
  // ICMS
  icms: { debito: number; credito: number; saldo: number; st: number };
  // IPI
  ipi: { debito: number; credito: number; saldo: number };
  // PIS
  pis: { debito: number; credito: number; saldo: number };
  // COFINS
  cofins: { debito: number; credito: number; saldo: number };
  // ISS
  iss: { devido: number; retido: number };
  // Totals
  totalEntradaCents: number;
  totalSaidaCents: number;
}

@Injectable()
export class FiscalPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  /* ═══════════════════════════════════════════════════════════════════
     findAll — List fiscal periods for a company
     ═══════════════════════════════════════════════════════════════════ */

  async findAll(companyId: string, year?: number) {
    const where: any = { companyId };
    if (year) where.year = year;

    return this.prisma.fiscalPeriod.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     findOne — Get single period
     ═══════════════════════════════════════════════════════════════════ */

  async findOne(id: string, companyId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, companyId },
    });
    if (!period) {
      throw new NotFoundException('Periodo fiscal nao encontrado');
    }
    return period;
  }

  /* ═══════════════════════════════════════════════════════════════════
     findOrCreate — Get period by year/month, create if not exists
     ═══════════════════════════════════════════════════════════════════ */

  async findOrCreate(companyId: string, year: number, month: number) {
    let period = await this.prisma.fiscalPeriod.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });

    if (!period) {
      period = await this.prisma.fiscalPeriod.create({
        data: { companyId, year, month, status: 'OPEN' },
      });
    }

    return period;
  }

  /* ═══════════════════════════════════════════════════════════════════
     calculate — Calculate apuracao for a period (NFe + NFS-e data)
     ═══════════════════════════════════════════════════════════════════ */

  async calculate(companyId: string, year: number, month: number): Promise<ApuracaoResumo> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true },
    });

    const competencia = `${year}-${String(month).padStart(2, '0')}`;

    // Date range for the month
    const dateFrom = new Date(year, month - 1, 1);
    const dateTo = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. NFe de Entrada — imported NFe for this period
    const nfeEntradas = await this.prisma.nfeImport.findMany({
      where: {
        companyId,
        issueDate: { gte: dateFrom, lte: dateTo },
        status: { in: ['PROCESSED', 'COMPLETED'] },
      },
      select: {
        id: true,
        totalCents: true,
        baseIcmsCents: true,
        icmsCents: true,
        baseIcmsStCents: true,
        icmsStCents: true,
        ipiCents: true,
        pisCents: true,
        cofinsCents: true,
      },
    });

    // 2. NFS-e de Entrada — servicos tomados
    const nfseEntradas = await this.prisma.nfseEntrada.findMany({
      where: {
        companyId,
        competencia,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        valorServicosCents: true,
        baseCalculoCents: true,
        valorIssCents: true,
        issRetido: true,
        valorPisCents: true,
        valorCofinsCents: true,
      },
    });

    // 3. NFS-e de Saida — emissoes do periodo
    const nfseSaidas = await this.prisma.nfseEmission.findMany({
      where: {
        companyId,
        createdAt: { gte: dateFrom, lte: dateTo },
        status: 'AUTHORIZED',
      },
      select: {
        id: true,
        valorServicos: true,  // centavos (Int)
        valorIss: true,       // centavos (Int)
      },
    });

    // Calculate ICMS (from NFe entradas — credits)
    const icmsCreditoCents = nfeEntradas.reduce((sum, n) => sum + (n.icmsCents || 0), 0);
    const icmsStCents = nfeEntradas.reduce((sum, n) => sum + (n.icmsStCents || 0), 0);

    // Calculate IPI (from NFe entradas — credits)
    const ipiCreditoCents = nfeEntradas.reduce((sum, n) => sum + (n.ipiCents || 0), 0);

    // PIS/COFINS from NFe entradas (credits for LR)
    const pisCreditoNfe = nfeEntradas.reduce((sum, n) => sum + (n.pisCents || 0), 0);
    const cofinsCreditoNfe = nfeEntradas.reduce((sum, n) => sum + (n.cofinsCents || 0), 0);

    // PIS/COFINS from NFS-e entrada (retained = credit)
    const pisCreditoNfse = nfseEntradas.reduce((sum, n) => sum + (n.valorPisCents || 0), 0);
    const cofinsCreditoNfse = nfseEntradas.reduce((sum, n) => sum + (n.valorCofinsCents || 0), 0);

    const pisCreditoCents = pisCreditoNfe + pisCreditoNfse;
    const cofinsCreditoCents = cofinsCreditoNfe + cofinsCreditoNfse;

    // PIS/COFINS debitos — calculated from NFS-e saida based on regime
    // SN: included in DAS (no separate PIS/COFINS), LP: 0.65%/3.00%, LR: 1.65%/7.60%
    const taxRegime = company?.taxRegime || 'SN';
    let pisAliq = 0;
    let cofinsAliq = 0;
    if (taxRegime === 'LP') { pisAliq = 0.0065; cofinsAliq = 0.03; }
    if (taxRegime === 'LR') { pisAliq = 0.0165; cofinsAliq = 0.076; }

    const totalSaidaServicos = nfseSaidas.reduce((sum, n) => sum + (n.valorServicos || 0), 0);
    const pisDebitoCents = Math.round(totalSaidaServicos * pisAliq);
    const cofinsDebitoCents = Math.round(totalSaidaServicos * cofinsAliq);

    // ISS — from NFS-e saida (valorIss is already in centavos)
    const issDevidoCents = nfseSaidas.reduce((sum, n) => sum + (n.valorIss || 0), 0);
    const issRetidoCents = nfseEntradas.filter(n => n.issRetido).reduce((sum, n) => sum + (n.valorIssCents || 0), 0);

    // Totais
    const totalEntradaNfe = nfeEntradas.reduce((sum, n) => sum + (n.totalCents || 0), 0);
    const totalEntradaNfse = nfseEntradas.reduce((sum, n) => sum + (n.valorServicosCents || 0), 0);
    const totalSaidaNfse = nfseSaidas.reduce((sum, n) => sum + (n.valorServicos || 0), 0);

    return {
      period: { year, month },
      taxRegime: company?.taxRegime || 'SN',
      totalNfeEntrada: nfeEntradas.length,
      totalNfseEntrada: nfseEntradas.length,
      totalNfseSaida: nfseSaidas.length,
      icms: {
        debito: 0, // No ICMS debit from services
        credito: icmsCreditoCents,
        saldo: -icmsCreditoCents, // negative = credit balance
        st: icmsStCents,
      },
      ipi: {
        debito: 0,
        credito: ipiCreditoCents,
        saldo: -ipiCreditoCents,
      },
      pis: {
        debito: pisDebitoCents,
        credito: pisCreditoCents,
        saldo: pisDebitoCents - pisCreditoCents,
      },
      cofins: {
        debito: cofinsDebitoCents,
        credito: cofinsCreditoCents,
        saldo: cofinsDebitoCents - cofinsCreditoCents,
      },
      iss: {
        devido: issDevidoCents,
        retido: issRetidoCents,
      },
      totalEntradaCents: totalEntradaNfe + totalEntradaNfse,
      totalSaidaCents: totalSaidaNfse,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     close — Close (fechar) a fiscal period
     ═══════════════════════════════════════════════════════════════════ */

  async close(companyId: string, year: number, month: number, userName: string) {
    const period = await this.findOrCreate(companyId, year, month);

    if (period.status === 'CLOSED') {
      throw new BadRequestException('Periodo ja esta fechado');
    }
    if (period.status === 'FILED') {
      throw new BadRequestException('Periodo ja foi escriturado');
    }

    // Calculate apuracao
    const apuracao = await this.calculate(companyId, year, month);

    // Update with calculated values
    return this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedByName: userName,
        // Quantities
        totalNfeEntrada: apuracao.totalNfeEntrada,
        totalNfeSaida: 0,
        totalNfseEntrada: apuracao.totalNfseEntrada,
        totalNfseSaida: apuracao.totalNfseSaida,
        // ICMS
        icmsDebitoCents: apuracao.icms.debito,
        icmsCreditoCents: apuracao.icms.credito,
        icmsSaldoCents: apuracao.icms.saldo,
        icmsStCents: apuracao.icms.st,
        // IPI
        ipiDebitoCents: apuracao.ipi.debito,
        ipiCreditoCents: apuracao.ipi.credito,
        ipiSaldoCents: apuracao.ipi.saldo,
        // PIS
        pisDebitoCents: apuracao.pis.debito,
        pisCreditoCents: apuracao.pis.credito,
        pisSaldoCents: apuracao.pis.saldo,
        // COFINS
        cofinsDebitoCents: apuracao.cofins.debito,
        cofinsCreditoCents: apuracao.cofins.credito,
        cofinsSaldoCents: apuracao.cofins.saldo,
        // ISS
        issDevidoCents: apuracao.iss.devido,
        issRetidoCents: apuracao.iss.retido,
        // Totals
        totalEntradaCents: apuracao.totalEntradaCents,
        totalSaidaCents: apuracao.totalSaidaCents,
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     reopen — Reopen a closed period
     ═══════════════════════════════════════════════════════════════════ */

  async reopen(id: string, companyId: string) {
    const period = await this.findOne(id, companyId);

    if (period.status === 'OPEN') {
      throw new BadRequestException('Periodo ja esta aberto');
    }

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedByName: null,
        filedAt: null,
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     updateNotes — Update period notes
     ═══════════════════════════════════════════════════════════════════ */

  async updateNotes(id: string, companyId: string, notes: string) {
    await this.findOne(id, companyId);
    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: { notes },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     getLivroEntradas — NFe Entrada report for a period
     ═══════════════════════════════════════════════════════════════════ */

  async getLivroEntradas(companyId: string, year: number, month: number): Promise<LivroEntradaItem[]> {
    const dateFrom = new Date(year, month - 1, 1);
    const dateTo = new Date(year, month, 0, 23, 59, 59, 999);

    const nfeImports = await this.prisma.nfeImport.findMany({
      where: {
        companyId,
        issueDate: { gte: dateFrom, lte: dateTo },
        status: { in: ['PROCESSED', 'COMPLETED'] },
      },
      orderBy: { issueDate: 'asc' },
      select: {
        id: true,
        issueDate: true,
        nfeNumber: true,
        nfeSeries: true,
        nfeKey: true,
        supplierCnpj: true,
        supplierName: true,
        totalCents: true,
        baseIcmsCents: true,
        icmsCents: true,
        icmsStCents: true,
        ipiCents: true,
        pisCents: true,
        cofinsCents: true,
        freteCents: true,
        seguroCents: true,
        descontoCents: true,
        items: {
          select: { cfop: true },
          take: 1,
        },
      },
    });

    return nfeImports.map(nfe => ({
      id: nfe.id,
      dataEmissao: nfe.issueDate,
      numero: nfe.nfeNumber,
      serie: nfe.nfeSeries,
      chaveAcesso: nfe.nfeKey,
      emitenteCnpj: nfe.supplierCnpj,
      emitenteRazaoSocial: nfe.supplierName,
      cfop: nfe.items?.[0]?.cfop || null,
      valorTotalCents: nfe.totalCents,
      baseIcmsCents: nfe.baseIcmsCents,
      icmsCents: nfe.icmsCents,
      icmsStCents: nfe.icmsStCents,
      ipiCents: nfe.ipiCents,
      pisCents: nfe.pisCents,
      cofinsCents: nfe.cofinsCents,
      freteCents: nfe.freteCents,
      seguroCents: nfe.seguroCents,
      descontoCents: nfe.descontoCents,
    }));
  }

  /* ═══════════════════════════════════════════════════════════════════
     getServicosTomados — NFS-e Entrada report for a period
     ═══════════════════════════════════════════════════════════════════ */

  async getServicosTomados(companyId: string, year: number, month: number): Promise<ServicoTomadoItem[]> {
    const competencia = `${year}-${String(month).padStart(2, '0')}`;

    const nfseEntradas = await this.prisma.nfseEntrada.findMany({
      where: {
        companyId,
        competencia,
        status: 'ACTIVE',
      },
      orderBy: { dataEmissao: 'asc' },
    });

    return nfseEntradas.map(nfse => ({
      id: nfse.id,
      dataEmissao: nfse.dataEmissao,
      numero: nfse.numero,
      competencia: nfse.competencia,
      prestadorCnpjCpf: nfse.prestadorCnpjCpf,
      prestadorRazaoSocial: nfse.prestadorRazaoSocial,
      prestadorMunicipio: nfse.prestadorMunicipio,
      itemListaServico: nfse.itemListaServico,
      discriminacao: nfse.discriminacao,
      valorServicosCents: nfse.valorServicosCents,
      baseCalculoCents: nfse.baseCalculoCents,
      aliquotaIss: nfse.aliquotaIss,
      issRetido: nfse.issRetido,
      valorIssCents: nfse.valorIssCents,
      valorPisCents: nfse.valorPisCents,
      valorCofinsCents: nfse.valorCofinsCents,
      valorInssCents: nfse.valorInssCents,
      valorIrCents: nfse.valorIrCents,
      valorCsllCents: nfse.valorCsllCents,
      valorLiquidoCents: nfse.valorLiquidoCents,
    }));
  }

  /* ═══════════════════════════════════════════════════════════════════
     getDashboard — Overview of fiscal obligations for the company
     ═══════════════════════════════════════════════════════════════════ */

  async getDashboard(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true, cnae: true, fiscalProfile: true },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get recent periods (last 6 months)
    const periods = await this.prisma.fiscalPeriod.findMany({
      where: { companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 12,
    });

    // Calculate current period preview (without closing)
    const currentApuracao = await this.calculate(companyId, currentYear, currentMonth);

    // Get obligations based on regime
    const obligations = this.getObligations(company?.taxRegime || 'SN', currentYear, currentMonth);

    return {
      taxRegime: company?.taxRegime || 'SN',
      cnae: company?.cnae,
      fiscalProfile: company?.fiscalProfile,
      currentPeriod: {
        year: currentYear,
        month: currentMonth,
        apuracao: currentApuracao,
      },
      periods,
      obligations,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     getObligations — List fiscal obligations with deadlines
     ═══════════════════════════════════════════════════════════════════ */

  private getObligations(taxRegime: string, year: number, month: number) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const competencia = `${year}-${String(month).padStart(2, '0')}`;

    const obligations: Array<{
      name: string;
      deadline: string;
      deadlineDate: string;
      applicable: boolean;
      description: string;
    }> = [];

    if (taxRegime === 'SN') {
      obligations.push(
        {
          name: 'PGDAS-D',
          deadline: `Dia 20/${String(nextMonth).padStart(2, '0')}`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-20`,
          applicable: true,
          description: 'Apuracao e guia DAS (Portal do Simples Nacional)',
        },
        {
          name: 'DeSTDA',
          deadline: `Dia 28/${String(nextMonth).padStart(2, '0')}`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-28`,
          applicable: true,
          description: 'Declaracao ST, DIFAL e Antecipacao (SEDIF-SN)',
        },
        {
          name: 'Livro Registro de Entradas',
          deadline: 'Mensal (interno)',
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`,
          applicable: true,
          description: 'Escrituracao NFe de entrada do periodo',
        },
        {
          name: 'Livro Servicos Tomados',
          deadline: 'Mensal (interno)',
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`,
          applicable: true,
          description: 'Escrituracao NFS-e de entrada (servicos tomados)',
        },
      );
    } else if (taxRegime === 'LP') {
      obligations.push(
        {
          name: 'EFD-Contribuicoes',
          deadline: `Dia 10 util do 2o mes`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`,
          applicable: true,
          description: 'PIS 0,65% + COFINS 3,00% (cumulativo)',
        },
        {
          name: 'EFD ICMS/IPI',
          deadline: `Dia 20/${String(nextMonth).padStart(2, '0')}`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-20`,
          applicable: true,
          description: 'Escrituracao fiscal digital (se contribuinte ICMS)',
        },
        {
          name: 'DCTFWeb',
          deadline: `Dia 15/${String(nextMonth).padStart(2, '0')}`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`,
          applicable: true,
          description: 'Declaracao de debitos e creditos tributarios (eSocial)',
        },
      );
    } else {
      // LR
      obligations.push(
        {
          name: 'EFD-Contribuicoes',
          deadline: `Dia 10 util do 2o mes`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`,
          applicable: true,
          description: 'PIS 1,65% + COFINS 7,60% (nao-cumulativo, com creditos)',
        },
        {
          name: 'EFD ICMS/IPI',
          deadline: `Dia 20/${String(nextMonth).padStart(2, '0')}`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-20`,
          applicable: true,
          description: 'Escrituracao fiscal digital (obrigatorio)',
        },
        {
          name: 'DCTFWeb',
          deadline: `Dia 15/${String(nextMonth).padStart(2, '0')}`,
          deadlineDate: `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-15`,
          applicable: true,
          description: 'Declaracao de debitos e creditos tributarios',
        },
        {
          name: 'ECF',
          deadline: 'Anual (julho)',
          deadlineDate: `${year}-07-31`,
          applicable: true,
          description: 'Escrituracao Contabil Fiscal (LALUR/LACS)',
        },
      );
    }

    return obligations;
  }
}
