import { Injectable, Inject } from '@nestjs/common';
import type { AnalyticsType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

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
    return this.prisma.analyticsSnapshot.findMany({
      where: {
        type,
        date: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      orderBy: { date: 'asc' },
    });
  }
}
