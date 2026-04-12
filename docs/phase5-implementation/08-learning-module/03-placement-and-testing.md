# 03 — Placement Tests & Testing Overview

> Giải thích chi tiết PlacementTestsService — category → tags derivation, Fisher-Yates shuffle,
> grading by level, determineLevel logic. Testing overview — 39 tests across 6 files, key test
> patterns cho multi-service dependency mocking, access control, edge cases.

---

## 1. TỔNG QUAN

### 1.1 Vai trò

PlacementTestsService giúp student đánh giá trình độ trước khi chọn khóa học. Chọn câu hỏi theo category, trộn ngẫu nhiên, chấm điểm theo level, gợi ý khóa học phù hợp.

```
PlacementTestsService — 2 public methods:
  ├── startTest(categoryId)              → Questions (shuffled, no answers)
  └── submitTest(userId, dto)            → Grade by level + recommend courses

  1 private method:
  └── determineLevel(scores, totals)     → BEGINNER | INTERMEDIATE | ADVANCED
```

### 1.2 Module Structure

```
placement-tests/
├── placement-tests.controller.ts    # POST /api/placement-tests/start, POST /submit
├── placement-tests.service.ts       # Question selection, grading
└── placement-tests.service.spec.ts  # 4 tests
```

### 1.3 Dependencies

```
PlacementTestsService
  └── PrismaService    (no other service dependencies)
```

---

## 2. CATEGORY → TAG IDS DERIVATION

### 2.1 Vấn đề

Placement questions được tag bằng `tagIds` (array of tag IDs). Khi user chọn category "Web Development", cần tìm questions liên quan. Nhưng PlacementQuestion không có trực tiếp `categoryId` — chỉ có `tagIds`.

### 2.2 Solution — Derive tags từ category courses

```typescript
async startTest(categoryId: string) {
  let questions = await this.prisma.placementQuestion.findMany();

  if (categoryId) {
    // Get category with courses → courseTags → tagIds
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        courses: {
          select: { courseTags: { select: { tagId: true } } },
        },
      },
    });

    // Collect unique tagIds from all courses in category
    const tagIds = [
      ...new Set(
        category?.courses.flatMap((c) => c.courseTags.map((ct) => ct.tagId)) ?? [],
      ),
    ];

    if (tagIds.length > 0) {
      questions = await this.prisma.placementQuestion.findMany({
        where: { tagIds: { hasSome: tagIds } },
      });
    }
  }
```

**Chain relation:**
```
Category → courses[] → courseTags[] → tagId
                                        ↓
PlacementQuestion.tagIds: hasSome(tagIds)
```

**`hasSome`** — PostgreSQL array overlap operator. Tìm questions có ít nhất 1 tag trùng với tags của courses trong category.

**`new Set(...)` + spread** — deduplicate tagIds. Nhiều courses trong cùng category có thể share tags.

### 2.3 Fallback khi không có categoryId

```typescript
let questions = await this.prisma.placementQuestion.findMany();

if (categoryId) {
  // ... filter by tags
}
```

Nếu không truyền `categoryId` → lấy tất cả questions → general placement test.

---

## 3. FISHER-YATES SHUFFLE

### 3.1 Tại sao cần shuffle?

Placement test không nên trả câu hỏi cùng thứ tự mỗi lần — user có thể nhớ vị trí đáp án.

### 3.2 Implementation

```typescript
// Fisher-Yates shuffle
for (let i = questions.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [questions[i], questions[j]] = [questions[j]!, questions[i]!];
}

const selected = questions.slice(0, 15);
```

**Fisher-Yates algorithm:**
1. Từ cuối mảng → đầu mảng
2. Chọn random index `j` trong range `[0, i]`
3. Swap `questions[i]` với `questions[j]`
4. Kết quả: uniform random permutation — mỗi câu hỏi có xác suất bằng nhau ở mỗi vị trí

**`slice(0, 15)`** — lấy 15 câu đầu sau shuffle = random 15 câu từ pool. Nếu pool < 15 → lấy hết.

**Tại sao Fisher-Yates thay vì `sort(() => Math.random() - 0.5)`?**
- `sort` random: bias, không uniform, O(n log n)
- Fisher-Yates: unbiased, uniform, O(n)

---

## 4. RETURN QUESTIONS WITHOUT ANSWER

```typescript
return {
  questions: selected.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    level: q.level,
    // NO 'answer' field!
  })),
  totalQuestions: selected.length,
};
```

**Explicit whitelist** — chỉ trả `id`, `question`, `options`, `level`. Field `answer` (correct option ID) bị strip. Giống pattern strip `isCorrect` ở CoursePlayerService — whitelist an toàn hơn blacklist.

---

## 5. GRADING BY LEVEL

### 5.1 Chấm điểm theo 3 levels

```typescript
async submitTest(userId: string, dto: SubmitPlacementDto) {
  const scores: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };
  const totals: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };

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
```

