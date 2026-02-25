import { IsInt, Min, Max, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGestorEvaluationDto {
  @IsUUID('4', { message: 'ID da OS inválido' })
  serviceOrderId: string;

  @Type(() => Number)
  @IsInt({ message: 'Nota deve ser um inteiro' })
  @Min(1, { message: 'Nota mínima é 1' })
  @Max(5, { message: 'Nota máxima é 5' })
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmitClientEvaluationDto {
  @Type(() => Number)
  @IsInt({ message: 'Nota deve ser um inteiro' })
  @Min(1, { message: 'Nota mínima é 1' })
  @Max(5, { message: 'Nota máxima é 5' })
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
