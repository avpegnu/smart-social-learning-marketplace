# 02 — Quiz Attempts, Certificates, Streaks & Dashboard

> Giải thích chi tiết QuizAttemptsService — lookup by lessonId, score 0-1 stored/0-100 returned,
> explanations after submit. CertificatesService — idempotent generation, verify code collision retry.
> StreaksService — daily activity tracking, streak calculation, learning dashboard.

---

## 1. TỔNG QUAN

### 1.1 Vai trò

3 service bổ trợ cho learning flow: QuizAttemptsService xử lý nộp bài quiz + chấm điểm, CertificatesService tạo chứng chỉ khi hoàn thành 100%, StreaksService theo dõi hoạt động hàng ngày + tính streak + tổng hợp learning dashboard.

```
QuizAttemptsService — 2 methods:
  ├── submitQuiz(userId, lessonId, dto)  → Grade + save attempt
  └── getAttempts(userId, lessonId)      → History

CertificatesService — 3 methods:
  ├── generateCertificate(userId, courseId)  → Idempotent create
  ├── verifyCertificate(verifyCode)         → Public verify
  └── getMyCertificates(userId)             → List user certs

StreaksService — 3 methods:
  ├── trackDailyActivity(userId, type)  → Upsert daily record
  ├── getStreak(userId)                 → Current + longest streak
  └── getDashboard(userId)             → Active/completed courses + streak
```

### 1.2 Dependencies

```
QuizAttemptsService
  ├── PrismaService
  ├── ProgressService       → recalculateEnrollmentProgress after pass
  └── StreaksService         → trackDailyActivity('quiz')

CertificatesService
  ├── PrismaService
  └── ConfigService         → app.url for certificate URL

StreaksService
  └── PrismaService
```

---

## 2. QUIZ ATTEMPTS — LOOKUP BY LESSON ID

### 2.1 Vấn đề

Frontend course player biết `lessonId` (từ URL `/courses/:courseId/learn/:lessonId`), nhưng **không biết `quizId`**. Quiz là child của lesson (1:1 relationship), quizId là internal ID.

### 2.2 Solution — findUnique by lessonId

```typescript
async submitQuiz(userId: string, lessonId: string, dto: SubmitQuizDto) {
  // Lookup quiz by lessonId (not quizId)
  const quiz = await this.prisma.quiz.findUnique({
    where: { lessonId },  // @unique field
    include: {
      questions: { include: { options: true } },
      lesson: {
        include: { chapter: { include: { section: { select: { courseId: true } } } } },
      },
    },
  });
  if (!quiz) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND' });
  // ...
}
```

**Tại sao `findUnique` hoạt động?** Prisma schema: `Quiz.lessonId @unique` → Prisma tự generate unique index, cho phép `findUnique` thay vì `findFirst`.

**Tại sao không truyền `quizId` từ frontend?**
- Frontend chỉ biết `lessonId` từ course player URL
- Thêm quizId vào URL → redundant, phải validate cả `lessonId` lẫn `quizId`
- Đơn giản hơn: 1 param, 1 lookup

---

## 3. ENROLLMENT CHECK BEFORE QUIZ SUBMIT

```typescript
// 2. Verify enrollment
const courseId = quiz.lesson.chapter.section.courseId;
const enrollment = await this.prisma.enrollment.findUnique({
  where: { userId_courseId: { userId, courseId } },
});
if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
```

**Tại sao check enrollment trong QuizAttemptsService thay vì rely vào CoursePlayerService?**
- CoursePlayerService check access khi **xem** lesson
- QuizAttemptsService check enrollment khi **nộp** quiz
- 2 requests khác nhau → phải validate độc lập
- Nếu không check: user có thể gọi trực tiếp `POST /quiz/submit` mà không qua course player

---

## 4. MAX ATTEMPTS ENFORCEMENT

```typescript
// 3. Check max attempts
if (quiz.maxAttempts) {
  const attemptCount = await this.prisma.quizAttempt.count({
    where: { userId, quizId: quiz.id },
  });
  if (attemptCount >= quiz.maxAttempts) {
    throw new BadRequestException({ code: 'MAX_ATTEMPTS_REACHED' });
  }
}
```

**`if (quiz.maxAttempts)`** — nếu `maxAttempts = null` hoặc `0`, cho phép unlimited attempts. Instructor có thể set limit (ví dụ 3 lần) hoặc để unlimited.

---

## 5. SCORE — STORED 0-1, RETURNED 0-100

### 5.1 Tại sao lưu 0-1?

```typescript
const score = totalQuestions > 0 ? correctCount / totalQuestions : 0; // 0-1
const passed = score >= quiz.passingScore; // passingScore cũng 0-1
```

`Quiz.passingScore` trong Prisma schema lưu dạng 0-1 (ví dụ: 0.7 = 70%). Score phải cùng format để so sánh trực tiếp: `score >= passingScore`.

### 5.2 Return 0-100 cho frontend

