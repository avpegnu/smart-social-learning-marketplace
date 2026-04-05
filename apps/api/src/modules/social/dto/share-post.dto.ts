import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SharePostDto {
  @ApiPropertyOptional({ example: 'Check this out!', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;
}
