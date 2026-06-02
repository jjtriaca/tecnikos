import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Uma linha do Sistema de Borda Infinita (multi-linha, estilo "Dimensoes").
 * Tipo MASTER (cisterna principal) ou SLAVE (borda + captacao).
 * Storage final: poolDimensions.bordaInfinita[] (JSON livre). Este DTO valida o
 * endpoint de calculo POST /pool-budgets/borda-infinita/simulate.
 */
export class BordaLineDto {
  @IsIn(['MASTER', 'SLAVE'])
  tipo!: string;

  // ---- SLAVE: lamina de transbordo ----
  @IsOptional() @IsNumber() @Min(0) bordaLengthM?: number; // comprimento da borda/lamina
  @IsOptional() @IsNumber() @Min(0) alturaQuedaM?: number; // altura de queda da lamina
  @IsOptional() @IsNumber() @Min(0) filmeMm?: number; // espessura do filme (3-7mm) -> deriva vazao
  @IsOptional() @IsNumber() @Min(0) vazaoLminM?: number; // OU vazao direta L/min por metro
  @IsOptional() @IsNumber() @Min(0) horasDia?: number; // horas/dia ativa

  // ---- SLAVE: ponto de captacao (3 modos) ----
  @IsOptional() @IsIn(['RESERVATORIO', 'CANALETA', 'DIRETO']) captacao?: string;

  // captacao = RESERVATORIO (calha/mini-reservatorio com volume)
  @IsOptional() @IsNumber() @Min(0) reservComprM?: number;
  @IsOptional() @IsNumber() @Min(0) reservLargM?: number;
  @IsOptional() @IsNumber() @Min(0) reservProfM?: number;
  @IsOptional() @IsBoolean() reservAberto?: boolean; // aberto -> evapora; enterrado/tampado -> so volume

  // captacao = CANALETA (com ralos, sem volume relevante)
  @IsOptional() @IsNumber() @Min(0) canaletaComprM?: number;
  @IsOptional() @IsNumber() @Min(0) ralosQty?: number;
  @IsOptional() @IsNumber() @Min(0) raloDiamMm?: number;
  @IsOptional() @IsBoolean() canaletaAberta?: boolean;

  // ---- SLAVE: tubo de gravidade ate o master (so modos RESERVATORIO/CANALETA) ----
  @IsOptional() @IsNumber() @Min(0) tuboComprimentoM?: number;
  @IsOptional() @IsNumber() @Min(0) curvas90Qty?: number;
  @IsOptional() @IsNumber() @Min(0) tuboDesnivelM?: number; // diferenca de altura captacao->master

  // ---- MASTER: cisterna principal ----
  @IsOptional() @IsNumber() @Min(0) masterComprM?: number;
  @IsOptional() @IsNumber() @Min(0) masterLargM?: number;
  @IsOptional() @IsNumber() @Min(0) masterProfM?: number;
  @IsOptional() @IsBoolean() masterAberto?: boolean;
  @IsOptional() @IsBoolean() masterIsTanqueOndeCai?: boolean; // eh o proprio tanque onde a agua cai
  @IsOptional() @IsBoolean() masterCisternaPronta?: boolean; // usa cisterna plastica pronta -> so recomenda o volume (sem dims)
}

export class BordaInfinitaSimulateDto {
  @IsNumber() @Min(0) poolAreaM2!: number; // espelho d'agua (pra volume do master)
  @IsOptional() @IsNumber() @Min(0) poolVolumeM3?: number; // pra cross-check do % (5-10%)
  @IsOptional() @IsNumber() @Min(0) nBathers?: number;
  @IsOptional() @IsNumber() @Min(0) fillTargetRatio?: number; // enchimento alvo do tubo (default 0.5)
  @IsOptional() @IsNumber() @Min(0) manningN?: number; // override raro de rugosidade

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BordaLineDto)
  lines!: BordaLineDto[];
}
