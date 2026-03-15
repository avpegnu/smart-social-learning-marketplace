import { IsString, IsOptional, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CodeSnippetDto {
  @IsString()
  language!: string;

  @IsString()
  @MaxLength(5000)
  code!: string;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;
}
