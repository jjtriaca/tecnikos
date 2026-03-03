import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class UploadCertificateDto {
  @IsString()
  pfxPassword: string;
}

export class UpdateSefazConfigDto {
  @IsOptional()
  @IsIn(['PRODUCTION', 'HOMOLOGATION'])
  environment?: string;

  @IsOptional()
  @IsBoolean()
  autoFetchEnabled?: boolean;
}

export class SefazDocumentFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string; // FETCHED | IMPORTED | IGNORED | EVENT

  @IsOptional()
  @IsString()
  schema?: string; // resNFe | procNFe | resEvento

  @IsOptional()
  @IsString()
  situacao?: string; // 1=Autorizada | 2=Denegada | 3=Cancelada

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  supplierCnpj?: string;
}