```typescript
return {
  attempt: {
    id: attempt.id,
    score: Math.round(score * 100), // 0.7 → 70
    passed,
  },
  // ...
};
```

**Frontend hiển thị "70/100" hoặc "70%"** — dễ đọc hơn "0.7".

```
DB: score = 0.7, passingScore = 0.7
API response: score = 70
Frontend: "Bạn đạt 70/100 điểm — Đạt ✅"
```

---

## 6. EXPLANATIONS + CORRECT ANSWER — CHỈ SAU SUBMIT

### 6.1 Luồng dữ liệu quiz

```
Course Player GET lesson:
  quiz.questions[].options = [{ id, text, order }]  ← NO isCorrect
  → Student làm bài, chọn answers

Quiz Submit POST:
  → Server grade
  → Response includes:
    results[]: {
      questionId,
      correct: boolean,         // Student trả lời đúng/sai
      correctAnswer: "opt-a",   // Đáp án đúng
      explanation: "..."        // Giải thích
    }
```

### 6.2 Implementation

```typescript
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
```

**Tại sao trả `correctAnswer` là option ID thay vì text?**
- Frontend đã có full question + options từ course player
- Chỉ cần highlight option đúng bằng ID
- Tránh gửi duplicate data

---

## 7. SERVER-SIDE STARTED AT

```typescript
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
});
```

**Tại sao `startedAt = new Date()` thay vì nhận từ client?**
- Client có thể gửi timestamp giả để bypass time limit
- Ví dụ: quiz 10 phút, client gửi `startedAt = 1 phút trước` → bypass check
- Server-side timestamp đảm bảo integrity

**Limitation hiện tại:** `startedAt = endedAt = now()` — chưa track thời gian làm bài chính xác. Cải thiện sau: track `startedAt` khi GET quiz, `endedAt` khi POST submit.

---

## 8. CERTIFICATES — IDEMPOTENT GENERATION

### 8.1 Check existing trước create

```typescript
async generateCertificate(userId: string, courseId: string) {
  // Idempotent — don't create duplicate
  const existing = await this.prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  // ... generate new
}
```

**Tại sao cần idempotent?** `generateCertificate` được gọi từ `recalculateEnrollmentProgress` — method này chạy mỗi khi lesson complete. User hoàn thành lesson 30/30 → trigger → certificate created. User xem lại lesson 30 → `recalculate` chạy lại → `generate` gọi lại → **phải return existing, không tạo mới**.

### 8.2 Verify Code Collision Retry Loop

```typescript
let verifyCode = '';
for (let i = 0; i < 3; i++) {
  verifyCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const exists = await this.prisma.certificate.findUnique({ where: { verifyCode } });
  if (!exists) break;
}
```

**8 hex chars = 16^8 = 4,294,967,296 khả năng.** Collision probability cực thấp, nhưng vẫn check cho safety. Max 3 retries — nếu vẫn collision (gần như impossible) thì tạo certificate với code cuối cùng (DB unique constraint sẽ catch).

**Tại sao `crypto.randomUUID().slice(0, 8)`?**
- `randomUUID()` = cryptographically secure
- Lấy 8 chars đầu = đủ ngắn cho verify code (user share/nhập)
- `.toUpperCase()` = dễ đọc, tránh nhầm l/1, o/0

### 8.3 Certificate URL từ Config

```typescript
const appUrl = this.config.get<string>('app.url') ?? 'https://sslm.com';
const certificateUrl = `${appUrl}/certificates/${verifyCode}`;
```

**Không hardcode URL** — dev dùng `localhost:3000`, production dùng domain thật. Fallback `https://sslm.com` cho trường hợp config missing.

### 8.4 verifyCertificate — Public Endpoint

```typescript
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
```

**Public (no auth required)** — employer/recruiter có thể verify certificate bằng code mà không cần account. Response trả đủ info: tên sinh viên, tên khóa, tên giảng viên, ngày cấp.

---

## 9. STREAKS — DAILY ACTIVITY TRACKING

### 9.1 trackDailyActivity — Lesson vs Quiz

```typescript
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
```

**Track riêng `lesson` và `quiz`:**
- `ProgressService.updateLessonProgress` gọi `trackDailyActivity(userId, 'lesson')`
- `QuizAttemptsService.submitQuiz` gọi `trackDailyActivity(userId, 'quiz')`
- `DailyActivity` schema có 2 fields: `lessonsCompleted`, `quizzesPassed`
- Upsert: ngày đầu tiên create, các lần sau increment

### 9.2 Streak Calculation

```typescript
async getStreak(userId: string) {
  const activities = await this.prisma.dailyActivity.findMany({
    where: { userId },
    orderBy: { activityDate: 'desc' },
    take: 365, // Max 1 year lookback
  });

  if (activities.length === 0) {
    return { currentStreak: 0, longestStreak: 0, todayCompleted: false };
  }
```

### 9.3 "Today Not Yet Active" — Quan trọng

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);

