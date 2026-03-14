import { Test } from '@nestjs/testing';
import { StreaksService } from './streaks.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  dailyActivity: { upsert: jest.fn(), findMany: jest.fn() },
  enrollment: { findMany: jest.fn() },
  certificate: { findMany: jest.fn() },
  lesson: { findFirst: jest.fn() },
};

describe('StreaksService', () => {
  let service: StreaksService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [StreaksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(StreaksService);
    jest.clearAllMocks();
  });

  describe('trackDailyActivity', () => {
    it('should upsert lesson activity', async () => {
      mockPrisma.dailyActivity.upsert.mockResolvedValue({});

      await service.trackDailyActivity('user-1', 'lesson');

      expect(mockPrisma.dailyActivity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { lessonsCompleted: { increment: 1 } },
        }),
      );
    });

    it('should upsert quiz activity', async () => {
      mockPrisma.dailyActivity.upsert.mockResolvedValue({});

      await service.trackDailyActivity('user-1', 'quiz');

      expect(mockPrisma.dailyActivity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { quizzesPassed: { increment: 1 } },
        }),
      );
    });
  });

  describe('getStreak', () => {
    it('should return 0 streak when no activities', async () => {
      mockPrisma.dailyActivity.findMany.mockResolvedValue([]);

      const result = await service.getStreak('user-1');

      expect(result.currentStreak).toBe(0);
      expect(result.todayCompleted).toBe(false);
    });

    it('should count consecutive days', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activities = [
        { activityDate: new Date(today) },
        { activityDate: new Date(today.getTime() - 86400000) },
        { activityDate: new Date(today.getTime() - 86400000 * 2) },
      ];
      mockPrisma.dailyActivity.findMany.mockResolvedValue(activities);

      const result = await service.getStreak('user-1');

      expect(result.currentStreak).toBe(3);
      expect(result.todayCompleted).toBe(true);
    });

    it('should handle gap in streak', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activities = [
        { activityDate: new Date(today) },
        // Gap: yesterday missing
        { activityDate: new Date(today.getTime() - 86400000 * 2) },
      ];
      mockPrisma.dailyActivity.findMany.mockResolvedValue(activities);

      const result = await service.getStreak('user-1');

      expect(result.currentStreak).toBe(1); // Only today
    });

    it('should keep streak when today not yet active', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activities = [
        { activityDate: new Date(today.getTime() - 86400000) }, // yesterday
        { activityDate: new Date(today.getTime() - 86400000 * 2) }, // 2 days ago
      ];
      mockPrisma.dailyActivity.findMany.mockResolvedValue(activities);

      const result = await service.getStreak('user-1');

      expect(result.currentStreak).toBe(2); // Yesterday + day before
      expect(result.todayCompleted).toBe(false);
    });
  });

  describe('getDashboard', () => {
    it('should return active and completed courses', async () => {
      mockPrisma.enrollment.findMany
        .mockResolvedValueOnce([{ courseId: 'c1', course: { title: 'React' } }]) // active
        .mockResolvedValueOnce([{ courseId: 'c2', course: { title: 'CSS' } }]); // completed
      mockPrisma.dailyActivity.findMany.mockResolvedValue([]);
      mockPrisma.certificate.findMany.mockResolvedValue([{ courseId: 'c2', verifyCode: 'ABC' }]);
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-1', title: 'Next' });

      const result = await service.getDashboard('user-1');

      expect(result.activeCourses).toHaveLength(1);
      expect(result.completedCourses).toHaveLength(1);
      expect(result.completedCourses[0]!.certificate).toBeDefined();
    });
  });
});
