import { Injectable, Inject } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private embedder: unknown = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.warn('Failed to load embeddings model. AI features will be limited.', error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embeddings model not loaded');
    }

    const embedFn = this.embedder as (
      text: string,
      opts: Record<string, unknown>,
    ) => Promise<{ data: Float32Array }>;
    const output = await embedFn(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }

  isReady(): boolean {
    return this.embedder !== null;
  }

  async indexCourseContent(courseId: string) {
    if (!this.embedder) {
      throw new Error('Embeddings model not loaded — cannot index');
    }

    // Delete existing chunks for this course
    await this.prisma.$executeRaw`
      DELETE FROM course_chunks WHERE course_id = ${courseId}
    `;

    // Get all text lessons
    const lessons = await this.prisma.lesson.findMany({
      where: { chapter: { section: { courseId } }, type: 'TEXT' },
      select: { id: true, title: true, textContent: true },
    });

    for (const lesson of lessons) {
      const content = `${lesson.title}\n${lesson.textContent ?? ''}`;
      if (content.trim().length < 50) continue;

      const chunks = this.chunkText(content, 500, 50);

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk);
        const embeddingStr = `[${embedding.join(',')}]`;

        await this.prisma.$executeRaw`
          INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
          VALUES (gen_random_uuid(), ${courseId}, ${lesson.id}, ${chunk}, ${embeddingStr}::vector, now())
        `;
      }
    }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }
}
