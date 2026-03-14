import { IsBoolean, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationChannel {
  @IsBoolean()
  inApp!: boolean;

  @IsBoolean()
  email!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    example: {
      POST_LIKED: { inApp: true, email: false },
      NEW_FOLLOWER: { inApp: true, email: false },
      ORDER_COMPLETED: { inApp: true, email: true },
      COURSE_APPROVED: { inApp: true, email: true },
    },
  })
  @IsObject()
  preferences!: Record<string, NotificationChannel>;
}
