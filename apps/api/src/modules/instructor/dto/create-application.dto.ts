import { IsArray, IsOptional, IsString, ArrayMinSize, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({ example: ['JavaScript', 'React', 'Node.js'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  expertise!: string[];

  @ApiPropertyOptional({ example: '5 năm kinh nghiệm phát triển web với React và Node.js...' })
  @IsOptional()
  @IsString()
  @MinLength(50)
  experience?: string;

  @ApiPropertyOptional({ example: 'Muốn chia sẻ kiến thức và kinh nghiệm...' })
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiPropertyOptional({ example: ['https://res.cloudinary.com/cert1.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificateUrls?: string[];
}
