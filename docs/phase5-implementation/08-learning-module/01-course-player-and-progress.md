# 01 — Course Player & Progress: Access Control, Curriculum Sidebar, Video Segments Merge

> Giải thích chi tiết CoursePlayerService — 3-layer access control, curriculum sidebar với Set lookup,
> quiz options stripping. ProgressService — video watched segments merge algorithm, "never un-complete"
> pattern, enrollment progress recalculation, và auto-certificate.

---

## 1. TỔNG QUAN

### 1.1 Vai trò

CoursePlayerService là **endpoint quan trọng nhất của learning module** — frontend course player gọi để lấy lesson content + curriculum sidebar. ProgressService theo dõi tiến trình học video (segments merge) và text (explicit complete), recalculate enrollment progress, và trigger auto-certificate.

```
CoursePlayerService — 1 public method:
  └── getLesson(userId, courseId, lessonId)
        ├── verifyAccess()           → 3-layer access control
        ├── getLessonProgress()      → User's progress for this lesson
        └── getCurriculumWithProgress() → Sidebar with ✅ completion

ProgressService — 4 public methods:
  ├── updateLessonProgress(userId, lessonId, dto)  → Video segments merge
  ├── completeLesson(userId, lessonId)              → Text lesson mark complete
  ├── getCourseProgress(userId, courseId)            → Overall + per-lesson
  └── recalculateEnrollmentProgress(userId, courseId) → FULL vs PARTIAL
```

### 1.2 Dependencies

```
CoursePlayerService
  └── PrismaService

ProgressService
  ├── PrismaService
  ├── CertificatesService    → Auto-generate at 100%
  └── StreaksService          → Track daily activity on completion
```

**Không có circular dependency:** ProgressService gọi CertificatesService và StreaksService, nhưng không service nào gọi ngược lại ProgressService (trừ QuizAttemptsService — nhưng đó là dependency 1 chiều).

---

## 2. ACCESS CONTROL — 3 LAYERS

### 2.1 Vấn đề

SSLM hỗ trợ 3 cách truy cập lesson:
1. **Free preview** — instructor đánh dấu chapter là `isFreePreview`, ai cũng xem được
2. **FULL enrollment** — mua toàn bộ khóa học
3. **Chapter purchase** — mua lẻ từng chapter (PARTIAL enrollment)

### 2.2 Implementation — Kiểm tra theo thứ tự rẻ nhất

```typescript
private async verifyAccess(
  userId: string,
  courseId: string,
  chapterId: string,
  isFreePreview: boolean,
) {
  // Check 1: Free preview — NO database query needed
  if (isFreePreview) return;

  // Check 2: FULL enrollment → 1 query (unique index)
  const enrollment = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (enrollment?.type === 'FULL') return;

  // Check 3: Chapter purchase → 1 query (unique index)
  const chapterPurchase = await this.prisma.chapterPurchase.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  if (chapterPurchase) return;

  throw new ForbiddenException({ code: 'LESSON_ACCESS_DENIED' });
}
```

**Tại sao kiểm tra theo thứ tự này?**

| Layer | Cost | Tần suất match |
|-------|------|----------------|
| Free preview | 0 queries (in-memory check) | Ít — chỉ vài chapter đầu |
| FULL enrollment | 1 query (unique index) | Nhiều nhất — đa số user mua full |
| Chapter purchase | 1 query (unique index) | Ít — chỉ PARTIAL enrollment |

- **Check rẻ nhất trước:** `isFreePreview` là boolean có sẵn từ lesson query, không cần DB call.
- **Check phổ biến nhất thứ hai:** FULL enrollment. Nếu user đã mua full → return ngay, skip chapter purchase check.
- **Worst case:** 2 DB queries (enrollment + chapterPurchase), cả hai đều dùng unique index → O(1).

### 2.3 Lesson Validation

```typescript
const lesson = await this.prisma.lesson.findUnique({
  where: { id: lessonId },
  include: {
    chapter: {
      include: { section: { select: { courseId: true } } },
    },
    // ... media, attachments, quiz
  },
});

// Verify lesson belongs to this course
if (!lesson || lesson.chapter.section.courseId !== courseId) {
  throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });
}
```

**Tại sao check `courseId` match?** URL là `/courses/:courseId/learn/:lessonId` — nếu không verify, user có thể truy cập lesson của course khác bằng cách đổi `courseId` trong URL (ví dụ: enroll course A, nhưng access lesson của course B).

---

## 3. CURRICULUM SIDEBAR — SET LOOKUP PATTERN

### 3.1 Vấn đề

Frontend course player hiển thị sidebar curriculum: tất cả sections → chapters → lessons, với icon ✅ cho lessons đã hoàn thành. Cần annotate mỗi lesson với `isCompleted: boolean`.

### 3.2 Implementation — Batch Query + Set

