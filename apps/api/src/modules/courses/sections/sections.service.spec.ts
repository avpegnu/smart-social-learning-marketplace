import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CourseManagementService } from '../management/course-management.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  section: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  chapter: {
    findMany: jest.fn(),
  },
  course: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCourseManagement = {
  verifyOwnership: jest.fn(),
};

describe('SectionsService', () => {
  let service: SectionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SectionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CourseManagementService, useValue: mockCourseManagement },
      ],
    }).compile();

    service = module.get(SectionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create section with provided order', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.create.mockResolvedValue({
        id: 'sec-1',
        title: 'Getting Started',
        order: 0,
        courseId: 'course-1',
      });

      const result = await service.create('course-1', 'instr-1', {
        title: 'Getting Started',
        order: 0,
      });

      expect(result.title).toBe('Getting Started');
      expect(mockCourseManagement.verifyOwnership).toHaveBeenCalledWith('course-1', 'instr-1');
    });

    it('should auto-assign order when not provided', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findFirst.mockResolvedValue({ order: 2 });
      mockPrisma.section.create.mockResolvedValue({
        id: 'sec-1',
        title: 'New Section',
        order: 3,
        courseId: 'course-1',
      });

      const dto = { title: 'New Section' } as { title: string; order?: number };
      await service.create('course-1', 'instr-1', dto);

      expect(dto.order).toBe(3);
    });

    it('should start order at 0 when no sections exist', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findFirst.mockResolvedValue(null);
      mockPrisma.section.create.mockResolvedValue({ id: 'sec-1' });

      const dto = { title: 'First Section' } as { title: string; order?: number };
      await service.create('course-1', 'instr-1', dto);

      expect(dto.order).toBe(0);
    });
  });

  describe('update', () => {
    it('should update section', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        courseId: 'course-1',
      });
      mockPrisma.section.update.mockResolvedValue({ id: 'sec-1', title: 'Updated' });

      const result = await service.update('course-1', 'sec-1', 'instr-1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
    });

    it('should throw if section does not belong to course', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        courseId: 'other-course',
      });

      await expect(
        service.update('course-1', 'sec-1', 'instr-1', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete section and recalculate counters', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        courseId: 'course-1',
      });
      mockPrisma.section.delete.mockResolvedValue({});
      mockPrisma.chapter.findMany.mockResolvedValue([]);
      mockPrisma.course.update.mockResolvedValue({});

      await service.delete('course-1', 'sec-1', 'instr-1');

      expect(mockPrisma.section.delete).toHaveBeenCalledWith({ where: { id: 'sec-1' } });
      expect(mockPrisma.course.update).toHaveBeenCalled(); // recalculate
    });
  });

  describe('reorder', () => {
    it('should reorder sections in transaction', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder('course-1', 'instr-1', ['sec-3', 'sec-1', 'sec-2']);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()]),
      );
    });
  });

  describe('recalculateCourseCounters', () => {
    it('should sum chapter counters to course', async () => {
      mockPrisma.chapter.findMany.mockResolvedValue([
        { lessonsCount: 5, totalDuration: 3000 },
        { lessonsCount: 3, totalDuration: 1500 },
      ]);
      mockPrisma.course.update.mockResolvedValue({});

      await service.recalculateCourseCounters('course-1');

      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: { totalLessons: 8, totalDuration: 4500 },
      });
    });
  });
});
