import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { SubmitPlacementDto } from '../dto/submit-placement.dto';

@Injectable()
export class PlacementTestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async startTest(categoryId: string) {
    // Get questions — if categoryId provided, filter by related tags
    let questions = await this.prisma.placementQuestion.findMany();

    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          courses: {
            select: { courseTags: { select: { tagId: true } } },
          },
        },
      });

      const tagIds = [
        ...new Set(category?.courses.flatMap((c) => c.courseTags.map((ct) => ct.tagId)) ?? []),
      ];

      if (tagIds.length > 0) {
        questions = await this.prisma.placementQuestion.findMany({
          where: { tagIds: { hasSome: tagIds } },
        });
      }
    }

    // Group by level and pick 5 from each (balanced selection)
    const byLevel: Record<string, typeof questions> = {
      BEGINNER: [],
      INTERMEDIATE: [],
      ADVANCED: [],
    };
    for (const q of questions) {
      const level = q.level as string;
      if (byLevel[level]) byLevel[level].push(q);
    }

    // Shuffle each group
    for (const group of Object.values(byLevel)) {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j]!, group[i]!];
      }
    }

    // Take 5 per level, fill from others if a level has fewer
    const perLevel = 5;
    const picked: typeof questions = [];
    const leftover: typeof questions = [];

    for (const level of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
      const group = byLevel[level] ?? [];
      picked.push(...group.slice(0, perLevel));
      leftover.push(...group.slice(perLevel));
    }

    // If any level had < 5, fill remaining from leftover
    const remaining = 15 - picked.length;
    if (remaining > 0) {
      for (let i = leftover.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [leftover[i], leftover[j]] = [leftover[j]!, leftover[i]!];
      }
      picked.push(...leftover.slice(0, remaining));
    }

    // Final shuffle so levels aren't grouped together
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j]!, picked[i]!];
    }

    const selected = picked;

    // Return without answers
    return {
      questions: selected.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        level: q.level,
      })),
      totalQuestions: selected.length,
    };
  }

  async submitTest(userId: string, dto: SubmitPlacementDto) {
    // Grade by level
    const scores: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };
    const totals: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };

    for (const answer of dto.answers) {
      const question = await this.prisma.placementQuestion.findUnique({
        where: { id: answer.questionId },
      });
      if (!question) continue;

      const level = question.level as string;
      totals[level] = (totals[level] ?? 0) + 1;

      if (question.answer === answer.selectedOptionId) {
        scores[level] = (scores[level] ?? 0) + 1;
      }
    }

    const recommendedLevel = this.determineLevel(scores, totals);

    // Upsert result — one result per user, overwrite on re-test
    const test = await this.prisma.placementTest.upsert({
      where: { userId },
      update: {
        scores: scores as unknown as Prisma.InputJsonValue,
        recommendedLevel,
      },
      create: {
        userId,
        scores: scores as unknown as Prisma.InputJsonValue,
        recommendedLevel,
      },
    });

    // Get recommended courses
    const recommendedCourses = await this.prisma.course.findMany({
      where: { level: recommendedLevel, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, slug: true, thumbnailUrl: true, level: true },
      take: 5,
    });

    return {
      testId: test.id,
      level: recommendedLevel,
      scores,
      recommendedCourses,
    };
  }

  private determineLevel(
    scores: Record<string, number>,
    totals: Record<string, number>,
  ): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS' {
    const advancedRate = totals['ADVANCED']! > 0 ? scores['ADVANCED']! / totals['ADVANCED']! : 0;
    const intermediateRate =
      totals['INTERMEDIATE']! > 0 ? scores['INTERMEDIATE']! / totals['INTERMEDIATE']! : 0;
    const beginnerRate = totals['BEGINNER']! > 0 ? scores['BEGINNER']! / totals['BEGINNER']! : 0;

    if (advancedRate >= 0.7) return 'ADVANCED';
    if (intermediateRate >= 0.7) return 'INTERMEDIATE';
    if (beginnerRate >= 0.7) return 'BEGINNER';
    return 'BEGINNER';
  }
}
