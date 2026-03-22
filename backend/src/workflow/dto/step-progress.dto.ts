import { IsOptional, IsString } from 'class-validator';

export class StepProgressDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  /** V2: ID do bloco sendo completado */
  @IsOptional()
  @IsString()
  blockId?: string;

  /** V2: dados de resposta específicos do bloco (answers, GPS coords, checklist, etc.) */
  @IsOptional()
  responseData?: Record<string, any>;

  /** Timestamp do dispositivo do técnico (ISO string) — preserva horário exato do clique */
  @IsOptional()
  @IsString()
  clientTimestamp?: string;
}
