import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { GroupPrivacy } from '@prisma/client';

export class CreateGroupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;

  @IsOptional()
  @IsString()
  courseId?: string;
}
