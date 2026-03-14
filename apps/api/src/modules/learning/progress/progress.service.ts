import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { mergeSegments, calculateWatchedPercent } from '@/common/utils/segments.util';
import { LESSON_COMPLETE_THRESHOLD } from '@/common/constants/app.constant';
import { CertificatesService } from '../certificates/certificates.service';
import { StreaksService } from '../streaks/streaks.service';
import type { UpdateProgressDto } from '../dto/update-progress.dto';

@Injectable()
export class ProgressService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CertificatesService) private readonly certificatesService: CertificatesService,
    @Inject(StreaksService) private readonly streaksService: StreaksService,
  ) {}

  // ==================== VIDEO PROGRESS ====================

  async updateLessonProgress(userId: string, lessonId: string, dto: UpdateProgressDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { section: { select: { courseId: true } } } } },
    });
    if (!lesson) throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });

    const courseId = lesson.chapter.section.courseId;

    // Verify enrollment
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

    // Get existing progress
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    // Merge video segments
    const existingSegments = (existing?.watchedSegments as [number, number][]) ?? [];
    const newSegments = dto.watchedSegments ?? [];
    const merged = mergeSegments([...existingSegments, ...newSegments]);

    const totalDuration = lesson.estimatedDuration ?? 0;
    const watchedPercent = calculateWatchedPercent(merged, totalDuration);
    const isCompleted = watchedPercent >= LESSON_COMPLETE_THRESHOLD;

    // Never un-complete
    const finalCompleted = isCompleted || (existing?.isCompleted ?? false);

    // Upsert progress
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        lastPosition: dto.lastPosition ?? existing?.lastPosition ?? 0,
        watchedSegments: merged as unknown as Prisma.InputJsonValue,
        watchedPercent,
        isCompleted: finalCompleted,
      },
      create: {
        userId,
        lessonId,
        lastPosition: dto.lastPosition ?? 0,
        watchedSegments: merged as unknown as Prisma.InputJsonValue,
        watchedPercent,
        isCompleted,
      },
    });

    // If newly completed → recalculate + track activity
    const newlyCompleted = finalCompleted && !existing?.isCompleted;
    let courseProgress = enrollment.progress;

    if (newlyCompleted) {
      courseProgress = await this.recalculateEnrollmentProgress(userId, courseId);
      await this.streaksService.trackDailyActivity(userId, 'lesson');
    }

    return { watchedPercent, isCompleted: finalCompleted, courseProgress };
  }

  // ==================== TEXT LESSON COMPLETE ====================

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { section: { select: { courseId: true } } } } },
    });
    if (!lesson) throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });

    const courseId = lesson.chapter.section.courseId;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

    // Already completed → no-op
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    if (existing?.isCompleted) {
      return { isCompleted: true, courseProgress: enrollment.progress };
    }

    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { isCompleted: true, watchedPercent: 1 },
      create: { userId, lessonId, isCompleted: true, watchedPercent: 1 },
    });

    const courseProgress = await this.recalculateEnrollmentProgress(userId, courseId);
    await this.streaksService.trackDailyActivity(userId, 'lesson');

    return { isCompleted: true, courseProgress };
  }

  // ==================== COURSE PROGRESS ====================

  async getCourseProgress(userId: string, courseId: string) {
    const [enrollment, lessonProgresses] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId, lesson: { chapter: { section: { courseId } } } },
        select: { lessonId: true, isCompleted: true, watchedPercent: true, lastPosition: true },
      }),
    ]);

    if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

    return {
      overallProgress: enrollment.progress,
      lessons: lessonProgresses,
    };
  }

  // ==================== ENROLLMENT PROGRESS RECALCULATION ====================

  async recalculateEnrollmentProgress(userId: string, courseId: string): Promise<number> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return 0;

    // Count accessible lessons based on enrollment type
    let totalLessons: number;
    if (enrollment.type === 'FULL') {
      totalLessons = await this.prisma.lesson.count({
        where: { chapter: { section: { courseId } } },
      });
    } else {
      // PARTIAL: only purchased chapters' lessons
      const purchasedChapters = await this.prisma.chapterPurchase.findMany({
        where: { userId, chapter: { section: { courseId } } },
        select: { chapterId: true },
      });
      totalLessons = await this.prisma.lesson.count({
        where: { chapterId: { in: purchasedChapters.map((p) => p.chapterId) } },
      });
    }

    const completedLessons = await this.prisma.lessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: { chapter: { section: { courseId } } },
      },
    });

    const progress = totalLessons > 0 ? completedLessons / totalLessons : 0;

    await this.prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { progress },
    });

    // Auto-generate certificate at 100% (FULL only)
    if (progress >= 1 && enrollment.type === 'FULL') {
      await this.certificatesService.generateCertificate(userId, courseId);
    }

    return progress;
  }
}
