import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsService } from '@/uploads/uploads.service';

describe('MediaService', () => {
  let service: MediaService;
  const tx = {
    media: { update: jest.fn() },
    lesson: { update: jest.fn(), aggregate: jest.fn() },
    chapter: { update: jest.fn() },
    section: { findUnique: jest.fn() },
    course: { update: jest.fn() },
  };
  const prisma = {
    media: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    lesson: { findUnique: jest.fn() },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  const uploads = {
    generateSignedUploadParams: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: UploadsService, useValue: uploads },
      ],
    }).compile();
    service = module.get(MediaService);
    jest.clearAllMocks();
  });

  describe('signAndCreatePending', () => {
    it('should create media record and return signed params', async () => {
      prisma.media.create.mockResolvedValue({ id: 'm1' });
      uploads.generateSignedUploadParams.mockResolvedValue({
        signature: 'sig',
        timestamp: 123,
        cloudName: 'test',
        apiKey: 'key',
      });

      const result = await service.signAndCreatePending('u1', {
        type: 'IMAGE',
      });

      expect(result.mediaId).toBe('m1');
      expect(result.signature).toBe('sig');
      expect(prisma.media.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'IMAGE',
          status: 'UPLOADING',
        }),
      });
    });

    it('should verify ownership when lessonId provided', async () => {
      prisma.lesson.findUnique.mockResolvedValue({
        id: 'l1',
        chapter: {
          section: {
            course: { instructorId: 'other-user' },
          },
        },
      });

      await expect(
        service.signAndCreatePending('u1', {
          type: 'VIDEO',
          lessonId: 'l1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if lesson not found', async () => {
      prisma.lesson.findUnique.mockResolvedValue(null);

      await expect(
        service.signAndCreatePending('u1', {
          type: 'VIDEO',
          lessonId: 'not-exist',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should build correct folder for lesson', async () => {
      prisma.lesson.findUnique.mockResolvedValue({
        id: 'l1',
        chapter: {
          section: { course: { instructorId: 'u1' } },
        },
      });
      prisma.media.create.mockResolvedValue({ id: 'm1' });
      uploads.generateSignedUploadParams.mockResolvedValue({
        signature: 'sig',
        timestamp: 123,
      });

      await service.signAndCreatePending('u1', {
        type: 'VIDEO',
        lessonId: 'l1',
      });

      expect(uploads.generateSignedUploadParams).toHaveBeenCalledWith('courses/lessons/l1');
    });
  });

  describe('completeUpload', () => {
    const media = {
      id: 'm1',
      status: 'UPLOADING',
      lessonId: 'l1',
      lesson: { id: 'l1', chapter: { id: 'ch1', sectionId: 's1' } },
    };

    it('should update media to READY and recalculate counters', async () => {
      prisma.media.findUnique.mockResolvedValue(media);
      prisma.lesson.findUnique.mockResolvedValue({
        id: 'l1',
        chapter: {
          section: { course: { instructorId: 'u1' } },
        },
      });
      tx.media.update.mockResolvedValue({
        ...media,
        status: 'READY',
      });
      tx.lesson.update.mockResolvedValue({});
      tx.lesson.aggregate.mockResolvedValue({
        _sum: { estimatedDuration: 300 },
        _count: 5,
      });
      tx.chapter.update.mockResolvedValue({ sectionId: 's1' });
      tx.section.findUnique.mockResolvedValue({ courseId: 'c1' });
      tx.course.update.mockResolvedValue({});

      const result = await service.completeUpload('m1', 'u1', {
        cloudinaryResult: {
          publicId: 'vid/123',
          secureUrl: 'https://res.cloudinary.com/vid.mp4',
          duration: 120,
          format: 'mp4',
          bytes: 50000000,
        },
      });

      expect(result.status).toBe('READY');
      expect(tx.lesson.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { estimatedDuration: 120 },
      });
    });

    it('should throw if media not found', async () => {
      prisma.media.findUnique.mockResolvedValue(null);

      await expect(
        service.completeUpload('x', 'u1', {
          cloudinaryResult: {
            publicId: 'x',
            secureUrl: 'x',
            format: 'mp4',
            bytes: 0,
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if not UPLOADING status', async () => {
      prisma.media.findUnique.mockResolvedValue({
        ...media,
        status: 'READY',
      });

      await expect(
        service.completeUpload('m1', 'u1', {
          cloudinaryResult: {
            publicId: 'x',
            secureUrl: 'x',
            format: 'mp4',
            bytes: 0,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMedia', () => {
    it('should delete media and cloudinary file', async () => {
      prisma.media.findUnique.mockResolvedValue({
        id: 'm1',
        publicId: 'vid/123',
        lessonId: null,
      });
      prisma.media.delete.mockResolvedValue({ id: 'm1' });
      uploads.deleteFile.mockResolvedValue(undefined);

      await service.deleteMedia('m1', 'u1');

      expect(uploads.deleteFile).toHaveBeenCalledWith('vid/123');
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
    });

    it('should skip cloudinary delete if no publicId', async () => {
      prisma.media.findUnique.mockResolvedValue({
        id: 'm1',
        publicId: null,
        lessonId: null,
      });
      prisma.media.delete.mockResolvedValue({ id: 'm1' });

      await service.deleteMedia('m1', 'u1');

      expect(uploads.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw if not found', async () => {
      prisma.media.findUnique.mockResolvedValue(null);

      await expect(service.deleteMedia('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByLessonId', () => {
    it('should return ready media for lesson', async () => {
      prisma.media.findMany.mockResolvedValue([{ id: 'm1', status: 'READY' }]);

      const result = await service.getByLessonId('l1');

      expect(result).toHaveLength(1);
      expect(prisma.media.findMany).toHaveBeenCalledWith({
        where: { lessonId: 'l1', status: 'READY' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
