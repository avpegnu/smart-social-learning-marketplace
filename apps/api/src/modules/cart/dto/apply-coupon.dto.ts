import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ApplyCouponDto {
  @ApiProperty({ example: 'SUMMER2024' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;
}
