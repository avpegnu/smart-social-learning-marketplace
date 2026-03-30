import { Test } from '@nestjs/testing';
import { CronService } from './cron.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { RecommendationsService } from '@/modules/recommendations/recommendations.service';

describe('CronService', () => {
  let service: CronService;
  const prisma = {
    order: { updateMany: jest.fn() },
    course: { update: jest.fn(), findMany: jest.fn() },
    earning: { findMany: jest.fn(), updateMany: jest.fn() },
    instructorProfile: { update: jest.fn() },
    media: { updateMany: jest.fn() },
    user: { count: jest.fn() },
    enrollment: { count: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    analyticsSnapshot: { upsert: jest.fn() },
    courseSimilarity: { upsert: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const redis = {
    scan: jest.fn(),
    getdel: jest.fn(),
  };
  const recommendations = {
    computeAllSimilarities: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: RecommendationsService, useValue: recommendations },
      ],
    }).compile();
    service = module.get(CronService);
    jest.clearAllMocks();
  });

  describe('expirePendingOrders', () => {
    it('should expire orders past expiresAt', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 3 });
      await service.expirePendingOrders();

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('syncViewCounts', () => {
    it('should sync view counts using SCAN', async () => {
      redis.scan.mockResolvedValueOnce(['0', ['course_views:c1']]);
      redis.getdel.mockResolvedValue('5');
      prisma.course.update.mockResolvedValue({});

      await service.syncViewCounts();

      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'course_views:*', 'COUNT', 100);
      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { viewCount: { increment: 5 } },
      });
    });

    it('should skip keys with 0 views', async () => {
      redis.scan.mockResolvedValueOnce(['0', ['course_views:c1']]);
      redis.getdel.mockResolvedValue('0');

      await service.syncViewCounts();

      expect(prisma.course.update).not.toHaveBeenCalled();
    });
  });

  describe('releaseAvailableEarnings', () => {
    it('should find all pending earnings and release them immediately', async () => {
      prisma.earning.findMany.mockResolvedValue([
        { id: 'e1', instructorId: 'inst1', netAmount: 100000 },
        { id: 'e2', instructorId: 'inst1', netAmount: 200000 },
      ]);
      prisma.earning.updateMany.mockResolvedValue({ count: 2 });
      prisma.instructorProfile.update.mockResolvedValue({});

      await service.releaseAvailableEarnings();

      expect(prisma.earning.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        select: { id: true, instructorId: true, netAmount: true },
      });
      expect(prisma.earning.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['e1', 'e2'] } },
        data: { status: 'AVAILABLE' },
      });
      expect(prisma.instructorProfile.update).toHaveBeenCalledWith({
        where: { userId: 'inst1' },
        data: { availableBalance: { increment: 300000 } },
      });
    });

    it('should skip if no pending earnings', async () => {
      prisma.earning.findMany.mockResolvedValue([]);

      await service.releaseAvailableEarnings();

      expect(prisma.earning.updateMany).not.toHaveBeenCalled();
      expect(prisma.instructorProfile.update).not.toHaveBeenCalled();
    });

    it('should aggregate balance per instructor', async () => {
      prisma.earning.findMany.mockResolvedValue([
        { id: 'e1', instructorId: 'inst1', netAmount: 100000 },
        { id: 'e2', instructorId: 'inst2', netAmount: 200000 },
        { id: 'e3', instructorId: 'inst1', netAmount: 50000 },
      ]);
      prisma.earning.updateMany.mockResolvedValue({ count: 3 });
      prisma.instructorProfile.update.mockResolvedValue({});

      await service.releaseAvailableEarnings();

      expect(prisma.instructorProfile.update).toHaveBeenCalledTimes(2);
      expect(prisma.instructorProfile.update).toHaveBeenCalledWith({
        where: { userId: 'inst1' },
        data: { availableBalance: { increment: 150000 } },
      });
      expect(prisma.instructorProfile.update).toHaveBeenCalledWith({
        where: { userId: 'inst2' },
        data: { availableBalance: { increment: 200000 } },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired refresh tokens', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });
      await service.cleanupExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('computeRecommendationMatrix', () => {
    it('should delegate to RecommendationsService.computeAllSimilarities', async () => {
      recommendations.computeAllSimilarities.mockResolvedValue(undefined);

      await service.computeRecommendationMatrix();

      expect(recommendations.computeAllSimilarities).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconcileCounters', () => {
    it('should execute raw SQL for counter reconciliation', async () => {
      prisma.$executeRaw.mockResolvedValue(0);
      await service.reconcileCounters();

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    });
  });
});
