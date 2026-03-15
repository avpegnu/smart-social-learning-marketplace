import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryReportsDto extends PaginationDto {
  @IsOptional()
  @IsIn(['PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'])
  status?: string;

  @IsOptional()
  @IsIn(['POST', 'COMMENT', 'USER', 'COURSE', 'QUESTION'])
  targetType?: string;
}
