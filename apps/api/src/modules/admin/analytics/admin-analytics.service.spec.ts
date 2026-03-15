import { Test } from '@nestjs/testing';
import { AdminAnalyticsService } from './admin-analytics.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  const prisma = {
    user: { count: jest.fn() },
    course: { count: jest.fn(), findMany: jest.fn() },
    earning: { aggregate: jest.fn() },
    order: { count: jest.fn() },
    instructorApplication: { count: jest.fn() },
    report: { count: jest.fn() },
    withdrawal: { count: jest.fn() },
    analyticsSnapshot: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminAnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminAnalyticsService);
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return overview, pending approvals, and top courses', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(15); // newUsersThisWeek
      prisma.course.count
        .mockResolvedValueOnce(50) // totalCourses
        .mockResolvedValueOnce(3); // pendingCourses
      prisma.earning.aggregate.mockResolvedValue({
        _sum: { netAmount: 5000000 },
      });
      prisma.order.count.mockResolvedValue(5); // todayOrders
      prisma.instructorApplication.count.mockResolvedValue(2);
      prisma.report.count.mockResolvedValue(1);
      prisma.withdrawal.count.mockResolvedValue(0);
      prisma.course.findMany.mockResolvedValue([
        { id: 'c1', title: 'React', totalStudents: 200, avgRating: 4.5 },
      ]);

      const result = await service.getDashboard();

      expect(result.overview.totalUsers).toBe(100);
      expect(result.overview.totalCourses).toBe(50);
      expect(result.overview.totalRevenue).toBe(5000000);
      expect(result.overview.todayOrders).toBe(5);
      expect(result.overview.newUsersThisWeek).toBe(15);
      expect(result.pendingApprovals.instructorApps).toBe(2);
      expect(result.pendingApprovals.courseReviews).toBe(3);
      expect(result.pendingApprovals.reports).toBe(1);
      expect(result.pendingApprovals.withdrawals).toBe(0);
      expect(result.topCourses).toHaveLength(1);
    });

    it('should handle zero revenue', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.course.count.mockResolvedValue(0);
      prisma.earning.aggregate.mockResolvedValue({
        _sum: { netAmount: null },
      });
      prisma.order.count.mockResolvedValue(0);
      prisma.instructorApplication.count.mockResolvedValue(0);
      prisma.report.count.mockResolvedValue(0);
      prisma.withdrawal.count.mockResolvedValue(0);
      prisma.course.findMany.mockResolvedValue([]);

      const result = await service.getDashboard();
      expect(result.overview.totalRevenue).toBe(0);
    });
  });

  describe('getAnalytics', () => {
    it('should return snapshots filtered by type and date range', async () => {
      const snapshots = [{ date: '2026-03-01', type: 'DAILY_USERS', data: { count: 10 } }];
      prisma.analyticsSnapshot.findMany.mockResolvedValue(snapshots);

      const result = await service.getAnalytics('DAILY_USERS' as never, '2026-03-01', '2026-03-15');

      expect(result).toEqual(snapshots);
      expect(prisma.analyticsSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          type: 'DAILY_USERS',
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        orderBy: { date: 'asc' },
      });
    });
  });
});
