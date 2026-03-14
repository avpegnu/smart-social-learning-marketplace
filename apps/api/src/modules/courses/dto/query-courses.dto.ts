import { IsEnum, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CourseLevel, CourseStatus } from '@prisma/client';

export enum CourseSortBy {
  NEWEST = 'newest',
  POPULAR = 'popular',
  HIGHEST_RATED = 'highest_rated',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class QueryCoursesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Full-text search on title/description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Filter by language code (vi, en)' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Filter by tag ID' })
  @IsOptional()
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({ enum: CourseSortBy, default: CourseSortBy.NEWEST })
  @IsOptional()
  @IsEnum(CourseSortBy)
  sort?: CourseSortBy;

  @ApiPropertyOptional({ enum: CourseStatus, description: 'Filter by status (instructor view)' })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
