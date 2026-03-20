import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PendingActionDto {
  @IsString()
  blockId: string;

  @IsOptional()
  responseData?: Record<string, any>;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

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

  /** Deferred action from ACTION_BUTTONS — processed before the main advance */
  @IsOptional()
  @ValidateNested()
  @Type(() => PendingActionDto)
  pendingAction?: PendingActionDto;
}
