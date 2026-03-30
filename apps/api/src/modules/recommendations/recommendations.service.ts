import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentBasedService } from './algorithms/content-based.service';
import { CollaborativeService } from './algorithms/collaborative.service';
import { PopularityService } from './algorithms/popularity.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryRecommendationsDto } from './dto/query-recommendations.dto';

const COURSE_SELECT = {
  id: true,
  title: true,
  slug: true,
  thumbnailUrl: true,
  avgRating: true,
  totalStudents: true,
  price: true,
  originalPrice: true,
  level: true,
  instructor: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
    },
  },
  totalLessons: true,
  _count: {
    select: { reviews: true },
  },
} as const;

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ContentBasedService)
    private readonly contentBased: ContentBasedService,
    @Inject(CollaborativeService)
    private readonly collaborative: CollaborativeService,
    @Inject(PopularityService)
    private readonly popularity: PopularityService,
  ) {}

  async getRecommendations(userId: string | null, query: QueryRecommendationsDto) {
    const context = query.context ?? 'homepage';
    const limit = query.limit ?? 10;

    if (!userId) {
      return this.popularity.getPopularCourses(limit);
    }

    const enrolledCourseIds = (
      await this.prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      })
    ).map((e) => e.courseId);

    switch (context) {
      case 'course_detail':
        if (!query.courseId) {
          return this.popularity.getPopularCourses(limit);
        }
        return this.getContentBased(query.courseId, enrolledCourseIds, limit);

      case 'post_purchase':
        return this.getCollaborative(enrolledCourseIds, limit);

      case 'post_complete': {
        const lastCourseId = enrolledCourseIds[enrolledCourseIds.length - 1];
        if (!lastCourseId) {
          return this.popularity.getPopularCourses(limit);
        }
        return this.getContentBased(lastCourseId, enrolledCourseIds, limit);
      }

      case 'homepage':
      default:
        return this.getHybrid(enrolledCourseIds, limit);
    }
  }

  async computeAllSimilarities() {
    await this.contentBased.computeSimilarity();
    await this.collaborative.computeSimilarity();
    await this.computeHybrid();
  }

  private async getContentBased(courseId: string, excludeIds: string[], limit: number) {
    const similarities = await this.prisma.courseSimilarity.findMany({
      where: {
        courseId,
        similarCourseId: { notIn: excludeIds },
        algorithm: 'CONTENT',
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: { similarCourse: { select: COURSE_SELECT } },
    });

    return similarities.map((s) => ({
      ...s.similarCourse,
      score: s.score,
      reason: 'Based on similar topics',
    }));
  }

  private async getCollaborative(enrolledCourseIds: string[], limit: number) {
    if (enrolledCourseIds.length === 0) {
      return this.popularity.getPopularCourses(limit);
    }

    const similarities = await this.prisma.courseSimilarity.findMany({
      where: {
        courseId: { in: enrolledCourseIds },
        similarCourseId: { notIn: enrolledCourseIds },
        algorithm: 'COLLABORATIVE',
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: { similarCourse: { select: COURSE_SELECT } },
    });

    return similarities.map((s) => ({
      ...s.similarCourse,
      score: s.score,
      reason: 'Students who enrolled in similar courses also liked this',
    }));
  }

  private async getHybrid(enrolledCourseIds: string[], limit: number) {
    if (enrolledCourseIds.length === 0) {
      return this.popularity.getPopularCourses(limit);
    }

    const similarities = await this.prisma.courseSimilarity.findMany({
      where: {
        courseId: { in: enrolledCourseIds },
        similarCourseId: { notIn: enrolledCourseIds },
        algorithm: 'HYBRID',
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: { similarCourse: { select: COURSE_SELECT } },
    });

    if (similarities.length === 0) {
      return this.popularity.getPopularCourses(limit);
    }

    return similarities.map((s) => ({
      ...s.similarCourse,
      score: s.score,
      reason: 'Recommended for you',
    }));
  }

  private async computeHybrid() {
    const contentScores = await this.prisma.courseSimilarity.findMany({
      where: { algorithm: 'CONTENT' },
      select: { courseId: true, similarCourseId: true, score: true },
    });

    const collabScores = await this.prisma.courseSimilarity.findMany({
      where: { algorithm: 'COLLABORATIVE' },
      select: { courseId: true, similarCourseId: true, score: true },
    });

    const contentMap = new Map<string, number>();
    for (const s of contentScores) {
      contentMap.set(`${s.courseId}:${s.similarCourseId}`, s.score);
    }

    const collabMap = new Map<string, number>();
    for (const s of collabScores) {
      collabMap.set(`${s.courseId}:${s.similarCourseId}`, s.score);
    }

    const allKeys = new Set([...contentMap.keys(), ...collabMap.keys()]);

    for (const key of allKeys) {
      const [courseId, similarCourseId] = key.split(':') as [string, string];
      const cb = contentMap.get(key) ?? 0;
      const cf = collabMap.get(key) ?? 0;

      const hybridScore = cb * 0.5 + cf * 0.5;
      if (hybridScore <= 0) continue;

      await this.prisma.courseSimilarity.upsert({
        where: {
          courseId_similarCourseId_algorithm: {
            courseId,
            similarCourseId,
            algorithm: 'HYBRID',
          },
        },
        update: { score: hybridScore },
        create: {
          courseId,
          similarCourseId,
          score: hybridScore,
          algorithm: 'HYBRID',
        },
      });
    }
  }
}
