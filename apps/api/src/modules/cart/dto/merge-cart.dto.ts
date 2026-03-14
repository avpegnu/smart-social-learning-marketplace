import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MergeCartItemDto {
  @ApiProperty()
  @IsString()
  courseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chapterId?: string;
}

export class MergeCartDto {
  @ApiProperty({ type: [MergeCartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MergeCartItemDto)
  items!: MergeCartItemDto[];
}
