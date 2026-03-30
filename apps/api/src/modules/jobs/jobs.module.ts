import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from '@/mail/mail.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { RecommendationsModule } from '@/modules/recommendations/recommendations.module';
import { EmailProcessor } from './processors/email.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { FeedProcessor } from './processors/feed.processor';
import { CronService } from './cron/cron.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'email' }, { name: 'notification' }, { name: 'feed' }),
    MailModule,
    NotificationsModule,
    RecommendationsModule,
  ],
  providers: [EmailProcessor, NotificationProcessor, FeedProcessor, CronService],
})
export class JobsModule {}