```typescript
private async getCurriculumWithProgress(userId: string, courseId: string) {
  // 1. Get full curriculum structure
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

  // 2. Batch query ALL completed lesson IDs
  const completedLessons = await this.prisma.lessonProgress.findMany({
    where: {
      userId,
      isCompleted: true,
      lesson: { chapter: { section: { courseId } } },
    },
    select: { lessonId: true },
  });
  const completedIds = new Set(completedLessons.map((l) => l.lessonId));

  // 3. Annotate — O(1) lookup per lesson
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
```

**Pattern giống `enrichWithFollowStatus` từ Phase 5.5:**

| Phase 5.5 — Follow Status | Phase 5.8 — Completion Status |
|---------------------------|-------------------------------|
| Batch query `Follow` records | Batch query `LessonProgress` records |
| `new Set(follows.map(f => f.followingId))` | `new Set(completedLessons.map(l => l.lessonId))` |
| `isFollowing: followedIds.has(user.id)` | `isCompleted: completedIds.has(lesson.id)` |
| O(1) per user | O(1) per lesson |

**Tại sao không query progress per lesson?**
- 1 course có 50-100 lessons → 50-100 queries N+1
- Batch query + Set: 2 queries tổng cộng → O(n) annotate

---

## 4. QUIZ OPTIONS STRIPPING

### 4.1 Vấn đề

Khi course player trả quiz cho student, **KHÔNG được trả `isCorrect` field** — nếu không student nhìn source/network tab là biết đáp án.

### 4.2 Implementation — Select chỉ cần thiết

```typescript
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
```

**Dùng Prisma `select` thay vì `omit`** — explicit whitelist an toàn hơn blacklist. Nếu sau này thêm field mới vào `QuizOption`, nó sẽ không tự động leak ra response.

**So sánh approach:**
- Course Player: strip `isCorrect` trước khi trả quiz → student làm bài
- QuizAttemptsService: trả `correctAnswer` + `explanation` **SAU KHI submit** → student xem kết quả

---

## 5. VIDEO PROGRESS — SEGMENTS MERGE ALGORITHM

### 5.1 Watched Segments là gì?

Video player gửi các đoạn đã xem dưới dạng `[start, end]` segments (đơn vị: seconds):

```
User xem 0:00-4:00, tua đến 10:00-15:00:
  watchedSegments: [[0, 240], [600, 900]]

Lần sau xem tiếp 3:00-8:00:
  newSegments: [[180, 480]]

Merged: [[0, 480], [600, 900]]  → 2 đoạn, không overlap
```

### 5.2 mergeSegments Utility

```typescript
// common/utils/segments.util.ts

export function mergeSegments(segments: [number, number][]): [number, number][] {
  if (segments.length === 0) return [];

  // Sort by start position
  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const first = sorted[0]!;
  const merged: [number, number][] = [first];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const current = sorted[i]!;

    if (current[0] <= last[1]) {
      // Overlapping or adjacent → extend
      last[1] = Math.max(last[1], current[1]);
    } else {
      // Gap → new segment
      merged.push(current);
    }
  }

  return merged;
}
```

