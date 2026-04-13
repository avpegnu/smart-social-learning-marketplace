import { Module } from '@nestjs/common';
import { AiTutorModule } from '@/modules/ai-tutor/ai-tutor.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { AdminUsersService } from './users/admin-users.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminApplicationsService } from './applications/admin-applications.service';
import { AdminApplicationsController } from './applications/admin-applications.controller';
import { AdminCoursesService } from './courses/admin-courses.service';
import { AdminCoursesController } from './courses/admin-courses.controller';
import { AdminWithdrawalsService } from './withdrawals/admin-withdrawals.service';
import { AdminWithdrawalsController } from './withdrawals/admin-withdrawals.controller';
import { AdminContentService } from './content/admin-content.service';
import { AdminContentController } from './content/admin-content.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminModerationService } from './moderation/admin-moderation.service';
import { AdminModerationController } from './moderation/admin-moderation.controller';

@Module({
  imports: [AiTutorModule, JobsModule],
  controllers: [
    AdminUsersController,
    AdminApplicationsController,
    AdminCoursesController,
    AdminWithdrawalsController,
    AdminContentController,
    AdminAnalyticsController,
    AdminModerationController,
  ],
  providers: [
    AdminUsersService,
    AdminApplicationsService,
    AdminCoursesService,
    AdminWithdrawalsService,
    AdminContentService,
    AdminAnalyticsService,
    AdminModerationService,
  ],
  exports: [AdminModerationService, AdminUsersService],
})
export class AdminModule {}
