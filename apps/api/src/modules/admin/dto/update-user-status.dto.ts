import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
