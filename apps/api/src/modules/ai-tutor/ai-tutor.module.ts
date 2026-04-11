import { Module } from '@nestjs/common';
import { AiTutorService } from './ai-tutor.service';
import { AiTutorController } from './ai-tutor.controller';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { TextExtractionService } from './text-extraction/text-extraction.service';

@Module({
  controllers: [AiTutorController],
  providers: [AiTutorService, EmbeddingsService, TextExtractionService],
  exports: [EmbeddingsService],
})
export class AiTutorModule {}
