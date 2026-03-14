import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'Course ID to add to cart' })
  @IsString()
  courseId!: string;

  @ApiPropertyOptional({
    description: 'Chapter ID for individual chapter purchase (null = full course)',
  })
  @IsOptional()
  @IsString()
  chapterId?: string;
}
