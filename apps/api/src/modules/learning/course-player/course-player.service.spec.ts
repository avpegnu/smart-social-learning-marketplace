import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CoursePlayerService } from './course-player.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsService } from '@/uploads/uploads.service';

const mockPrisma = {
  lesson: { findUnique: jest.fn() },
  enrollment: { findUnique: jest.fn() },
  chapterPurchase: { findUnique: jest.fn() },
  lessonProgress: { findUnique: jest.fn(), findMany: jest.fn() },
  section: { findMany: jest.fn() },
};

const mockUploads = {
  getSignedVideoUrl: jest.fn((publicId: string) => `https://signed.example/${publicId}`),
};

const MOCK_LESSON = {
  id: 'les-1',
  title: 'What is React?',
  type: 'VIDEO',
  textContent: null,
  videoUrl: null,
  videoPublicId: null,
  estimatedDuration: 600,
  media: [],
  attachments: [],
  quiz: null,
  chapter: {
    id: 'ch-1',
    isFreePreview: false,
    section: { courseId: 'course-1' },
  },
};

describe('CoursePlayerService', () => {
  let service: CoursePlayerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CoursePlayerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UploadsService, useValue: mockUploads },
      ],
    }).compile();

    service = module.get(CoursePlayerService);
    jest.clearAllMocks();
  });

  describe('getLesson', () => {
    it('should return lesson for fully enrolled user', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getLesson('user-1', 'course-1', 'les-1');

      expect(result.lesson.id).toBe('les-1');
      expect(result.lesson.isCompleted).toBe(false);
      expect(result.curriculum).toBeDefined();
    });

    it('should allow free preview access without enrollment', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue({
        ...MOCK_LESSON,
        chapter: { ...MOCK_LESSON.chapter, isFreePreview: true },
      });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getLesson('user-1', 'course-1', 'les-1');

      expect(result.lesson).toBeDefined();
      expect(mockPrisma.enrollment.findUnique).not.toHaveBeenCalled();
    });

    it('should allow access with chapter purchase', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.chapterPurchase.findUnique.mockResolvedValue({ id: 'cp-1' });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getLesson('user-1', 'course-1', 'les-1');

      expect(result.lesson).toBeDefined();
    });

    it('should throw if lesson not found', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(null);

      await expect(service.getLesson('user-1', 'course-1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if lesson belongs to different course', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue({
        ...MOCK_LESSON,
        chapter: { ...MOCK_LESSON.chapter, section: { courseId: 'other-course' } },
      });

      await expect(service.getLesson('user-1', 'course-1', 'les-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should deny access without enrollment or purchase', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.chapterPurchase.findUnique.mockResolvedValue(null);

      await expect(service.getLesson('user-1', 'course-1', 'les-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should include progress when exists', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(MOCK_LESSON);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue({
        lastPosition: 300,
        watchedPercent: 0.5,
        watchedSegments: [[0, 300]],
        isCompleted: false,
      });
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getLesson('user-1', 'course-1', 'les-1');

      expect(result.lesson.progress).toEqual({
        lastPosition: 300,
        watchedPercent: 0.5,
        watchedSegments: [[0, 300]],
      });
    });

    it('should return a signed URL when the lesson has a videoPublicId (authenticated)', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue({
        ...MOCK_LESSON,
        videoUrl: null,
        videoPublicId: 'courses/videos/abc123',
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getLesson('user-1', 'course-1', 'les-1');

      expect(mockUploads.getSignedVideoUrl).toHaveBeenCalledWith('courses/videos/abc123');
      expect(result.lesson.videoUrl).toBe('https://signed.example/courses/videos/abc123');
    });

    it('should return the raw videoUrl for a legacy public video (no publicId)', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue({
        ...MOCK_LESSON,
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/legacy.mp4',
        videoPublicId: null,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrisma.section.findMany.mockResolvedValue([]);
      mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

      const result = await service.getLesson('user-1', 'course-1', 'les-1');

      expect(mockUploads.getSignedVideoUrl).not.toHaveBeenCalled();
      expect(result.lesson.videoUrl).toBe(
        'https://res.cloudinary.com/demo/video/upload/legacy.mp4',
      );
    });
  });
});
