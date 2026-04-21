# 03 — Curriculum CRUD: Sections, Chapters, Lessons, và Counter Cascade

> Giải thích 3 sub-services — nested CRUD pattern, auto-order assignment,
> ownership verification chain, denormalized counter cascade, và reorder pattern.

---

## 1. TỔNG QUAN — 3 LAYERS

### 1.1 Cấu trúc Curriculum

```
Course
  └── Section (ví dụ: "Phần 1: Giới thiệu")
       └── Chapter (ví dụ: "Chương 1: React là gì?")
            └── Lesson (ví dụ: "Bài 1: Welcome", type: VIDEO/TEXT/QUIZ)
```

### 1.2 3 Services — Same Pattern

```
SectionsService  → CRUD sections + recalculateCourseCounters
ChaptersService  → CRUD chapters + recalculateChapterCounters (cascade → course)
LessonsService   → CRUD lessons + trigger chapter recalculation (cascade → course)
```

Mỗi service có: `create`, `update`, `delete`, `reorder` + private `verify*BelongsTo*` helper.

### 1.3 Dependency Chain

```
LessonsService
  ├── PrismaService
  ├── CourseManagementService  (verifyOwnership)
  └── ChaptersService          (recalculateChapterCounters)

ChaptersService
  ├── PrismaService
  ├── CourseManagementService  (verifyOwnership)
  └── SectionsService          (recalculateCourseCounters)

SectionsService
  ├── PrismaService
  └── CourseManagementService  (verifyOwnership)
```

---

## 2. OWNERSHIP VERIFICATION — 2 LAYERS

### 2.1 Layer 1: Course Ownership

Mọi thao tác đều bắt đầu bằng:
```typescript
await this.courseManagement.verifyOwnership(courseId, instructorId);
```

### 2.2 Layer 2: Resource Belongs to Course

Sau khi xác nhận instructor owns course, kiểm tra resource thuộc về course:

```typescript
// SectionsService
private async verifySectionBelongsToCourse(sectionId: string, courseId: string) {
  const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || section.courseId !== courseId) {
    throw new NotFoundException({ code: 'SECTION_NOT_FOUND' });
  }
  return section;
}

// ChaptersService — cần JOIN qua section
private async verifyChapterBelongsToCourse(chapterId: string, courseId: string) {
  const chapter = await this.prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { section: { select: { courseId: true } } },  // JOIN
  });
  if (!chapter || chapter.section.courseId !== courseId) {
    throw new NotFoundException({ code: 'CHAPTER_NOT_FOUND' });
  }
  return chapter;
}

// LessonsService — cần 2 JOINs
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
```

**Tại sao verify 2 lần?**
```
Scenario tấn công:
  Instructor A owns course-1
  Instructor A gửi: DELETE /api/instructor/courses/course-1/sections/sec-99
  sec-99 thuộc course-2 (của Instructor B)

  Nếu chỉ verify ownership course-1 → pass
  Nhưng sec-99 không thuộc course-1 → phải reject!

  → Layer 2 prevents cross-course resource manipulation
```

---

## 3. AUTO-ORDER ASSIGNMENT

### 3.1 Pattern — Giống nhau cho cả 3 services

```typescript
async create(courseId: string, instructorId: string, dto: CreateSectionDto) {
  await this.courseManagement.verifyOwnership(courseId, instructorId);

  // Auto-assign order nếu frontend không gửi
  if (dto.order === undefined) {
    const lastSection = await this.prisma.section.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    dto.order = (lastSection?.order ?? -1) + 1;
  }

  return this.prisma.section.create({
    data: { title: dto.title, order: dto.order, courseId },
  });
}
```

**Logic:**
```
Chưa có section nào → lastSection = null → order = (-1) + 1 = 0
Có section order=0  → lastSection.order = 0 → order = 0 + 1 = 1
Có section order=5  → lastSection.order = 5 → order = 5 + 1 = 6
```

**Tại sao `(lastSection?.order ?? -1) + 1`?**
- `lastSection` có thể null (chưa có item nào).
- Nullish coalescing `??` trả -1 khi null → -1 + 1 = 0 (order bắt đầu từ 0).
- Cũng dùng cho chapters (per section) và lessons (per chapter).

---

## 4. DENORMALIZED COUNTER CASCADE

### 4.1 Cơ chế

```
Khi lesson THAY ĐỔI (create/update duration/delete):
  │
  ▼
ChaptersService.recalculateChapterCounters(chapterId)
  → COUNT lessons in chapter     → chapter.lessonsCount
  → SUM lesson.estimatedDuration → chapter.totalDuration
  │
  ▼
SectionsService.recalculateCourseCounters(courseId)
  → SUM chapter.lessonsCount  → course.totalLessons
  → SUM chapter.totalDuration → course.totalDuration
```

