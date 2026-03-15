import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CollaborativeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async computeSimilarity() {
    const enrollments = await this.prisma.enrollment.findMany({
      select: { userId: true, courseId: true },
    });

    // Group users by course
    const courseUsers = new Map<string, Set<string>>();
    for (const e of enrollments) {
      if (!courseUsers.has(e.courseId)) courseUsers.set(e.courseId, new Set());
      courseUsers.get(e.courseId)!.add(e.userId);
    }

    const courseIds = [...courseUsers.keys()];

    for (let i = 0; i < courseIds.length; i++) {
      for (let j = i + 1; j < courseIds.length; j++) {
        const setA = courseUsers.get(courseIds[i]!)!;
        const setB = courseUsers.get(courseIds[j]!)!;

        let intersection = 0;
        for (const u of setA) {
          if (setB.has(u)) intersection++;
        }
        const union = setA.size + setB.size - intersection;
        const score = union > 0 ? intersection / union : 0;

        if (score <= 0) continue;

        const courseAId = courseIds[i]!;
        const courseBId = courseIds[j]!;

        // Save both directions
        await this.prisma.courseSimilarity.upsert({
          where: {
            courseId_similarCourseId_algorithm: {
              courseId: courseAId,
              similarCourseId: courseBId,
              algorithm: 'COLLABORATIVE',
            },
          },
          update: { score },
          create: {
            courseId: courseAId,
            similarCourseId: courseBId,
            score,
            algorithm: 'COLLABORATIVE',
          },
        });

        await this.prisma.courseSimilarity.upsert({
          where: {
            courseId_similarCourseId_algorithm: {
              courseId: courseBId,
              similarCourseId: courseAId,
              algorithm: 'COLLABORATIVE',
            },
          },
          update: { score },
          create: {
            courseId: courseBId,
            similarCourseId: courseAId,
            score,
            algorithm: 'COLLABORATIVE',
          },
        });
      }
    }
  }
}