**Algorithm: classic interval merge (LeetCode #56)**
1. Sort segments by start position
2. Iterate: nếu segment hiện tại overlap với segment cuối trong result → merge (extend end)
3. Nếu không overlap → push segment mới

**Ví dụ step-by-step:**

```
Input: [[0, 200], [180, 400], [600, 900]]
Sorted: [[0, 200], [180, 400], [600, 900]]

Step 1: merged = [[0, 200]]
Step 2: [180, 400] → 180 <= 200 → extend → merged = [[0, 400]]
Step 3: [600, 900] → 600 > 400 → gap → merged = [[0, 400], [600, 900]]

Output: [[0, 400], [600, 900]]
```

### 5.3 calculateWatchedPercent

```typescript
export function calculateWatchedPercent(
  segments: [number, number][],
  totalDuration: number,
): number {
  if (totalDuration === 0) return 0;
  const watched = segments.reduce((total, [start, end]) => total + (end - start), 0);
  return Math.min(watched / totalDuration, 1); // Cap at 1.0
}
```

`Math.min(..., 1)` — phòng trường hợp segments > totalDuration (ví dụ video player report duration khác DB).

### 5.4 LESSON_COMPLETE_THRESHOLD = 0.8

```typescript
import { LESSON_COMPLETE_THRESHOLD } from '@/common/constants/app.constant';

const isCompleted = watchedPercent >= LESSON_COMPLETE_THRESHOLD; // 0.8 = 80%
```

**Tại sao 80% chứ không phải 100%?**
- User có thể skip intro/outro
- Video player có thể không report cuối video chính xác
- Common practice: Udemy, Coursera dùng 80-90% threshold

---

## 6. "NEVER UN-COMPLETE" PATTERN

### 6.1 Vấn đề

```
Lần 1: User xem 100% video → isCompleted = true
Lần 2: User mở lại, xem 1 phút rồi tắt → segments chỉ [[0, 60]]
  → watchedPercent = 0.1 → isCompleted = false ← BUG!
```

User đã hoàn thành lesson nhưng mở lại xem → progress bị reset.

### 6.2 Solution — OR với existing

```typescript
// Never un-complete
const finalCompleted = isCompleted || (existing?.isCompleted ?? false);

await this.prisma.lessonProgress.upsert({
  // ...
  update: {
    isCompleted: finalCompleted, // true || false = true (stays completed)
  },
});
```

**Logic:**
- `isCompleted` (mới tính) = false (chỉ xem 10%)
- `existing?.isCompleted` = true (đã complete trước đó)
- `false || true = true` → **vẫn giữ completed**

Pattern này đảm bảo **monotonic progression**: progress chỉ đi lên, không bao giờ đi xuống.

---

## 7. JSON CAST CHO WATCHEDSEGMENTS

### 7.1 Vấn đề

Prisma schema define `watchedSegments` là `Json` type (PostgreSQL `jsonb`). Khi upsert, TypeScript complain vì `[number, number][]` không match `Prisma.InputJsonValue`.

### 7.2 Solution — Double cast

```typescript
watchedSegments: merged as unknown as Prisma.InputJsonValue,
```

**Tại sao `as unknown as` thay vì `as`?** TypeScript không cho phép cast trực tiếp `[number, number][]` → `Prisma.InputJsonValue` vì hai type không overlap. Phải cast qua `unknown` trước — same pattern dùng cho `qualifications`, `learningOutcomes` ở các phase trước.

---

## 8. TEXT LESSON COMPLETE — SEPARATE ENDPOINT

### 8.1 Tại sao cần endpoint riêng?

```
Video lesson:
  PUT /api/learning/progress/:lessonId { watchedSegments: [...] }
  → Auto-complete khi >= 80%

Text lesson:
  POST /api/learning/lessons/:lessonId/complete
  → Explicit "mark as read" action
  → Không có segments, không có percent calculation
```

Text lesson không có concept "watched segments" — user đọc xong nhấn nút "Đánh dấu hoàn thành".

### 8.2 Implementation

```typescript
async completeLesson(userId: string, lessonId: string) {
  // ... validate lesson + enrollment

  // Already completed → no-op (idempotent)
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
```

**`watchedPercent: 1`** — text lesson set 100% vì "đã đọc" = "đã hoàn thành".

---

## 9. ENROLLMENT PROGRESS RECALCULATION

### 9.1 FULL vs PARTIAL

```typescript
async recalculateEnrollmentProgress(userId: string, courseId: string): Promise<number> {
  const enrollment = await this.prisma.enrollment.findUnique({ ... });

  let totalLessons: number;
  if (enrollment.type === 'FULL') {
    // FULL: count ALL lessons in course
    totalLessons = await this.prisma.lesson.count({
      where: { chapter: { section: { courseId } } },
    });
  } else {
    // PARTIAL: only count lessons in PURCHASED chapters
    const purchasedChapters = await this.prisma.chapterPurchase.findMany({
      where: { userId, chapter: { section: { courseId } } },
      select: { chapterId: true },
    });
    totalLessons = await this.prisma.lesson.count({
      where: { chapterId: { in: purchasedChapters.map((p) => p.chapterId) } },
    });
  }

  const completedLessons = await this.prisma.lessonProgress.count({
    where: { userId, isCompleted: true, lesson: { chapter: { section: { courseId } } } },
  });

  const progress = totalLessons > 0 ? completedLessons / totalLessons : 0;

  await this.prisma.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { progress },
  });

  return progress;
}
```

**Ví dụ:**

| Enrollment | Total Lessons | Completed | Progress |
|-----------|---------------|-----------|----------|
| FULL (30 lessons) | 30 | 21 | 0.7 (70%) |
| PARTIAL (2 chapters, 8 lessons) | 8 | 6 | 0.75 (75%) |

### 9.2 Auto-Certificate at 100%

```typescript
if (progress >= 1 && enrollment.type === 'FULL') {
  await this.certificatesService.generateCertificate(userId, courseId);
}
```

**Chỉ FULL enrollment mới nhận certificate** — PARTIAL enrollment dù 100% purchased chapters cũng không đủ qualification (chưa học hết khóa).

---

## 10. KEY DESIGN DECISIONS

| Decision | Lý do |
|----------|-------|
| Access control check cheapest query first | `isFreePreview` = 0 queries, enrollment = 1 query, chapter purchase = 1 query |
| Set lookup cho curriculum completion | O(1) per lesson thay vì N+1 queries |
| Prisma `select` (whitelist) cho quiz options | An toàn hơn `omit` (blacklist) — field mới không tự leak |
| `mergeSegments` extracted to util | Reusable, dễ unit test, pure function |
| 80% threshold cho video complete | Industry standard, phù hợp user behavior |
| "Never un-complete" pattern | Monotonic progression — UX tốt hơn |
| `as unknown as Prisma.InputJsonValue` | TypeScript workaround cho Prisma Json field |
| Separate `completeLesson` endpoint | Text lesson không có video segments concept |
| FULL vs PARTIAL progress calculation | Fair progress — chỉ count accessible lessons |
| Auto-certificate only for FULL | PARTIAL chưa hoàn thành toàn bộ khóa học |
| ProgressService → CertificatesService + StreaksService | 1-directional dependency, không circular |
