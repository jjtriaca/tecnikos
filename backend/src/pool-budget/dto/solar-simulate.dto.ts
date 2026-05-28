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

  // v5: persistidos em environmentParams (motor de calculo usara em fase futura)
  @IsOptional()
  @IsString()
  @IsIn(['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'])
  orientacaoTelhado?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  inclinacaoTelhadoGraus?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(40)
  temperaturaAguaInicial?: number;

  // v1.12.31: altura geometrica do telhado (m). Usada pela auto-selecao da bomba —
  // 1m ≈ 1 MCA estatica. Bombas com pressaoTrabalhoMca >= alturaTelhadoM atendem.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  alturaTelhadoM?: number;

  // v1.12.49: override de area/volume da piscina vindos do estado do formulario.
  // Quando presentes, sobrescrevem os valores de budget.poolDimensions APENAS no
  // calculo do solar. NAO modificam o cadastro do orcamento (poolDimensions fica
  // intacto). Permite operador testar dimensionamento com area diferente sem
  // precisar salvar o orcamento. Ao reabrir, volta ao valor do banco.
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaPiscinaM2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeM3?: number;

  // v1.12.83: capa termica e vento. Antes nao eram aceitos no recompute do solar,
  // entao mudar a capa no formulario nao afetava o calculo (backend lia env.capaTermica
  // do banco). Agora frontend envia esses 2 campos a cada Recalcular.
  @IsOptional()
  @IsIn(['SIM', 'NAO'])
  capa?: 'SIM' | 'NAO';

  @IsOptional()
  @IsIn(['FRACO', 'MODERADO', 'FORTE'])
  vento?: 'FRACO' | 'MODERADO' | 'FORTE';
}
