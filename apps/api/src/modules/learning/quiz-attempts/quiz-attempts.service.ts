import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { StreaksService } from '../streaks/streaks.service';
import type { SubmitQuizDto } from '../dto/submit-quiz.dto';

@Injectable()
export class QuizAttemptsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressService) private readonly progressService: ProgressService,
    @Inject(StreaksService) private readonly streaksService: StreaksService,
  ) {}

  async submitQuiz(userId: string, lessonId: string, dto: SubmitQuizDto) {
    // 1. Find quiz by lessonId
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: { include: { options: true } },
        lesson: {
          include: { chapter: { include: { section: { select: { courseId: true } } } } },
        },
      },
    });
    if (!quiz) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND' });

    // 2. Verify enrollment
    const courseId = quiz.lesson.chapter.section.courseId;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

    // 3. Check max attempts
    if (quiz.maxAttempts) {
      const attemptCount = await this.prisma.quizAttempt.count({
        where: { userId, quizId: quiz.id },
      });
      if (attemptCount >= quiz.maxAttempts) {
        throw new BadRequestException({ code: 'MAX_ATTEMPTS_REACHED' });
      }
    }

    // 4. Grade answers
    let correctCount = 0;
    const answerResults = dto.answers.map((a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      const correctOption = question?.options.find((o) => o.isCorrect);
      const isCorrect = correctOption?.id === a.selectedOptionId;
      if (isCorrect) correctCount++;
      return { questionId: a.questionId, selectedOptionId: a.selectedOptionId, isCorrect };
    });

    const totalQuestions = quiz.questions.length;
    const score = totalQuestions > 0 ? correctCount / totalQuestions : 0;
    // passingScore stored as decimal (0.7) or percentage (70) — normalize
    const passingThreshold = quiz.passingScore > 1 ? quiz.passingScore / 100 : quiz.passingScore;
    const passed = score >= passingThreshold;

    // 5. Save attempt
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        score,
        passed,
        startedAt: new Date(),
        endedAt: new Date(),
        answers: { create: answerResults },
      },
    });

    // 6. If passed → mark lesson as complete
    let courseProgress = enrollment.progress;
    if (passed) {
      await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { isCompleted: true, watchedPercent: 1 },
        create: { userId, lessonId, isCompleted: true, watchedPercent: 1 },
      });
      courseProgress = await this.progressService.recalculateEnrollmentProgress(userId, courseId);
      await this.streaksService.trackDailyActivity(userId, 'quiz');
    }

    // 7. Build results with explanations
    const results = dto.answers.map((a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      const correctOption = question?.options.find((o) => o.isCorrect);
      return {
        questionId: a.questionId,
        correct: correctOption?.id === a.selectedOptionId,
        correctAnswer: correctOption?.id ?? null,
        explanation: question?.explanation ?? null,
      };
    });

    return {
      attempt: { id: attempt.id, score: Math.round(score * 100), passed },
      correctCount,
      totalQuestions,
      results,
      lessonCompleted: passed,
      courseProgress,
    };
  }

  async getAttempts(userId: string, lessonId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { lessonId } });
    if (!quiz) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND' });

    return this.prisma.quizAttempt.findMany({
      where: { userId, quizId: quiz.id },
      include: { answers: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
