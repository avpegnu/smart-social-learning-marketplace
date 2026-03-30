import {
  IsString,
  IsArray,
  IsEnum,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PlacementOptionDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;
}

export class CreatePlacementQuestionDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  question!: string;

  @ApiProperty({ type: [PlacementOptionDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PlacementOptionDto)
  options!: PlacementOptionDto[];

  @ApiProperty({ description: 'Must match one of the option IDs' })
  @IsString()
  answer!: string;

  @ApiProperty({ enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] })
  @IsEnum({ BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED' })
  level!: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tagIds!: string[];
}
