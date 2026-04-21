import { Module } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { SocialModule } from '@/modules/social/social.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [JobsModule, SocialModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
