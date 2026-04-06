import { Injectable, Inject } from '@nestjs/common';
import type { AnalyticsType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

type Granularity = 'daily' | 'weekly' | 'monthly';

export interface AggregatedSnapshot {
  date: Date;
  type: AnalyticsType;
  data: Record<string, number>;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalCourses,
      totalRevenue,
      todayOrders,
      newUsersThisWeek,
      pendingApps,
      pendingCourses,
      pendingReports,
      pendingWithdrawals,
      topCourses,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.course.count({
        where: { status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.earning.aggregate({ _sum: { netAmount: true } }),
      this.prisma.order.count({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: today },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: weekAgo }, deletedAt: null },
      }),
      this.prisma.instructorApplication.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.course.count({
        where: { status: 'PENDING_REVIEW' },
      }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      this.prisma.course.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        select: {
          id: true,
          title: true,
          totalStudents: true,
          avgRating: true,
        },
        orderBy: { totalStudents: 'desc' },
        take: 5,
      }),
    ]);

    return {
      overview: {
        totalUsers,
        totalCourses,
        totalRevenue: totalRevenue._sum.netAmount || 0,
        todayOrders,
        newUsersThisWeek,
      },
      pendingApprovals: {
        instructorApps: pendingApps,
        courseReviews: pendingCourses,
        reports: pendingReports,
        withdrawals: pendingWithdrawals,
      },
      topCourses,
    };
  }

  async getAnalytics(type: AnalyticsType, fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const snapshots = await this.prisma.analyticsSnapshot.findMany({
      where: {
        type,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });

    // Pick granularity based on date range to keep charts readable
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
    const granularity: Granularity = days <= 31 ? 'daily' : days <= 92 ? 'weekly' : 'monthly';

    if (granularity === 'daily') {
      return snapshots;
    }
    return aggregate(snapshots as AggregatedSnapshot[], granularity);
  }
}

// ── Aggregation helpers ──

function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === 'monthly') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  // Weekly: ISO week starting Monday
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() - day + 1); // shift to Monday
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function bucketStartDate(key: string, granularity: Granularity): Date {
  if (granularity === 'monthly') {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year!, month! - 1, 1));
  }
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function aggregate(
  snapshots: AggregatedSnapshot[],
  granularity: Granularity,
): AggregatedSnapshot[] {
  if (snapshots.length === 0) return [];

  const buckets = new Map<string, Record<string, number>>();
  const type = snapshots[0]!.type;

  for (const snapshot of snapshots) {
    const key = bucketKey(new Date(snapshot.date), granularity);
    const bucket = buckets.get(key) ?? {};
    for (const [field, value] of Object.entries(snapshot.data)) {
      if (typeof value === 'number') {
        bucket[field] = (bucket[field] ?? 0) + value;
      }
    }
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([key, data]) => ({
      date: bucketStartDate(key, granularity),
      type,
      data,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