**Tại sao chấm theo level thay vì tổng?**

```
Ví dụ: 15 câu = 5 BEGINNER + 5 INTERMEDIATE + 5 ADVANCED

User A: đúng 5/5 BEGINNER, 0/5 INTERMEDIATE, 0/5 ADVANCED
  → Total: 5/15 = 33% ← Thấp, nhưng user giỏi BEGINNER
  → Level: BEGINNER (100% beginner rate)

User B: đúng 3/5 BEGINNER, 4/5 INTERMEDIATE, 4/5 ADVANCED
  → Total: 11/15 = 73%
  → Level: ADVANCED (80% advanced rate)
```

Chấm theo level cho kết quả chính xác hơn tổng điểm.

### 5.2 determineLevel Logic

```typescript
private determineLevel(
  scores: Record<string, number>,
  totals: Record<string, number>,
): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS' {
  const advancedRate = totals['ADVANCED']! > 0
    ? scores['ADVANCED']! / totals['ADVANCED']! : 0;
  const intermediateRate = totals['INTERMEDIATE']! > 0
    ? scores['INTERMEDIATE']! / totals['INTERMEDIATE']! : 0;
  const beginnerRate = totals['BEGINNER']! > 0
    ? scores['BEGINNER']! / totals['BEGINNER']! : 0;

  if (advancedRate >= 0.7) return 'ADVANCED';
  if (intermediateRate >= 0.7) return 'INTERMEDIATE';
  if (beginnerRate >= 0.7) return 'BEGINNER';
  return 'BEGINNER'; // Default
}
```

**Check từ cao xuống thấp:**
1. Advanced >= 70%? → ADVANCED
2. Intermediate >= 70%? → INTERMEDIATE
3. Beginner >= 70%? → BEGINNER
4. Không đạt threshold nào? → BEGINNER (default)

**Tại sao 70% threshold?**
- Quá thấp (50%) → nhiều false positive
- Quá cao (90%) → nhiều false negative (user giỏi nhưng sai 1-2 câu)
- 70% = balance — đúng 3.5/5 câu trở lên = đủ confident

**Tại sao check cao → thấp?** User giỏi ADVANCED thường cũng đúng INTERMEDIATE/BEGINNER. Nếu check thấp → cao, user ADVANCED bị classify thành BEGINNER vì beginnerRate > 0.7.

### 5.3 Recommended Courses

```typescript
const recommendedCourses = await this.prisma.course.findMany({
  where: { level: recommendedLevel, status: 'PUBLISHED', deletedAt: null },
  select: { id: true, title: true, slug: true, thumbnailUrl: true, level: true },
  take: 5,
});
```

Gợi ý 5 khóa học phù hợp level. Filter `PUBLISHED` + `deletedAt: null` — chỉ khóa đang hoạt động.

---

## 6. TESTING OVERVIEW — 39 TESTS, 6 FILES

### 6.1 Test Distribution

| File | Tests | Focus |
|------|-------|-------|
| `course-player.service.spec.ts` | 7 | Access control 3 layers, lesson validation |
| `progress.service.spec.ts` | 10 | Segments merge, threshold, never un-complete, FULL/PARTIAL |
| `quiz-attempts.service.spec.ts` | 7 | Grading, max attempts, explanations |
| `certificates.service.spec.ts` | 5 | Idempotent gen, verify code, verify cert |
| `streaks.service.spec.ts` | 6 | Daily activity, streak calc, dashboard |
| `placement-tests.service.spec.ts` | 4 | Shuffle, strip answers, grading by level |
| **Total** | **39** | |

### 6.2 Multi-Service Dependency Mocking

ProgressService là service có nhiều dependencies nhất (3 deps):

```typescript
const mockPrisma = {
  lesson: { findUnique: jest.fn(), count: jest.fn() },
  enrollment: { findUnique: jest.fn(), update: jest.fn() },
  lessonProgress: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  chapterPurchase: { findMany: jest.fn() },
};

const mockCertificates = { generateCertificate: jest.fn() };
const mockStreaks = { trackDailyActivity: jest.fn() };

// NestJS testing module
const module = await Test.createTestingModule({
  providers: [
    ProgressService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: CertificatesService, useValue: mockCertificates },
    { provide: StreaksService, useValue: mockStreaks },
  ],
}).compile();
```

**Pattern:** Mock chỉ methods thực sự được gọi — không mock toàn bộ PrismaService. Ví dụ ProgressService không dùng `prisma.user` nên không cần mock.

### 6.3 Course Player Access Control — 6 Test Cases

```typescript
// Covers all 3 access layers:
it('should return lesson for fully enrolled user');        // Layer 2: FULL
it('should allow free preview access without enrollment'); // Layer 1: Free preview
it('should allow access with chapter purchase');           // Layer 3: Chapter purchase
it('should throw if lesson not found');                    // Validation
it('should throw if lesson belongs to different course');  // Cross-course attack
it('should deny access without enrollment or purchase');   // All 3 layers fail
```

