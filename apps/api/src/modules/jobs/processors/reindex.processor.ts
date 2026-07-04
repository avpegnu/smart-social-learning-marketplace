import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EmbeddingsService } from '@/modules/ai-tutor/embeddings/embeddings.service';

// Re-index nội dung khóa cho AI Tutor, chạy nền (debounce theo jobId ở QueueService)
@Processor('reindex')
export class ReindexProcessor extends WorkerHost {
  private readonly logger = new Logger(ReindexProcessor.name);

  constructor(@Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'course') {
      this.logger.warn(`Unknown reindex job type: ${job.name}`);
      return;
    }

    const { courseId } = job.data as { courseId: string };

    // Model chưa nạp → ném để BullMQ thử lại (cron 5h cũng là lưới dự phòng)
    if (!this.embeddings.isReady()) {
      throw new Error('Embeddings model not ready');
    }

    await this.embeddings.indexCourseContent(courseId);
    this.logger.log(`Re-indexed course ${courseId}`);
  }
}
