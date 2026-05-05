import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePoolProjectPhotoDto {
  @ApiProperty({ description: 'URL da foto (CDN ou /uploads)' })
  @IsString()
  fileUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ description: 'Quando a foto foi tirada (ISO)' })
  @IsOptional()
  @IsDateString()
  takenAt?: string;
}
