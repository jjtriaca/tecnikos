import {
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  ArrayMinSize,
  IsEmail,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreatePartnerDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione pelo menos um tipo de parceiro' })
  @IsString({ each: true })
  @IsIn(['CLIENTE', 'FORNECEDOR', 'TECNICO'], { each: true })
  partnerTypes: string[];

  @IsString()
  @IsIn(['PF', 'PJ'], { message: 'Tipo de pessoa deve ser PF ou PJ' })
  personType: string;

  @IsOptional()
  @IsBoolean()
  isRuralProducer?: boolean;

  @IsString()
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CPF', 'CNPJ'], { message: 'Tipo de documento deve ser CPF ou CNPJ' })
  documentType?: string;

  @IsOptional()
  @IsString()
  ie?: string;

  @IsOptional()
  @IsString()
  im?: string;

  @IsOptional()
  @IsString()
  ieStatus?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email != null)
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  cep?: string;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressNumber?: string;

  @IsOptional()
  @IsString()
  addressComp?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'UF deve ter 2 letras maiúsculas' })
  state?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ATIVO', 'INATIVO', 'EM_TREINAMENTO'], { message: 'Status inválido' })
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializationIds?: string[];
}
