import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class ApiResponseDto<T> {
  @ApiProperty() data!: T;
  @ApiPropertyOptional() meta?: MetaDto;
}

export class ApiErrorDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() statusCode!: number;
  @ApiPropertyOptional() field?: string;
}
