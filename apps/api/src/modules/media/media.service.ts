import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { MediaType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsService } from '@/uploads/uploads.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SignUploadDto } from './dto/sign-upload.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UploadsService) private readonly uploadsService: UploadsService,
  ) {}

  async signAndCreatePending(userId: string, dto: SignUploadDto) {
    if (dto.lessonId) {
      await this.verifyLessonOwnership(userId, dto.lessonId);
    }

    // Create pending media record
    const media = await this.prisma.media.create({
      data: {
        type: dto.type as MediaType,
        status: 'UPLOADING',
        originalName: '',
        mimeType: '',
        size: 0,
        lessonId: dto.lessonId,
      },
    });

    // Build folder path
    const folder = dto.folder || this.buildFolder(userId, dto.type, dto.lessonId);

    // Generate signed params
    const params = await this.uploadsService.generateSignedUploadParams(folder);

    return { mediaId: media.id, ...params };
  }

  async completeUpload(mediaId: string, userId: string, dto: CompleteUploadDto) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        lesson: {
          include: {
            chapter: { select: { id: true, sectionId: true } },
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
    }
    if (media.status !== 'UPLOADING') {
      throw new BadRequestException({ code: 'MEDIA_NOT_UPLOADING' });
    }
    if (media.lessonId) {
      await this.verifyLessonOwnership(userId, media.lessonId);
    }

    const { cloudinaryResult: cr } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update media record
      const updated = await tx.media.update({
        where: { id: mediaId },
        data: {
          status: 'READY',
          publicId: cr.publicId,
          urls: { original: cr.secureUrl } as Prisma.InputJsonValue,
          size: cr.bytes,
          mimeType: cr.format,
          originalName: cr.originalFilename || cr.publicId,
          duration: cr.duration,
        },
      });

      // 2. If linked to lesson with duration — update counters
      if (media.lessonId && cr.duration) {
        await tx.lesson.update({
          where: { id: media.lessonId },
          data: { estimatedDuration: cr.duration },
        });

        await this.recalculateCounters(tx, media.lesson!.chapter!.id);
      }

      return updated;
    });
  }

  async deleteMedia(mediaId: string, userId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
    }

    if (media.lessonId) {
      await this.verifyLessonOwnership(userId, media.lessonId);
    }

    // Delete from Cloudinary (async, don't block response)
    if (media.publicId) {
      this.uploadsService.deleteFile(media.publicId).catch(() => {});
    }

    return this.prisma.media.delete({ where: { id: mediaId } });
  }

  async getByLessonId(lessonId: string) {
    return this.prisma.media.findMany({
      where: { lessonId, status: 'READY' },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async recalculateCounters(tx: Prisma.TransactionClient, chapterId: string) {
    // Recalculate chapter
    const chapterStats = await tx.lesson.aggregate({
      where: { chapterId },
      _sum: { estimatedDuration: true },
      _count: true,
    });
    const chapter = await tx.chapter.update({
      where: { id: chapterId },
      data: {
        totalDuration: chapterStats._sum.estimatedDuration || 0,
        lessonsCount: chapterStats._count,
      },
      select: { sectionId: true },
    });

    // Recalculate course via section
    const section = await tx.section.findUnique({
      where: { id: chapter.sectionId },
      select: { courseId: true },
    });
    if (section) {
      const courseStats = await tx.lesson.aggregate({
        where: {
          chapter: { section: { courseId: section.courseId } },
        },
        _sum: { estimatedDuration: true },
        _count: true,
      });
      await tx.course.update({
        where: { id: section.courseId },
        data: {
          totalDuration: courseStats._sum.estimatedDuration || 0,
          totalLessons: courseStats._count,
        },
      });
    }
  }

  private async verifyLessonOwnership(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            section: {
              include: {
                course: { select: { instructorId: true } },
              },
            },
          },
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });
    }
    if (lesson.chapter.section.course.instructorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_LESSON_OWNER' });
    }
  }

  private buildFolder(userId: string, type: string, lessonId?: string): string {
    if (lessonId) return `courses/lessons/${lessonId}`;
    if (type === 'IMAGE') return `users/${userId}/images`;
    return `users/${userId}/files`;
  }
}
