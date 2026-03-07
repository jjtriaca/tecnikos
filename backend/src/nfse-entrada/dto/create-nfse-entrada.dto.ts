export class CreateNfseEntradaDto {
  numero?: string;
  codigoVerificacao?: string;
  dataEmissao?: string;
  competencia?: string;

  // Prestador
  prestadorId?: string;
  prestadorCnpjCpf?: string;
  prestadorRazaoSocial?: string;
  prestadorIm?: string;
  prestadorMunicipio?: string;
  prestadorUf?: string;

  // Service
  itemListaServico?: string;
  codigoCnae?: string;
  codigoTribMunicipio?: string;
  discriminacao?: string;
  municipioServico?: string;

  // Values (centavos)
  valorServicosCents?: number;
  baseCalculoCents?: number;
  aliquotaIss?: number;
  issRetido?: boolean;
  valorIssCents?: number;
  valorPisCents?: number;
  valorCofinsCents?: number;
  valorInssCents?: number;
  valorIrCents?: number;
  valorCsllCents?: number;
  outrasRetCents?: number;
  descontoIncondCents?: number;
  valorLiquidoCents?: number;

  // Construction
  codigoObra?: string;
  art?: string;
}
