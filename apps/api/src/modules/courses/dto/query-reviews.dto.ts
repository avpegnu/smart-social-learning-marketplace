import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export enum ReviewSortBy {
  NEWEST = 'newest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

export class QueryReviewsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReviewSortBy, default: ReviewSortBy.NEWEST })
  @IsOptional()
  @IsEnum(ReviewSortBy)
  sort?: ReviewSortBy;
}