### 4.2 Implementation

```typescript
// ChaptersService
async recalculateChapterCounters(chapterId: string) {
  const lessons = await this.prisma.lesson.findMany({
    where: { chapterId },
    select: { estimatedDuration: true },
  });

  const chapter = await this.prisma.chapter.update({
    where: { id: chapterId },
    data: {
      lessonsCount: lessons.length,
      totalDuration: lessons.reduce((sum, l) => sum + (l.estimatedDuration ?? 0), 0),
    },
  });

  // Cascade lên course
  const section = await this.prisma.section.findUnique({
    where: { id: chapter.sectionId },
    select: { courseId: true },
  });
  if (section) {
    await this.sectionsService.recalculateCourseCounters(section.courseId);
  }
}

// SectionsService
async recalculateCourseCounters(courseId: string) {
  const chapters = await this.prisma.chapter.findMany({
    where: { section: { courseId } },
    select: { lessonsCount: true, totalDuration: true },
  });

  await this.prisma.course.update({
    where: { id: courseId },
    data: {
      totalLessons: chapters.reduce((sum, c) => sum + c.lessonsCount, 0),
      totalDuration: chapters.reduce((sum, c) => sum + c.totalDuration, 0),
    },
  });
}
```

### 4.3 Khi nào trigger recalculation?

| Action | Trigger |
|--------|---------|
| Lesson created | `chaptersService.recalculateChapterCounters(chapterId)` |
| Lesson duration updated | `chaptersService.recalculateChapterCounters(chapterId)` |
| Lesson title updated | Không recalculate (title không ảnh hưởng counters) |
| Lesson deleted | `chaptersService.recalculateChapterCounters(chapterId)` |
| Chapter deleted | `sectionsService.recalculateCourseCounters(courseId)` |
| Section deleted | `sectionsService.recalculateCourseCounters(courseId)` |

### 4.4 Tại sao không dùng DB triggers?

```
Option A: Application-level recalculation (✅ Chọn)
  + Kiểm soát hoàn toàn khi nào trigger
  + Dễ test (mock service methods)
  + Portable (không phụ thuộc DB-specific triggers)
  - Phải nhớ gọi recalculate sau mỗi mutation

Option B: PostgreSQL triggers (❌)
  + Tự động, không quên
  - Khó test, khó debug
  - Prisma không support manage triggers
  - Logic ẩn trong DB layer, không thấy trong code
```

---

## 5. REORDER PATTERN

### 5.1 Batch Update trong Transaction

```typescript
async reorder(courseId: string, instructorId: string, orderedIds: string[]) {
  await this.courseManagement.verifyOwnership(courseId, instructorId);

  await this.prisma.$transaction(
    orderedIds.map((id, index) =>
      this.prisma.section.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );
}
```

**Frontend gửi:**
```json
PUT /api/instructor/courses/xxx/sections/reorder
{ "orderedIds": ["sec-3", "sec-1", "sec-2"] }
```

**Kết quả:**
```
sec-3.order = 0  (trước đây order=2)
sec-1.order = 1  (trước đây order=0)
sec-2.order = 2  (trước đây order=1)
```

### 5.2 ReorderDto — Generic cho cả 3 levels

```typescript
export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
```

Cùng 1 DTO dùng cho sections, chapters, và lessons reorder.

### 5.3 Tại sao `$transaction` với array?

```typescript
// Prisma $transaction có 2 overloads:

// 1. Sequential (callback) — cho logic phức tạp
await prisma.$transaction(async (tx) => {
  const a = await tx.user.create(...);
  await tx.post.create({ data: { userId: a.id } });
});

// 2. Batch (array) — cho independent operations
await prisma.$transaction([
  prisma.section.update({ where: { id: 'sec-1' }, data: { order: 0 } }),
  prisma.section.update({ where: { id: 'sec-2' }, data: { order: 1 } }),
]);
```

Reorder dùng batch mode vì:
- Các update independent (không phụ thuộc lẫn nhau).
- Prisma batch transaction hiệu quả hơn (1 round-trip thay vì N).
- Tất cả succeed hoặc tất cả rollback.

---

## 6. CASCADE DELETE

```
Khi xóa Section:
  → CASCADE deletes all Chapters in section
    → CASCADE deletes all Lessons in chapters
      → CASCADE deletes Quiz, QuizQuestions, QuizOptions

Prisma schema:
  Chapter: @relation(onDelete: Cascade)
  Lesson:  @relation(onDelete: Cascade)
  Quiz:    @relation(onDelete: Cascade)
```

Sau cascade delete, service gọi `recalculateCourseCounters` để cập nhật `totalLessons`/`totalDuration` trên Course.
