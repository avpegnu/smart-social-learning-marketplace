import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SepayWebhookDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() id?: number;
  @ApiProperty() @IsString() gateway!: string;
  @ApiProperty() @IsString() transactionDate!: string;
  @ApiProperty() @IsString() accountNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subAccount?: string | null;
  @ApiProperty() @IsString() transferType!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  @IsNumber()
  transferAmount!: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() accumulated?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string | null;
  @ApiProperty() @IsString() content!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}
