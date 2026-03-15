import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewApplicationDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
