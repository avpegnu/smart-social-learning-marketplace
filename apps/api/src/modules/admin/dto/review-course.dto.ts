import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCourseDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
