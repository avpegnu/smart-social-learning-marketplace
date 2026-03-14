import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCouponDto {
  @ApiProperty({ example: 'REACT2024' })
  @IsString()
  @MinLength(1)
  code!: string;
}
