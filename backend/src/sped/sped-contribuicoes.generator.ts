import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EFD-Contribuicoes (PIS/COFINS) SPED file generator.
 *
 * Generates the pipe-delimited TXT file required by the Receita Federal
 * for companies under Lucro Presumido or Lucro Real tax regimes.
 *
 * Layout version: 006 (current as of 2026)
 */
@Injectable()
export class SpedContribuicoesGenerator {
  private readonly logger = new Logger(SpedContribuicoesGenerator.name);

  constructor(private readonly prisma: PrismaService) {}

  /* ═══════════════════════════════════════════════════════
   *  MAIN ENTRY POINT
   * ═══════════════════════════════════════════════════════ */

  async generate(companyId: string, year: number, month: number): Promise<string> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    const nfseConfig = await this.prisma.nfseConfig.findUnique({
      where: { companyId },
    });

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // last day of month

    // Query NFS-e Entrada (services received)
    const nfseEntradas = await this.prisma.nfseEntrada.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        dataEmissao: { gte: periodStart, lte: new Date(year, month - 1, periodEnd.getDate(), 23, 59, 59) },
      },
      orderBy: { dataEmissao: 'asc' },
    });

    // Query NFS-e Emission (services rendered)
    const nfseEmissions = await this.prisma.nfseEmission.findMany({
      where: {
        companyId,
        status: 'AUTHORIZED',
        createdAt: { gte: periodStart, lte: new Date(year, month - 1, periodEnd.getDate(), 23, 59, 59) },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Query NFe Imports with items (goods received)
    const nfeImports = await this.prisma.nfeImport.findMany({
      where: {
        companyId,
        status: { not: 'CANCELLED' },
        issueDate: { gte: periodStart, lte: new Date(year, month - 1, periodEnd.getDate(), 23, 59, 59) },
      },
      include: { items: { orderBy: { itemNumber: 'asc' } } },
      orderBy: { issueDate: 'asc' },
    });

    // Collect all unique participant CNPJs for register 0150
    const participantMap = new Map<string, { cnpj: string; name: string }>();
    for (const nfse of nfseEntradas) {
      if (nfse.prestadorCnpjCpf) {
        participantMap.set(nfse.prestadorCnpjCpf, {
          cnpj: nfse.prestadorCnpjCpf,
          name: nfse.prestadorRazaoSocial || 'PARTICIPANTE',
        });
      }
    }
    for (const nfse of nfseEmissions) {
      if (nfse.tomadorCnpjCpf) {
        participantMap.set(nfse.tomadorCnpjCpf, {
          cnpj: nfse.tomadorCnpjCpf,
          name: nfse.tomadorRazaoSocial || 'PARTICIPANTE',
        });
      }
    }
    for (const nfe of nfeImports) {
      if (nfe.supplierCnpj) {
        participantMap.set(nfe.supplierCnpj, {
          cnpj: nfe.supplierCnpj,
          name: nfe.supplierName || 'PARTICIPANTE',
        });
      }
    }
    const participants = Array.from(participantMap.values());

    // Collect unique products from NFe items for register 0200
    const productMap = new Map<string, { code: string; desc: string; ncm: string; unit: string }>();
    for (const nfe of nfeImports) {
      for (const item of nfe.items) {
        const code = item.productCode || `PROD${item.itemNumber}`;
        if (!productMap.has(code)) {
          productMap.set(code, {
            code,
            desc: item.description || 'PRODUTO',
            ncm: item.ncm || '',
            unit: item.unit || 'UN',
          });
        }
      }
    }
    const products = Array.from(productMap.values());

    // Collect unique units for register 0190
    const unitSet = new Set<string>();
    for (const p of products) {
      if (p.unit) unitSet.add(p.unit);
    }
    const units = Array.from(unitSet);

    // Regime-based tax parameters
    const regime = company.taxRegime || 'LP';
    const isCumulativo = regime === 'LP';
    const pisAliq = isCumulativo ? 0.0065 : 0.0165; // 0.65% or 1.65%
    const cofinsAliq = isCumulativo ? 0.03 : 0.076;  // 3.00% or 7.60%
    const cstSaida = '01'; // Operacao tributavel - receita cumulativa/nao-cumulativa
    const cstEntrada = isCumulativo ? '70' : '50'; // 70=sem credito (cumulativo), 50=credito (nao-cumulativo)
    const codIncTrib = isCumulativo ? '2' : '1'; // 2=cumulativo, 1=nao-cumulativo
    const codCont = isCumulativo ? '51' : '01'; // 51=cumulativo aliq basica, 01=nao-cumulativo aliq basica

    // Accumulate totals for M blocks
    let totalBaseSaida = 0; // in cents
    let totalBaseEntradaA = 0; // NFS-e entrada services
    let totalBaseEntradaC = 0; // NFe goods entrada

    // Register counter for block 9
    const regCount = new Map<string, number>();
    const countReg = (reg: string) => regCount.set(reg, (regCount.get(reg) || 0) + 1);

    const lines: string[] = [];
    const addLine = (...fields: (string | number | null | undefined)[]) => {
      const reg = String(fields[0]);
      countReg(reg);
      lines.push(this.line(...fields));
    };

    const cnpjClean = (company.cnpj || '').replace(/\D/g, '');
    const codigoMunicipio = nfseConfig?.codigoMunicipio || '';

    /* ── BLOCK 0: Opening ─────────────────────────── */

    // 0000 - Opening
    addLine(
      '0000',
      '006',           // COD_VER - layout version
      '2',             // TIPO_ESCRIT: 2=EFD-Contribuicoes
      '0',             // IND_SIT_ESP: 0=abertura normal
      '',              // NUM_REC_ANTERIOR
      this.fmtDate(periodStart), // DT_INI
      this.fmtDate(periodEnd),   // DT_FIN
      company.name || '',        // NOME
      cnpjClean,                 // CNPJ
      company.state || '',       // UF
      codigoMunicipio,           // COD_MUN
      '',              // SUFRAMA
      '0',             // IND_NAT_PJ: 0=PJ em geral
      '0',             // IND_ATIV: 0=Industrial ou equiparado
    );

    // 0001 - Block 0 opening indicator
    addLine('0001', '0'); // IND_MOV: 0=has data

    // 0100 - Accountant
    addLine(
      '0100',
      company.contabilistName || '',
      this.cleanDoc(company.contabilistCpf || ''),
      company.contabilistCrc || '',
      this.cleanDoc(company.contabilistCnpj || ''),
      (company.contabilistCep || '').replace(/\D/g, ''),
      '',              // END (address)
      '',              // NUM
      '',              // COMPL
      '',              // BAIRRO
      '',              // FONE
      '',              // FAX
      company.contabilistEmail || '',
      codigoMunicipio, // COD_MUN
    );

    // 0110 - Regime de apuracao
    addLine(
      '0110',
      codIncTrib,      // COD_INC_TRIB
      '1',             // IND_APRO_CRED: 1=direta
      '1',             // COD_TIPO_CONT: 1=aliquota basica
      '',              // IND_REG_CUM (only for mixed regime)
    );

    // 0140 - Establishment
    addLine(
      '0140',
      cnpjClean,                 // CNPJ
      company.name || '',        // NOME
      company.state || '',       // UF
      company.ie || '',          // IE
      codigoMunicipio,           // COD_MUN
      company.im || '',          // IM
      '',                        // SUFRAMA
    );

    // 0150 - Participants
    for (const p of participants) {
      const doc = this.cleanDoc(p.cnpj);
      addLine(
        '0150',
        doc,             // COD_PART (using CNPJ as code)
        p.name,          // NOME
        doc.length === 14 ? '1' : '2', // COD_PAIS: not used, but CNPJ/CPF indicator
        doc.length <= 11 ? doc : '',    // CPF
        doc.length > 11 ? doc : '',     // CNPJ
        '',              // IE
        '',              // COD_MUN
        '',              // SUFRAMA
        '',              // END
        '',              // NUM
        '',              // COMPL
        '',              // BAIRRO
      );
    }

    // 0190 - Unit of measure
    for (const unit of units) {
      addLine('0190', unit, this.unitDescription(unit));
    }

    // 0200 - Products
    for (const p of products) {
      addLine(
        '0200',
        p.code,          // COD_ITEM
        p.desc,          // DESCR_ITEM
        '',              // COD_BARRA
        '',              // COD_ANT_ITEM
        p.unit,          // UNID_INV
        '',              // TIPO_ITEM
        p.ncm,           // COD_NCM
        '',              // EX_IPI
        '',              // COD_GEN
        '',              // COD_LST
        '',              // ALIQ_ICMS
      );
    }

    // 0990 - Block 0 closing
    const block0Count = lines.length + 1; // +1 for this line itself
    addLine('0990', String(block0Count));

    /* ── BLOCK A: Services (NFS-e) ────────────────── */

    const hasBlockA = nfseEntradas.length > 0 || nfseEmissions.length > 0;
    addLine('A001', hasBlockA ? '0' : '1');

    if (hasBlockA) {
      // A010 - Establishment for block A
      addLine('A010', cnpjClean);

      // NFS-e Entrada (services received - IND_OPER=0)
      for (const nfse of nfseEntradas) {
        const valorServicos = nfse.valorServicosCents || 0;
        const basePis = nfse.baseCalculoCents || valorServicos;
        const baseCofins = basePis;

        // Calculate PIS/COFINS for entrada
        const valorPis = nfse.valorPisCents || Math.round(basePis * pisAliq);
        const valorCofins = nfse.valorCofinsCents || Math.round(baseCofins * cofinsAliq);

        totalBaseEntradaA += basePis;

        // A100 - Document header
        addLine(
          'A100',
          '0',             // IND_OPER: 0=entrada (servico tomado)
          '0',             // IND_EMIT: 0=emissao propria (not applicable, but required)
          this.cleanDoc(nfse.prestadorCnpjCpf || ''), // COD_PART
          '00',            // COD_SIT: 00=regular
          nfse.numero || '',        // SER (used as NUM_DOC here)
          '',              // SUB
          nfse.numero || '',        // NUM_DOC
          '',              // CHV_NFSE
          this.fmtDate(nfse.dataEmissao),  // DT_DOC
          this.fmtDate(nfse.dataEmissao),  // DT_EXE_SERV
          this.fmtVal(valorServicos),      // VL_DOC
          '1',             // IND_PGTO: 1=a prazo
          this.fmtVal(0),  // VL_DESC
          this.fmtVal(basePis),     // VL_BC_PIS
          this.fmtVal(valorPis),    // VL_PIS
          this.fmtVal(baseCofins),  // VL_BC_COFINS
          this.fmtVal(valorCofins), // VL_COFINS
          this.fmtVal(0),  // VL_PIS_RET
          this.fmtVal(0),  // VL_COFINS_RET
          this.fmtVal(nfse.valorIssCents || 0), // VL_ISS
        );

        // A170 - Item detail (1 item per NFS-e)
        addLine(
          'A170',
          '1',             // NUM_ITEM
          nfse.itemListaServico || '', // COD_ITEM (service code)
          nfse.discriminacao ? nfse.discriminacao.substring(0, 100) : '', // DESCR_COMPL
          this.fmtVal(valorServicos),  // VL_ITEM
          this.fmtVal(0),  // VL_DESC
          '0',             // NAT_BC_CRED: 0=nao aplicavel (cumulativo) or applicable
          cstEntrada,      // IND_ORIG_CRED -> CST_PIS
          cstEntrada,      // CST_PIS
          this.fmtVal(basePis),     // VL_BC_PIS
          this.fmtAliq4(pisAliq * 100),  // ALIQ_PIS
          this.fmtVal(valorPis),    // VL_PIS
          cstEntrada,      // CST_COFINS
          this.fmtVal(baseCofins),  // VL_BC_COFINS
          this.fmtAliq4(cofinsAliq * 100), // ALIQ_COFINS
          this.fmtVal(valorCofins), // VL_COFINS
          '',              // COD_CTA
          '',              // COD_CCUS
        );
      }

      // NFS-e Emission (services rendered - IND_OPER=1)
      for (const nfse of nfseEmissions) {
        const valorServicos = nfse.valorServicos || 0;
        const basePis = valorServicos;
        const baseCofins = valorServicos;

        const valorPis = Math.round(basePis * pisAliq);
        const valorCofins = Math.round(baseCofins * cofinsAliq);

        totalBaseSaida += basePis;

        // A100 - Document header
        addLine(
          'A100',
          '1',             // IND_OPER: 1=saida (servico prestado)
          '0',             // IND_EMIT: 0=emissao propria
          this.cleanDoc(nfse.tomadorCnpjCpf || ''), // COD_PART
          '00',            // COD_SIT: 00=regular
          nfse.rpsSeries || '',     // SER
          '',              // SUB
          nfse.nfseNumber || String(nfse.rpsNumber), // NUM_DOC
          '',              // CHV_NFSE
          this.fmtDate(nfse.issuedAt || nfse.createdAt),  // DT_DOC
          this.fmtDate(nfse.issuedAt || nfse.createdAt),  // DT_EXE_SERV
          this.fmtVal(valorServicos),      // VL_DOC
          '1',             // IND_PGTO: 1=a prazo
          this.fmtVal(0),  // VL_DESC
          this.fmtVal(basePis),     // VL_BC_PIS
          this.fmtVal(valorPis),    // VL_PIS
          this.fmtVal(baseCofins),  // VL_BC_COFINS
          this.fmtVal(valorCofins), // VL_COFINS
          this.fmtVal(0),  // VL_PIS_RET
          this.fmtVal(0),  // VL_COFINS_RET
          this.fmtVal(nfse.valorIss || 0), // VL_ISS
        );

        // A170 - Item detail (1 item per NFS-e)
        addLine(
          'A170',
          '1',             // NUM_ITEM
          nfse.itemListaServico || '', // COD_ITEM
          nfse.discriminacao ? nfse.discriminacao.substring(0, 100) : '', // DESCR_COMPL
          this.fmtVal(valorServicos),  // VL_ITEM
          this.fmtVal(0),  // VL_DESC
          '0',             // NAT_BC_CRED
          cstSaida,        // CST_PIS
          cstSaida,        // CST_PIS (repeated for layout)
          this.fmtVal(basePis),     // VL_BC_PIS
          this.fmtAliq4(pisAliq * 100),  // ALIQ_PIS
          this.fmtVal(valorPis),    // VL_PIS
          cstSaida,        // CST_COFINS
          this.fmtVal(baseCofins),  // VL_BC_COFINS
          this.fmtAliq4(cofinsAliq * 100), // ALIQ_COFINS
          this.fmtVal(valorCofins), // VL_COFINS
          '',              // COD_CTA
          '',              // COD_CCUS
        );
      }
    }

    // A990 - Block A closing
    const blockAStart = lines.findIndex(l => l.startsWith('|A001|'));
    const blockACount = lines.length - blockAStart + 1;
    addLine('A990', String(blockACount));

    /* ── BLOCK C: NFe Goods ───────────────────────── */

    const hasBlockC = nfeImports.length > 0;
    addLine('C001', hasBlockC ? '0' : '1');

    if (hasBlockC) {
      // C010 - Establishment for block C
      addLine(
        'C010',
        cnpjClean,
        codIncTrib, // IND_ESCRIT: same as COD_INC_TRIB
      );

      for (const nfe of nfeImports) {
        // C100 - Document header
        addLine(
          'C100',
          '0',             // IND_OPER: 0=entrada
          '1',             // IND_EMIT: 1=terceiros
          this.cleanDoc(nfe.supplierCnpj || ''), // COD_PART
          '55',            // COD_MOD: 55=NFe
          nfe.codSit || '00', // COD_SIT
          nfe.nfeSeries || '', // SER
          nfe.nfeNumber || '', // NUM_DOC
          nfe.nfeKey || '',    // CHV_NFE
          this.fmtDate(nfe.issueDate), // DT_DOC
          this.fmtDate(nfe.issueDate), // DT_E_S (data entrada/saida)
          this.fmtVal(nfe.totalCents || 0), // VL_DOC
          '1',             // IND_PGTO: 1=a prazo
          this.fmtVal(nfe.descontoCents || 0), // VL_DESC
          this.fmtVal(0),  // VL_ABAT_NT
          this.fmtVal(nfe.totalCents || 0), // VL_MERC (valor total mercadorias)
          '9',             // IND_FRT: 9=sem frete
          this.fmtVal(nfe.freteCents || 0),     // VL_FRT
          this.fmtVal(nfe.seguroCents || 0),     // VL_SEG
          this.fmtVal(nfe.outrasDespCents || 0), // VL_OUT_DA
          this.fmtVal(nfe.baseIcmsCents || 0),   // VL_BC_ICMS
          this.fmtVal(nfe.icmsCents || 0),       // VL_ICMS
          this.fmtVal(nfe.baseIcmsStCents || 0), // VL_BC_ICMS_ST
          this.fmtVal(nfe.icmsStCents || 0),     // VL_ICMS_ST
          this.fmtVal(nfe.ipiCents || 0),        // VL_IPI
          this.fmtVal(nfe.pisCents || 0),        // VL_PIS
          this.fmtVal(nfe.cofinsCents || 0),     // VL_COFINS
          this.fmtVal(0),  // VL_PIS_ST
          this.fmtVal(0),  // VL_COFINS_ST
        );

        // C170 - Items
        for (const item of nfe.items) {
          const basePis = item.basePisCents || item.totalCents || 0;
          const baseCofins = item.baseCofinsCents || item.totalCents || 0;
          const itemPis = item.pisCents || Math.round(basePis * pisAliq);
          const itemCofins = item.cofinsCents || Math.round(baseCofins * cofinsAliq);

          totalBaseEntradaC += basePis;

          addLine(
            'C170',
            String(item.itemNumber),     // NUM_ITEM
            item.productCode || `PROD${item.itemNumber}`, // COD_ITEM
            item.description || '',      // DESCR_COMPL
            item.quantity != null ? String(item.quantity).replace('.', ',') : '1', // QTD
            item.unit || 'UN',           // UNID
            this.fmtVal(item.totalCents || 0), // VL_ITEM
            this.fmtVal(item.descontoCents || 0), // VL_DESC
            '0',             // IND_MOV: 0=sim
            item.cstPis || cstEntrada, // CST_PIS
            this.fmtVal(basePis),      // VL_BC_PIS
            this.fmtAliq4(item.aliqPis != null ? item.aliqPis : pisAliq * 100), // ALIQ_PIS
            this.fmtVal(itemPis),      // VL_PIS
            item.cstCofins || cstEntrada, // CST_COFINS
            this.fmtVal(baseCofins),   // VL_BC_COFINS
            this.fmtAliq4(item.aliqCofins != null ? item.aliqCofins : cofinsAliq * 100), // ALIQ_COFINS
            this.fmtVal(itemCofins),   // VL_COFINS
            item.cfop || '',           // CFOP
            '',              // COD_CTA
          );
        }
      }
    }

    // C990 - Block C closing
    const blockCStart = lines.findIndex(l => l.startsWith('|C001|'));
    const blockCCount = lines.length - blockCStart + 1;
    addLine('C990', String(blockCCount));

    /* ── BLOCK D: Empty (transport) ───────────────── */

    addLine('D001', '1'); // IND_MOV: 1=no data
    addLine('D990', '2'); // QTD_LIN_D

    /* ── BLOCK F: Empty (other documents) ─────────── */

    addLine('F001', '1'); // IND_MOV: 1=no data
    addLine('F990', '2'); // QTD_LIN_F

    /* ── BLOCK M: PIS/COFINS Apuration ────────────── */

    addLine('M001', '0'); // IND_MOV: 0=has data (always present for apuration)

    // Totals
    const totalBaseCredPis = totalBaseEntradaA + totalBaseEntradaC;
    const totalBaseCredCofins = totalBaseCredPis; // same base

    const totalPisSaida = Math.round(totalBaseSaida * pisAliq);
    const totalCofinsSaida = Math.round(totalBaseSaida * cofinsAliq);

    const totalPisCredito = isCumulativo ? 0 : Math.round(totalBaseCredPis * pisAliq);
    const totalCofinsCredito = isCumulativo ? 0 : Math.round(totalBaseCredCofins * cofinsAliq);

    const pisDevido = Math.max(0, totalPisSaida - totalPisCredito);
    const cofinsDevido = Math.max(0, totalCofinsSaida - totalCofinsCredito);

    // ── M100: Credito PIS (only for nao-cumulativo)
    if (!isCumulativo && totalBaseCredPis > 0) {
      addLine(
        'M100',
        '01',            // COD_CRED: 01=aliquota basica
        '0',             // IND_CRED_ORI: 0=operacoes no mercado interno
        this.fmtVal(totalBaseCredPis), // VL_BC_PIS
        this.fmtAliq4(pisAliq * 100),  // ALIQ_PIS
        this.fmtVal(totalPisCredito),  // VL_CRED
        this.fmtVal(totalPisCredito),  // VL_AJUS_ACRES (no adjustment)
        this.fmtVal(0),  // VL_AJUS_REDUC
        this.fmtVal(totalPisCredito),  // VL_CRED_DIF
        this.fmtVal(0),  // VL_CRED_DISP
        '0',             // IND_DESC_CRED: 0=total
        this.fmtVal(totalPisCredito),  // VL_CRED_DESC
        '',              // SLD_CRED
      );

      // M105: Detail of credit
      addLine(
        'M105',
        '01',            // NAT_BC_CRED: 01=bens para revenda
        '01',            // CST_PIS
        this.fmtVal(totalBaseCredPis), // VL_BC_PIS_TOT
        '',              // VL_BC_PIS_CUM
        this.fmtVal(totalBaseCredPis), // VL_BC_PIS_NC
        this.fmtVal(totalPisCredito),  // VL_BC_PIS
      );
    }

    // ── M200: PIS consolidation (contribuicao apurada)
    addLine(
      'M200',
      this.fmtVal(totalBaseSaida), // VL_TOT_CONT_NC_PER (base total)
      this.fmtVal(0),  // VL_TOT_CRED_DESC
      this.fmtVal(totalPisSaida), // VL_TOT_CONT_CUM_PER
      this.fmtVal(totalPisCredito), // VL_TOT_CRED_DESC_ANT
      this.fmtVal(pisDevido), // VL_TOT_CONT_NC_DEV
      this.fmtVal(0),  // VL_RET_NC
      this.fmtVal(0),  // VL_OUT_DED_NC
      this.fmtVal(pisDevido), // VL_CONT_NC_REC
      this.fmtVal(totalPisSaida), // VL_TOT_CONT_CUM_DEV (for cumulativo)
      this.fmtVal(0),  // VL_RET_CUM
      this.fmtVal(0),  // VL_OUT_DED_CUM
      this.fmtVal(pisDevido), // VL_CONT_CUM_REC
      this.fmtVal(pisDevido), // VL_TOT_CONT_DEV
    );

    // ── M210: PIS detail by COD_CONT
    if (totalBaseSaida > 0) {
      addLine(
        'M210',
        codCont,         // COD_CONT: 51 (cumulativo) or 01 (nao-cumulativo)
        this.fmtVal(totalBaseSaida), // VL_REC_BRT
        this.fmtVal(totalBaseSaida), // VL_BC_CONT
        this.fmtAliq4(pisAliq * 100), // ALIQ_PIS
        this.fmtVal(totalPisSaida), // VL_CONT_APUR
        this.fmtVal(0),  // VL_AJUS_ACRES
        this.fmtVal(0),  // VL_AJUS_REDUC
        this.fmtVal(totalPisSaida), // VL_CONT_DIFER
        this.fmtVal(0),  // VL_CONT_DIFER_ANT
        this.fmtVal(totalPisSaida), // VL_CONT_PER
      );
    }

    // ── M500: Credito COFINS (only for nao-cumulativo)
    if (!isCumulativo && totalBaseCredCofins > 0) {
      addLine(
        'M500',
        '01',            // COD_CRED
        '0',             // IND_CRED_ORI
        this.fmtVal(totalBaseCredCofins), // VL_BC_COFINS
        this.fmtAliq4(cofinsAliq * 100),  // ALIQ_COFINS
        this.fmtVal(totalCofinsCredito),  // VL_CRED
        this.fmtVal(totalCofinsCredito),  // VL_AJUS_ACRES
        this.fmtVal(0),  // VL_AJUS_REDUC
        this.fmtVal(totalCofinsCredito),  // VL_CRED_DIF
        this.fmtVal(0),  // VL_CRED_DISP
        '0',             // IND_DESC_CRED
        this.fmtVal(totalCofinsCredito),  // VL_CRED_DESC
        '',              // SLD_CRED
      );

      // M505: Detail of credit
      addLine(
        'M505',
        '01',            // NAT_BC_CRED
        '01',            // CST_COFINS
        this.fmtVal(totalBaseCredCofins), // VL_BC_COFINS_TOT
        '',              // VL_BC_COFINS_CUM
        this.fmtVal(totalBaseCredCofins), // VL_BC_COFINS_NC
        this.fmtVal(totalCofinsCredito),  // VL_BC_COFINS
      );
    }

    // ── M600: COFINS consolidation
    addLine(
      'M600',
      this.fmtVal(totalBaseSaida), // VL_TOT_CONT_NC_PER
      this.fmtVal(0),  // VL_TOT_CRED_DESC
      this.fmtVal(totalCofinsSaida), // VL_TOT_CONT_CUM_PER
      this.fmtVal(totalCofinsCredito), // VL_TOT_CRED_DESC_ANT
      this.fmtVal(cofinsDevido), // VL_TOT_CONT_NC_DEV
      this.fmtVal(0),  // VL_RET_NC
      this.fmtVal(0),  // VL_OUT_DED_NC
      this.fmtVal(cofinsDevido), // VL_CONT_NC_REC
      this.fmtVal(totalCofinsSaida), // VL_TOT_CONT_CUM_DEV
      this.fmtVal(0),  // VL_RET_CUM
      this.fmtVal(0),  // VL_OUT_DED_CUM
      this.fmtVal(cofinsDevido), // VL_CONT_CUM_REC
      this.fmtVal(cofinsDevido), // VL_TOT_CONT_DEV
    );

    // ── M610: COFINS detail by COD_CONT
    if (totalBaseSaida > 0) {
      addLine(
        'M610',
        codCont,         // COD_CONT
        this.fmtVal(totalBaseSaida), // VL_REC_BRT
        this.fmtVal(totalBaseSaida), // VL_BC_CONT
        this.fmtAliq4(cofinsAliq * 100), // ALIQ_COFINS
        this.fmtVal(totalCofinsSaida), // VL_CONT_APUR
        this.fmtVal(0),  // VL_AJUS_ACRES
        this.fmtVal(0),  // VL_AJUS_REDUC
        this.fmtVal(totalCofinsSaida), // VL_CONT_DIFER
        this.fmtVal(0),  // VL_CONT_DIFER_ANT
        this.fmtVal(totalCofinsSaida), // VL_CONT_PER
      );
    }

    // M990 - Block M closing
    const blockMStart = lines.findIndex(l => l.startsWith('|M001|'));
    const blockMCount = lines.length - blockMStart + 1;
    addLine('M990', String(blockMCount));

    /* ── BLOCK 1: Complementary info ──────────────── */

    addLine('1001', '1'); // IND_MOV: 1=no data (mostly)

    // 1010 - Informacao complementar (all N fields)
    addLine(
      '1010',
      'N', // PER_REF_CST99
      'N', // INC_IMOB
      'N', // EXP
      'N', // REC_FINANC
      'N', // ATIV_IMOB
      'N', // VL_OPER
      'N', // VL_OPER_PREST
      'N', // VL_OPER_DED
      'N', // VL_PATR_DOA
      'N', // VL_REC_COM
    );

    // 1990 - Block 1 closing
    addLine('1990', '3'); // 1001 + 1010 + 1990

    /* ── BLOCK 9: Closing ─────────────────────────── */

    addLine('9001', '0'); // IND_MOV: 0=has data

    // 9900 - Register count for each register type used
    // First pass: count what we have so far, plus the 9900 lines we will add,
    // plus 9990 and 9999
    const registersUsed = Array.from(regCount.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // We need to add 9900 entries for: each existing register + 9900 itself + 9990 + 9999
    const total9900Lines = registersUsed.length + 3; // +3 for 9900, 9990, 9999
    const totalBlock9Lines = 1 + total9900Lines + 1 + 1; // 9001 + 9900s + 9990 + 9999

    for (const [reg, count] of registersUsed) {
      addLine('9900', reg, String(count));
    }
    addLine('9900', '9900', String(total9900Lines));
    addLine('9900', '9990', '1');
    addLine('9900', '9999', '1');

    // 9990 - Block 9 closing
    addLine('9990', String(totalBlock9Lines));

    // 9999 - File closing
    addLine('9999', String(lines.length + 1)); // +1 for this line

    return lines.join('\r\n') + '\r\n';
  }

  /* ═══════════════════════════════════════════════════════
   *  HELPER METHODS
   * ═══════════════════════════════════════════════════════ */

  /** Build a pipe-delimited line: |FIELD1|FIELD2|...|FIELDN| */
  private line(...fields: (string | number | null | undefined)[]): string {
    const values = fields.map(f => (f == null ? '' : String(f)));
    return '|' + values.join('|') + '|';
  }

  /** Format a Date as ddmmaaaa. Returns empty string for null/undefined. */
  private fmtDate(date: Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }

  /**
   * Format cents as a decimal value with 2 decimal places and comma separator.
   * e.g., 123456 -> "1234,56"
   */
  private fmtVal(cents: number | null | undefined): string {
    if (cents == null || cents === 0) return '0,00';
    const abs = Math.abs(cents);
    const intPart = Math.floor(abs / 100);
    const decPart = abs % 100;
    const sign = cents < 0 ? '-' : '';
    return `${sign}${intPart},${String(decPart).padStart(2, '0')}`;
  }

  /**
   * Format a float aliquota with 4 decimal places and comma separator.
   * e.g., 1.65 -> "1,6500", 7.6 -> "7,6000"
   */
  private fmtAliq4(value: number | null | undefined): string {
    if (value == null) return '0,0000';
    const fixed = value.toFixed(4);
    return fixed.replace('.', ',');
  }

  /** Remove non-numeric characters from CNPJ/CPF */
  private cleanDoc(doc: string): string {
    return doc.replace(/\D/g, '');
  }

  /** Get description for common units of measure */
  private unitDescription(unit: string): string {
    const descs: Record<string, string> = {
      UN: 'UNIDADE',
      CX: 'CAIXA',
      KG: 'QUILOGRAMA',
      MT: 'METRO',
      M2: 'METRO QUADRADO',
      M3: 'METRO CUBICO',
      LT: 'LITRO',
      PC: 'PECA',
      HR: 'HORA',
      SV: 'SERVICO',
      GL: 'GALAO',
      TO: 'TONELADA',
      PR: 'PAR',
      JG: 'JOGO',
      RL: 'ROLO',
      SC: 'SACO',
      FD: 'FARDO',
      CT: 'CARTELA',
      TB: 'TUBO',
      BD: 'BALDE',
    };
    return descs[unit.toUpperCase()] || unit;
  }
}
