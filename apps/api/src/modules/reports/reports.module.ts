import { Module } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AdminReportsController } from './admin-reports.controller';

@Module({
  imports: [JobsModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
