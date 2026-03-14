import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseManagementService } from './course-management.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  course: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  courseTag: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  tag: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

const MOCK_COURSE = {
  id: 'course-1',
  title: 'React Masterclass',
  slug: 'react-masterclass-abc',
  instructorId: 'instr-1',
  status: 'DRAFT',
  deletedAt: null,
  description: 'Full description with at least fifty characters for validation test',
  categoryId: 'cat-1',
};

describe('CourseManagementService', () => {
  let service: CourseManagementService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CourseManagementService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CourseManagementService);
    jest.clearAllMocks();
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a course with auto-generated slug', async () => {
      mockPrisma.course.create.mockResolvedValue({
        ...MOCK_COURSE,
        category: null,
        courseTags: [],
      });

      const result = await service.create('instr-1', {
        title: 'React Masterclass',
      } as never);

      expect(result).toBeDefined();
      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'React Masterclass',
            instructorId: 'instr-1',
            slug: expect.any(String),
          }),
        }),
      );
    });

    it('should create course with tags', async () => {
      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag-1', name: 'react', slug: 'react' });
      mockPrisma.course.create.mockResolvedValue({
        ...MOCK_COURSE,
        courseTags: [{ tagId: 'tag-1' }],
      });

      await service.create('instr-1', {
        title: 'React Masterclass',
        tags: ['react'],
      } as never);

      expect(mockPrisma.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'react' },
        }),
      );
    });
  });

  // ==================== verifyOwnership ====================

  describe('verifyOwnership', () => {
    it('should return course when owner matches', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(MOCK_COURSE);

      const result = await service.verifyOwnership('course-1', 'instr-1');

      expect(result).toEqual(MOCK_COURSE);
    });

    it('should throw NotFoundException when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.verifyOwnership('bad-id', 'instr-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...MOCK_COURSE,
        deletedAt: new Date(),
      });

      await expect(service.verifyOwnership('course-1', 'instr-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when not owner', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(MOCK_COURSE);

      await expect(service.verifyOwnership('course-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should reject update when course is PUBLISHED', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...MOCK_COURSE,
        status: 'PUBLISHED',
      });

      await expect(
        service.update('course-1', 'instr-1', { title: 'Updated' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow update when course is DRAFT', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(MOCK_COURSE);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          courseTag: { deleteMany: jest.fn(), createMany: jest.fn() },
          course: { update: jest.fn().mockResolvedValue(MOCK_COURSE) },
        }),
      );

      await service.update('course-1', 'instr-1', { title: 'Updated' } as never);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should allow update when course is REJECTED', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...MOCK_COURSE,
        status: 'REJECTED',
      });
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          courseTag: { deleteMany: jest.fn(), createMany: jest.fn() },
          course: { update: jest.fn().mockResolvedValue(MOCK_COURSE) },
        }),
      );

      await expect(
        service.update('course-1', 'instr-1', { price: 599000 } as never),
      ).resolves.toBeDefined();
    });
  });

  // ==================== submitForReview ====================

  describe('submitForReview', () => {
    it('should reject if course is not DRAFT or REJECTED', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({
        ...MOCK_COURSE,
        status: 'PUBLISHED',
      });

      await expect(service.submitForReview('course-1', 'instr-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if course has no sections', async () => {
      mockPrisma.course.findUnique
        .mockResolvedValueOnce(MOCK_COURSE) // verifyOwnership
        .mockResolvedValueOnce({
          // validateCourseCompleteness
          ...MOCK_COURSE,
          sections: [],
        });

      await expect(service.submitForReview('course-1', 'instr-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if course has no content (empty chapters)', async () => {
      mockPrisma.course.findUnique
        .mockResolvedValueOnce(MOCK_COURSE) // verifyOwnership
        .mockResolvedValueOnce({
          // validateCourseCompleteness
          ...MOCK_COURSE,
          sections: [{ chapters: [{ lessons: [] }] }],
        });

      await expect(service.submitForReview('course-1', 'instr-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should submit successfully with valid course', async () => {
      mockPrisma.course.findUnique
        .mockResolvedValueOnce(MOCK_COURSE) // verifyOwnership
        .mockResolvedValueOnce({
          // validateCourseCompleteness
          ...MOCK_COURSE,
          sections: [
            {
              chapters: [
                {
                  lessons: [{ id: 'lesson-1', type: 'VIDEO', textContent: null }],
                },
              ],
            },
          ],
        });
      mockPrisma.course.update.mockResolvedValue({ ...MOCK_COURSE, status: 'PENDING_REVIEW' });

      const result = await service.submitForReview('course-1', 'instr-1');

      expect(result.status).toBe('PENDING_REVIEW');
    });
  });

  // ==================== softDelete ====================

  describe('softDelete', () => {
    it('should set deletedAt on course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(MOCK_COURSE);
      mockPrisma.course.update.mockResolvedValue({ ...MOCK_COURSE, deletedAt: new Date() });

      const result = await service.softDelete('course-1', 'instr-1');

      expect(result.deletedAt).toBeDefined();
      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  // ==================== getInstructorCourses ====================

  describe('getInstructorCourses', () => {
    it('should return paginated instructor courses', async () => {
      mockPrisma.course.findMany.mockResolvedValue([MOCK_COURSE]);
      mockPrisma.course.count.mockResolvedValue(1);

      const result = await service.getInstructorCourses('instr-1', {
        page: 1,
        limit: 20,
        skip: 0,
      } as never);

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instructorId: 'instr-1',
            deletedAt: null,
          }),
        }),
      );
    });
  });

  // ==================== updateTags ====================

  describe('updateTags', () => {
    it('should replace all tags', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(MOCK_COURSE);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateTags('course-1', 'instr-1', ['tag-1', 'tag-2']);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.courseTag.deleteMany).toHaveBeenCalledWith({
        where: { courseId: 'course-1' },
      });
      expect(mockPrisma.courseTag.createMany).toHaveBeenCalledWith({
        data: [
          { courseId: 'course-1', tagId: 'tag-1' },
          { courseId: 'course-1', tagId: 'tag-2' },
        ],
      });
    });
  });
});
