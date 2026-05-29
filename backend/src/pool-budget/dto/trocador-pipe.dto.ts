import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

// DTO da tubulacao do lado piscina do trocador de calor (Simulador, aba Trocador).
// Espelha o SolarPipeDto, mas a vazao vem do trocador (lado secundario, nao do
// solarReport) e adiciona a perda interna do proprio trocador.
export class TrocadorPipeDto {
  @IsNumber()
  @Min(0)
  @Max(500)
  comprimentoM!: number;

  @IsNumber()
  @Min(0)
  @Max(50)
  desnivelM!: number;

  // Vazao do lado piscina (secundario) do trocador, em m3/h. Dirige a perda de carga.
  @IsNumber()
  @Min(0)
  @Max(500)
  vazaoM3h!: number;

  // Perda de carga interna do trocador a vazao nominal (mca). Aditiva na altura.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  perdaInternaMca?: number;

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
