import { IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BankInfoDto {
  @ApiProperty({ example: 'MB Bank' })
  @IsString()
  bankName!: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  accountNumber!: string;

  @ApiProperty({ example: 'NGUYEN VAN A' })
  @IsString()
  accountName!: string;
}

export class CreateWithdrawalDto {
  @ApiProperty({ minimum: 200000 })
  @IsNumber()
  @Min(5000)
  amount!: number;

  @ApiProperty({ type: BankInfoDto })
  @ValidateNested()
  @Type(() => BankInfoDto)
  bankInfo!: BankInfoDto;
}
