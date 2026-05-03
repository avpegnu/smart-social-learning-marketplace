# 05 — Testing: 151 Unit Tests cho Courses & Categories Modules

> Giải thích 13 test files — mock strategy cho multi-service dependencies,
> DTO validation testing, counter cascade mocking, và transaction testing patterns.

---

## 1. TEST OVERVIEW

### 1.1 Phân bố tests

```
Phase 5.6 Tests (151 tests total, 13 files):

DTO Validation:
  dto/dto.validation.spec.ts              → 45 tests (11 DTOs)

Service Tests:
  browse/courses.service.spec.ts          → 10 tests (filter, sort, view tracking)
  management/course-management.service.spec.ts → 16 tests (CRUD, ownership, submit)
  sections/sections.service.spec.ts       → 10 tests (CRUD, reorder, counters)
  chapters/chapters.service.spec.ts       →  9 tests (CRUD, counter cascade)
  lessons/lessons.service.spec.ts         →  8 tests (CRUD, duration recalc)
  quizzes/quizzes.service.spec.ts         →  7 tests (upsert, validation)
  reviews/reviews.service.spec.ts         → 13 tests (4 gates, avg rating)
  categories/categories.service.spec.ts   →  4 tests (findAll, findBySlug)

Controller Tests:
  browse/courses.controller.spec.ts       →  3 tests (delegation)
  management/course-management.controller.spec.ts → 6 tests (delegation)
  reviews/reviews.controller.spec.ts      →  4 tests (delegation)
  categories/categories.controller.spec.ts →  2 tests (delegation)
```

### 1.2 Tổng project

```
Phase 5.3 (Common):      63 tests
Phase 5.4 (Auth):         87 tests
Phase 5.5 (Users):        74 tests
Phase 5.6 (Courses):     151 tests  ← HIỆN TẠI
─────────────────────────────────
Total:                   375 tests
```

---

## 2. MOCK STRATEGY — MULTI-SERVICE DEPENDENCIES

### 2.1 So sánh với Phase 5.5

```
Phase 5.5:
  UsersService → PrismaService (1 dependency)
  → Mock 1 object

Phase 5.6:
  LessonsService → PrismaService + CourseManagementService + ChaptersService
  → Mock 3 objects
```

### 2.2 Mock Sub-services — Chỉ mock methods được gọi

```typescript
// lessons.service.spec.ts
const mockCourseManagement = { verifyOwnership: jest.fn() };
const mockChaptersService = { recalculateChapterCounters: jest.fn() };

const module = await Test.createTestingModule({
  providers: [
    LessonsService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: CourseManagementService, useValue: mockCourseManagement },
    { provide: ChaptersService, useValue: mockChaptersService },
  ],
}).compile();
```

**Pattern:**
- Mock object chỉ chứa methods mà SUT (System Under Test) thực sự gọi.
- `verifyOwnership` → `jest.fn()` (default resolve undefined — enough for "not throwing").
- `recalculateChapterCounters` → `jest.fn()` (verify nó ĐƯỢC GỌI, không cần return value).

### 2.3 Mock PrismaService — Per-test setup

```typescript
const mockPrisma = {
  section: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  chapter: { findMany: jest.fn() },
  course: { update: jest.fn() },
  $transaction: jest.fn(),
};
```

**Chỉ mock Prisma models + methods mà service THỰC SỰ GỌI.**
- SectionsService gọi `prisma.section.*` + `prisma.chapter.findMany` + `prisma.course.update`.
- Không mock `prisma.user` hay `prisma.enrollment` vì SectionsService không dùng.

---

## 3. DTO VALIDATION TESTING

### 3.1 Helper Functions — DRY

```typescript
async function validateDto<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.keys(e.constraints || {}));
}

async function expectValid<T extends object>(DtoClass: new () => T, data: Record<string, unknown>) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints).toHaveLength(0);
}

async function expectInvalid<T extends object>(
  DtoClass: new () => T,
  data: Record<string, unknown>,
) {
  const constraints = await validateDto(DtoClass, data);
  expect(constraints.length).toBeGreaterThan(0);
}
```

### 3.2 Boundary Testing

```typescript
// CreateCourseDto
it('title too short (< 5 chars)', async () => {
  await expectInvalid(CreateCourseDto, { title: 'abc' });      // 3 chars
});
it('title too long (> 200 chars)', async () => {
  await expectInvalid(CreateCourseDto, { title: 'A'.repeat(201) });
});
it('description too short (< 50 chars)', async () => {
  await expectInvalid(CreateCourseDto, { ...valid, description: 'Too short' });
});
it('negative price', async () => {
  await expectInvalid(CreateCourseDto, { ...valid, price: -100 });
});
it('too many tags (> 10)', async () => {
  const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
  await expectInvalid(CreateCourseDto, { ...valid, tags });
});
```

