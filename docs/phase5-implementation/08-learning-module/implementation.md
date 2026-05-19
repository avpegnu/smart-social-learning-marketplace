# Phase 5.8 — LEARNING MODULE

> Course Player, Progress Tracking (video segments + text), Quiz Attempts, Certificates,
> Daily Activity & Streak, Learning Dashboard, Placement Tests.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase2-database/01-database-design.md`

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: DTOs](#step-2-dtos)
- [Step 3: Course Player Service](#step-3-course-player-service)
- [Step 4: Progress Service](#step-4-progress-service)
- [Step 5: Quiz Attempt Service](#step-5-quiz-attempt-service)
- [Step 6: Certificate Service](#step-6-certificate-service)
- [Step 7: Daily Activity & Streak Service](#step-7-daily-activity--streak-service)
- [Step 8: Learning Dashboard Service](#step-8-learning-dashboard-service)
- [Step 9: Placement Test Service](#step-9-placement-test-service)
- [Step 10: Controllers](#step-10-controllers)
- [Step 11: Register Module](#step-11-register-module)
- [Step 12: Verify](#step-12-verify)

---

## Scope & Boundaries

### In scope (Phase 5.8):
- Course Player (lesson content + access control: enrollment, chapter purchase, free preview)
- Progress tracking: video (watched segments merge), text (explicit complete)
- Quiz attempts (submit, grade, max attempts check)
- Certificates (auto-generate at 100%, verify by code)
- Daily activity tracking + streak calculation
- Learning dashboard (active courses, completed, streak, stats)
- Placement tests (start, submit, grade, recommend level)

### Out of scope:
- Video URL generation (Media module — separate phase)
- AI-based course recommendations → Phase 5.10
- Notifications on completion → Phase 5.10

---

## Step 1: Module Structure

```
src/modules/learning/
├── learning.module.ts
├── course-player/
│   ├── course-player.controller.ts     # GET /api/courses/:courseId/learn/:lessonId
│   └── course-player.service.ts        # Access control + lesson content
├── progress/
│   ├── progress.controller.ts          # PUT progress, POST complete
│   └── progress.service.ts             # Segment merge, enrollment recalculation
├── quiz-attempts/
│   ├── quiz-attempts.controller.ts     # POST submit, GET attempts
│   └── quiz-attempts.service.ts        # Grade, max attempts, lesson complete
├── certificates/
│   ├── certificates.controller.ts      # GET my certs, GET verify/:code
│   └── certificates.service.ts         # Auto-generate, verify
├── streaks/
│   ├── streaks.controller.ts           # GET streak, GET dashboard
│   └── streaks.service.ts              # Daily activity, streak calc, dashboard
├── placement-tests/
│   ├── placement-tests.controller.ts   # POST start, POST submit
│   └── placement-tests.service.ts      # Question selection, grading
└── dto/
    ├── update-progress.dto.ts
    ├── complete-lesson.dto.ts
    ├── submit-quiz.dto.ts
    └── submit-placement.dto.ts
```

---

## Step 2: DTOs

### 2.1 `dto/update-progress.dto.ts`

```typescript
export class UpdateProgressDto {
  @ApiPropertyOptional({ description: 'Current playback position in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lastPosition?: number;

  @ApiPropertyOptional({
    description: 'Watched segments [[start, end], ...]',
    type: [[Number]],
  })
  @IsOptional()
  @IsArray()
  watchedSegments?: [number, number][];
}
```

### 2.2 `dto/submit-quiz.dto.ts`

```typescript
export class QuizAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiProperty()
  @IsString()
  selectedOptionId!: string;
}

export class SubmitQuizDto {
  @ApiProperty({ type: [QuizAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}
```

> Không có `startedAt` trong DTO — server tự track từ lúc quiz loaded (hoặc tạm dùng `createdAt` của attempt). Tránh trust client-side timestamp cho time limit.

### 2.3 `dto/submit-placement.dto.ts`

```typescript
export class PlacementAnswerDto {
  @IsString() questionId!: string;
  @IsString() selectedOptionId!: string;
}

export class SubmitPlacementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlacementAnswerDto)
  answers!: PlacementAnswerDto[];
}
```

---

## Step 3: Course Player Service

### Core endpoint: `GET /api/courses/:courseId/learn/:lessonId`

**Đây là endpoint quan trọng nhất** — frontend course player gọi để lấy lesson content.

### `course-player/course-player.service.ts`

```typescript
@Injectable()
export class CoursePlayerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getLesson(userId: string, courseId: string, lessonId: string) {
    // 1. Get lesson with full context
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            section: { select: { courseId: true } },
          },
        },
        media: true,
        attachments: true,
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { options: { orderBy: { order: 'asc' } } },
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
    // Check 1: Free preview lessons — always accessible
    if (isFreePreview) return;

