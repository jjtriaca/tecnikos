import { IsString, IsOptional, IsInt, IsBoolean, IsNumber, Min, MaxLength, MinLength } from 'class-validator';

export class SaveNfseConfigDto {
  @IsOptional() @IsString() focusNfeToken?: string;
  @IsOptional() @IsString() focusNfeEnvironment?: string;
  @IsOptional() @IsString() inscricaoMunicipal?: string;
  @IsOptional() @IsString() codigoMunicipio?: string;
  @IsOptional() @IsString() naturezaOperacao?: string;
  @IsOptional() @IsString() regimeEspecialTributacao?: string;
  @IsOptional() @IsBoolean() optanteSimplesNacional?: boolean;
  @IsOptional() @IsString() itemListaServico?: string;
  @IsOptional() @IsString() codigoCnae?: string;
  @IsOptional() @IsString() codigoTributarioMunicipio?: string;
  @IsOptional() @IsString() codigoTributarioNacional?: string;
  @IsOptional() @IsString() codigoTributarioNacionalServico?: string;
  @IsOptional() @IsString() nfseLayout?: string; // MUNICIPAL | NACIONAL
  @IsOptional() @IsNumber() aliquotaIss?: number;
  @IsOptional() @IsBoolean() autoEmitOnEntry?: boolean;
  @IsOptional() @IsBoolean() askOnFinishOS?: boolean;
  @IsOptional() @IsString() receiveWithoutNfse?: string; // WARN | BLOCK | IGNORE
  @IsOptional() @IsBoolean() sendEmailToTomador?: boolean;
  @IsOptional() @IsBoolean() afterEmissionSendWhatsApp?: boolean;
  @IsOptional() @IsString() rpsSeries?: string;
  @IsOptional() @IsString() defaultDiscriminacao?: string;
}

export class EmitNfseDto {
  @IsOptional() @IsString() serviceOrderId?: string;
  @IsString() financialEntryId: string;
  // Tomador (pode sobrescrever os dados do parceiro)
  @IsOptional() @IsString() tomadorCnpjCpf?: string;
  @IsOptional() @IsString() tomadorRazaoSocial?: string;
  @IsOptional() @IsString() tomadorEmail?: string;
  @IsOptional() @IsString() tomadorLogradouro?: string;
  @IsOptional() @IsString() tomadorNumero?: string;
  @IsOptional() @IsString() tomadorComplemento?: string;
  @IsOptional() @IsString() tomadorBairro?: string;
  @IsOptional() @IsString() tomadorCodigoMunicipio?: string;
  @IsOptional() @IsString() tomadorUf?: string;
  @IsOptional() @IsString() tomadorCep?: string;
  // Serviço (pode sobrescrever os padrões da config)
  @IsInt() @Min(1) valorServicosCents: number;
  @IsOptional() @IsNumber() aliquotaIss?: number;
  @IsOptional() @IsBoolean() issRetido?: boolean;
  @IsOptional() @IsString() itemListaServico?: string;
  @IsOptional() @IsString() codigoCnae?: string;
  @IsOptional() @IsString() codigoTributarioMunicipio?: string;
  @IsOptional() @IsString() discriminacao?: string;
  @IsOptional() @IsString() naturezaOperacao?: string;
  @IsOptional() @IsString() codigoMunicipioServico?: string;
  // Tipo de NFS-e e Obra (v1.00.88)
  @IsOptional() @IsString() tipoNota?: string; // SERVICO | OBRA
  @IsOptional() @IsString() obraId?: string;
  // Service code selecionado
  @IsOptional() @IsString() serviceCodeId?: string;
  // NBS selecionado na emissao
  @IsOptional() @IsString() codigoNbs?: string;
}

export class CreateNfseServiceCodeDto {
  @IsString() codigo: string;
  @IsOptional() @IsString() codigoNbs?: string;
  @IsString() descricao: string;
  @IsOptional() @IsString() tipo?: string; // SERVICO | OBRA
  @IsOptional() @IsNumber() aliquotaIss?: number;
  @IsOptional() @IsString() itemListaServico?: string;
  @IsOptional() @IsString() codigoCnae?: string;
  @IsOptional() @IsString() codigoTribMunicipal?: string;
}

export class UpdateNfseServiceCodeDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() codigoNbs?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsNumber() aliquotaIss?: number;
  @IsOptional() @IsString() itemListaServico?: string;
  @IsOptional() @IsString() codigoCnae?: string;
  @IsOptional() @IsString() codigoTribMunicipal?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CancelNfseDto {
  @IsString() @MinLength(15) @MaxLength(255) justificativa: string;
}

export class NfsePreviewDto {
  financialEntryId: string;
}
