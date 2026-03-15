import { IsString, IsOptional, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CodeSnippetDto } from './create-question.dto';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;
}
