import { Injectable, Inject, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private embedder: unknown = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.logger.log('Embeddings model loaded successfully');
    } catch (error) {
      this.logger.warn('Failed to load embeddings model. AI features will be limited.', error);
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
      throw new Error('Embeddings model not loaded');
    }

    this.logger.log(`Indexing course ${courseId}...`);

    // Delete existing chunks for this course
    await this.prisma.$executeRaw`
      DELETE FROM course_chunks WHERE course_id = ${courseId}
    `;

    // Fetch course with full content tree
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        shortDescription: true,
        description: true,
        learningOutcomes: true,
        prerequisites: true,
        sections: {
          orderBy: { order: 'asc' },
          select: {
            title: true,
            chapters: {
              orderBy: { order: 'asc' },
              select: {
                title: true,
                description: true,
                lessons: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    textContent: true,
                    quiz: {
                      select: {
                        questions: {
                          orderBy: { order: 'asc' },
                          select: {
                            question: true,
                            explanation: true,
                            options: {
                              select: { text: true, isCorrect: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) return;

    let chunksInserted = 0;

    // 1. Index course metadata
    const metaParts: string[] = [`[Course] ${course.title}`];
    if (course.shortDescription) metaParts.push(course.shortDescription);
    if (course.description) metaParts.push(stripHtml(course.description));

    const outcomes = course.learningOutcomes as string[] | null;
    if (outcomes?.length) {
      metaParts.push('Learning outcomes:\n' + outcomes.map((o) => `- ${o}`).join('\n'));
    }

    const prereqs = course.prerequisites as string[] | null;
    if (prereqs?.length) {
      metaParts.push('Prerequisites:\n' + prereqs.map((p) => `- ${p}`).join('\n'));
    }

    const metaText = metaParts.join('\n\n');
    chunksInserted += await this.insertChunks(courseId, null, metaText);

    // 2. Index sections, chapters, and lessons
    for (const section of course.sections) {
      for (const chapter of section.chapters) {
        // Chapter context line
        const chapterHeader = `[${section.title}] ${chapter.title}${chapter.description ? ': ' + chapter.description : ''}`;

        for (const lesson of chapter.lessons) {
          if (lesson.type === 'TEXT') {
            // TEXT lesson — index title + content
            const text = `${chapterHeader}\n[Lesson] ${lesson.title}\n${lesson.textContent ?? ''}`;
            chunksInserted += await this.insertChunks(courseId, lesson.id, text);
          } else if (lesson.type === 'QUIZ' && lesson.quiz) {
            // QUIZ lesson — index questions + answers + explanations
            const quizParts = [`${chapterHeader}\n[Quiz] ${lesson.title}`];
            for (const q of lesson.quiz.questions) {
              const options = q.options.map((o, i) => {
                const letter = String.fromCharCode(65 + i); // A, B, C, D
                return `${letter}) ${o.text}${o.isCorrect ? ' ✓' : ''}`;
              });
              quizParts.push(
                `Q: ${q.question}\n${options.join('\n')}${q.explanation ? '\nExplanation: ' + q.explanation : ''}`,
              );
            }
            chunksInserted += await this.insertChunks(courseId, lesson.id, quizParts.join('\n\n'));
          } else if (lesson.type === 'VIDEO') {
            // VIDEO lesson — index title only (no transcript)
            const text = `${chapterHeader}\n[Video Lesson] ${lesson.title}`;
            if (text.length >= 30) {
              chunksInserted += await this.insertChunks(courseId, lesson.id, text);
            }
          }
        }
      }
    }

    this.logger.log(`Course ${courseId} indexed: ${chunksInserted} chunks`);
  }

  private async insertChunks(
    courseId: string,
    lessonId: string | null,
    text: string,
  ): Promise<number> {
    if (text.trim().length < 30) return 0;

    const chunks = this.chunkText(text, 500, 50);
    let count = 0;

    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk);
      const embeddingStr = `[${embedding.join(',')}]`;

      await this.prisma.$executeRaw`
        INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
        VALUES (gen_random_uuid(), ${courseId}, ${lessonId}, ${chunk}, ${embeddingStr}::vector, now())
      `;
      count++;
    }

    return count;
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
