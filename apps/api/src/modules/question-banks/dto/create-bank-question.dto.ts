import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class BankOptionDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateBankQuestionDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => BankOptionDto)
  options!: BankOptionDto[];
}

export class BatchCreateBankQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBankQuestionDto)
  questions!: CreateBankQuestionDto[];
}