const firstDate = new Date(activities[0]!.activityDate);
firstDate.setHours(0, 0, 0, 0);
const todayCompleted = firstDate.getTime() === today.getTime();

// Start from today if active, yesterday if not
const startDate = todayCompleted ? today : new Date(today.getTime() - MS_PER_DAY);
```

**Vấn đề:**
```
User có streak 5 ngày liên tiếp (Mon-Fri)
Saturday sáng, user mở app → chưa học gì hôm nay
  → Nếu tính từ today: streak = 0 (today not active) ← BAD UX!
  → Nếu tính từ yesterday: streak = 5 (Fri active) ← CORRECT!
```

**Solution:** Nếu hôm nay chưa active, bắt đầu đếm streak từ hôm qua. User chưa có cơ hội học hôm nay → không phạt mất streak.

### 9.4 Current Streak Loop

```typescript
let streak = 0;
for (let i = 0; i < activities.length; i++) {
  const expected = new Date(startDate.getTime() - i * MS_PER_DAY);
  expected.setHours(0, 0, 0, 0);

  const activityDate = new Date(activities[i]!.activityDate);
  activityDate.setHours(0, 0, 0, 0);

  if (activityDate.getTime() === expected.getTime()) {
    streak++;
  } else {
    break; // Gap found → streak broken
  }
}
```

**Logic:** Đếm ngược từ `startDate`, mỗi ngày check xem có activity không. Gặp gap → streak kết thúc.

### 9.5 Longest Streak — Consecutive Day Run

```typescript
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
```

**`Math.round` cho diffDays** — tránh floating point issues khi timezone/DST khác nhau.

**`Math.max(longestStreak, currentRun, streak)`** — 3 giá trị:
- `longestStreak`: best run tìm được trong loop
- `currentRun`: run cuối cùng (chưa được compare trong loop)
- `streak`: current streak (có thể lớn hơn historical runs)

### 9.6 MS_PER_DAY Constant

```typescript
const MS_PER_DAY = 86400000; // 24 * 60 * 60 * 1000
```

Tránh magic number `86400000` lặp lại nhiều chỗ. Named constant rõ ý nghĩa.

---

## 10. LEARNING DASHBOARD — PARALLEL QUERIES

### 10.1 Promise.all cho 4 queries

```typescript
async getDashboard(userId: string) {
  const [activeEnrollments, completedEnrollments, streak, certificates] = await Promise.all([
    // Active courses (progress < 1)
    this.prisma.enrollment.findMany({
      where: { userId, progress: { lt: 1 } },
      // ...
      take: 10,
    }),
    // Completed courses (progress >= 1)
    this.prisma.enrollment.findMany({
      where: { userId, progress: { gte: 1 } },
      // ...
    }),
    // Streak
    this.getStreak(userId),
    // Certificates
    this.prisma.certificate.findMany({ where: { userId } }),
  ]);
```

**4 queries chạy song song** — giảm latency so với chạy tuần tự.

### 10.2 Next Lesson cho Active Courses

```typescript
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
```

**`lessonProgresses: { none: { userId, isCompleted: true } }`** — tìm lesson đầu tiên chưa complete. `none` filter: không có progress record nào với `isCompleted = true` cho user này.

**Multi-level orderBy:** Section order → Chapter order → Lesson order → đảm bảo next lesson theo đúng thứ tự curriculum.

### 10.3 Certificates cho Completed Courses

```typescript
completedCourses: completedEnrollments.map((e) => ({
  ...e,
  certificate: certificates.find((c) => c.courseId === e.courseId) ?? null,
})),
```

**Batch query certificates + in-memory match** — thay vì N+1 query per completed course.

---

## 11. KEY DESIGN DECISIONS

| Decision | Lý do |
|----------|-------|
| Quiz lookup by `lessonId` not `quizId` | Frontend chỉ biết lessonId từ URL |
| Enrollment check trong QuizAttemptsService | Validate độc lập — không rely vào course player |
| `maxAttempts` nullable = unlimited | Instructor flexibility |
| Score 0-1 DB, 0-100 API | Consistent với `passingScore` format; readable cho frontend |
| Explanations chỉ sau submit | Tránh leak đáp án trước khi nộp bài |
| Server-side `startedAt` | Don't trust client timestamp |
| Idempotent certificate generation | `recalculate` có thể gọi nhiều lần |
| Verify code 8 hex chars + retry loop | Đủ ngắn để share, collision-safe |
| Certificate URL from config | Dev/prod environments khác nhau |
| `verifyCertificate` public endpoint | Employer/recruiter verify không cần account |
| Track lesson + quiz separately | DailyActivity schema 2 counter fields |
| Streak: start from yesterday if today not active | Không phạt user chưa kịp học hôm nay |
| Dashboard: `Promise.all` 4 queries | Parallel execution giảm latency |
| `MS_PER_DAY = 86400000` constant | Tránh magic number |
