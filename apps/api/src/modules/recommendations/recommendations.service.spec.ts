import { Test } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { ContentBasedService } from './algorithms/content-based.service';
import { CollaborativeService } from './algorithms/collaborative.service';
import { PopularityService } from './algorithms/popularity.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  enrollment: { findMany: jest.fn() },
  courseSimilarity: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockContentBased = {
  computeSimilarity: jest.fn(),
};

const mockCollaborative = {
  computeSimilarity: jest.fn(),
};

const mockPopularity = {
  getPopularCourses: jest.fn(),
};

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ContentBasedService, useValue: mockContentBased },
        { provide: CollaborativeService, useValue: mockCollaborative },
        { provide: PopularityService, useValue: mockPopularity },
      ],
    }).compile();

    service = module.get(RecommendationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getRecommendations', () => {
    it('should return popularity for anonymous user', async () => {
      mockPopularity.getPopularCourses.mockResolvedValue([{ id: 'c1', score: 0.9 }]);

      const result = await service.getRecommendations(null, {
        limit: 10,
      });
      expect(result).toHaveLength(1);
      expect(mockPopularity.getPopularCourses).toHaveBeenCalledWith(10);
    });

    it('should return popularity for user with no enrollments', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);
      mockPopularity.getPopularCourses.mockResolvedValue([]);

      await service.getRecommendations('user-1', {
        context: 'homepage',
        limit: 10,
      });
      expect(mockPopularity.getPopularCourses).toHaveBeenCalled();
    });

    it('should return content-based for course_detail context', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: 'enrolled-1' }]);
      mockPrisma.courseSimilarity.findMany.mockResolvedValue([
        {
          score: 0.8,
          similarCourse: { id: 'rec-1', title: 'Similar Course' },
        },
      ]);

      const result = await service.getRecommendations('user-1', {
        context: 'course_detail',
        courseId: 'course-1',
        limit: 5,
      });
      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).reason).toBe('Based on similar topics');
    });

    it('should return collaborative for post_purchase context', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: 'enrolled-1' }]);
      mockPrisma.courseSimilarity.findMany.mockResolvedValue([
        {
          score: 0.7,
          similarCourse: { id: 'rec-1', title: 'Collab Course' },
        },
      ]);

      const result = await service.getRecommendations('user-1', {
        context: 'post_purchase',
        limit: 5,
      });
      expect((result[0] as Record<string, unknown>).reason).toContain('Students who enrolled');
    });

    it('should return hybrid for homepage context', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: 'enrolled-1' }]);
      mockPrisma.courseSimilarity.findMany.mockResolvedValue([
        {
          score: 0.85,
          similarCourse: { id: 'rec-1', title: 'Hybrid Course' },
        },
      ]);

      const result = await service.getRecommendations('user-1', {
        context: 'homepage',
        limit: 5,
      });
      expect((result[0] as Record<string, unknown>).reason).toBe('Recommended for you');
    });

    it('should fallback to popularity if hybrid returns nothing', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: 'enrolled-1' }]);
      mockPrisma.courseSimilarity.findMany.mockResolvedValue([]);
      mockPopularity.getPopularCourses.mockResolvedValue([{ id: 'pop-1' }]);

      const result = await service.getRecommendations('user-1', {
        context: 'homepage',
        limit: 5,
      });
      expect(mockPopularity.getPopularCourses).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('computeAllSimilarities', () => {
    it('should call all 3 algorithms + hybrid', async () => {
      mockContentBased.computeSimilarity.mockResolvedValue(undefined);
      mockCollaborative.computeSimilarity.mockResolvedValue(undefined);
      mockPrisma.courseSimilarity.findMany.mockResolvedValue([]);

      await service.computeAllSimilarities();

      expect(mockContentBased.computeSimilarity).toHaveBeenCalled();
      expect(mockCollaborative.computeSimilarity).toHaveBeenCalled();
    });
  });
});
