# 04 — Quizzes & Reviews: Upsert Pattern, Score Conversion, và Avg Rating Recalculation

> Giải thích QuizzesService (upsert pattern, validation) và ReviewsService
> (enrollment check, progress gate, unique constraint, transactional avg rating).

---

## 1. QUIZZES SERVICE

### 1.1 Vai trò

QuizzesService quản lý quiz cho lessons type=QUIZ. Mỗi lesson chỉ có tối đa 1 quiz (1:1 relation qua `lessonId @unique`).

```
QuizzesService — 3 methods:

  upsertQuiz(courseId, lessonId, instructorId, dto) → Create or replace quiz
  getQuiz(courseId, lessonId, instructorId)          → Get quiz with questions + options
  deleteQuiz(courseId, lessonId, instructorId)       → Delete quiz
```

### 1.2 Upsert Pattern — Delete + Recreate

```typescript
async upsertQuiz(courseId, lessonId, instructorId, dto) {
  await this.courseManagement.verifyOwnership(courseId, instructorId);
  await this.verifyLessonBelongsToCourse(lessonId, courseId);

  // Validation
  for (const q of dto.questions) {
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException({ code: 'QUIZ_INVALID_CORRECT_OPTIONS' });
    }
  }

  return this.prisma.$transaction(async (tx) => {
    // ① Delete existing quiz (cascade → questions → options)
    await tx.quiz.deleteMany({ where: { lessonId } });

    // ② Create new quiz with nested data
    return tx.quiz.create({
      data: {
        lessonId,
        passingScore: dto.passingScore !== undefined ? dto.passingScore / 100 : 0.7,
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
    });
  });
}
```

### 1.3 Tại sao Upsert thay vì Partial Update?

```
Partial Update (❌ Phức tạp):
  - Tìm questions cũ, diff với questions mới
  - Delete removed questions, update changed, create new
  - Cùng logic cho options bên trong mỗi question
  - Edge cases: reorder, add + delete cùng lúc
  - Code phức tạp, dễ bug

Delete + Recreate (✅ Đơn giản):
  - deleteMany quiz (cascade xóa questions + options)
  - create quiz mới với full data
  - 1 transaction, atomic, dễ hiểu
  - API doc cũng recommend approach này
```

### 1.4 passingScore Conversion

```
DTO:    passingScore = 70   (0-100, user-friendly)
DB:     passingScore = 0.7  (0-1, Float)

Conversion: dto.passingScore / 100

Schema default: @default(0.7) = 70%
```

**Tại sao DB lưu 0-1?**
- Float 0-1 dùng cho comparison trực tiếp: `if (score >= quiz.passingScore)`
- Không cần `/100` mỗi lần compare
- Consistent với `enrollment.progress` (cũng 0-1)

### 1.5 Question Validation — Exactly 1 Correct

```typescript
for (const q of dto.questions) {
  const correctCount = q.options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    throw new BadRequestException({ code: 'QUIZ_INVALID_CORRECT_OPTIONS' });
  }
}
```

**Tại sao validate ở service, không phải DTO?**
- DTO validates individual field types (IsString, IsBoolean, IsArray).
- Cross-field validation (correctCount per question) thuộc business logic.
- class-validator CÓ thể custom validator, nhưng phức tạp hơn simple loop.

### 1.6 `deleteMany` thay vì `delete`

```typescript
await tx.quiz.deleteMany({ where: { lessonId } });
// vs
await tx.quiz.delete({ where: { lessonId } });
```

- `deleteMany` không throw nếu không có quiz → idempotent.
- `delete` throws `RecordNotFound` nếu quiz chưa tồn tại.
- Upsert cần idempotent delete (lần đầu chưa có quiz → không nên error).

---

## 2. REVIEWS SERVICE

### 2.1 Vai trò

```
ReviewsService — 4 methods:

  create(userId, courseId, dto)     → Tạo review (nhiều validation)
  findByCourse(courseId, query)     → List reviews (public, paginated)
  update(userId, reviewId, dto)    → Sửa review (owner only)
  delete(userId, reviewId)         → Xóa review (owner only)
```

### 2.2 Create Review — 4 Validation Gates

