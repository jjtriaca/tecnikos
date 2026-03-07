import { IsString, IsNotEmpty, IsEmail, IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class UpdateEmailConfigDto {
  @IsString()
  @IsNotEmpty()
  smtpHost: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort: number;

  @IsBoolean()
  smtpSecure: boolean;

  @IsString()
  @IsNotEmpty()
  smtpUser: string;

  @IsOptional()
  @IsString()
  smtpPass?: string; // Optional on update if password already exists

  @IsString()
  @IsNotEmpty()
  fromName: string;

  @IsEmail()
  fromEmail: string;
}

export class TestEmailConnectionDto {
  @IsString()
  @IsNotEmpty()
  smtpHost: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort: number;

  @IsBoolean()
  smtpSecure: boolean;

  @IsString()
  @IsNotEmpty()
  smtpUser: string;

  @IsString()
  @IsNotEmpty()
  smtpPass: string;
}

export class TestEmailSendDto {
  @IsEmail()
  toEmail: string;
}
