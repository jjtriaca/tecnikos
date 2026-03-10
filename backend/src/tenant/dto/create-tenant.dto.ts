import { IsString, IsOptional, MinLength, MaxLength, Matches, IsBoolean } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hifens',
  })
  slug: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  responsibleName?: string;

  @IsOptional()
  @IsString()
  responsibleEmail?: string;

  @IsOptional()
  @IsString()
  responsiblePhone?: string;

  @IsOptional()
  @IsBoolean()
  isMaster?: boolean;
}
