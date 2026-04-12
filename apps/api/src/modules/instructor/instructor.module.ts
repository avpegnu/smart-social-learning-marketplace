import { Module } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';

@Module({
  imports: [JobsModule],
  controllers: [InstructorController],
  providers: [InstructorService],
  exports: [InstructorService],
})
export class InstructorModule {}
