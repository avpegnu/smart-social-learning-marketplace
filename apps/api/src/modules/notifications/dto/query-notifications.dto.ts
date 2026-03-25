import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryNotificationsDto extends PaginationDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  read?: string;
}
