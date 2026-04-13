import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsIn(['REVIEWED', 'ACTION_TAKEN', 'DISMISSED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;

  @IsOptional()
  @IsIn(['DELETE_CONTENT', 'SUSPEND_USER'])
  action?: string;
}
