import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MonthlyArrayDto {
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @IsNumber({}, { each: true })
  temp!: number[];

  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(1, { each: true })
  humidity!: number[];

  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(15, { each: true }) // kWh/m²/dia — max realista
  radSol!: number[];
}

export class UpsertClimateDataDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  uf!: string;

  @IsOptional()
  @IsString()
  cidade?: string | null;

  @IsString()
  @IsNotEmpty()
  ufName!: string;

  @ValidateNested()
  @Type(() => MonthlyArrayDto)
  monthlyData!: MonthlyArrayDto;
}

export class AddCustomCityDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  uf!: string;

  @IsString()
  @IsNotEmpty()
  cidade!: string;

  @ValidateNested()
  @Type(() => MonthlyArrayDto)
  monthlyData!: MonthlyArrayDto;
}

export class UpdateClimateDataDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MonthlyArrayDto)
  monthlyData?: MonthlyArrayDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
