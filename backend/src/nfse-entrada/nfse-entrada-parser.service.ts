import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

/* ══════════════════════════════════════════════════════════════════════
   Parsed NFS-e Entrada — Normalized interface from any layout
   ══════════════════════════════════════════════════════════════════════ */

export interface ParsedNfseEntrada {
  layout: 'ABRASF' | 'NACIONAL';
  // Identification
  numero: string | null;
  codigoVerificacao: string | null;
  dataEmissao: string | null; // ISO string
  competencia: string | null; // "YYYY-MM"
  // Prestador
  prestadorCnpjCpf: string | null;
  prestadorRazaoSocial: string | null;
  prestadorIm: string | null;
  prestadorMunicipio: string | null;
  prestadorUf: string | null;
  // Tomador
  tomadorCnpj: string | null;
  // Service
  itemListaServico: string | null;
  codigoCnae: string | null;
  codigoTribMunicipio: string | null;
  codigoTribNacional: string | null;
  discriminacao: string | null;
  municipioServico: string | null;
  naturezaOperacao: string | null;
  exigibilidadeIss: string | null;
  // Values (in centavos)
  valorServicosCents: number | null;
  valorDeducoesCents: number | null;
  baseCalculoCents: number | null;
  aliquotaIss: number | null;
  issRetido: boolean;
  valorIssCents: number | null;
  valorPisCents: number | null;
  valorCofinsCents: number | null;
  valorInssCents: number | null;
  valorIrCents: number | null;
  valorCsllCents: number | null;
  outrasRetCents: number | null;
  descontoIncondCents: number | null;
  descontoCondCents: number | null;
  valorLiquidoCents: number | null;
  // Construction
  codigoObra: string | null;
  art: string | null;
}

/* ══════════════════════════════════════════════════════════════════════
   Parser Service
   ══════════════════════════════════════════════════════════════════════ */

