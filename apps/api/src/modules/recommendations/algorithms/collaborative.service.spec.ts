import { Test } from '@nestjs/testing';
import { CollaborativeService } from './collaborative.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  enrollment: { findMany: jest.fn() },
  courseSimilarity: { upsert: jest.fn() },
};

describe('CollaborativeService', () => {
  let service: CollaborativeService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CollaborativeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CollaborativeService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('computeSimilarity', () => {
    it('should compute Jaccard similarity between courses', async () => {
      // User1 enrolled in [courseA, courseB]
      // User2 enrolled in [courseA, courseC]
      // User3 enrolled in [courseA, courseB]
      mockPrisma.enrollment.findMany.mockResolvedValue([
        { userId: 'u1', courseId: 'cA' },
        { userId: 'u1', courseId: 'cB' },
        { userId: 'u2', courseId: 'cA' },
        { userId: 'u2', courseId: 'cC' },
        { userId: 'u3', courseId: 'cA' },
        { userId: 'u3', courseId: 'cB' },
      ]);
      mockPrisma.courseSimilarity.upsert.mockResolvedValue({});

      await service.computeSimilarity();

      // cA has users {u1, u2, u3}, cB has {u1, u3}, cC has {u2}
      // Jaccard(cA, cB) = |{u1,u3}| / |{u1,u2,u3}| = 2/3 ≈ 0.667
      // Jaccard(cA, cC) = |{u2}| / |{u1,u2,u3}| = 1/3 ≈ 0.333
      // Jaccard(cB, cC) = |{}| / |{u1,u2,u3}| = 0/3 = 0

      // 2 pairs with score > 0 (cA-cB and cA-cC), each saved both directions = 4 upserts
      expect(mockPrisma.courseSimilarity.upsert).toHaveBeenCalledTimes(4);
    });

    it('should skip pairs with zero overlap', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([
        { userId: 'u1', courseId: 'cA' },
        { userId: 'u2', courseId: 'cB' },
      ]);
      mockPrisma.courseSimilarity.upsert.mockResolvedValue({});

      await service.computeSimilarity();

      // No overlap → no upserts
      expect(mockPrisma.courseSimilarity.upsert).not.toHaveBeenCalled();
    });

    it('should handle empty enrollments', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);

      await service.computeSimilarity();

      expect(mockPrisma.courseSimilarity.upsert).not.toHaveBeenCalled();
    });

    it('should save both directions for each pair', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([
        { userId: 'u1', courseId: 'cA' },
        { userId: 'u1', courseId: 'cB' },
      ]);
      mockPrisma.courseSimilarity.upsert.mockResolvedValue({});

      await service.computeSimilarity();

      // 1 pair × 2 directions = 2 upserts
      expect(mockPrisma.courseSimilarity.upsert).toHaveBeenCalledTimes(2);

      // Verify both directions
      const calls = mockPrisma.courseSimilarity.upsert.mock.calls;
      const firstWhere = calls[0]![0].where.courseId_similarCourseId_algorithm;
      const secondWhere = calls[1]![0].where.courseId_similarCourseId_algorithm;

      expect(firstWhere.courseId).toBe('cA');
      expect(firstWhere.similarCourseId).toBe('cB');
      expect(secondWhere.courseId).toBe('cB');
      expect(secondWhere.similarCourseId).toBe('cA');
    });
  });
});
