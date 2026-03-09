import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateServiceAddressDto {
  @IsString() partnerId: string;
  @IsString() label: string;
  @IsOptional() @IsString() cep?: string;
  @IsString() addressStreet: string;
  @IsOptional() @IsString() addressNumber?: string;
  @IsOptional() @IsString() addressComp?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsString() city: string;
  @IsString() @MaxLength(2) state: string;
}

export class UpdateServiceAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() addressNumber?: string;
  @IsOptional() @IsString() addressComp?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() @MaxLength(2) state?: string;
}
