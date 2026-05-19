import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SolarSimulateDto {
  @IsNumber()
  @Min(0)
  areaPiscinaM2!: number;

  @IsNumber()
  @Min(0)
  volumeM3!: number;

  @IsNumber()
  @Min(20)
  @Max(40)
  tempDesejada!: number;

  @IsIn(['SIM', 'NAO'])
  capa!: 'SIM' | 'NAO';

  @IsIn(['FRACO', 'MODERADO', 'FORTE'])
  vento!: 'FRACO' | 'MODERADO' | 'FORTE';

  @IsNumber()
  @Min(0)
  @Max(10)
  extraColetoresPct!: number;

  @IsString()
  uf!: string;

  @IsOptional()
  @IsString()
  cidade?: string | null;

  // Modelo de coletor escolhido — opcional (se vazio usa default)
  @IsOptional()
  @IsString()
  collectorProductId?: string;
}

export class SolarRecomputeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  extraColetoresPct?: number;

  @IsOptional()
  @IsString()
  collectorProductId?: string;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(40)
  tempDesejada?: number;
}
