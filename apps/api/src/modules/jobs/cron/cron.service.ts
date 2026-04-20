import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { AnalyticsType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { RedisService } from '@/redis/redis.service';
import { RecommendationsService } from '@/modules/recommendations/recommendations.service';
import { EmbeddingsService } from '@/modules/ai-tutor/embeddings/embeddings.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(RecommendationsService) private readonly recommendations: RecommendationsService,
    @Inject(EmbeddingsService) private readonly embeddingsService: EmbeddingsService,
  ) {}

  // 1. Expire pending orders (every 20 min)
  // Sửa từ 1 phút sang 20 phút để giảm compute cost
  // Lý do: Chạy 1 phút/lần khiến DB thức liên tục, không được suspend, consume ~50% compute budget
  // (110 CU-hrs/20 ngày). Với 20 phút/lần, DB có thể ngủ giữa lúc, giảm từ ~110 CU xuống ~8-10 CU/tháng.
  // Delay 20 phút cho order expiration là chấp nhận được.
  @Cron('*/20 * * * *')
  async expirePendingOrders() {
    const expiredOrders = await this.prisma.order.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true, userId: true },
    });
    if (expiredOrders.length === 0) return;

    await this.prisma.order.updateMany({
      where: { id: { in: expiredOrders.map((o) => o.id) } },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(`Expired ${expiredOrders.length} pending orders`);

    for (const order of expiredOrders) {
      this.queue.addNotification(order.userId, 'ORDER_EXPIRED', {
        orderId: order.id,
      });
    }
  }

  // 2. Sync view counts from Redis to DB (every 30 min)
  // Sửa từ 5 phút sang 30 phút để giảm compute cost
  // Lý do: Chạy 5 phút/lần khiến DB thức 12 lần/giờ, consume ~30% compute budget.
  // Với 30 phút/lần, DB có thời gian ngủ dài hơn. Delay trong sync view count là chấp nhận vì analytics không realtime.
  // Giảm cost: ~65%. Uses SCAN thay vì KEYS (production-safe)
  @Cron('*/30 * * * *')
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

    const [students, instructors, revenue, enrollments, courses] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: dateRange, deletedAt: null, role: 'STUDENT' },
      }),
      this.prisma.user.count({
        where: { createdAt: dateRange, deletedAt: null, role: 'INSTRUCTOR' },
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

    // Data shape must match the chart consumers in the management portal:
    // - DAILY_USERS:       { students, instructors }
    // - DAILY_REVENUE:     { revenue }
    // - DAILY_ENROLLMENTS: { count }
    // - DAILY_COURSES:     { count }
    const snapshots: Array<{
      date: Date;
      type: AnalyticsType;
      data: Prisma.InputJsonValue;
    }> = [
      {
        date: yesterday,
        type: 'DAILY_USERS',
        data: { students, instructors },
      },
      {
        date: yesterday,
        type: 'DAILY_REVENUE',
        data: { revenue: revenue._sum.finalAmount || 0 },
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
    try {
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
    } catch (err) {
      this.logger.error(`Feed cleanup failed: ${(err as Error).message}`);
    }
  }

  // 9. Reconcile denormalized counters (weekly Sunday 5 AM)
  @Cron('0 5 * * 0')
  async reconcileCounters() {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE posts SET
            like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id),
            comment_count = (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id)
          WHERE deleted_at IS NULL
        `;

        await tx.$executeRaw`
          UPDATE users SET
            follower_count = (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id),
            following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id)
          WHERE deleted_at IS NULL
        `;

        await tx.$executeRaw`
          UPDATE tags SET
            course_count = (SELECT COUNT(*) FROM course_tags WHERE course_tags.tag_id = tags.id)
        `;
      });

      this.logger.log('Counter reconciliation completed');
    } catch (err) {
      this.logger.error(`Counter reconciliation failed: ${(err as Error).message}`);
    }
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
