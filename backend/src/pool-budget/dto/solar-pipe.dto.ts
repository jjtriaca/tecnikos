import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SolarPipeDto {
  @IsNumber()
  @Min(0)
  @Max(500)
  comprimentoM!: number;

  @IsNumber()
  @Min(0)
  @Max(50)
  desnivelM!: number;

  @IsOptional()
  @IsIn(['PVC', 'CPVC', 'PPR', 'COBRE'])
  material?: 'PVC' | 'CPVC' | 'PPR' | 'COBRE';

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200)
  diametroMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fatorSegurancaPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  joelho90Qty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  teQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  registroQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  valvulaQty?: number;
}
