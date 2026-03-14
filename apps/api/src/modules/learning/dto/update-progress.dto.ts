import { IsArray, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProgressDto {
  @ApiPropertyOptional({ description: 'Current playback position in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lastPosition?: number;

  @ApiPropertyOptional({ description: 'Watched segments [[start, end], ...]' })
  @IsOptional()
  @IsArray()
  watchedSegments?: [number, number][];
}