```typescript
async create(userId, courseId, dto) {
  // Gate 1: Course must exist and be PUBLISHED
  const course = await this.prisma.course.findFirst({
    where: { id: courseId, status: 'PUBLISHED', deletedAt: null },
  });
  if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

  // Gate 2: Must be enrolled
  const enrollment = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

  // Gate 3: Must have ≥30% progress
  if (enrollment.progress < 0.3) {
    throw new BadRequestException({ code: 'INSUFFICIENT_PROGRESS' });
  }

  // Gate 4: 1 review per user per course
  const existing = await this.prisma.review.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw new ConflictException({ code: 'ALREADY_REVIEWED' });

  // Create + recalculate in transaction
  return this.prisma.$transaction(async (tx) => { ... });
}
```

**Tại sao check unique trước thay vì catch P2002?**
```
Option A: Check trước (✅ Chọn)
  → Explicit error code: 'ALREADY_REVIEWED'
  → Frontend biết chính xác lý do để hiển thị message phù hợp
  → 1 extra query nhưng clear intent

Option B: Catch P2002 (❌)
  → Generic Prisma error, phải parse meta.target để biết field nào
  → Error message không descriptive
  → Tuy nhiên pattern này dùng ở Follow system (Phase 5.5) vì follow ít validation hơn
```

### 2.3 Avg Rating Recalculation — Transactional

```typescript
return this.prisma.$transaction(async (tx) => {
  // Create review
  const review = await tx.review.create({
    data: { userId, courseId, rating: dto.rating, comment: dto.comment },
  });

  // Recalculate avg + count
  const agg = await tx.review.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: true,
  });

  await tx.course.update({
    where: { id: courseId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count,
    },
  });

  return review;
});
```

**Tại sao dùng `aggregate` thay vì incremental?**
```
Incremental (❌ Drift risk):
  newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
  → Nếu có concurrent reviews → race condition → sai avg
  → Accumulated floating point errors over time

Aggregate (✅ Always correct):
  SELECT AVG(rating), COUNT(*) FROM reviews WHERE courseId = ?
  → Source of truth, không drift
  → Chạy trong transaction → consistent
```

### 2.4 Review Update/Delete — Owner Check

```typescript
async update(userId: string, reviewId: string, dto: CreateReviewDto) {
  const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.userId !== userId) {
    throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
  }
  // update + recalculate avg...
}
```

**Tại sao throw `NotFoundException` thay vì `ForbiddenException` khi userId không khớp?**
- Security best practice: không tiết lộ review tồn tại cho user khác.
- Nếu throw Forbidden → attacker biết reviewId valid, chỉ không có quyền.
- Throw NotFound → attacker không biết reviewId có tồn tại hay không.

### 2.5 Review Sort

```typescript
private buildReviewSort(sort?: ReviewSortBy): Prisma.ReviewOrderByWithRelationInput {
  switch (sort) {
    case ReviewSortBy.HIGHEST: return { rating: 'desc' };
    case ReviewSortBy.LOWEST:  return { rating: 'asc' };
    default:                   return { createdAt: 'desc' };
  }
}
```

Frontend: `GET /api/courses/:courseId/reviews?sort=highest&page=1&limit=10`

---

## 3. CONTROLLER PATTERNS

### 3.1 ReviewsController — Mixed Auth

```typescript
@Controller('courses/:courseId/reviews')
@ApiTags('Reviews')
export class ReviewsController {
  @Public()   @Get()     findByCourse()   // Ai cũng xem được
  @Post()                create()          // Cần auth (JwtAuthGuard global)
  @Patch(':reviewId')    update()          // Cần auth + owner check (service)
  @Delete(':reviewId')   delete()          // Cần auth + owner check (service)
}
```

**Không dùng `@UseGuards(RolesGuard)` ở class level** vì:
- `GET` là public (ai cũng xem reviews).
- `POST/PATCH/DELETE` cần auth nhưng mọi role đều review được (STUDENT + INSTRUCTOR).
- Auth check qua global `JwtAuthGuard` (đã register ở AppModule).

### 3.2 QuizzesController — Full Instructor Guard

```typescript
@Controller('instructor/courses/:courseId/lessons/:lessonId/quiz')
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class QuizzesController {
  @Put()     upsert()    // Tạo/cập nhật quiz
  @Get()     get()        // Xem quiz
  @Delete()  delete()     // Xóa quiz
}
```

**PUT thay vì POST** cho upsert — semantic đúng hơn:
- PUT = idempotent (gọi nhiều lần, kết quả giống nhau).
- POST = tạo mới (gọi nhiều lần, tạo nhiều records).
- Quiz upsert: gọi bao nhiêu lần cũng chỉ có 1 quiz per lesson → PUT.
