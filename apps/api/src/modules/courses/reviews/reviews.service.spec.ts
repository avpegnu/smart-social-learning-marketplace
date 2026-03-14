import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  course: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  enrollment: {
    findUnique: jest.fn(),
  },
  review: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  $transaction: jest.fn(),
};

const MOCK_REVIEW = {
  id: 'rev-1',
  userId: 'user-1',
  courseId: 'course-1',
  rating: 5,
  comment: 'Great course!',
  user: { id: 'user-1', fullName: 'Test User', avatarUrl: null },
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(ReviewsService);
    jest.clearAllMocks();
  });

  // ==================== create ====================

  describe('create', () => {
    it('should throw if course not found', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', 'course-1', { rating: 5 } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if not enrolled', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', 'course-1', { rating: 5 } as never)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if progress < 30%', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ progress: 0.2 });

      await expect(service.create('user-1', 'course-1', { rating: 5 } as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if already reviewed', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ progress: 0.5 });
      mockPrisma.review.findUnique.mockResolvedValue(MOCK_REVIEW);

      await expect(service.create('user-1', 'course-1', { rating: 5 } as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create review and recalculate avgRating in transaction', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ progress: 0.5 });
      mockPrisma.review.findUnique.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          review: {
            create: jest.fn().mockResolvedValue(MOCK_REVIEW),
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: 10 }),
          },
          course: { update: jest.fn() },
        }),
      );

      const result = await service.create('user-1', 'course-1', {
        rating: 5,
        comment: 'Great course!',
      } as never);

      expect(result).toEqual(MOCK_REVIEW);
    });
  });

  // ==================== findByCourse ====================

  describe('findByCourse', () => {
    it('should return paginated reviews', async () => {
      mockPrisma.review.findMany.mockResolvedValue([MOCK_REVIEW]);
      mockPrisma.review.count.mockResolvedValue(1);

      const result = await service.findByCourse('course-1', {
        page: 1,
        limit: 10,
        skip: 0,
      } as never);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should sort by highest rating', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      await service.findByCourse('course-1', {
        page: 1,
        limit: 10,
        skip: 0,
        sort: 'highest',
      } as never);

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'desc' },
        }),
      );
    });

    it('should sort by lowest rating', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      await service.findByCourse('course-1', {
        page: 1,
        limit: 10,
        skip: 0,
        sort: 'lowest',
      } as never);

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'asc' },
        }),
      );
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update own review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(MOCK_REVIEW);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          review: {
            update: jest.fn().mockResolvedValue({ ...MOCK_REVIEW, rating: 4 }),
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.2 } }),
          },
          course: { update: jest.fn() },
        }),
      );

      const result = await service.update('user-1', 'rev-1', { rating: 4 } as never);

      expect(result.rating).toBe(4);
    });

    it('should throw if review not found or not owner', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.update('user-1', 'rev-1', { rating: 4 } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if trying to update other user review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        ...MOCK_REVIEW,
        userId: 'other-user',
      });

      await expect(service.update('user-1', 'rev-1', { rating: 4 } as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should delete own review and recalculate', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(MOCK_REVIEW);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          review: {
            delete: jest.fn(),
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.0 }, _count: 9 }),
          },
          course: { update: jest.fn() },
        }),
      );

      await service.delete('user-1', 'rev-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw if review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.delete('user-1', 'rev-bad')).rejects.toThrow(NotFoundException);
    });
  });
});
