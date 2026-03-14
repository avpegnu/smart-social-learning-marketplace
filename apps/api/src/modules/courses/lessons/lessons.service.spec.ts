import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CourseManagementService } from '../management/course-management.service';
import { ChaptersService } from '../chapters/chapters.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  lesson: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  chapter: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCourseManagement = { verifyOwnership: jest.fn() };
const mockChaptersService = { recalculateChapterCounters: jest.fn() };

describe('LessonsService', () => {
  let service: LessonsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CourseManagementService, useValue: mockCourseManagement },
        { provide: ChaptersService, useValue: mockChaptersService },
      ],
    }).compile();

    service = module.get(LessonsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create lesson and recalculate counters', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: 'ch-1',
        section: { courseId: 'course-1' },
      });
      mockPrisma.lesson.findFirst.mockResolvedValue(null);
      mockPrisma.lesson.create.mockResolvedValue({
        id: 'les-1',
        title: 'What is React?',
        type: 'VIDEO',
        order: 0,
        chapterId: 'ch-1',
      });
      mockChaptersService.recalculateChapterCounters.mockResolvedValue({});

      const dto = { title: 'What is React?', type: 'VIDEO' } as {
        title: string;
        type: string;
        order?: number;
      };
      const result = await service.create('course-1', 'ch-1', 'instr-1', dto as never);

      expect(result.title).toBe('What is React?');
      expect(mockChaptersService.recalculateChapterCounters).toHaveBeenCalledWith('ch-1');
    });

    it('should throw if chapter does not belong to course', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: 'ch-1',
        section: { courseId: 'other-course' },
      });

      await expect(
        service.create('course-1', 'ch-1', 'instr-1', {
          title: 'Test',
          type: 'VIDEO',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update lesson and recalculate if duration changed', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapterId: 'ch-1',
        chapter: { section: { courseId: 'course-1' } },
      });
      mockPrisma.lesson.update.mockResolvedValue({ id: 'les-1' });
      mockChaptersService.recalculateChapterCounters.mockResolvedValue({});

      await service.update('course-1', 'les-1', 'instr-1', {
        estimatedDuration: 600,
      } as never);

      expect(mockChaptersService.recalculateChapterCounters).toHaveBeenCalledWith('ch-1');
    });

    it('should not recalculate if duration not changed', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapterId: 'ch-1',
        chapter: { section: { courseId: 'course-1' } },
      });
      mockPrisma.lesson.update.mockResolvedValue({ id: 'les-1' });

      await service.update('course-1', 'les-1', 'instr-1', { title: 'Updated' } as never);

      expect(mockChaptersService.recalculateChapterCounters).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete lesson and recalculate counters', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapterId: 'ch-1',
        chapter: { section: { courseId: 'course-1' } },
      });
      mockPrisma.lesson.delete.mockResolvedValue({});
      mockChaptersService.recalculateChapterCounters.mockResolvedValue({});

      await service.delete('course-1', 'les-1', 'instr-1');

      expect(mockPrisma.lesson.delete).toHaveBeenCalledWith({ where: { id: 'les-1' } });
      expect(mockChaptersService.recalculateChapterCounters).toHaveBeenCalledWith('ch-1');
    });

    it('should throw if lesson does not belong to course', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapterId: 'ch-1',
        chapter: { section: { courseId: 'other-course' } },
      });

      await expect(service.delete('course-1', 'les-1', 'instr-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorder', () => {
    it('should reorder lessons in transaction', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder('course-1', 'ch-1', 'instr-1', ['les-3', 'les-1', 'les-2']);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
