import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CloudinaryResultDto {
  @IsString()
  publicId!: string;

  @IsString()
  secureUrl!: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsString()
  format!: string;

  @IsNumber()
  bytes!: number;

  @IsOptional()
  @IsString()
  originalFilename?: string;
}

export class CompleteUploadDto {
  @ValidateNested()
  @Type(() => CloudinaryResultDto)
  cloudinaryResult!: CloudinaryResultDto;
}
