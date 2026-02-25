import { IsEnum } from 'class-validator';
import { ServiceOrderStatus } from '@prisma/client';

export class UpdateServiceOrderStatusDto {
  @IsEnum(ServiceOrderStatus, { message: 'Status inválido' })
  status: ServiceOrderStatus;
}
