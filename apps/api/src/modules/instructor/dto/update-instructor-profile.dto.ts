import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QualificationItem {
  @IsString()
  name!: string;

  @IsString()
  institution!: string;

  @IsOptional()
  @IsString()
  year?: string;
}

export class UpdateInstructorProfileDto {
  @ApiPropertyOptional({ example: 'Senior React Developer' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({ example: 'Tôi có hơn 5 năm kinh nghiệm...' })
  @IsOptional()
  @IsString()
  biography?: string;

  @ApiPropertyOptional({ example: ['React', 'Node.js', 'TypeScript'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional({ example: '5 năm kinh nghiệm phát triển web' })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ example: [{ name: 'AWS', institution: 'Amazon', year: '2023' }] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualificationItem)
  qualifications?: QualificationItem[];

  @ApiPropertyOptional({ example: { github: 'https://github.com/user', linkedin: '' } })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