    // Check 2: FULL enrollment → access all lessons
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (enrollment?.type === 'FULL') return;

    // Check 3: Chapter purchase → access lessons in purchased chapter
    const chapterPurchase = await this.prisma.chapterPurchase.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
    });
    if (chapterPurchase) return;

    // No access
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

    // Get all completed lesson IDs for this user + course
    const completedLessons = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        isCompleted: true,
        lesson: { chapter: { section: { courseId } } },
      },
      select: { lessonId: true },
    });
    const completedIds = new Set(completedLessons.map((l) => l.lessonId));

    // Annotate lessons with completion status
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
```

**Key design decisions:**

1. **3-layer access control**: Free preview → FULL enrollment → Chapter purchase. Checked in order of cheapest query first.
2. **Curriculum with completion status**: Sidebar cần hiển thị ✅ cho mỗi lesson. Batch query `lessonProgress` rồi dùng `Set` cho O(1) lookup — giống `enrichWithFollowStatus` pattern từ Phase 5.5.
3. **Quiz included khi type=QUIZ**: Frontend cần questions + options để render quiz form. Instructor quiz (Phase 5.6) không show `isCorrect`; student quiz ở đây cũng KHÔNG show `isCorrect` — grading xảy ra khi submit.

> **Quan trọng:** Response quiz KHÔNG chứa `isCorrect` field cho student. Cần select chỉ `id, text, order` cho options. Implementation cần strip `isCorrect` trước khi return.

---

## Step 4: Progress Service

### `progress/progress.service.ts`

```typescript
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

    // Verify enrollment (any type — FULL or PARTIAL with chapter access)
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
    const isCompleted = watchedPercent >= LESSON_COMPLETE_THRESHOLD; // 0.8

    // Upsert progress
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        lastPosition: dto.lastPosition ?? existing?.lastPosition ?? 0,
        watchedSegments: merged as unknown as Prisma.InputJsonValue,
        watchedPercent,
        isCompleted: isCompleted || (existing?.isCompleted ?? false), // Never un-complete
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
    const newlyCompleted = isCompleted && !existing?.isCompleted;
    let courseProgress = enrollment.progress;

    if (newlyCompleted) {
      courseProgress = await this.recalculateEnrollmentProgress(userId, courseId);
      await this.streaksService.trackDailyActivity(userId, 'lesson');
    }

    return { watchedPercent, isCompleted: isCompleted || (existing?.isCompleted ?? false), courseProgress };
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

    // Auto-generate certificate at 100% (FULL enrollment only)
    if (progress >= 1 && enrollment.type === 'FULL') {
      await this.certificatesService.generateCertificate(userId, courseId);
    }

    return progress;
  }
}
```

**Key design decisions:**

1. **Never un-complete**: `isCompleted: isCompleted || (existing?.isCompleted ?? false)` — once completed, stays completed even if segments data changes.
2. **JSON cast**: `merged as unknown as Prisma.InputJsonValue` — same pattern as qualifications, learningOutcomes.
3. **PARTIAL enrollment progress**: Only count lessons in purchased chapters, not all course lessons.
4. **Auto-certificate**: Triggered inside `recalculateEnrollmentProgress` when progress reaches 1.0 and enrollment is FULL.
5. **Separate `completeLesson` endpoint**: Text lessons don't have video segments — explicit "mark as read" action.

---

## Step 5: Quiz Attempt Service

### `quiz-attempts/quiz-attempts.service.ts`

```typescript
@Injectable()
export class QuizAttemptsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressService) private readonly progressService: ProgressService,
    @Inject(StreaksService) private readonly streaksService: StreaksService,
  ) {}

  async submitQuiz(userId: string, lessonId: string, dto: SubmitQuizDto) {
    // 1. Find quiz by lessonId (not quizId — frontend knows lessonId)
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
      return {
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        isCorrect,
      };
    });

    const totalQuestions = quiz.questions.length;
    const score = totalQuestions > 0 ? correctCount / totalQuestions : 0; // 0-1
    const passed = score >= quiz.passingScore;

    // 5. Save attempt
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        score,
        passed,
        startedAt: new Date(), // Server-side timestamp
        endedAt: new Date(),
        answers: { create: answerResults },
      },
      include: { answers: true },
    });

    // 6. If passed → mark lesson as complete + track activity
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

    // 7. Return results with explanations
    const results = dto.answers.map((a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      const correctOption = question?.options.find((o) => o.isCorrect);
      const isCorrect = correctOption?.id === a.selectedOptionId;
      return {
        questionId: a.questionId,
        correct: isCorrect,
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
```

**Key design decisions:**

1. **Lookup by `lessonId`, not `quizId`**: Frontend navigates by lesson → quiz is 1:1 with lesson → `Quiz.lessonId @unique` allows `findUnique({ where: { lessonId } })`.
2. **Score stored 0-1, returned 0-100**: Consistent with `Quiz.passingScore` (0-1). API response: `Math.round(score * 100)`.
3. **Server-side `startedAt`**: Don't trust client-side timestamp (time limit circumvention). For MVP, `startedAt = endedAt = now()`. Time tracking can be enhanced later.
4. **Return explanations after submit**: Frontend hiển thị đáp án + giải thích sau khi nộp bài.
5. **Strip `isCorrect` from quiz in course player**: QuizAttemptsService returns correctAnswer sau submit, nhưng CoursePlayerService phải strip trước khi trả quiz.

---

## Step 6: Certificate Service

### `certificates/certificates.service.ts`

```typescript
@Injectable()
export class CertificatesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async generateCertificate(userId: string, courseId: string) {
    // Check if already exists (idempotent)
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return existing;

    // Generate unique verify code (retry on collision)
    let verifyCode: string;
    let retries = 0;
    do {
      verifyCode = crypto.randomUUID().slice(0, 8).toUpperCase();
      const exists = await this.prisma.certificate.findUnique({ where: { verifyCode } });
      if (!exists) break;
      retries++;
    } while (retries < 3);

    const appUrl = this.config.get<string>('app.url') ?? 'https://sslm.com';
    const certificateUrl = `${appUrl}/certificates/${verifyCode}`;

    return this.prisma.certificate.create({
      data: { userId, courseId, certificateUrl, verifyCode },
    });
  }

  async verifyCertificate(verifyCode: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { verifyCode },
      include: {
        user: { select: { fullName: true } },
        course: {
          select: {
            title: true,
            instructor: { select: { fullName: true } },
          },
        },
      },
    });
    if (!cert) throw new NotFoundException({ code: 'CERTIFICATE_NOT_FOUND' });

    return {
      valid: true,
      studentName: cert.user.fullName,
      courseName: cert.course.title,
      instructorName: cert.course.instructor.fullName,
      issuedAt: cert.createdAt,
      verifyCode: cert.verifyCode,
    };
  }

  async getMyCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: {
        course: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

**Key design decisions:**

1. **Idempotent generation**: `findUnique` trước create → gọi nhiều lần không tạo duplicate.
2. **Verify code collision handling**: Retry loop (max 3). 8 hex chars = 4 tỷ khả năng, collision cực hiếm.
3. **Certificate URL from config**: `app.url` thay vì hardcode.

---

## Step 7: Daily Activity & Streak Service

### `streaks/streaks.service.ts`

```typescript
@Injectable()
export class StreaksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async trackDailyActivity(userId: string, type: 'lesson' | 'quiz') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const incrementField = type === 'lesson'
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
    const firstActivityDate = new Date(activities[0]!.activityDate);
    firstActivityDate.setHours(0, 0, 0, 0);
    const todayCompleted = firstActivityDate.getTime() === today.getTime();

    // Calculate current streak
    // Start from today if active, or yesterday if not yet active today
    let streak = 0;
    const startDate = todayCompleted ? today : new Date(today.getTime() - 86400000);

    for (let i = 0; i < activities.length; i++) {
      const expected = new Date(startDate);
      expected.setDate(expected.getDate() - i);
      expected.setHours(0, 0, 0, 0);

      const activityDate = new Date(activities[i]!.activityDate);
      activityDate.setHours(0, 0, 0, 0);

      if (activityDate.getTime() === expected.getTime()) {
        streak++;
      } else if (activityDate.getTime() < expected.getTime()) {
        // There's a gap — streak broken
        break;
      }
    }

    // If today not completed but yesterday was, streak still counts
    // (user hasn't had a chance to study today yet)

    // Calculate longest streak
    let longestStreak = 0;
    let currentRun = 1;
    for (let i = 1; i < activities.length; i++) {
      const prev = new Date(activities[i - 1]!.activityDate);
      const curr = new Date(activities[i]!.activityDate);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);

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
}
```

**Key design decisions:**

1. **Track both `lesson` and `quiz`**: `lessonsCompleted` and `quizzesPassed` tracked separately per DailyActivity schema.
2. **Streak handles "today not yet active"**: If user hasn't studied today but studied yesterday, streak still counts from yesterday. Prevents "lose streak at midnight" frustration.
3. **Longest streak calculation**: Iterate through sorted activities, count consecutive day runs.
4. **`86400000` = 24*60*60*1000**: Milliseconds in a day. Used for date comparison.

---

## Step 8: Learning Dashboard Service

### Dashboard trong `streaks/streaks.service.ts` (cùng service)

```typescript
async getDashboard(userId: string) {
  const [
    activeEnrollments,
    completedEnrollments,
    streak,
    certificates,
  ] = await Promise.all([
    // Active courses (progress < 1)
    this.prisma.enrollment.findMany({
      where: { userId, progress: { lt: 1 } },
      include: {
        course: {
          select: {
            id: true, title: true, slug: true, thumbnailUrl: true,
            totalLessons: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    // Completed courses (progress = 1)
    this.prisma.enrollment.findMany({
      where: { userId, progress: { gte: 1 } },
      include: {
        course: {
          select: { id: true, title: true, slug: true, thumbnailUrl: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    // Streak
    this.getStreak(userId),
    // Certificates
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
          lessonProgresses: {
            none: { userId, isCompleted: true },
          },
        },
        orderBy: [
          { chapter: { section: { order: 'asc' } } },
          { chapter: { order: 'asc' } },
          { order: 'asc' },
        ],
        select: { id: true, title: true, type: true },
      });

      return {
        ...enrollment,
        nextLesson,
      };
    }),
  );

  return {
    activeCourses,
    completedCourses: completedEnrollments.map((e) => ({
      ...e,
      certificate: certificates.find((c) => c.courseId === e.courseId) ?? null,
    })),
    streak,
  };
}
```

---

## Step 9: Placement Test Service

### `placement-tests/placement-tests.service.ts`

```typescript
@Injectable()
export class PlacementTestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async startTest(userId: string, categoryId: string) {
    // Get category tags for question selection
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { courses: { select: { courseTags: { select: { tagId: true } } } } },
    });

    // Collect unique tagIds from courses in this category
    const tagIds = [
      ...new Set(
        category?.courses.flatMap((c) => c.courseTags.map((ct) => ct.tagId)) ?? [],
      ),
    ];

    // Get questions matching tags, mixed levels
    const questions = await this.prisma.placementQuestion.findMany({
      where: { tagIds: { hasSome: tagIds.length > 0 ? tagIds : undefined } },
    });

    // Shuffle (Fisher-Yates)
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j]!, questions[i]!];
    }

    const selected = questions.slice(0, 15);

    // Return without answers
    return {
      questions: selected.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        level: q.level,
      })),
      totalQuestions: selected.length,
    };
  }

  async submitTest(userId: string, dto: SubmitPlacementDto) {
    // Grade answers by level
    const scores: Record<string, number> = {
      BEGINNER: 0,
      INTERMEDIATE: 0,
      ADVANCED: 0,
    };
    const totals: Record<string, number> = {
      BEGINNER: 0,
      INTERMEDIATE: 0,
      ADVANCED: 0,
    };

    for (const answer of dto.answers) {
      const question = await this.prisma.placementQuestion.findUnique({
        where: { id: answer.questionId },
      });
      if (!question) continue;

      const level = question.level as string;
      totals[level] = (totals[level] ?? 0) + 1;

      if (question.answer === answer.selectedOptionId) {
        scores[level] = (scores[level] ?? 0) + 1;
      }
    }

    // Determine recommended level
    const recommendedLevel = this.determineLevel(scores, totals);

    // Save test result
    const test = await this.prisma.placementTest.create({
      data: {
        userId,
        scores: scores as unknown as Prisma.InputJsonValue,
        recommendedLevel,
      },
    });

    // Get recommended courses
    const recommendedCourses = await this.prisma.course.findMany({
      where: { level: recommendedLevel, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, slug: true, thumbnailUrl: true, level: true },
      take: 5,
    });

    return {
      level: recommendedLevel,
      scores,
      recommendedCourses,
    };
  }

  private determineLevel(
    scores: Record<string, number>,
    totals: Record<string, number>,
  ): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS' {
    const beginnerRate = totals['BEGINNER']! > 0 ? scores['BEGINNER']! / totals['BEGINNER']! : 0;
    const intermediateRate = totals['INTERMEDIATE']! > 0 ? scores['INTERMEDIATE']! / totals['INTERMEDIATE']! : 0;
    const advancedRate = totals['ADVANCED']! > 0 ? scores['ADVANCED']! / totals['ADVANCED']! : 0;

    if (advancedRate >= 0.7) return 'ADVANCED';
    if (intermediateRate >= 0.7) return 'INTERMEDIATE';
    if (beginnerRate >= 0.7) return 'BEGINNER';
    return 'BEGINNER'; // Default
  }
}
```

---

## Step 10: Controllers

### 10.1 Course Player Controller

```typescript
@Controller('courses/:courseId/learn')
@ApiTags('Course Player')
@ApiBearerAuth()
export class CoursePlayerController {
  @Get(':lessonId')
  @ApiOperation({ summary: 'Get lesson content for course player' })
  async getLesson(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.coursePlayerService.getLesson(user.sub, courseId, lessonId);
  }
}
```

### 10.2 Progress Controller

```typescript
@Controller('learning')
@ApiTags('Learning — Progress')
@ApiBearerAuth()
export class ProgressController {
  @Put('progress/:lessonId')
  @ApiOperation({ summary: 'Update video lesson progress (segments)' })
  async updateProgress(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: UpdateProgressDto,
  ) { ... }

  @Post('lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Mark text lesson as completed' })
  async completeLesson(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) { ... }

  @Get('progress/:courseId')
  @ApiOperation({ summary: 'Get course progress with lesson statuses' })
  async getCourseProgress(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) { ... }
}
```

### 10.3 Quiz Attempts Controller

```typescript
@Controller('learning/lessons/:lessonId/quiz')
@ApiTags('Learning — Quiz')
@ApiBearerAuth()
export class QuizAttemptsController {
  @Post('submit')
  @ApiOperation({ summary: 'Submit quiz answers' })
  async submitQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: SubmitQuizDto,
  ) { ... }

  @Get('attempts')
  @ApiOperation({ summary: 'Get my quiz attempts' })
  async getAttempts(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) { ... }
}
```

### 10.4 Certificates Controller

```typescript
@Controller('certificates')
@ApiTags('Certificates')
export class CertificatesController {
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my certificates' })
  async getMyCertificates(@CurrentUser() user: JwtPayload) { ... }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verify certificate by code' })
  async verifyCertificate(@Param('code') code: string) { ... }
}
```

### 10.5 Streaks + Dashboard Controller

```typescript
@Controller('learning')
@ApiTags('Learning — Dashboard')
@ApiBearerAuth()
export class StreaksController {
  @Get('streak')
  @ApiOperation({ summary: 'Get current streak info' })
  async getStreak(@CurrentUser() user: JwtPayload) { ... }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get learning dashboard' })
  async getDashboard(@CurrentUser() user: JwtPayload) { ... }
}
```

### 10.6 Placement Tests Controller

```typescript
@Controller('placement-tests')
@ApiTags('Placement Tests')
@ApiBearerAuth()
export class PlacementTestsController {
  @Post('start')
  @ApiOperation({ summary: 'Start placement test by category' })
  async startTest(@CurrentUser() user: JwtPayload, @Body('categoryId') categoryId: string) { ... }

  @Post('submit')
  @ApiOperation({ summary: 'Submit placement test answers' })
  async submitTest(@CurrentUser() user: JwtPayload, @Body() dto: SubmitPlacementDto) { ... }
}
```

---

## Step 11: Register Module

```typescript
@Module({
  controllers: [
    CoursePlayerController,
    ProgressController,
    QuizAttemptsController,
    CertificatesController,
    StreaksController,
    PlacementTestsController,
  ],
  providers: [
    CoursePlayerService,
    ProgressService,
    QuizAttemptsService,
    CertificatesService,
    StreaksService,
    PlacementTestsService,
  ],
  exports: [ProgressService, CertificatesService],
})
export class LearningModule {}
```

### `app.module.ts` — Add import

```typescript
import { LearningModule } from './modules/learning/learning.module';
```

---

## Step 12: Verify

### Endpoint Summary — 12 endpoints

**Course Player (1):** GET /api/courses/:courseId/learn/:lessonId
**Progress (3):** PUT progress/:lessonId, POST lessons/:lessonId/complete, GET progress/:courseId
**Quiz (2):** POST lessons/:lessonId/quiz/submit, GET lessons/:lessonId/quiz/attempts
**Certificates (2):** GET my, GET verify/:code (public)
**Streaks (2):** GET streak, GET dashboard
**Placement (2):** POST start, POST submit

### Checklist

- [ ] Course Player: 3-layer access control (free preview → FULL → chapter purchase)
- [ ] Course Player: quiz returned WITHOUT isCorrect (strip before response)
- [ ] Course Player: curriculum sidebar with ✅ completion status (Set lookup)
- [ ] Video progress: segments merge via `mergeSegments` util
- [ ] Video progress: lesson complete at 80% (`LESSON_COMPLETE_THRESHOLD`)
- [ ] Video progress: never un-complete (isCompleted || existing)
- [ ] Video progress: JSON cast for watchedSegments
- [ ] Text lesson: explicit complete endpoint (`POST .../complete`)
- [ ] Enrollment progress: recalculated on any lesson completion
- [ ] Enrollment progress: PARTIAL counts only purchased chapter lessons
- [ ] Certificate: auto-generated at 100% FULL enrollment
- [ ] Certificate: verify code collision handling (retry loop)
- [ ] Certificate: URL from config, not hardcode
- [ ] Quiz: lookup by lessonId (not quizId)
- [ ] Quiz: enrollment check before submit
- [ ] Quiz: maxAttempts enforcement
- [ ] Quiz: score 0-1 stored, 0-100 returned
- [ ] Quiz: return explanations + correct answers after submit
- [ ] Daily activity: track lessons + quizzes separately
- [ ] Streak: handle "today not yet active" (count from yesterday)
- [ ] Streak: longest streak calculation
- [ ] Dashboard: active courses with nextLesson, completed with certificates
- [ ] Placement: shuffle questions, grade by level, recommend courses
- [ ] All services use `@Inject()` pattern
- [ ] All error codes (not messages)
- [ ] Build: 0 errors, Lint: 0 errors, Tests: all pass
