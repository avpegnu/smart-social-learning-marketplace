import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ContentBasedService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async computeSimilarity() {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      include: { courseTags: { select: { tagId: true } } },
    });

    const allTagIds = [...new Set(courses.flatMap((c) => c.courseTags.map((t) => t.tagId)))];
    if (allTagIds.length === 0) return;

    for (let i = 0; i < courses.length; i++) {
      const courseA = courses[i]!;
      const tagsA = new Set(courseA.courseTags.map((t) => t.tagId));
      const vectorA = allTagIds.map((t) => (tagsA.has(t) ? 1 : 0));

      for (let j = i + 1; j < courses.length; j++) {
        const courseB = courses[j]!;
        const tagsB = new Set(courseB.courseTags.map((t) => t.tagId));
        const vectorB = allTagIds.map((t) => (tagsB.has(t) ? 1 : 0));

        const score = this.cosineSimilarity(vectorA, vectorB);
        if (score <= 0.1) continue;

        // Save both directions
        await this.prisma.courseSimilarity.upsert({
          where: {
            courseId_similarCourseId_algorithm: {
              courseId: courseA.id,
              similarCourseId: courseB.id,
              algorithm: 'CONTENT',
            },
          },
          update: { score },
          create: {
            courseId: courseA.id,
            similarCourseId: courseB.id,
            score,
            algorithm: 'CONTENT',
          },
        });

        await this.prisma.courseSimilarity.upsert({
          where: {
            courseId_similarCourseId_algorithm: {
              courseId: courseB.id,
              similarCourseId: courseA.id,
              algorithm: 'CONTENT',
            },
          },
          update: { score },
          create: {
            courseId: courseB.id,
            similarCourseId: courseA.id,
            score,
            algorithm: 'CONTENT',
          },
        });
      }
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
