import { IsString, IsIn } from 'class-validator';

export class UpdatePartnerStatusDto {
  @IsString()
  @IsIn(['ATIVO', 'INATIVO', 'EM_TREINAMENTO', 'SUSPENSO'], {
    message: 'Status inválido',
  })
  status: string;
}
