import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class StartPlacementTestDto {
  @ApiProperty({ description: 'Category ID for placement test' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}
