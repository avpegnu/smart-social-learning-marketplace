# Sub-phase 5.10d — RECOMMENDATIONS MODULE

> Course recommendations using 3 algorithms: Content-Based (Cosine), Collaborative (Jaccard), Popularity (Wilson Score).
> Pre-computed similarity stored in CourseSimilarity table, read at request time.
> Prisma model: CourseSimilarity

---

## Step 1: Module Structure

```
src/modules/recommendations/
├── recommendations.module.ts
├── recommendations.service.ts
├── recommendations.service.spec.ts
├── recommendations.controller.ts
├── algorithms/
│   ├── content-based.service.ts
│   ├── content-based.service.spec.ts
│   ├── collaborative.service.ts
│   ├── collaborative.service.spec.ts
│   └── popularity.service.ts
└── dto/
    └── query-recommendations.dto.ts
```

---

## Step 2: DTO

### query-recommendations.dto.ts

```typescript
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryRecommendationsDto {
  @IsOptional()
  @IsString()
  context?: 'homepage' | 'course_detail' | 'post_purchase' | 'post_complete';

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
```

---

## Step 3: Algorithm Services

### 3.1 content-based.service.ts — Cosine Similarity on Tag Vectors

```typescript
@Injectable()
export class ContentBasedService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async computeSimilarity() {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      include: { courseTags: { select: { tagId: true } } },
    });

    // Build unique tag set
    const allTagIds = [...new Set(courses.flatMap((c) => c.courseTags.map((t) => t.tagId)))];
    if (allTagIds.length === 0) return;

    // Compute pairwise cosine similarity
    for (let i = 0; i < courses.length; i++) {
      const courseA = courses[i]!;
      const tagsA = new Set(courseA.courseTags.map((t) => t.tagId));
      const vectorA = allTagIds.map((t) => (tagsA.has(t) ? 1 : 0));

      for (let j = i + 1; j < courses.length; j++) {
        const courseB = courses[j]!;
        const tagsB = new Set(courseB.courseTags.map((t) => t.tagId));
        const vectorB = allTagIds.map((t) => (tagsB.has(t) ? 1 : 0));

        const score = this.cosineSimilarity(vectorA, vectorB);
        if (score <= 0.1) continue; // Skip low similarity

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

  private cosineSimilarity(a: number[], b: number[]): number {
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
```

### 3.2 collaborative.service.ts — Jaccard Similarity on Enrollment Sets

```typescript
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

        // Save both directions
        const courseAId = courseIds[i]!;
        const courseBId = courseIds[j]!;

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
```

### 3.3 popularity.service.ts — Wilson Score + Time Decay

```typescript
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

    // Wilson Score Lower Bound + Time Decay
    const scored = courses.map((course) => {
      const wilsonScore = this.wilsonScoreLowerBound(
        course.avgRating,
        course._count.reviews,
      );

      // Time decay: newer courses get slight boost
      const ageInDays = (Date.now() - course.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const timeFactor = 1 / (1 + Math.log10(1 + ageInDays / 30)); // Decay over months

      const score = wilsonScore * 0.7 + timeFactor * 0.3;

      return { ...course, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Wilson Score Lower Bound
   * Confidence interval for rating with low sample sizes
   * Better than simple average: 5.0 (1 review) < 4.5 (100 reviews)
   */
  private wilsonScoreLowerBound(avgRating: number, reviewCount: number): number {
    if (reviewCount === 0) return 0;

    // Normalize to 0-1 range (rating is 1-5)
    const p = (avgRating - 1) / 4;
    const n = reviewCount;
    const z = 1.96; // 95% confidence

    const denominator = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

    return (centre - spread) / denominator;
  }
}
```

**Key points:**
- **Wilson Score**: handles "5.0 stars with 1 review" vs "4.5 stars with 100 reviews" — more reviews = higher confidence
- **Time Decay**: `1 / (1 + log10(1 + days/30))` — logarithmic decay over months
- **Combined**: 70% Wilson + 30% Time factor

---

## Step 4: RecommendationsService

