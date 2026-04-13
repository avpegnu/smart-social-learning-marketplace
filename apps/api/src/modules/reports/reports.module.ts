import { Module, forwardRef } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AdminReportsController } from './admin-reports.controller';

@Module({
  imports: [JobsModule, forwardRef(() => AdminModule)],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
