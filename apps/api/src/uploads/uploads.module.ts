import { Module, forwardRef } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { MediaModule } from '@/modules/media/media.module';

@Module({
  imports: [forwardRef(() => MediaModule)],
  providers: [UploadsService],
  controllers: [UploadsController],
  exports: [UploadsService],
})
export class UploadsModule {}