@Injectable()
export class NfseEntradaParserService {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseTagValue: true,
      trimValues: true,
      isArray: (name) => ['CompNfse', 'Nfse', 'NFSe'].includes(name),
    });
  }

  /**
   * Detect layout and parse NFS-e XML
   */
  parse(xmlContent: string): ParsedNfseEntrada {
    if (!xmlContent || !xmlContent.trim()) {
      throw new BadRequestException('Conteudo XML vazio');
    }

    const parsed = this.parser.parse(xmlContent);

    // Detect layout
    if (this.isAbrasf(parsed)) {
      return this.parseAbrasf(parsed);
    }
    if (this.isNacional(parsed)) {
      return this.parseNacional(parsed);
    }

    throw new BadRequestException(
      'Layout XML nao reconhecido. Formatos suportados: ABRASF 2.04, Nacional (SPED).',
    );
  }

  /* ── Layout Detection ─────────────────────────────────── */

  private isAbrasf(parsed: any): boolean {
    // ABRASF: root may be CompNfse, ConsultarNfseResposta, or ListaNfse
    return !!(
      this.dig(parsed, 'CompNfse') ||
      this.dig(parsed, 'ConsultarNfseResposta') ||
      this.dig(parsed, 'ListaNfse') ||
      this.dig(parsed, 'Nfse', 'InfNfse')
    );
  }

  private isNacional(parsed: any): boolean {
    // Nacional: root is NFSe with infNFSe
    return !!(
      this.dig(parsed, 'NFSe') ||
      this.dig(parsed, 'nfseProc') ||
      this.dig(parsed, 'infNFSe')
    );
  }

  /* ── ABRASF Parser ────────────────────────────────────── */

  private parseAbrasf(parsed: any): ParsedNfseEntrada {
    // Navigate to InfNfse — may be nested under CompNfse > Nfse > InfNfse
    let infNfse = this.dig(parsed, 'CompNfse', 'Nfse', 'InfNfse');
    if (!infNfse && Array.isArray(this.dig(parsed, 'CompNfse'))) {
      const compArr = this.dig(parsed, 'CompNfse');
      infNfse = this.dig(compArr[0], 'Nfse', 'InfNfse');
      if (!infNfse && Array.isArray(this.dig(compArr[0], 'Nfse'))) {
        infNfse = this.dig(compArr[0], 'Nfse')[0]?.InfNfse;
      }
    }
    // Try alternate paths
    if (!infNfse) infNfse = this.dig(parsed, 'Nfse', 'InfNfse');
    if (!infNfse) infNfse = this.dig(parsed, 'ConsultarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse');
    if (!infNfse) infNfse = this.dig(parsed, 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse');
    // Array unwrap
    if (Array.isArray(infNfse)) infNfse = infNfse[0];

    if (!infNfse) {
      throw new BadRequestException('Nao foi possivel localizar InfNfse no XML ABRASF');
    }

    const servico = infNfse.Servico || {};
    const valores = servico.Valores || {};
    const prestador = infNfse.PrestadorServico || infNfse.Prestador || {};
    const idPrestador = prestador.IdentificacaoPrestador || {};
    const tomador = infNfse.TomadorServico || infNfse.Tomador || {};
    const idTomador = tomador.IdentificacaoTomador || {};
    const construcao = infNfse.ConstrucaoCivil || {};

    return {
      layout: 'ABRASF',
      numero: this.str(infNfse.Numero),
      codigoVerificacao: this.str(infNfse.CodigoVerificacao),
      dataEmissao: this.str(infNfse.DataEmissao),
      competencia: this.str(infNfse.Competencia),
      // Prestador
      prestadorCnpjCpf: this.extractCnpjCpf(idPrestador.CpfCnpj),
      prestadorRazaoSocial: this.str(prestador.RazaoSocial),
      prestadorIm: this.str(idPrestador.InscricaoMunicipal),
      prestadorMunicipio: this.str(prestador.Endereco?.CodigoMunicipio),
      prestadorUf: this.str(prestador.Endereco?.Uf),
      // Tomador
      tomadorCnpj: this.extractCnpjCpf(idTomador.CpfCnpj),
      // Service
      itemListaServico: this.str(servico.ItemListaServico),
      codigoCnae: this.str(servico.CodigoCnae),
      codigoTribMunicipio: this.str(servico.CodigoTributacaoMunicipio),
      codigoTribNacional: null,
      discriminacao: this.str(servico.Discriminacao),
      municipioServico: this.str(servico.CodigoMunicipio),
      naturezaOperacao: this.str(infNfse.NaturezaOperacao),
      exigibilidadeIss: this.str(servico.ExigibilidadeISS),
      // Values
      valorServicosCents: this.toCents(valores.ValorServicos),
      valorDeducoesCents: this.toCents(valores.ValorDeducoes),
      baseCalculoCents: this.toCents(valores.BaseCalculo),
      aliquotaIss: this.toFloat(valores.Aliquota),
      issRetido: valores.IssRetido === 1 || valores.IssRetido === '1' || valores.IssRetido === true,
      valorIssCents: this.toCents(valores.ValorIss),
      valorPisCents: this.toCents(valores.ValorPis),
      valorCofinsCents: this.toCents(valores.ValorCofins),
      valorInssCents: this.toCents(valores.ValorInss),
      valorIrCents: this.toCents(valores.ValorIr),
      valorCsllCents: this.toCents(valores.ValorCsll),
      outrasRetCents: this.toCents(valores.OutrasRetencoes),
      descontoIncondCents: this.toCents(valores.DescontoIncondicionado),
      descontoCondCents: this.toCents(valores.DescontoCondicionado),
      valorLiquidoCents: this.toCents(valores.ValorLiquidoNfse),
      // Construction
      codigoObra: this.str(construcao.CodigoObra),
      art: this.str(construcao.Art),
    };
  }

  /* ── Nacional Parser ──────────────────────────────────── */

  private parseNacional(parsed: any): ParsedNfseEntrada {
    // Navigate to infNFSe
    let infNfse = this.dig(parsed, 'NFSe', 'infNFSe');
    if (!infNfse) infNfse = this.dig(parsed, 'nfseProc', 'NFSe', 'infNFSe');
    if (Array.isArray(infNfse)) infNfse = infNfse[0];
    if (!infNfse) infNfse = this.dig(parsed, 'infNFSe');

    if (!infNfse) {
      throw new BadRequestException('Nao foi possivel localizar infNFSe no XML Nacional');
    }

    const dps = infNfse.DPS?.infDPS || infNfse.DPS || {};
    const emit = infNfse.emit || {};
    const toma = dps.toma || {};
    const serv = dps.serv || {};
    const valores = dps.valores || infNfse.valores || {};
    const tributos = serv.trib || {};
    const obra = dps.obra || {};

    // cTribNac -> Item LC 116 rough mapping
    const cTribNac = this.str(serv.cTribNac);

    return {
      layout: 'NACIONAL',
      numero: this.str(infNfse.nNFSe),
      codigoVerificacao: this.str(infNfse.cLocEmi), // Nacional uses cLocEmi
      dataEmissao: this.str(infNfse.dEmi) || this.str(dps.dhEmi),
      competencia: this.str(dps.dCompet) ? this.str(dps.dCompet)!.substring(0, 7) : null,
      // Prestador (= emitente)
      prestadorCnpjCpf: this.str(emit.CNPJ) || this.str(emit.CPF),
      prestadorRazaoSocial: this.str(emit.xNome),
      prestadorIm: this.str(emit.IM),
      prestadorMunicipio: this.str(emit.enderNac?.cMun),
      prestadorUf: this.str(emit.enderNac?.UF),
      // Tomador
      tomadorCnpj: this.str(toma.CNPJ) || this.str(toma.CPF),
      // Service
      itemListaServico: null, // Nacional uses cTribNac, not Item LC 116 directly
      codigoCnae: this.str(serv.cNBS),
      codigoTribMunicipio: this.str(serv.cTribMun),
      codigoTribNacional: cTribNac,
      discriminacao: this.str(serv.xDescServ),
      municipioServico: this.str(serv.cLocPrestacao || dps.cLocEmi),
      naturezaOperacao: null, // Nacional doesn't use naturezaOperacao
      exigibilidadeIss: null,
      // Values
      valorServicosCents: this.toCents(serv.vServPrest || serv.vServ),
      valorDeducoesCents: this.toCents(serv.vDed),
      baseCalculoCents: this.toCents(tributos.vBCISS || serv.vBC),
      aliquotaIss: this.toFloat(tributos.pAliq),
      issRetido: tributos.tpRetISSQN === 1 || tributos.tpRetISSQN === '1',
      valorIssCents: this.toCents(tributos.vISSQN || valores.vISSQN),
      valorPisCents: this.toCents(tributos.vPIS || valores.vPIS),
      valorCofinsCents: this.toCents(tributos.vCOFINS || valores.vCOFINS),
      valorInssCents: this.toCents(tributos.vINSS),
      valorIrCents: this.toCents(tributos.vIR),
      valorCsllCents: this.toCents(tributos.vCSLL),
      outrasRetCents: this.toCents(tributos.vOutrasRet),
      descontoIncondCents: this.toCents(serv.vDescIncond),
      descontoCondCents: this.toCents(serv.vDescCond),
      valorLiquidoCents: this.toCents(valores.vLiq),
      // Construction
      codigoObra: this.str(obra.cObra),
      art: this.str(obra.cART),
    };
  }

  /* ── Helpers ──────────────────────────────────────────── */

  private extractCnpjCpf(cpfCnpj: any): string | null {
    if (!cpfCnpj) return null;
    return this.str(cpfCnpj.Cnpj) || this.str(cpfCnpj.Cpf) || this.str(cpfCnpj.CNPJ) || this.str(cpfCnpj.CPF) || null;
  }

  private str(val: any): string | null {
    if (val == null || val === '') return null;
    return String(val).trim() || null;
  }

  private toFloat(val: any): number | null {
    if (val == null || val === '') return null;
    const n = parseFloat(String(val));
    return isNaN(n) ? null : n;
  }

  private toCents(val: any): number | null {
    if (val == null || val === '') return null;
    const n = parseFloat(String(val));
    if (isNaN(n)) return null;
    return Math.round(n * 100);
  }

  /** Dig into nested object safely */
  private dig(obj: any, ...keys: string[]): any {
    let current = obj;
    for (const key of keys) {
      if (current == null) return undefined;
      current = current[key];
      if (Array.isArray(current) && current.length === 1) {
        current = current[0];
      }
    }
    return current;
  }
}
