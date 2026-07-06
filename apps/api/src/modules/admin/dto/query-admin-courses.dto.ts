import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryAdminCoursesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  // Only non-DRAFT statuses are filterable; DRAFT never surfaces to admin
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'])
  status?: string;
}
