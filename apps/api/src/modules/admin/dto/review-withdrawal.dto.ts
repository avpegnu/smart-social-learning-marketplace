import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewWithdrawalDto {
  @IsIn(['COMPLETED', 'REJECTED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
