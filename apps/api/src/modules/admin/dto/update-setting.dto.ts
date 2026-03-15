import { IsString, IsDefined } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  key!: string;

  @IsDefined()
  value!: unknown;
}
