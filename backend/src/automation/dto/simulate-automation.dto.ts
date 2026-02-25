import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SimulateAutomationDto {
  @IsString()
  @IsNotEmpty()
  entityType: string; // 'SERVICE_ORDER' | 'PARTNER'

  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsOptional()
  @IsString()
  eventType?: string; // if not provided, uses the rule's event
}
