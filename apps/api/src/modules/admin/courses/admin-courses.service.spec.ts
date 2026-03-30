import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminCoursesService } from './admin-courses.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingsService } from '@/modules/ai-tutor/embeddings/embeddings.service';

describe('AdminCoursesService', () => {
  let service: AdminCoursesService;
  const tx = {
    course: { update: jest.fn() },
    group: { create: jest.fn() },
  };
  const prisma = {
    course: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  const embeddings = {
    indexCourseContent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminCoursesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingsService, useValue: embeddings },
      ],
    }).compile();
    service = module.get(AdminCoursesService);
    jest.clearAllMocks();
  });

  describe('reviewCourse', () => {
    const course = {
      id: 'c1',
      title: 'React Course',
      status: 'PENDING_REVIEW',
      instructorId: 'inst1',
      publishedAt: null,
    };

    it('should approve course and create group', async () => {
      prisma.course.findUnique.mockResolvedValue(course);
      tx.course.update.mockResolvedValue({
        ...course,
        status: 'PUBLISHED',
        title: 'React Course',
      });

      await service.reviewCourse('c1', 'admin1', {
        approved: true,
      });

      expect(tx.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
      expect(tx.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'inst1',
            privacy: 'PRIVATE',
          }),
        }),
      );
    });

    it('should reject course without group', async () => {
      prisma.course.findUnique.mockResolvedValue(course);
      prisma.course.update.mockResolvedValue({
        ...course,
        status: 'REJECTED',
      });

      const result = await service.reviewCourse('c1', 'admin1', {
        approved: false,
      });

      expect(result.status).toBe('REJECTED');
      expect(tx.group.create).not.toHaveBeenCalled();
    });

    it('should throw if course not found', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.reviewCourse('x', 'admin1', { approved: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if not pending review', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...course,
        status: 'PUBLISHED',
      });
      await expect(service.reviewCourse('c1', 'admin1', { approved: true })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
