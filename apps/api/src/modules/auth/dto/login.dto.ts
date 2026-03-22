import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    example: 'student',
    description: 'Portal identifier for cookie isolation',
  })
  @IsOptional()
  @IsString()
  portal?: string;
}
