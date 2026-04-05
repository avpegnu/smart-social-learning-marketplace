import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateBankTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}

export class UpdateBankTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}
