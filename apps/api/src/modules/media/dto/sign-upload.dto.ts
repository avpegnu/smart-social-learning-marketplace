import { IsIn, IsOptional, IsString } from 'class-validator';

export class SignUploadDto {
  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsIn(['VIDEO', 'IMAGE', 'ATTACHMENT'])
  type!: string;

  @IsOptional()
  @IsString()
  folder?: string;
}
