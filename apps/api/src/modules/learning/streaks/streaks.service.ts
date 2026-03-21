import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const MS_PER_DAY = 86400000;

@Injectable()
export class StreaksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==================== DAILY ACTIVITY ====================

  async trackDailyActivity(userId: string, type: 'lesson' | 'quiz') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const incrementField =
      type === 'lesson'
        ? { lessonsCompleted: { increment: 1 } }
        : { quizzesPassed: { increment: 1 } };

    await this.prisma.dailyActivity.upsert({
      where: { userId_activityDate: { userId, activityDate: today } },
      update: incrementField,
      create: {
        userId,
        activityDate: today,
        lessonsCompleted: type === 'lesson' ? 1 : 0,
        quizzesPassed: type === 'quiz' ? 1 : 0,
      },
    });
  }

  // ==================== STREAK ====================

  async getStreak(userId: string) {
    const activities = await this.prisma.dailyActivity.findMany({
      where: { userId },
      orderBy: { activityDate: 'desc' },
      take: 365,
    });

    if (activities.length === 0) {
      return { currentStreak: 0, longestStreak: 0, todayCompleted: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today has activity
    const firstDate = new Date(activities[0]!.activityDate);
    firstDate.setHours(0, 0, 0, 0);
    const todayCompleted = firstDate.getTime() === today.getTime();

    // Current streak: start from today if active, yesterday if not
    let streak = 0;
    const startDate = todayCompleted ? today : new Date(today.getTime() - MS_PER_DAY);

    for (let i = 0; i < activities.length; i++) {
      const expected = new Date(startDate.getTime() - i * MS_PER_DAY);
      expected.setHours(0, 0, 0, 0);

      const activityDate = new Date(activities[i]!.activityDate);
      activityDate.setHours(0, 0, 0, 0);

      if (activityDate.getTime() === expected.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    // Longest streak
    let longestStreak = 1;
    let currentRun = 1;
    for (let i = 1; i < activities.length; i++) {
      const prev = new Date(activities[i - 1]!.activityDate);
      const curr = new Date(activities[i]!.activityDate);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / MS_PER_DAY);

      if (diffDays === 1) {
        currentRun++;
      } else {
        longestStreak = Math.max(longestStreak, currentRun);
        currentRun = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentRun, streak);

    return { currentStreak: streak, longestStreak, todayCompleted };
  }

  // ==================== DASHBOARD ====================

  async getDashboard(userId: string) {
    const [activeEnrollments, completedEnrollments, streak, certificates] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId, progress: { lt: 1 } },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
              totalLessons: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.enrollment.findMany({
        where: { userId, progress: { gte: 1 } },
        include: {
          course: {
            select: { id: true, title: true, slug: true, thumbnailUrl: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.getStreak(userId),
      this.prisma.certificate.findMany({
        where: { userId },
        select: { id: true, courseId: true, verifyCode: true, createdAt: true },
      }),
    ]);

    // Find next lesson for each active course
    const activeCourses = await Promise.all(
      activeEnrollments.map(async (enrollment) => {
        const nextLesson = await this.prisma.lesson.findFirst({
          where: {
            chapter: { section: { courseId: enrollment.courseId } },
            lessonProgresses: { none: { userId, isCompleted: true } },
          },
          orderBy: [
            { chapter: { section: { order: 'asc' } } },
            { chapter: { order: 'asc' } },
            { order: 'asc' },
          ],
          select: { id: true, title: true, type: true },
        });

        return { ...enrollment, nextLesson };
      }),
    );

    // Get first lesson for completed courses (for "Review" button)
    const completedCourses = await Promise.all(
      completedEnrollments.map(async (e) => {
        const firstLesson = await this.prisma.lesson.findFirst({
          where: { chapter: { section: { courseId: e.courseId } } },
          orderBy: [
            { chapter: { section: { order: 'asc' } } },
            { chapter: { order: 'asc' } },
            { order: 'asc' },
          ],
          select: { id: true, title: true, type: true },
        });
        return {
          ...e,
          firstLesson,
          certificate: certificates.find((c) => c.courseId === e.courseId) ?? null,
        };
      }),
    );

    return { activeCourses, completedCourses, streak };
  }
}
