import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CertificatesService } from '../certificates/certificates.service';
import { StreaksService } from '../streaks/streaks.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  lesson: { findUnique: jest.fn(), count: jest.fn() },
  enrollment: { findUnique: jest.fn(), update: jest.fn() },
  lessonProgress: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  chapterPurchase: { findMany: jest.fn() },
};

const mockCertificates = { generateCertificate: jest.fn() };
const mockStreaks = { trackDailyActivity: jest.fn() };

const MOCK_LESSON = {
  id: 'les-1',
  estimatedDuration: 600,
  chapter: { section: { courseId: 'course-1' } },
};

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CertificatesService, useValue: mockCertificates },
        { provide: StreaksService, useValue: mockStreaks },
      ],
    }).compile();

    service = module.get(ProgressService);
    jest.clearAllMocks();
  });

  describe('updateLessonProgress', () => {
    it('should merge segments and calculate percent', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.3 });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue({
        watchedSegments: [[0, 200]],
        lastPosition: 200,
        isCompleted: false,
      });
      mockPrisma.lessonProgress.upsert.mockResolvedValue({});

      const result = await service.updateLessonProgress('user-1', 'les-1', {
        lastPosition: 400,
        watchedSegments: [[180, 400]],
      });

      // Merged: [[0, 200]] + [[180, 400]] = [[0, 400]]
      // watchedPercent: 400/600 = 0.667 (< 0.8 threshold)
      expect(result.watchedPercent).toBeCloseTo(0.667, 2);
      expect(result.isCompleted).toBe(false);
    });

    it('should mark complete at 80% threshold', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.5 });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue({
        watchedSegments: [[0, 400]],
        isCompleted: false,
      });
      mockPrisma.lessonProgress.upsert.mockResolvedValue({});
      mockPrisma.lessonProgress.count.mockResolvedValue(5);
      mockPrisma.lesson.count.mockResolvedValue(10);
      mockPrisma.enrollment.update.mockResolvedValue({});

      const result = await service.updateLessonProgress('user-1', 'les-1', {
        watchedSegments: [[380, 600]],
      });

      // Merged: [[0, 400]] + [[380, 600]] = [[0, 600]]
      // watchedPercent: 600/600 = 1.0 (>= 0.8)
      expect(result.isCompleted).toBe(true);
      expect(mockStreaks.trackDailyActivity).toHaveBeenCalledWith('user-1', 'lesson');
    });

    it('should throw if lesson not found', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(null);

      await expect(service.updateLessonProgress('user-1', 'bad', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if not enrolled', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.updateLessonProgress('user-1', 'les-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should never un-complete', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.8 });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue({
        watchedSegments: [[0, 600]],
        isCompleted: true, // Already completed
      });
      mockPrisma.lessonProgress.upsert.mockResolvedValue({});

      const result = await service.updateLessonProgress('user-1', 'les-1', {
        watchedSegments: [[0, 100]], // Smaller segments
      });

      expect(result.isCompleted).toBe(true); // Still true
    });
  });

  describe('completeLesson', () => {
    it('should mark text lesson as complete', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.5 });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrisma.lessonProgress.upsert.mockResolvedValue({});
      mockPrisma.lessonProgress.count.mockResolvedValue(6);
      mockPrisma.lesson.count.mockResolvedValue(10);
      mockPrisma.enrollment.update.mockResolvedValue({});

      const result = await service.completeLesson('user-1', 'les-1');

      expect(result.isCompleted).toBe(true);
      expect(mockStreaks.trackDailyActivity).toHaveBeenCalledWith('user-1', 'lesson');
    });

    it('should no-op if already completed', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.6 });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue({ isCompleted: true });

      const result = await service.completeLesson('user-1', 'les-1');

      expect(result.isCompleted).toBe(true);
      expect(mockPrisma.lessonProgress.upsert).not.toHaveBeenCalled();
    });
  });

  describe('recalculateEnrollmentProgress', () => {
    it('should calculate progress for FULL enrollment', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.lesson.count.mockResolvedValue(10);
      mockPrisma.lessonProgress.count.mockResolvedValue(7);
      mockPrisma.enrollment.update.mockResolvedValue({});

      const progress = await service.recalculateEnrollmentProgress('user-1', 'course-1');

      expect(progress).toBe(0.7);
    });

    it('should generate certificate at 100%', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.lesson.count.mockResolvedValue(10);
      mockPrisma.lessonProgress.count.mockResolvedValue(10);
      mockPrisma.enrollment.update.mockResolvedValue({});

      await service.recalculateEnrollmentProgress('user-1', 'course-1');

      expect(mockCertificates.generateCertificate).toHaveBeenCalledWith('user-1', 'course-1');
    });

    it('should count only purchased chapters for PARTIAL', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'PARTIAL' });
      mockPrisma.chapterPurchase.findMany.mockResolvedValue([
        { chapterId: 'ch-1' },
        { chapterId: 'ch-2' },
      ]);
      mockPrisma.lesson.count.mockResolvedValue(5); // 5 lessons in purchased chapters
      mockPrisma.lessonProgress.count.mockResolvedValue(3);
      mockPrisma.enrollment.update.mockResolvedValue({});

      const progress = await service.recalculateEnrollmentProgress('user-1', 'course-1');

      expect(progress).toBe(0.6);
      expect(mockCertificates.generateCertificate).not.toHaveBeenCalled(); // PARTIAL
    });
  });
});
