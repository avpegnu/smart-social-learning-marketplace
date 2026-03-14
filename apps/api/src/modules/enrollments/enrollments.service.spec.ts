import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  enrollment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  chapterPurchase: { findMany: jest.fn() },
  course: { findFirst: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EnrollmentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(EnrollmentsService);
    jest.clearAllMocks();
  });

  describe('checkEnrollment', () => {
    it('should return enrolled status with FULL enrollment', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue({
        type: 'FULL',
        progress: 0.65,
      });

      const result = await service.checkEnrollment('user-1', 'course-1');

      expect(result.enrolled).toBe(true);
      expect(result.type).toBe('FULL');
      expect(result.progress).toBe(0.65);
      expect(result.purchasedChapterIds).toHaveLength(0);
    });

    it('should return purchased chapters for PARTIAL enrollment', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'PARTIAL', progress: 0.2 });
      mockPrisma.chapterPurchase.findMany.mockResolvedValue([
        { chapterId: 'ch-1' },
        { chapterId: 'ch-2' },
      ]);

      const result = await service.checkEnrollment('user-1', 'course-1');

      expect(result.type).toBe('PARTIAL');
      expect(result.purchasedChapterIds).toEqual(['ch-1', 'ch-2']);
    });

    it('should return not enrolled', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.chapterPurchase.findMany.mockResolvedValue([]);

      const result = await service.checkEnrollment('user-1', 'course-1');

      expect(result.enrolled).toBe(false);
      expect(result.type).toBeNull();
    });
  });

  describe('enrollFree', () => {
    it('should enroll in free course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        price: 0,
        instructorId: 'instr-1',
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          enrollment: { create: jest.fn().mockResolvedValue({ id: 'enr-1', type: 'FULL' }) },
          course: { update: jest.fn() },
        }),
      );

      const result = await service.enrollFree('user-1', 'course-1');

      expect(result.type).toBe('FULL');
    });

    it('should throw if course not free', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.enrollFree('user-1', 'course-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw if enrolling own course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        price: 0,
        instructorId: 'user-1',
      });

      await expect(service.enrollFree('user-1', 'course-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if already enrolled', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        price: 0,
        instructorId: 'instr-1',
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });

      await expect(service.enrollFree('user-1', 'course-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getMyLearning', () => {
    it('should return paginated enrollments', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([
        { id: 'enr-1', course: { title: 'React' } },
      ]);
      mockPrisma.enrollment.count.mockResolvedValue(1);

      const result = await service.getMyLearning('user-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
