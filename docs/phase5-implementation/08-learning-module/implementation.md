# Phase 5.8 — LEARNING MODULE

> Progress tracking, Quiz attempts, Certificates, Daily activity/streak, Placement tests.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase2-database/01-database-design.md`

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: Progress Service](#step-2-progress-service)
- [Step 3: Quiz Attempt Service](#step-3-quiz-attempt-service)
- [Step 4: Certificate Service](#step-4-certificate-service)
- [Step 5: Daily Activity & Streak](#step-5-daily-activity--streak)
- [Step 6: Placement Test Service](#step-6-placement-test-service)
- [Step 7: Controllers](#step-7-controllers)
- [Step 8: Verify](#step-8-verify)

---

## Step 1: Module Structure

```
src/modules/learning/
├── learning.module.ts
├── progress/
│   ├── progress.controller.ts
│   └── progress.service.ts
├── certificates/
│   ├── certificates.controller.ts
│   └── certificates.service.ts
├── placement-tests/
│   ├── placement-tests.controller.ts
│   └── placement-tests.service.ts
└── dto/
    ├── update-progress.dto.ts
    ├── submit-quiz.dto.ts
    └── submit-placement.dto.ts
```

---

## Step 2: Progress Service

### Video watched segments merge algorithm

```typescript
import { mergeSegments, calculateWatchedPercent } from '@/common/utils/segments.util';
import { LESSON_COMPLETE_THRESHOLD } from '@/common/constants/app.constant';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async updateLessonProgress(userId: string, lessonId: string, dto: UpdateProgressDto) {
    // Get lesson for total duration
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { section: true } } },
    });
    if (!lesson) throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });

    // Verify enrollment
    const courseId = lesson.chapter.section.courseId;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

    // Get existing progress
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    // Merge segments
    const existingSegments = (existing?.watchedSegments as [number, number][]) || [];
    const newSegments = dto.watchedSegments || [];
    const merged = mergeSegments([...existingSegments, ...newSegments]);

    const totalDuration = lesson.estimatedDuration || 0;
    const watchedPercent = calculateWatchedPercent(merged, totalDuration);
    const isCompleted =
      lesson.type === 'TEXT' ? dto.completed || false : watchedPercent >= LESSON_COMPLETE_THRESHOLD;

    // Upsert progress
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        lastPosition: dto.lastPosition ?? existing?.lastPosition ?? 0,
        watchedSegments: merged,
        watchedPercent,
        isCompleted,
      },
      create: {
        userId,
        lessonId,
        lastPosition: dto.lastPosition ?? 0,
        watchedSegments: merged,
        watchedPercent,
        isCompleted,
      },
    });

    // Recalculate enrollment progress
    if (isCompleted && !existing?.isCompleted) {
      await this.recalculateEnrollmentProgress(userId, courseId);
      await this.trackDailyActivity(userId);
    }

    return { watchedPercent, isCompleted };
  }

  async recalculateEnrollmentProgress(userId: string, courseId: string) {
    // Count total accessible lessons
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return;

    let totalLessons: number;
    if (enrollment.type === 'FULL') {
      totalLessons = await this.prisma.lesson.count({
        where: { chapter: { section: { courseId } } },
      });
    } else {
      // PARTIAL: count only purchased chapters' lessons
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

    // Auto-generate certificate at 100%
    if (progress >= 1 && enrollment.type === 'FULL') {
      await this.generateCertificate(userId, courseId);
    }
  }

  async getCourseProgress(userId: string, courseId: string) {
    const [enrollment, lessonProgresses] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId, lesson: { chapter: { section: { courseId } } } },
      }),
    ]);

    return {
      overallProgress: enrollment?.progress || 0,
      lessons: lessonProgresses,
    };
  }
}
```

---

## Step 3: Quiz Attempt Service

```typescript
async submitQuizAttempt(userId: string, quizId: string, dto: SubmitQuizDto) {
  const quiz = await this.prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { include: { options: true } }, lesson: true },
  });
  if (!quiz) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND' });

  // Check max attempts
  if (quiz.maxAttempts) {
    const attemptCount = await this.prisma.quizAttempt.count({
      where: { userId, quizId },
    });
    if (attemptCount >= quiz.maxAttempts) {
      throw new BadRequestException({ code: 'MAX_ATTEMPTS_REACHED' });
    }
  }

  // Grade answers
  let correctCount = 0;
  const answers = dto.answers.map((a) => {
    const question = quiz.questions.find((q) => q.id === a.questionId);
    const correctOption = question?.options.find((o) => o.isCorrect);
    const isCorrect = correctOption?.id === a.selectedOptionId;
    if (isCorrect) correctCount++;
    return { questionId: a.questionId, selectedOptionId: a.selectedOptionId, isCorrect };
  });

  const score = quiz.questions.length > 0 ? correctCount / quiz.questions.length : 0;
  const passed = score >= quiz.passingScore;

  // Save attempt
  const attempt = await this.prisma.quizAttempt.create({
    data: {
      userId,
      quizId,
      score,
      passed,
      startedAt: dto.startedAt,
      endedAt: new Date(),
      answers: { create: answers },
    },
    include: { answers: true },
  });

  // If passed, mark lesson as complete
  if (passed && quiz.lessonId) {
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: quiz.lessonId } },
      update: { isCompleted: true, watchedPercent: 1 },
      create: { userId, lessonId: quiz.lessonId, isCompleted: true, watchedPercent: 1 },
    });
  }

  return { attempt, score, passed, correctCount, totalQuestions: quiz.questions.length };
}
```

---

## Step 4: Certificate Service

```typescript
async generateCertificate(userId: string, courseId: string) {
  const existing = await this.prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  const verifyCode = crypto.randomUUID().slice(0, 8).toUpperCase();

  // TODO: Generate PDF/image certificate via Cloudinary or template
  const certificateUrl = `https://sslm.com/certificates/${verifyCode}`;

  return this.prisma.certificate.create({
    data: { userId, courseId, certificateUrl, verifyCode },
  });
}

