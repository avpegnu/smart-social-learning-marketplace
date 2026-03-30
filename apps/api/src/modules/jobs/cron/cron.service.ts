import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AnalyticsType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { RecommendationsService } from '@/modules/recommendations/recommendations.service';
import { EmbeddingsService } from '@/modules/ai-tutor/embeddings/embeddings.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(RecommendationsService) private readonly recommendations: RecommendationsService,
    @Inject(EmbeddingsService) private readonly embeddingsService: EmbeddingsService,
  ) {}

  // 1. Expire pending orders (every 1 min)
  @Cron('*/1 * * * *')
  async expirePendingOrders() {
    const result = await this.prisma.order.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} pending orders`);
    }
  }

  // 2. Sync view counts from Redis to DB (every 5 min)
  // Uses SCAN instead of KEYS (production-safe)
  @Cron('*/5 * * * *')
  async syncViewCounts() {
    let cursor = '0';
    let synced = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'course_views:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const courseId = key.replace('course_views:', '');
        const views = parseInt((await this.redis.getdel(key)) || '0', 10);
        if (views > 0) {
          await this.prisma.course
            .update({
              where: { id: courseId },
              data: { viewCount: { increment: views } },
            })
            .catch(() => {});
          synced += views;
        }
      }
    } while (cursor !== '0');

    if (synced > 0) {
      this.logger.log(`Synced ${synced} view counts`);
    }
  }

  // 3. Release available earnings (every 30 min)
  @Cron('*/30 * * * *')
  async releaseAvailableEarnings() {
    // Find all pending earnings and release immediately
    const pendingEarnings = await this.prisma.earning.findMany({
      where: { status: 'PENDING' },
      select: { id: true, instructorId: true, netAmount: true },
    });

    if (pendingEarnings.length === 0) return;

    // Mark as AVAILABLE
    await this.prisma.earning.updateMany({
      where: { id: { in: pendingEarnings.map((e) => e.id) } },
      data: { status: 'AVAILABLE' },
    });

    // Add to each instructor's availableBalance
    const balanceByInstructor = new Map<string, number>();
    for (const e of pendingEarnings) {
      balanceByInstructor.set(
        e.instructorId,
        (balanceByInstructor.get(e.instructorId) ?? 0) + e.netAmount,
      );
    }

    for (const [instructorId, amount] of balanceByInstructor) {
      await this.prisma.instructorProfile.update({
        where: { userId: instructorId },
        data: { availableBalance: { increment: amount } },
      });
    }

    this.logger.log(`Released ${pendingEarnings.length} earnings`);
  }

  // 4. Cleanup failed uploads (every 6 hours)
  @Cron('0 */6 * * *')
  async cleanupFailedUploads() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.media.updateMany({
      where: { status: 'UPLOADING', createdAt: { lt: cutoff } },
      data: { status: 'FAILED' },
    });
    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} failed uploads`);
    }
  }

  // 5. Compute analytics snapshot for yesterday (daily 2:30 AM)
  @Cron('30 2 * * *')
  async computeAnalyticsSnapshot() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfDay = new Date(yesterday);
    endOfDay.setHours(23, 59, 59, 999);

    const dateRange = {
      gte: yesterday,
      lte: endOfDay,
    };

    const [users, revenue, enrollments, courses] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: dateRange, deletedAt: null },
      }),
      this.prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: dateRange,
        },
        _sum: { finalAmount: true },
      }),
      this.prisma.enrollment.count({
        where: { createdAt: dateRange },
      }),
      this.prisma.course.count({
        where: {
          status: 'PUBLISHED',
          publishedAt: dateRange,
        },
      }),
    ]);

    const snapshots: Array<{
      date: Date;
      type: AnalyticsType;
      data: Prisma.InputJsonValue;
    }> = [
      {
        date: yesterday,
        type: 'DAILY_USERS',
        data: { count: users },
      },
      {
        date: yesterday,
        type: 'DAILY_REVENUE',
        data: { amount: revenue._sum.finalAmount || 0 },
      },
      {
        date: yesterday,
        type: 'DAILY_ENROLLMENTS',
        data: { count: enrollments },
      },
      {
        date: yesterday,
        type: 'DAILY_COURSES',
        data: { count: courses },
      },
    ];

    for (const s of snapshots) {
      await this.prisma.analyticsSnapshot.upsert({
        where: { date_type: { date: s.date, type: s.type } },
        update: { data: s.data },
        create: s,
      });
    }

    this.logger.log(`Analytics snapshot computed for ${yesterday.toISOString().split('T')[0]!}`);
  }

  // 6. Cleanup expired tokens (every 6 hours)
  @Cron('0 */6 * * *')
  async cleanupExpiredTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired tokens`);
    }
  }

  // 7. Compute recommendation matrix (daily 4 AM)
  @Cron('0 4 * * *')
  async computeRecommendationMatrix() {
    this.logger.log('Starting recommendation matrix computation...');
    await this.recommendations.computeAllSimilarities();
    this.logger.log('Recommendation matrix computation complete');
  }

  // 8. Cleanup old feed items (weekly Sunday 4 AM)
  @Cron('0 4 * * 0')
  async cleanupOldFeedItems() {
    const result: number = await this.prisma.$executeRaw`
      DELETE FROM feed_items
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY created_at DESC
          ) as rn FROM feed_items
        ) ranked WHERE rn > 1000
      )
    `;
    if (result > 0) {
      this.logger.log(`Cleaned up ${result} old feed items`);
    }
  }

  // 9. Reconcile denormalized counters (weekly Sunday 5 AM)
  @Cron('0 5 * * 0')
  async reconcileCounters() {
    await this.prisma.$executeRaw`
      UPDATE posts SET
        like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id),
        comment_count = (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.deleted_at IS NULL)
      WHERE deleted_at IS NULL
    `;

    await this.prisma.$executeRaw`
      UPDATE users SET
        follower_count = (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id),
        following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id)
      WHERE deleted_at IS NULL
    `;

    await this.prisma.$executeRaw`
      UPDATE tags SET
        course_count = (SELECT COUNT(*) FROM course_tags WHERE course_tags.tag_id = tags.id)
    `;

    this.logger.log('Counter reconciliation completed');
  }

  // 10. Index published courses for AI Tutor (daily 5 AM)
  @Cron('0 5 * * *')
  async indexCoursesForAiTutor() {
    if (!this.embeddingsService.isReady()) return;

    const unindexed = await this.prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        courseChunks: { none: {} },
      },
      select: { id: true },
    });

    for (const course of unindexed) {
      try {
        await this.embeddingsService.indexCourseContent(course.id);
        this.logger.log(`AI Tutor: indexed course ${course.id}`);
      } catch (err) {
        this.logger.warn(
          `AI Tutor: failed to index course ${course.id}: ${(err as Error).message}`,
        );
      }
    }

    if (unindexed.length > 0) {
      this.logger.log(`AI Tutor indexing: ${unindexed.length} courses processed`);
    }
  }
}