```typescript
@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ContentBasedService) private readonly contentBased: ContentBasedService,
    @Inject(CollaborativeService) private readonly collaborative: CollaborativeService,
    @Inject(PopularityService) private readonly popularity: PopularityService,
  ) {}

  async getRecommendations(userId: string | null, query: QueryRecommendationsDto) {
    const context = query.context ?? 'homepage';
    const limit = query.limit ?? 10;

    // Not logged in → popularity only
    if (!userId) {
      return this.popularity.getPopularCourses(limit);
    }

    // Get enrolled courseIds
    const enrolledCourseIds = (
      await this.prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      })
    ).map((e) => e.courseId);

    switch (context) {
      case 'course_detail':
        return this.getContentBased(query.courseId!, enrolledCourseIds, limit);

      case 'post_purchase':
        return this.getCollaborative(enrolledCourseIds, limit);

      case 'post_complete':
        return this.getContentBased(
          enrolledCourseIds[enrolledCourseIds.length - 1]!, // Last completed
          enrolledCourseIds,
          limit,
        );

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

  // --- Private ---

  private async getContentBased(courseId: string, excludeIds: string[], limit: number) {
    const similarities = await this.prisma.courseSimilarity.findMany({
      where: {
        courseId,
        similarCourseId: { notIn: excludeIds },
        algorithm: 'CONTENT',
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        similarCourse: {
          select: {
            id: true, title: true, slug: true, thumbnailUrl: true,
            avgRating: true, totalStudents: true, price: true,
          },
        },
      },
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
      include: {
        similarCourse: {
          select: {
            id: true, title: true, slug: true, thumbnailUrl: true,
            avgRating: true, totalStudents: true, price: true,
          },
        },
      },
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
      include: {
        similarCourse: {
          select: {
            id: true, title: true, slug: true, thumbnailUrl: true,
            avgRating: true, totalStudents: true, price: true,
          },
        },
      },
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
    // Get all unique course pairs from CONTENT + COLLABORATIVE
    const contentScores = await this.prisma.courseSimilarity.findMany({
      where: { algorithm: 'CONTENT' },
      select: { courseId: true, similarCourseId: true, score: true },
    });

    const collabScores = await this.prisma.courseSimilarity.findMany({
      where: { algorithm: 'COLLABORATIVE' },
      select: { courseId: true, similarCourseId: true, score: true },
    });

    // Build score maps
    const contentMap = new Map<string, number>();
    for (const s of contentScores) {
      contentMap.set(`${s.courseId}:${s.similarCourseId}`, s.score);
    }

    const collabMap = new Map<string, number>();
    for (const s of collabScores) {
      collabMap.set(`${s.courseId}:${s.similarCourseId}`, s.score);
    }

    // All unique pairs
    const allKeys = new Set([...contentMap.keys(), ...collabMap.keys()]);

    for (const key of allKeys) {
      const [courseId, similarCourseId] = key.split(':') as [string, string];
      const cb = contentMap.get(key) ?? 0;
      const cf = collabMap.get(key) ?? 0;

      // Weighted: CB 0.5 + CF 0.5 (popularity handled separately at query time)
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
```

---

## Step 5: Controller

```typescript
@Controller('recommendations')
@ApiTags('Recommendations')
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService) private readonly service: RecommendationsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get course recommendations' })
  async getRecommendations(
    @CurrentUser() user: JwtPayload | undefined,
    @Query() query: QueryRecommendationsDto,
  ) {
    return this.service.getRecommendations(user?.sub ?? null, query);
  }
}
```

**`@Public()`** — recommendations work for anonymous users (popularity-based).

---

## Step 6: Module

```typescript
@Module({
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    ContentBasedService,
    CollaborativeService,
    PopularityService,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
```

**`exports: [RecommendationsService]`** — Admin cron job (Phase 5.11) will call `computeAllSimilarities()`.

---

## Step 7: Verify

- [ ] Popularity: Wilson Score + Time Decay returns sorted courses
- [ ] Content-Based: Cosine similarity computed from tag vectors
- [ ] Collaborative: Jaccard similarity computed from enrollment overlap
- [ ] Hybrid: Weighted average of CB + CF stored in CourseSimilarity
- [ ] Context-aware: homepage, course_detail, post_purchase, post_complete
- [ ] Anonymous user → popularity only
- [ ] Authenticated user with no enrollments → popularity fallback
- [ ] computeAllSimilarities orchestrates all 3 algorithms + hybrid merge
- [ ] `@Inject()` pattern, no `any`
- [ ] Build 0 errors, Lint 0 errors, Tests pass

---

## Note: Cron Job (Phase 5.11)

The `computeAllSimilarities()` method will be called by a cron job in Phase 5.11 (Admin & Jobs):
```typescript
@Cron('0 3 * * *') // Daily at 3 AM
async recomputeSimilarities() {
  await this.recommendationsService.computeAllSimilarities();
}
```

For now, it can be triggered manually via an admin endpoint or test.
