import { Module, forwardRef } from '@nestjs/common';
import { UploadsModule } from '@/uploads/uploads.module';
import { MediaService } from './media.service';

@Module({
  imports: [forwardRef(() => UploadsModule)],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
