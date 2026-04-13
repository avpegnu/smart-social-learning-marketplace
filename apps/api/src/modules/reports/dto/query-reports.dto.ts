import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryReportsDto extends PaginationDto {
  @IsOptional()
  @IsIn(['PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'])
  status?: string;

  @IsOptional()
  @IsString()
  targetType?: string;
}
