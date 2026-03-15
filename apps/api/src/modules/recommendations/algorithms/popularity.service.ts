import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PopularityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPopularCourses(limit: number) {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailUrl: true,
        avgRating: true,
        totalStudents: true,
        price: true,
        createdAt: true,
        _count: { select: { reviews: true } },
      },
    });

    const scored = courses.map((course) => {
      const wilsonScore = this.wilsonScoreLowerBound(course.avgRating, course._count.reviews);

      const ageInDays = (Date.now() - course.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const timeFactor = 1 / (1 + Math.log10(1 + ageInDays / 30));

      const score = wilsonScore * 0.7 + timeFactor * 0.3;

      return { ...course, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  wilsonScoreLowerBound(avgRating: number, reviewCount: number): number {
    if (reviewCount === 0) return 0;

    const p = (avgRating - 1) / 4; // Normalize 1-5 to 0-1
    const n = reviewCount;
    const z = 1.96; // 95% confidence

    const denominator = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

    return (centre - spread) / denominator;
  }
}
