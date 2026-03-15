import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryRecommendationsDto {
  @IsOptional()
  @IsString()
  context?: 'homepage' | 'course_detail' | 'post_purchase' | 'post_complete';

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
