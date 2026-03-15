import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryNotificationsDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : undefined))
  read?: boolean;
}
