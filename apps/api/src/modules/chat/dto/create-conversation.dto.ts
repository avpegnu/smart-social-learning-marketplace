import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  participantId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;

  @IsOptional()
  @IsString()
  name?: string;
}
