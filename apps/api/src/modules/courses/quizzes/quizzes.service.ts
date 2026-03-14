import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CourseManagementService } from '../management/course-management.service';
import type { CreateQuizDto } from '../dto/create-quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
  ) {}

  /** Create or update quiz for a lesson (upsert: delete old → create new) */
  async upsertQuiz(courseId: string, lessonId: string, instructorId: string, dto: CreateQuizDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifyLessonBelongsToCourse(lessonId, courseId);

    // Validate: each question must have exactly 1 correct option
    for (const q of dto.questions) {
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException({ code: 'QUIZ_INVALID_CORRECT_OPTIONS' });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing quiz if any (cascade deletes questions + options)
      await tx.quiz.deleteMany({ where: { lessonId } });

      // Create new quiz with nested questions + options
      return tx.quiz.create({
        data: {
          lessonId,
          passingScore: dto.passingScore !== undefined ? dto.passingScore / 100 : 0.7,
          maxAttempts: dto.maxAttempts,
          timeLimitSeconds: dto.timeLimitSeconds,
          questions: {
            create: dto.questions.map((q, qi) => ({
              question: q.question,
              explanation: q.explanation,
              order: qi,
              options: {
                create: q.options.map((o, oi) => ({
                  text: o.text,
                  isCorrect: o.isCorrect,
                  order: oi,
                })),
              },
            })),
          },
        },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { orderBy: { order: 'asc' } } },
          },
        },
      });
    });
  }

  async getQuiz(courseId: string, lessonId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    return this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  async deleteQuiz(courseId: string, lessonId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    await this.prisma.quiz.deleteMany({ where: { lessonId } });
  }

  // ==================== PRIVATE HELPERS ====================

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
