import { IsString, IsOptional, IsBoolean, IsArray, IsInt, IsEnum, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChecklistItemDto {
  @IsString()
  text: string;

  @IsBoolean()
  checked: boolean;

  @IsOptional()
  @IsString()
  checkedAt?: string;
}

export class GeolocationDto {
  lat: number;
  lng: number;
  accuracy?: number;
}

export class DeviceInfoDto {
  @IsOptional() @IsString() browser?: string;
  @IsOptional() @IsString() os?: string;
  @IsOptional() @IsString() device?: string;
}

export class SubmitChecklistDto {
  @IsString()
  checklistClass: string;

  @IsString()
  stage: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items: ChecklistItemDto[];

  @IsOptional()
  @IsString()
  observation?: string;

  @IsBoolean()
  confirmed: boolean;

  @IsOptional()
  @IsString()
  technicianName?: string;

  @IsOptional()
  geolocation?: GeolocationDto;

  @IsOptional()
  deviceInfo?: DeviceInfoDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeInStage?: number;

  @IsOptional()
  @IsArray()
  skippedItems?: ChecklistItemDto[];

  @IsOptional()
  @IsBoolean()
  notifyOnSkip?: boolean;
}
