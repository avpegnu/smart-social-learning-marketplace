import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class StartPlacementTestDto {
  @ApiPropertyOptional({
    description: 'Category ID for placement test; omit for a general test across all categories',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
