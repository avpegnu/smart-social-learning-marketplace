import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTagsDto {
  @ApiProperty({ type: [String], description: 'Array of tag IDs' })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tagIds!: string[];
}
