import { IsString, IsOptional, IsArray, IsBoolean, ValidateNested, IsNotEmpty } from 'class-validator';

export class CreateAutomationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Trigger definition: { entity, event, conditions[] } */
  @IsNotEmpty()
  trigger: Record<string, any>;

  /** Action definitions: [{ type, config }] */
  @IsArray()
  actions: Record<string, any>[];

  /** Canvas visual layout (optional) */
  @IsOptional()
  layout?: Record<string, any>;
}

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  trigger?: Record<string, any>;

  @IsOptional()
  @IsArray()
  actions?: Record<string, any>[];

  @IsOptional()
  layout?: Record<string, any>;
}
