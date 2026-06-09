import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Divide um lancamento de CARTAO ja PAGO em N parcelas, uma por ciclo de fatura.
 * count: numero de parcelas (2..36). dryRun: simula (retorna o plano) sem gravar.
 */
export class SplitCardEntryDto {
  @IsInt()
  @Min(2)
  @Max(36)
  count: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
