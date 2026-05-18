import { IsInt, Min } from 'class-validator';

export class UpsertEnergyTariffDto {
  @IsInt()
  @Min(1)
  kwhBRLCents!: number; // R$/kWh em centavos (ex: 115 = R$ 1.15)

  @IsInt()
  @Min(1)
  glpKgBRLCents!: number; // R$/Kg GLP

  @IsInt()
  @Min(1)
  gnM3BRLCents!: number; // R$/m³ GN
}
