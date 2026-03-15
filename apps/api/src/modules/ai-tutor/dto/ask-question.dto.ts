import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}