async verifyCertificate(verifyCode: string) {
  const cert = await this.prisma.certificate.findUnique({
    where: { verifyCode },
    include: {
      user: { select: { fullName: true } },
      course: { select: { title: true } },
    },
  });
  if (!cert) throw new NotFoundException({ code: 'CERTIFICATE_NOT_FOUND' });
  return cert;
}
```

---

## Step 5: Daily Activity & Streak

```typescript
async trackDailyActivity(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await this.prisma.dailyActivity.upsert({
    where: { userId_activityDate: { userId, activityDate: today } },
    update: { lessonsCompleted: { increment: 1 } },
    create: { userId, activityDate: today, lessonsCompleted: 1 },
  });
}

async getStreak(userId: string) {
  const activities = await this.prisma.dailyActivity.findMany({
    where: { userId },
    orderBy: { activityDate: 'desc' },
    take: 365,
  });

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < activities.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    expected.setHours(0, 0, 0, 0);

    const activityDate = new Date(activities[i].activityDate);
    activityDate.setHours(0, 0, 0, 0);

    if (activityDate.getTime() === expected.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return { currentStreak: streak, totalDays: activities.length };
}
```

---

## Step 6: Placement Test Service

```typescript
async startPlacementTest(userId: string, tagIds: string[]) {
  // Get random questions matching tags
  const questions = await this.prisma.placementQuestion.findMany({
    where: { tagIds: { hasSome: tagIds } },
    take: 20,
  });

  // Shuffle and return (without answers)
  return questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    level: q.level,
  }));
}

async submitPlacementTest(userId: string, dto: SubmitPlacementDto) {
  // Grade and calculate level scores
  const scores: Record<string, number> = {};
  // ... grading logic based on question levels

  const recommendedLevel = this.determineLevel(scores);

  return this.prisma.placementTest.create({
    data: { userId, scores, recommendedLevel },
  });
}
```

---

## Step 7: Controllers

| Method | Path                                    | Auth   | Description            |
| ------ | --------------------------------------- | ------ | ---------------------- |
| PUT    | /api/learning/progress/:lessonId        | User   | Update lesson progress |
| GET    | /api/learning/progress/:courseId        | User   | Get course progress    |
| POST   | /api/learning/quiz/:quizId/submit       | User   | Submit quiz attempt    |
| GET    | /api/learning/quiz/:quizId/attempts     | User   | Get quiz attempts      |
| GET    | /api/learning/certificates              | User   | My certificates        |
| GET    | /api/learning/certificates/verify/:code | Public | Verify certificate     |
| GET    | /api/learning/streak                    | User   | Get current streak     |
| GET    | /api/learning/dashboard                 | User   | Learning dashboard     |
| POST   | /api/learning/placement-test/start      | User   | Start placement test   |
| POST   | /api/learning/placement-test/submit     | User   | Submit placement test  |

---

## Step 8: Verify

### Checklist

- [ ] Video progress: segments merge correctly
- [ ] Lesson marked complete at 80% watched
- [ ] Text lesson marked complete on explicit action
- [ ] Quiz grading calculates correct score
- [ ] Quiz respects maxAttempts limit
- [ ] Enrollment progress recalculated on lesson completion
- [ ] Certificate auto-generated at 100% progress
- [ ] Certificate verification by code works
- [ ] Daily activity tracked on lesson completion
- [ ] Streak calculation handles consecutive days
- [ ] Placement test returns questions and grades correctly
