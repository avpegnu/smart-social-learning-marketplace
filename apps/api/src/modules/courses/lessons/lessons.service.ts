import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CourseManagementService } from '../management/course-management.service';
import { ChaptersService } from '../chapters/chapters.service';
import type { CreateLessonDto, UpdateLessonDto } from '../dto/create-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
    @Inject(ChaptersService) private readonly chaptersService: ChaptersService,
  ) {}

  async create(courseId: string, chapterId: string, instructorId: string, dto: CreateLessonDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifyChapterBelongsToCourse(chapterId, courseId);

    // Auto-assign order if not provided
    if (dto.order === undefined) {
      const lastLesson = await this.prisma.lesson.findFirst({
        where: { chapterId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      dto.order = (lastLesson?.order ?? -1) + 1;
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        title: dto.title,
        type: dto.type,
        order: dto.order,
        textContent: dto.textContent,
        videoUrl: dto.videoUrl,
        fileUrl: dto.fileUrl,
        fileMimeType: dto.fileMimeType,
        estimatedDuration: dto.estimatedDuration,
        chapterId,
      },
    });

    // Recalculate chapter + course counters
    await this.chaptersService.recalculateChapterCounters(chapterId);

    return lesson;
  }

  async update(courseId: string, lessonId: string, instructorId: string, dto: UpdateLessonDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    const lesson = await this.verifyLessonBelongsToCourse(lessonId, courseId);

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...dto,
        // Reset cached extracted text when file URL changes so next index run re-extracts
        ...(dto.fileUrl !== undefined ? { fileExtractedText: null } : {}),
      },
    });

    // Recalculate if duration changed
    if (dto.estimatedDuration !== undefined) {
      await this.chaptersService.recalculateChapterCounters(lesson.chapterId);
    }

    return updated;
  }

  async delete(courseId: string, lessonId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    const lesson = await this.verifyLessonBelongsToCourse(lessonId, courseId);

    await this.prisma.lesson.update({ where: { id: lessonId }, data: { deletedAt: new Date() } });

    // Recalculate chapter + course counters
    await this.chaptersService.recalculateChapterCounters(lesson.chapterId);
  }

  async reorder(courseId: string, _chapterId: string, instructorId: string, orderedIds: string[]) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.lesson.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifyChapterBelongsToCourse(chapterId: string, courseId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { section: { select: { courseId: true } } },
    });
    if (!chapter || chapter.section.courseId !== courseId) {
      throw new NotFoundException({ code: 'CHAPTER_NOT_FOUND' });
    }
    return chapter;
  }

  private async verifyLessonBelongsToCourse(lessonId: string, courseId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { section: { select: { courseId: true } } } } },
    });
    if (!lesson || lesson.chapter.section.courseId !== courseId) {
      throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });
    }
    return lesson;
  }
}
