import { Module } from '@nestjs/common';
import { AiTutorService } from './ai-tutor.service';
import { AiTutorController } from './ai-tutor.controller';
import { EmbeddingsService } from './embeddings/embeddings.service';

@Module({
  controllers: [AiTutorController],
  providers: [AiTutorService, EmbeddingsService],
  exports: [EmbeddingsService],
})
export class AiTutorModule {}
