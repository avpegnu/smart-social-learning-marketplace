import { IsString, IsOptional, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CodeSnippetDto } from './create-post.dto';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;

  @IsOptional()
  @IsString()
  linkUrl?: string;
}