### 3.3 Nested DTO Testing — Quiz

```typescript
describe('QuizQuestionDto', () => {
  it('should pass with valid question', async () => {
    await expectValid(QuizQuestionDto, {
      question: 'What is React?',
      options: [
        { text: 'A library', isCorrect: true },
        { text: 'A framework', isCorrect: false },
      ],
    });
  });
});
```

**`@ValidateNested` + `@Type(() => QuizOptionDto)`:**
- class-validator validates nested objects khi có `@ValidateNested`.
- class-transformer `@Type` cần để `plainToInstance` biết transform sang đúng class.
- Trong tests, `plainToInstance` tự handle nested transformation.

---

## 4. TRANSACTION TESTING

### 4.1 Callback Transaction — Mock Pattern

```typescript
// ReviewsService dùng callback transaction:
// prisma.$transaction(async (tx) => { tx.review.create(...) })

mockPrisma.$transaction.mockImplementation(
  async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      review: {
        create: jest.fn().mockResolvedValue(MOCK_REVIEW),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: 10 }),
      },
      course: { update: jest.fn() },
    }),
);
```

**Giải thích:**
- `$transaction` nhận callback function `(tx) => Promise`.
- Mock THỰC THI callback ngay lập tức với fake `tx` object.
- Fake `tx` chứa mock methods giống PrismaService.
- Cho phép test verify: review được create, aggregate được gọi, course được update.

### 4.2 Batch Transaction — Array Pattern

```typescript
// SectionsService.reorder dùng batch transaction:
// prisma.$transaction([update1, update2, update3])

mockPrisma.$transaction.mockResolvedValue([]);

await service.reorder('course-1', 'instr-1', ['sec-3', 'sec-1', 'sec-2']);

expect(mockPrisma.$transaction).toHaveBeenCalled();
```

**Batch transaction mock đơn giản hơn:**
- Nhận array of PrismaPromise → resolve array of results.
- Mock chỉ cần `mockResolvedValue([])`.
- Verify individual method calls riêng biệt.

---

## 5. COUNTER CASCADE TESTING

### 5.1 Verify recalculation được gọi

```typescript
// lessons.service.spec.ts
it('should create lesson and recalculate counters', async () => {
  // ... setup mocks ...
  mockChaptersService.recalculateChapterCounters.mockResolvedValue({});

  await service.create('course-1', 'ch-1', 'instr-1', dto);

  // Verify cascade trigger
  expect(mockChaptersService.recalculateChapterCounters).toHaveBeenCalledWith('ch-1');
});

it('should not recalculate if duration not changed', async () => {
  await service.update('course-1', 'les-1', 'instr-1', { title: 'Updated' });

  // Title change → no counter impact
  expect(mockChaptersService.recalculateChapterCounters).not.toHaveBeenCalled();
});
```

### 5.2 Test recalculation logic

```typescript
// chapters.service.spec.ts
it('should aggregate lesson counts and cascade to course', async () => {
  mockPrisma.lesson.findMany.mockResolvedValue([
    { estimatedDuration: 600 },
    { estimatedDuration: 300 },
    { estimatedDuration: null },   // ← null duration = 0
  ]);

  await service.recalculateChapterCounters('ch-1');

  expect(mockPrisma.chapter.update).toHaveBeenCalledWith({
    where: { id: 'ch-1' },
    data: { lessonsCount: 3, totalDuration: 900 },  // 600 + 300 + 0
  });
  expect(mockSectionsService.recalculateCourseCounters).toHaveBeenCalledWith('course-1');
});
```

---

## 6. CONTROLLER TESTING — THIN DELEGATION

```typescript
// course-management.controller.spec.ts
it('should create course', async () => {
  const dto = { title: 'New Course' };
  mockService.create.mockResolvedValue({ id: 'course-1' });

  await controller.create(MOCK_USER, dto);

  // Controller chỉ delegate → verify đúng args
  expect(mockService.create).toHaveBeenCalledWith('instr-1', dto);
});
```

**Thin controller tests verify:**
1. Controller gọi đúng service method
2. Truyền đúng arguments (user.sub, params, dto)
3. Return service result (không transform)

**Không test trong controller tests:**
- Business logic (test ở service)
- Validation (test ở DTO)
- Auth/Guards (test ở integration tests)
