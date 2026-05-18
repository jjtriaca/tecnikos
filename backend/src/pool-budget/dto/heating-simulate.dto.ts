import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * DTO pra simulacao "calculo rapido" — todos inputs no body, sem persistir.
 * Usado pelo endpoint POST /pool-budgets/heating/simulate.
 */
export class HeatingSimulateDto {
  @IsNumber()
  @Min(0.1)
  areaM2!: number;

  @IsNumber()
  @Min(0.1)
  volumeM3!: number;

  @IsString()
  uf!: string;

  @ValidateIf((_o, v) => v !== null && v !== undefined && v !== '')
  @IsString()
  cidade?: string;

  @IsNumber()
  @Min(15)
  tempAguaDesejada!: number;

  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsNumber()
  tempAguaInicial?: number;

  @IsIn(['INTERNA', 'NULO', 'FRACO', 'MODERADO', 'FORTE'])
  vento!: string;

  @IsIn(['ABERTA', 'FECHADA'])
  tipoConstrucao!: string;

  @IsIn(['PRIVATIVA', 'COLETIVA'])
  tipoPiscina!: string;

  @IsBoolean()
  capaTermica!: boolean;

  @IsIn(['ANO_TODO', 'VERAO', 'INVERNO'])
  utilizacaoAno!: string;

  @IsIn(['MES_TODO', 'FIM_DE_SEMANA'])
  utilizacaoSemana!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hidromassagensQtd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cascataLarguraCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bordaInfinitaM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bordaInfinitaAlturaM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bordaInfinitaVazaoLminPorM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bordaInfinitaHorasAtivaDia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  horasFuncionamentoDia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaFuncionamento?: number;
}
