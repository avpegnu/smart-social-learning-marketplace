import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryAdminUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
  role?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: string;
}
