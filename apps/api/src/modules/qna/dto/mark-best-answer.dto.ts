import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class MarkBestAnswerDto {
  @ApiProperty({ description: 'Answer ID to mark as best' })
  @IsString()
  @IsNotEmpty()
  answerId!: string;
}
