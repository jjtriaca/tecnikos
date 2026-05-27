import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SolarRulesValuesDto {
  @IsInt() @Min(1) @Max(10) minColetoresPorBateria!: number;
  @IsInt() @Min(1) @Max(10) maxColetoresPorBateria!: number;
  @IsInt() @Min(10) @Max(50) maxAreaPorBateriaM2!: number;
  @IsInt() @Min(1) @Max(5) maxBateriasEmSerie!: number;
  @IsInt() @Min(150) @Max(400) vazaoProjetoLhPorM2!: number;
}

export class CreateSolarRuleDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @MinLength(1) @MaxLength(80) poolType!: string;
  @IsString() @MinLength(1) @MaxLength(80) model!: string;
  @ValidateNested() @Type(() => SolarRulesValuesDto) rules!: SolarRulesValuesDto;
}

export class UpdateSolarRuleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) poolType?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) model?: string;
  @IsOptional() @ValidateNested() @Type(() => SolarRulesValuesDto) rules?: SolarRulesValuesDto;
}
