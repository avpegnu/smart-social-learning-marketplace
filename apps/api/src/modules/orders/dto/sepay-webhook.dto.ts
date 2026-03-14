import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SepayWebhookDto {
  @ApiProperty() @IsString() gateway!: string;
  @ApiProperty() @IsString() transactionDate!: string;
  @ApiProperty() @IsString() accountNumber!: string;
  @ApiProperty() @IsString() transferType!: string;
  @ApiProperty() @IsNumber() transferAmount!: number;
  @ApiProperty() @IsString() content!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceCode?: string;
}
