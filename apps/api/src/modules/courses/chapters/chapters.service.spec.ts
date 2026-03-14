import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CourseManagementService } from '../management/course-management.service';
import { SectionsService } from '../sections/sections.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  chapter: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  section: {
    findUnique: jest.fn(),
  },
  lesson: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCourseManagement = { verifyOwnership: jest.fn() };
const mockSectionsService = { recalculateCourseCounters: jest.fn() };

describe('ChaptersService', () => {
  let service: ChaptersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChaptersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CourseManagementService, useValue: mockCourseManagement },
        { provide: SectionsService, useValue: mockSectionsService },
      ],
    }).compile();

    service = module.get(ChaptersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create chapter with auto-order', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.chapter.findFirst.mockResolvedValue({ order: 1 });
      mockPrisma.chapter.create.mockResolvedValue({
        id: 'ch-1',
        title: 'Intro',
        order: 2,
        sectionId: 'sec-1',
      });

      const dto = { title: 'Intro' } as { title: string; order?: number };
      const result = await service.create('course-1', 'sec-1', 'instr-1', dto);

      expect(result.title).toBe('Intro');
      expect(dto.order).toBe(2);
    });
  });

  describe('update', () => {
    it('should update chapter', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: 'ch-1',
        section: { courseId: 'course-1' },
      });
      mockPrisma.chapter.update.mockResolvedValue({ id: 'ch-1', title: 'Updated' });

      const result = await service.update('course-1', 'ch-1', 'instr-1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
    });

    it('should throw if chapter does not belong to course', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: 'ch-1',
        section: { courseId: 'other-course' },
      });

      await expect(
        service.update('course-1', 'ch-1', 'instr-1', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete chapter and recalculate course counters', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: 'ch-1',
        section: { courseId: 'course-1' },
      });
      mockPrisma.chapter.delete.mockResolvedValue({});
      mockSectionsService.recalculateCourseCounters.mockResolvedValue({});

      await service.delete('course-1', 'ch-1', 'instr-1');

      expect(mockPrisma.chapter.delete).toHaveBeenCalledWith({ where: { id: 'ch-1' } });
      expect(mockSectionsService.recalculateCourseCounters).toHaveBeenCalledWith('course-1');
    });
  });

  describe('recalculateChapterCounters', () => {
    it('should aggregate lesson counts and cascade to course', async () => {
      mockPrisma.lesson.findMany.mockResolvedValue([
        { estimatedDuration: 600 },
        { estimatedDuration: 300 },
        { estimatedDuration: null },
      ]);
      mockPrisma.chapter.update.mockResolvedValue({
        id: 'ch-1',
        sectionId: 'sec-1',
        lessonsCount: 3,
        totalDuration: 900,
      });
      mockPrisma.section.findUnique.mockResolvedValue({ courseId: 'course-1' });
      mockSectionsService.recalculateCourseCounters.mockResolvedValue({});

      await service.recalculateChapterCounters('ch-1');

      expect(mockPrisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 'ch-1' },
        data: { lessonsCount: 3, totalDuration: 900 },
      });
      expect(mockSectionsService.recalculateCourseCounters).toHaveBeenCalledWith('course-1');
    });
  });

  describe('reorder', () => {
    it('should verify section belongs to course before reorder', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findUnique.mockResolvedValue({ id: 'sec-1', courseId: 'course-1' });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder('course-1', 'sec-1', 'instr-1', ['ch-2', 'ch-1']);

      expect(mockPrisma.section.findUnique).toHaveBeenCalledWith({ where: { id: 'sec-1' } });
    });

    it('should throw if section does not belong to course', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findUnique.mockResolvedValue({ id: 'sec-1', courseId: 'other' });

      await expect(service.reorder('course-1', 'sec-1', 'instr-1', ['ch-1'])).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
