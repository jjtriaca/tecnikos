import { IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateSuggestionDto {
  @IsIn(['MELHORIA', 'BUG', 'DUVIDA'])
  @IsOptional()
  category?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;
}

export class UpdateSuggestionStatusDto {
  @IsIn(['ABERTA', 'EM_ANALISE', 'IMPLEMENTADA', 'DESCARTADA'])
  status: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  adminNotes?: string;
}