**Test case quan trọng — cross-course validation:**

```typescript
it('should throw if lesson belongs to different course', async () => {
  mockPrisma.lesson.findUnique.mockResolvedValue({
    ...MOCK_LESSON,
    chapter: { ...MOCK_LESSON.chapter, section: { courseId: 'other-course' } },
  });

  await expect(service.getLesson('user-1', 'course-1', 'les-1'))
    .rejects.toThrow(NotFoundException);
});
```

Verify rằng user không thể access lesson của course khác bằng cách thay đổi `courseId` trong URL.

### 6.4 "Never Un-Complete" Test

```typescript
it('should never un-complete', async () => {
  mockPrisma.lessonProgress.findUnique.mockResolvedValue({
    watchedSegments: [[0, 600]],
    isCompleted: true,  // Already completed
  });

  const result = await service.updateLessonProgress('user-1', 'les-1', {
    watchedSegments: [[0, 100]], // Smaller segments → would be < 80%
  });

  expect(result.isCompleted).toBe(true); // Still true!
});
```

Verify monotonic progression — lesson đã complete không bao giờ bị un-complete dù segments mới nhỏ hơn.

### 6.5 Streak "Today Not Yet Active" Edge Case

```typescript
it('should keep streak when today not yet active', async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activities = [
    { activityDate: new Date(today.getTime() - 86400000) },     // yesterday
    { activityDate: new Date(today.getTime() - 86400000 * 2) }, // 2 days ago
  ];
  mockPrisma.dailyActivity.findMany.mockResolvedValue(activities);

  const result = await service.getStreak('user-1');

  expect(result.currentStreak).toBe(2); // Yesterday + day before
  expect(result.todayCompleted).toBe(false);
});
```

User chưa học hôm nay nhưng streak vẫn giữ = 2 (tính từ yesterday). Critical edge case — nếu không handle, user mở app sáng sớm thấy streak = 0.

### 6.6 Quiz Grading with Explanations Verification

```typescript
it('should return explanations and correct answers', async () => {
  // ... setup quiz with explanations
  const result = await service.submitQuiz('user-1', 'les-1', {
    answers: [
      { questionId: 'q-1', selectedOptionId: 'opt-b' }, // wrong
      { questionId: 'q-2', selectedOptionId: 'opt-c' }, // correct
    ],
  });

  expect(result.results[0]!.correctAnswer).toBe('opt-a');
  expect(result.results[0]!.explanation).toBe('useState manages state');
});
```

Verify response chứa đáp án đúng + giải thích SAU KHI submit — critical cho UX "xem lại bài".

### 6.7 jest.mock('crypto') cho Certificate Tests

```typescript
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'ABCD1234-5678-9012-3456-789012345678'),
}));
```

**Tại sao mock crypto?**
- `randomUUID()` trả random value → test non-deterministic
- Mock → fixed value `'ABCD1234...'` → `slice(0, 8).toUpperCase()` = `'ABCD1234'`
- Cho phép assert exact verify code và certificate URL

```typescript
it('should create new certificate with verify code', async () => {
  // ...
  const result = await service.generateCertificate('user-1', 'course-1');

  expect(result.verifyCode).toBe('ABCD1234');
  expect(result.certificateUrl).toContain('sslm.com/certificates/ABCD1234');
});
```

### 6.8 Placement Test — Strip Answer Verification

```typescript
it('should return shuffled questions without answers', async () => {
  mockPrisma.placementQuestion.findMany.mockResolvedValue([
    { id: 'pq-1', question: 'Q1', options: [], level: 'BEGINNER', answer: 'opt-a' },
  ]);

  const result = await service.startTest('cat-1');

  // Answer field should NOT be in response
  expect(result.questions[0]).not.toHaveProperty('answer');
});
```

Verify rằng `answer` field bị strip trước khi trả response. Nếu không — student nhìn network tab thấy đáp án.

---

## 7. KEY DESIGN DECISIONS

| Decision | Lý do |
|----------|-------|
| Category → tags derivation qua relation chain | PlacementQuestion không có `categoryId`, derive từ courses' tags |
| Fisher-Yates shuffle | Unbiased, O(n), uniform distribution |
| Select 15 câu từ pool | Đủ dài để đánh giá, không quá dài gây mệt |
| Strip `answer` field (whitelist) | An toàn hơn blacklist — field mới không tự leak |
| Grade by level (không tổng điểm) | Chính xác hơn — user có thể giỏi 1 level, yếu level khác |
| Check high → low (ADVANCED → BEGINNER) | User giỏi ADVANCED cũng đúng lower levels |
| 70% threshold | Balance giữa false positive và false negative |
| Default BEGINNER | Safe fallback — gợi ý khóa cơ bản khi không chắc chắn |
| Mock crypto for deterministic tests | Fixed verify code → exact assertion |
| 6 test files covering 39 cases | Mỗi service test độc lập, mock dependencies |
