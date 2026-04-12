import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from '@/mail/mail.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { RecommendationsModule } from '@/modules/recommendations/recommendations.module';
import { AiTutorModule } from '@/modules/ai-tutor/ai-tutor.module';
import { EmailProcessor } from './processors/email.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { FeedProcessor } from './processors/feed.processor';
import { CronService } from './cron/cron.service';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'email' }, { name: 'notification' }, { name: 'feed' }),
    MailModule,
    NotificationsModule,
    RecommendationsModule,
    AiTutorModule,
  ],
  providers: [EmailProcessor, NotificationProcessor, FeedProcessor, CronService, QueueService],
  exports: [QueueService],
})
export class JobsModule {}
