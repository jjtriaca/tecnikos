import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EFD-ICMS/IPI SPED file generator.
 *
 * Generates pipe-delimited TXT files according to the Brazilian
 * EFD (Escrituracao Fiscal Digital) ICMS/IPI layout specification.
 *
 * Format rules:
 * - Each line starts and ends with |
 * - Fields separated by |
 * - Dates: ddmmaaaa
 * - Values: comma decimal, 2 places, no thousands sep (e.g. "1234,56")
 * - Empty fields: || (nothing between pipes)
 * - Line terminator: \r\n (CRLF)
 */
@Injectable()
export class SpedIcmsIpiGenerator {
  private readonly logger = new Logger(SpedIcmsIpiGenerator.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Format a Date as ddmmaaaa */
  private fmtDate(date: Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const aaaa = String(d.getFullYear());
    return `${dd}${mm}${aaaa}`;
  }

  /** Convert cents (integer) to comma-decimal string with 2 places. Null => '' */
  private fmtVal(cents: number | null | undefined): string {
    if (cents == null) return '';
    const abs = Math.abs(cents);
    const intPart = Math.floor(abs / 100);
    const decPart = abs % 100;
    const sign = cents < 0 ? '-' : '';
    return `${sign}${intPart},${String(decPart).padStart(2, '0')}`;
  }

  /** Format a float aliquota to 2-decimal comma string. Null => '' */
  private fmtAliq(value: number | null | undefined): string {
    if (value == null) return '';
    const fixed = value.toFixed(2);
    return fixed.replace('.', ',');
  }

  /** Format quantity (float) to 3-decimal comma string. Null => '' */
  private fmtQtd(value: number | null | undefined): string {
    if (value == null) return '';
    const fixed = value.toFixed(3);
    return fixed.replace('.', ',');
  }

  /** Format unit price (cents) to 4-decimal comma string. Null => '' */
  private fmtUnitPrice(cents: number | null | undefined): string {
    if (cents == null) return '';
    const val = cents / 100;
    const fixed = val.toFixed(4);
    return fixed.replace('.', ',');
  }

  /** Build a pipe-delimited line. Automatically wraps with | and appends \r\n */
  private line(...fields: (string | number | null | undefined)[]): string {
    const mapped = fields.map((f) => (f == null ? '' : String(f)));
    return `|${mapped.join('|')}|\r\n`;
  }

  /** Strip non-digits from a string */
  private digits(s: string | null | undefined): string {
    if (!s) return '';
    return s.replace(/\D/g, '');
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  async generate(
    companyId: string,
    year: number,
    month: number,
  ): Promise<string> {
    this.logger.log(
      `Generating EFD-ICMS/IPI for company=${companyId} period=${year}-${String(month).padStart(2, '0')}`,
    );

    // --- Fetch company ---
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    // --- Fetch NfseConfig for codigoMunicipio ---
    let codigoMunicipio = '';
    try {
      const nfseConfig = await this.prisma.nfseConfig.findUnique({
        where: { companyId },
      });
      codigoMunicipio = nfseConfig?.codigoMunicipio ?? '';
    } catch {
      // NfseConfig may not exist
    }

    // --- Date range for the period ---
    const dtIni = new Date(year, month - 1, 1);
    const dtFin = new Date(year, month, 0); // last day of month

    // --- Fetch NFe imports in the period ---
    const nfeImports = await this.prisma.nfeImport.findMany({
      where: {
        companyId,
        status: { not: 'CANCELLED' },
        issueDate: { gte: dtIni, lte: dtFin },
      },
      include: { items: true },
      orderBy: { issueDate: 'asc' },
    });

    // --- Collect unique participants (suppliers) ---
    const participantMap = new Map<
      string,
      {
        cnpj: string;
        name: string;
        ie: string;
        state: string;
        city: string;
        cep: string;
        addressStreet: string;
        addressNumber: string;
        addressComp: string;
        neighborhood: string;
      }
    >();

    const supplierCnpjs = [
      ...new Set(
        nfeImports
          .map((n) => this.digits(n.supplierCnpj))
          .filter((c) => c.length > 0),
      ),
    ];

    // Try to enrich from Partner table
    const partners =
      supplierCnpjs.length > 0
        ? await this.prisma.partner.findMany({
            where: {
              companyId,
              document: { in: supplierCnpjs },
            },
          })
        : [];

    const partnerByDoc = new Map(
      partners.map((p) => [this.digits(p.document), p]),
    );

    for (const nfe of nfeImports) {
      const cnpj = this.digits(nfe.supplierCnpj);
      if (!cnpj || participantMap.has(cnpj)) continue;

      const partner = partnerByDoc.get(cnpj);
      participantMap.set(cnpj, {
        cnpj,
        name: partner?.name ?? nfe.supplierName ?? '',
        ie: partner?.ie ?? '',
        state: partner?.state ?? '',
        city: partner?.city ?? '',
        cep: this.digits(partner?.cep),
        addressStreet: partner?.addressStreet ?? '',
        addressNumber: partner?.addressNumber ?? '',
        addressComp: partner?.addressComp ?? '',
        neighborhood: partner?.neighborhood ?? '',
      });
    }

    // --- Collect unique units ---
    const unitSet = new Set<string>();
    for (const nfe of nfeImports) {
      for (const item of nfe.items) {
        if (item.unit) unitSet.add(item.unit.toUpperCase());
      }
    }

    // --- Collect unique items (by productCode) ---
    const itemMap = new Map<
      string,
      { code: string; description: string; ncm: string; unit: string }
    >();
    for (const nfe of nfeImports) {
      for (const item of nfe.items) {
        const code = item.productCode || `ITEM_${item.id.substring(0, 8)}`;
        if (!itemMap.has(code)) {
          itemMap.set(code, {
            code,
            description: item.description || '',
            ncm: item.ncm || '',
            unit: (item.unit || 'UN').toUpperCase(),
          });
        }
      }
    }

    // --- Build register counter ---
    const regCounter = new Map<string, number>();
    const countReg = (reg: string, n = 1) => {
      regCounter.set(reg, (regCounter.get(reg) ?? 0) + n);
    };

    const lines: string[] = [];
    const push = (...args: string[]) => {
      for (const l of args) lines.push(l);
    };

    // =========================================================================
    // BLOCK 0 — Opening
    // =========================================================================

    const compCnpj = this.digits(company.cnpj);
    const compIe = this.digits(company.ie);
    const compCep = this.digits(company.cep);
    const codMun = this.digits(codigoMunicipio);
    const codFin = '0'; // 0 = Remessa do arquivo original
    const indPerf = company.fiscalProfile ?? 'A'; // A, B, or C

    // 0000 — Opening record
    push(
      this.line(
        '0000',
        '017', // COD_VER — EFD layout version (017 = 2024+)
        '0', // COD_FIN — 0=original
        this.fmtDate(dtIni), // DT_INI
        this.fmtDate(dtFin), // DT_FIN
        company.name ?? '', // NOME
        compCnpj, // CNPJ
        '', // CPF
        company.state ?? '', // UF
        compIe, // IE
        codMun, // COD_MUN
        '', // IM
        company.suframa ?? '', // SUFRAMA
        indPerf, // IND_PERFIL
        '1', // IND_ATIV — 1=Industrial/Equiparado
      ),
    );
    countReg('0000');

    // 0001 — Block 0 opening
    push(this.line('0001', '0')); // IND_MOV = 0 (has data)
    countReg('0001');

    // 0005 — Company complementary data
    push(
      this.line(
        '0005',
        company.tradeName ?? company.name ?? '', // FANTASIA
        compCep, // CEP
        company.addressStreet ?? '', // END
        company.addressNumber ?? '', // NUM
        company.addressComp ?? '', // COMPL
        company.neighborhood ?? '', // BAIRRO
        company.phone ? this.digits(company.phone) : '', // FONE
        '', // FAX
        company.email ?? '', // EMAIL
      ),
    );
    countReg('0005');

    // 0100 — Accountant data
    const contName = company.contabilistName ?? '';
    const contCpf = this.digits(company.contabilistCpf);
    const contCrc = company.contabilistCrc ?? '';
    const contCnpj = this.digits(company.contabilistCnpj);
    const contCep = this.digits(company.contabilistCep);
    const contPhone = this.digits(company.contabilistPhone);
    const contEmail = company.contabilistEmail ?? '';

    push(
      this.line(
        '0100',
        contName, // NOME
        contCpf, // CPF
        contCrc, // CRC
        contCnpj, // CNPJ
        contCep, // CEP
        '', // END
        '', // NUM
        '', // COMPL
        '', // BAIRRO
        contPhone, // FONE
        '', // FAX
        contEmail, // EMAIL
        contCnpj ? '1' : '3', // COD_MUN — not really municipality code, but required
      ),
    );
    countReg('0100');

    // 0150 — Participants
    let partIdx = 0;
    for (const [cnpj, p] of participantMap) {
      const codPart = `F${String(partIdx++).padStart(5, '0')}`;
      // Store participant code for later reference
      (p as any)._codPart = codPart;

      push(
        this.line(
          '0150',
          codPart, // COD_PART
          p.name, // NOME
          '', // COD_PAIS
          cnpj, // CNPJ
          '', // CPF
          p.ie, // IE
          p.state, // COD_MUN — should be municipality IBGE code; using state as fallback
          '', // SUFRAMA
          p.addressStreet, // END
          p.addressNumber, // NUM
          p.addressComp, // COMPL
          p.neighborhood, // BAIRRO
        ),
      );
      countReg('0150');
    }

    // 0190 — Units of measure
    for (const unit of unitSet) {
      push(
        this.line(
          '0190',
          unit, // UNID
          unit, // DESCR
        ),
      );
      countReg('0190');
    }

    // 0200 — Product/item identification
    for (const [code, item] of itemMap) {
      push(
        this.line(
          '0200',
          code, // COD_ITEM
          item.description, // DESCR_ITEM
          '', // COD_BARRA
          '', // COD_ANT_ITEM
          item.unit, // UNID_INV
          '00', // TIPO_ITEM — 00=Mercadoria para Revenda
          item.ncm, // COD_NCM
          '', // EX_IPI
          '', // COD_GEN
          '', // COD_LST
          '', // ALIQ_ICMS
          '', // CEST
        ),
      );
      countReg('0200');
    }

    // 0990 — Block 0 closing
    // Count will be updated at the end
    const block0CountIdx = lines.length;
    push(''); // placeholder
    countReg('0990');

    // =========================================================================
    // BLOCK B — Empty (ISS municipal services — not applicable for ICMS/IPI)
    // =========================================================================

    push(this.line('B001', '1')); // IND_MOV = 1 (no data)
    countReg('B001');
    push(this.line('B990', '2')); // QTD_LIN_B = 2 (B001 + B990)
    countReg('B990');

    // =========================================================================
    // BLOCK C — NFe documents (Mercadorias)
    // =========================================================================

    const hasNfe = nfeImports.length > 0;
    push(this.line('C001', hasNfe ? '0' : '1'));
    countReg('C001');

    // C190 aggregation data for the entire block
    const c190Map = new Map<
      string,
      {
        cstIcms: string;
        cfop: string;
        aliqIcms: number;
        totalCents: number;
        baseIcmsCents: number;
        icmsCents: number;
        baseIcmsStCents: number;
        icmsStCents: number;
        ipiCents: number;
      }
    >();

    let totalC170 = 0;
    let totalC190 = 0;

    if (hasNfe) {
      for (const nfe of nfeImports) {
        // Resolve participant code
        const supplierCnpj = this.digits(nfe.supplierCnpj);
        const participant = participantMap.get(supplierCnpj);
        const codPart = participant
          ? (participant as any)._codPart ?? ''
          : '';

        // C100 — Document header
        const indOper = nfe.indOper != null ? String(nfe.indOper) : '0'; // 0=Entrada
        const indEmit = '1'; // 1=Terceiros
        const codMod = '55'; // NFe
        const codSit = nfe.codSit ?? '00'; // 00=Regular

        push(
          this.line(
            'C100',
            indOper, // IND_OPER
            indEmit, // IND_EMIT
            codPart, // COD_PART
            codMod, // COD_MOD
            codSit, // COD_SIT
            nfe.nfeSeries ?? '', // SER
            nfe.nfeNumber ?? '', // NUM_DOC
            nfe.nfeKey ?? '', // CHV_NFE
            this.fmtDate(nfe.issueDate), // DT_DOC
            this.fmtDate(nfe.issueDate), // DT_E_S (same as issue for simplicity)
            this.fmtVal(nfe.totalCents), // VL_DOC
            '', // IND_PGTO (deprecated)
            this.fmtVal(nfe.descontoCents), // VL_DESC
            '', // VL_ABAT_NT
            this.fmtVal(nfe.totalCents), // VL_MERC — same as total for simplicity
            '9', // IND_FRT — 9=Sem frete
            this.fmtVal(nfe.freteCents), // VL_FRT
            this.fmtVal(nfe.seguroCents), // VL_SEG
            this.fmtVal(nfe.outrasDespCents), // VL_OUT_DA
            this.fmtVal(nfe.baseIcmsCents), // VL_BC_ICMS
            this.fmtVal(nfe.icmsCents), // VL_ICMS
            this.fmtVal(nfe.baseIcmsStCents), // VL_BC_ICMS_ST
            this.fmtVal(nfe.icmsStCents), // VL_ICMS_ST
            this.fmtVal(nfe.ipiCents), // VL_IPI
            this.fmtVal(nfe.pisCents), // VL_PIS
            this.fmtVal(nfe.cofinsCents), // VL_COFINS
            '', // VL_PIS_ST
            '', // VL_COFINS_ST
          ),
        );
        countReg('C100');

        // Per-NFe C190 aggregation
        const nfeC190Map = new Map<
          string,
          {
            cstIcms: string;
            cfop: string;
            aliqIcms: number;
            totalCents: number;
            baseIcmsCents: number;
            icmsCents: number;
            baseIcmsStCents: number;
            icmsStCents: number;
            ipiCents: number;
          }
        >();

        // C170 — Item details
        for (const item of nfe.items) {
          const itemCode =
            item.productCode || `ITEM_${item.id.substring(0, 8)}`;
          const cfop = item.cfop ?? '';
          const cstIcms = item.cstIcms ?? '';
          const aliqIcms = item.aliqIcms ?? 0;

          push(
            this.line(
              'C170',
              String(item.itemNumber), // NUM_ITEM
              itemCode, // COD_ITEM
              item.description ?? '', // DESCR_COMPL
              this.fmtQtd(item.quantity), // QTD
              (item.unit || 'UN').toUpperCase(), // UNID
              this.fmtUnitPrice(item.unitPriceCents), // VL_ITEM
              this.fmtVal(item.descontoCents), // VL_DESC
              '', // IND_MOV — for physical inventory
              cstIcms, // CST_ICMS
              cfop, // CFOP
              '', // COD_NAT
              this.fmtVal(item.baseIcmsCents), // VL_BC_ICMS
              this.fmtAliq(item.aliqIcms), // ALIQ_ICMS
              this.fmtVal(item.icmsCents), // VL_ICMS
              this.fmtVal(item.baseIcmsStCents), // VL_BC_ICMS_ST
              this.fmtAliq(item.aliqIcmsSt), // ALIQ_ST
              this.fmtVal(item.icmsStCents), // VL_ICMS_ST
              '', // IND_APUR
              item.cstIpi ?? '', // CST_IPI
              '', // COD_ENQ
              this.fmtVal(item.baseIpiCents), // VL_BC_IPI
              this.fmtAliq(item.aliqIpi), // ALIQ_IPI
              this.fmtVal(item.ipiCents), // VL_IPI
              item.cstPis ?? '', // CST_PIS
              this.fmtVal(item.basePisCents), // VL_BC_PIS
              this.fmtAliq(item.aliqPis), // ALIQ_PIS
              '', // QUANT_BC_PIS
              '', // ALIQ_PIS_QUANT
              this.fmtVal(item.pisCents), // VL_PIS
              item.cstCofins ?? '', // CST_COFINS
              this.fmtVal(item.baseCofinsCents), // VL_BC_COFINS
              this.fmtAliq(item.aliqCofins), // ALIQ_COFINS
              '', // QUANT_BC_COFINS
              '', // ALIQ_COFINS_QUANT
              this.fmtVal(item.cofinsCents), // VL_COFINS
              '', // COD_CTA
            ),
          );
          countReg('C170');
          totalC170++;

          // Aggregate for C190
          const c190Key = `${cstIcms}|${cfop}|${aliqIcms.toFixed(2)}`;
          const existing = nfeC190Map.get(c190Key);
          if (existing) {
            existing.totalCents += item.totalCents ?? 0;
            existing.baseIcmsCents += item.baseIcmsCents ?? 0;
            existing.icmsCents += item.icmsCents ?? 0;
            existing.baseIcmsStCents += item.baseIcmsStCents ?? 0;
            existing.icmsStCents += item.icmsStCents ?? 0;
            existing.ipiCents += item.ipiCents ?? 0;
          } else {
            nfeC190Map.set(c190Key, {
              cstIcms,
              cfop,
              aliqIcms,
              totalCents: item.totalCents ?? 0,
              baseIcmsCents: item.baseIcmsCents ?? 0,
              icmsCents: item.icmsCents ?? 0,
              baseIcmsStCents: item.baseIcmsStCents ?? 0,
              icmsStCents: item.icmsStCents ?? 0,
              ipiCents: item.ipiCents ?? 0,
            });
          }
        }

        // C190 — Analytical records per NFe
        for (const [, agg] of nfeC190Map) {
          push(
            this.line(
              'C190',
              agg.cstIcms, // CST_ICMS
              agg.cfop, // CFOP
              this.fmtAliq(agg.aliqIcms), // ALIQ_ICMS
              this.fmtVal(agg.totalCents), // VL_OPR
              this.fmtVal(agg.baseIcmsCents), // VL_BC_ICMS
              this.fmtVal(agg.icmsCents), // VL_ICMS
              this.fmtVal(agg.baseIcmsStCents), // VL_BC_ICMS_ST
              this.fmtVal(agg.icmsStCents), // VL_ICMS_ST
              '', // VL_RED_BC
              this.fmtVal(agg.ipiCents), // VL_IPI
              '', // COD_OBS
            ),
          );
          countReg('C190');
          totalC190++;

          // Also accumulate into global map for E110
          const gKey = `${agg.cstIcms}|${agg.cfop}|${agg.aliqIcms.toFixed(2)}`;
          const gExisting = c190Map.get(gKey);
          if (gExisting) {
            gExisting.totalCents += agg.totalCents;
            gExisting.baseIcmsCents += agg.baseIcmsCents;
            gExisting.icmsCents += agg.icmsCents;
            gExisting.baseIcmsStCents += agg.baseIcmsStCents;
            gExisting.icmsStCents += agg.icmsStCents;
            gExisting.ipiCents += agg.ipiCents;
          } else {
            c190Map.set(gKey, { ...agg });
          }
        }
      }
    }

    // C990 — Block C closing
    const blockCCount =
      1 + // C001
      (regCounter.get('C100') ?? 0) +
      totalC170 +
      totalC190 +
      1; // C990
    push(this.line('C990', String(blockCCount)));
    countReg('C990');

    // =========================================================================
    // BLOCK D — Empty (Transport services)
    // =========================================================================

    push(this.line('D001', '1'));
    countReg('D001');
    push(this.line('D990', '2'));
    countReg('D990');

    // =========================================================================
    // BLOCK E — ICMS Apuration
    // =========================================================================

    push(this.line('E001', '0')); // Always has E110
    countReg('E001');

    // E100 — Period of ICMS apuration
    push(
      this.line(
        'E100',
        this.fmtDate(dtIni), // DT_INI
        this.fmtDate(dtFin), // DT_FIN
      ),
    );
    countReg('E100');

    // Calculate ICMS totals for E110
    let totalIcmsCredito = 0; // credits (from purchases = entrada)
    let totalIcmsDebito = 0; // debits (from sales = saida)
    let totalIcmsStDebito = 0;
    let totalIcmsStCredito = 0;

    for (const [, agg] of c190Map) {
      // CFOPs starting with 1,2,3 = entrada (credit), 5,6,7 = saida (debit)
      const cfopFirst = agg.cfop ? agg.cfop.charAt(0) : '';
      if (['1', '2', '3'].includes(cfopFirst)) {
        totalIcmsCredito += agg.icmsCents;
        totalIcmsStCredito += agg.icmsStCents;
      } else if (['5', '6', '7'].includes(cfopFirst)) {
        totalIcmsDebito += agg.icmsCents;
        totalIcmsStDebito += agg.icmsStCents;
      }
    }

    const saldoIcms = totalIcmsDebito - totalIcmsCredito;
    const icmsARecolher = saldoIcms > 0 ? saldoIcms : 0;
    const icmsSaldoCredor = saldoIcms < 0 ? Math.abs(saldoIcms) : 0;

    // E110 — ICMS apuration
    push(
      this.line(
        'E110',
        this.fmtVal(totalIcmsDebito), // VL_TOT_DEBITOS
        '', // VL_AJ_DEBITOS
        this.fmtVal(totalIcmsDebito), // VL_TOT_AJ_DEBITOS
        this.fmtVal(totalIcmsCredito), // VL_TOT_CREDITOS
        '', // VL_AJ_CREDITOS
        this.fmtVal(totalIcmsCredito), // VL_TOT_AJ_CREDITOS
        '0,00', // VL_ESTORNOS_DEB
        '0,00', // VL_ESTORNOS_CRED
        this.fmtVal(icmsARecolher), // VL_SLD_APURADO
        '0,00', // VL_TOT_DED
        this.fmtVal(icmsARecolher), // VL_ICMS_RECOLHER
        this.fmtVal(icmsSaldoCredor), // VL_SLD_CREDOR_TRANSPORTAR
        '0,00', // DEB_ESP
      ),
    );
    countReg('E110');

    // E990 — Block E closing
    const blockECount =
      1 + // E001
      1 + // E100
      1 + // E110
      1; // E990
    push(this.line('E990', String(blockECount)));
    countReg('E990');

    // =========================================================================
    // BLOCK G — Empty (CIAP — ICMS credit on fixed assets)
    // =========================================================================

    push(this.line('G001', '1'));
    countReg('G001');
    push(this.line('G990', '2'));
    countReg('G990');

    // =========================================================================
    // BLOCK H — Empty (Physical inventory)
    // =========================================================================

    push(this.line('H001', '1'));
    countReg('H001');
    push(this.line('H990', '2'));
    countReg('H990');

    // =========================================================================
    // BLOCK K — Empty (Production control / Stock)
    // =========================================================================

    push(this.line('K001', '1'));
    countReg('K001');
    push(this.line('K990', '2'));
    countReg('K990');

    // =========================================================================
    // BLOCK 1 — Other information
    // =========================================================================

    push(this.line('1001', '0')); // IND_MOV = 0 because 1010 is required
    countReg('1001');

    // 1010 — Obligation to file other SPED blocks (all N = not applicable)
    push(
      this.line(
        '1010',
        'N', // IND_EXP — Exportacao
        'N', // IND_CCRF — CCRF
        'N', // IND_COMB — Combustiveis
        'N', // IND_USINA — Usina
        'N', // IND_VA — Veiculos novos
        'N', // IND_EE — Energia eletrica
        'N', // IND_CART — Cart. Cambio/Finan.
        'N', // IND_FORM — AIDF
        'N', // IND_AER — Aeronautico
        'N', // IND_GIAF1
        'N', // IND_GIAF3
        'N', // IND_GIAF4
        'N', // IND_REST_RESSARC_COMPL_ICMS
      ),
    );
    countReg('1010');

    // 1990 — Block 1 closing
    const block1Count = 1 + 1 + 1; // 1001 + 1010 + 1990
    push(this.line('1990', String(block1Count)));
    countReg('1990');

    // =========================================================================
    // BLOCK 9 — Closing / Control
    // =========================================================================

    push(this.line('9001', '0'));
    countReg('9001');

    // 9900 — Record count for each register type
    // First, count 9900 records themselves (one per register type + one for 9900 itself + 9990 + 9999)
    const allRegTypes = [...regCounter.keys()].sort();
    // We'll also have: 9900 entries for each register, plus 9900 for itself, 9990, 9999
    const total9900 = allRegTypes.length + 3; // +3 for 9900 itself, 9990, 9999
    countReg('9900', total9900);

    for (const reg of allRegTypes) {
      push(
        this.line(
          '9900',
          reg, // REG_BLC
          String(regCounter.get(reg) ?? 0), // QTD_REG_BLC
        ),
      );
    }

    // 9900 for 9900 itself
    push(this.line('9900', '9900', String(total9900)));
    // 9900 for 9990
    push(this.line('9900', '9990', '1'));
    // 9900 for 9999
    push(this.line('9900', '9999', '1'));

    // 9990 — Block 9 closing
    const block9Count =
      1 + // 9001
      total9900 + // 9900 entries
      1 + // 9990
      1; // 9999
    push(this.line('9990', String(block9Count)));

    // 9999 — File closing
    const totalLines = lines.length + 1; // +1 for 9999 itself
    push(this.line('9999', String(totalLines)));

    // =========================================================================
    // Fix placeholder for 0990
    // =========================================================================

    const block0Count =
      (regCounter.get('0000') ?? 0) +
      (regCounter.get('0001') ?? 0) +
      (regCounter.get('0005') ?? 0) +
      (regCounter.get('0100') ?? 0) +
      (regCounter.get('0150') ?? 0) +
      (regCounter.get('0190') ?? 0) +
      (regCounter.get('0200') ?? 0) +
      1; // 0990 itself
    lines[block0CountIdx] = this.line('0990', String(block0Count));

    this.logger.log(
      `EFD-ICMS/IPI generated: ${lines.length} lines, ${nfeImports.length} NFe(s)`,
    );

    return lines.join('');
  }
}
