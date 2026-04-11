import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkIndexDto {
  @ApiProperty({ type: [String], description: 'Array of course IDs to index' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  courseIds!: string[];
}
