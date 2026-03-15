import { IsNumber, Max, Min } from 'class-validator';

export class CreateCommissionTierDto {
  @IsNumber()
  @Min(0)
  minRevenue!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  rate!: number;
}
