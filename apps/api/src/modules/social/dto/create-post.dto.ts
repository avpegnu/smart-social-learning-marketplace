import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '@prisma/client';

export class CodeSnippetDto {
  @IsString()
  language!: string;

  @IsString()
  @MaxLength(5000)
  code!: string;
}

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  groupId?: string;
}
