import { IsUUID } from 'class-validator';

export class AssignPartnerDto {
  @IsUUID('4', { message: 'ID do parceiro inválido' })
  partnerId: string;
}
