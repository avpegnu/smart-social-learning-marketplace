import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateOttDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  ott!: string;

  @ApiPropertyOptional({ example: 'student' })
  @IsOptional()
  @IsString()
  portal?: string;
}
