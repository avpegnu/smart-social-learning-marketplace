import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CoursePlayerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getLesson(userId: string, courseId: string, lessonId: string) {
    // 1. Get lesson with full context
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: { section: { select: { courseId: true } } },
        },
        media: true,
        attachments: true,
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, order: true }, // NO isCorrect!
                },
              },
            },
          },
        },
      },
    });

    if (!lesson || lesson.chapter.section.courseId !== courseId) {
      throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });
    }

    // 2. Access control — 3 checks
    await this.verifyAccess(userId, courseId, lesson.chapter.id, lesson.chapter.isFreePreview);

    // 3. Get user's progress for this lesson
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    // 4. Get curriculum with completion status
    const curriculum = await this.getCurriculumWithProgress(userId, courseId);

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        textContent: lesson.textContent,
        videoUrl: lesson.videoUrl,
        fileUrl: lesson.fileUrl,
        fileMimeType: lesson.fileMimeType,
        estimatedDuration: lesson.estimatedDuration,
        media: lesson.media,
        attachments: lesson.attachments,
        quiz: lesson.quiz,
        isCompleted: progress?.isCompleted ?? false,
        progress: progress
          ? {
              lastPosition: progress.lastPosition,
              watchedPercent: progress.watchedPercent,
              watchedSegments: progress.watchedSegments,
            }
          : null,
      },
      curriculum,
    };
  }

  // ==================== ACCESS CONTROL ====================

  private async verifyAccess(
    userId: string,
    courseId: string,
    chapterId: string,
    isFreePreview: boolean,
  ) {
    // Check 1: Free preview — always accessible
    if (isFreePreview) return;

    // Check 2: FULL enrollment → access all
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (enrollment?.type === 'FULL') return;

    // Check 3: Chapter purchase → access purchased chapter
    const chapterPurchase = await this.prisma.chapterPurchase.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
    });
    if (chapterPurchase) return;

    throw new ForbiddenException({ code: 'LESSON_ACCESS_DENIED' });
  }

  // ==================== CURRICULUM SIDEBAR ====================

  private async getCurriculumWithProgress(userId: string, courseId: string) {
    const sections = await this.prisma.section.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, type: true, estimatedDuration: true },
            },
          },
        },
      },
    });

    // Batch query completed lessons (Set for O(1) lookup)
    const completedLessons = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        isCompleted: true,
        lesson: { chapter: { section: { courseId } } },
      },
      select: { lessonId: true },
    });
    const completedIds = new Set(completedLessons.map((l) => l.lessonId));

    return sections.map((section) => ({
      ...section,
      chapters: section.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => ({
          ...lesson,
          isCompleted: completedIds.has(lesson.id),
        })),
      })),
    }));
  }
}
