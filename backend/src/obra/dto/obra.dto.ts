import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateObraDto {
  @IsString() partnerId: string;
  @IsString() @MinLength(3) name: string;
  @IsString() @MinLength(14) cno: string; // CNO format: XX.XXX.XXXXX/XX
  @IsString() addressStreet: string;
  @IsString() addressNumber: string;
  @IsOptional() @IsString() addressComp?: string;
  @IsString() neighborhood: string;
  @IsString() city: string;
  @IsString() @MaxLength(2) state: string;
  @IsString() cep: string;
  @IsOptional() @IsString() ibgeCode?: string;
}

export class UpdateObraDto {
  @IsOptional() @IsString() @MinLength(3) name?: string;
  @IsOptional() @IsString() @MinLength(14) cno?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() addressNumber?: string;
  @IsOptional() @IsString() addressComp?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() @MaxLength(2) state?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() ibgeCode?: string;
}
