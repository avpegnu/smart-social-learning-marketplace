# 02 — Course Management: Instructor CRUD, Tags, Publishing Flow, và JSON Fields

> Giải thích chi tiết CourseManagementService — create/update với tags và JSON fields,
> findById cho edit wizard, verifyOwnership pattern, submit validation, và slug generation.

---

## 1. TỔNG QUAN

### 1.1 Vai trò

CourseManagementService chứa **instructor-side business logic** — tạo, sửa, xóa khóa học, quản lý tags, và publishing flow. Đây là service "gốc" mà các sub-service (sections, chapters, lessons, quizzes) đều depend vào qua `verifyOwnership`.

```
CourseManagementService — 7 public methods:

  CRUD:
    ├── create(instructorId, dto)              → Tạo course DRAFT + auto slug + tags
    ├── findById(courseId, instructorId)        → Full detail cho edit wizard (any status)
    ├── update(courseId, instructorId, dto)     → Sửa (chỉ DRAFT/REJECTED)
    ├── softDelete(courseId, instructorId)      → Set deletedAt
    └── getInstructorCourses(instructorId, query) → List + filter by status

  Publishing:
    └── submitForReview(courseId, instructorId) → DRAFT → PENDING_REVIEW

  Tags:
    └── updateTags(courseId, instructorId, tagIds)

  Shared (used by sub-services):
    └── verifyOwnership(courseId, instructorId) → Check ownership, throw if not
```

### 1.2 File Location

```
courses/management/
  ├── course-management.controller.ts     → 7 endpoints
  ├── course-management.service.ts        → Business logic
  ├── course-management.controller.spec.ts
  └── course-management.service.spec.ts
```

---

## 2. COURSE CREATION — 3 CONCERNS

### 2.1 Slug Generation

```typescript
import { generateUniqueSlug } from '@/common/utils/slug.util';

const slug = generateUniqueSlug(dto.title);
// "NestJS Masterclass 2024" → "nestjs-masterclass-2024-lq8k9x2"
```

**Cơ chế:**
```
generateUniqueSlug(text):
  1. slugify(text, { lower: true, strict: true, locale: 'vi' })
     → "nestjs-masterclass-2024"
  2. + "-" + Date.now().toString(36)
     → "nestjs-masterclass-2024-lq8k9x2"
```

**Tại sao thêm timestamp suffix?**
- 2 course cùng title "React Basics" → cùng slug → unique constraint violation.
- Timestamp base36 đảm bảo uniqueness mà vẫn ngắn (7-8 chars).
- `locale: 'vi'` xử lý tiếng Việt: "Đồ án" → "do-an".

### 2.2 Tag — Find or Create Pattern

```typescript
private async findOrCreateTags(tagNames: string[]): Promise<{ tagId: string }[]> {
  const result: { tagId: string }[] = [];

  for (const name of tagNames) {
    const tag = await this.prisma.tag.upsert({
      where: { name },          // Tag.name là @unique
      update: {},                // Nếu đã tồn tại → không làm gì
      create: { name, slug: generateSlug(name) },  // Chưa có → tạo mới
    });
    result.push({ tagId: tag.id });
  }

  return result;
}
```

**Tại sao dùng `upsert` thay `findOrCreate`?**
- Prisma không có `findOrCreate` method.
- `upsert` = atomic `findOrCreate`: tìm theo unique field, nếu không có thì tạo.
- `update: {}` → nếu tag đã tồn tại, không update gì cả (chỉ return).
- Loop tuần tự (không Promise.all) vì `upsert` cần transactional safety.

### 2.3 JSON Fields — learningOutcomes & prerequisites

```typescript
// CreateCourseDto
learningOutcomes?: string[];   // ["Hiểu React fundamentals", "Build apps"]
prerequisites?: string[];      // ["JavaScript cơ bản", "HTML/CSS"]
promoVideoUrl?: string;        // Cloudinary URL

// Service — destructure + cast
async create(instructorId: string, dto: CreateCourseDto) {
  const { tags, learningOutcomes, prerequisites, ...courseData } = dto;

  return this.prisma.course.create({
    data: {
      ...courseData,
      slug,
      instructorId,
      ...(learningOutcomes && {
        learningOutcomes: learningOutcomes as unknown as Prisma.InputJsonValue
      }),
      ...(prerequisites && {
        prerequisites: prerequisites as unknown as Prisma.InputJsonValue
      }),
    },
  });
}
```

**Tại sao cần `as unknown as Prisma.InputJsonValue`?**
- Prisma schema: `learningOutcomes Json?` → TypeScript type là `Prisma.InputJsonValue`.
- `string[]` (DTO type) không assignable trực tiếp cho `InputJsonValue`.
- Double cast: `string[] → unknown → InputJsonValue`.
- Pattern giống Phase 5.5: `qualifications as unknown as Prisma.InputJsonValue` trong InstructorService.
- Runtime: `string[]` IS valid JSON → Prisma serializes nó đúng cách.

**Tại sao dùng JSON thay vì table riêng?**
```
Option A: JSON field (✅ Chọn)
  Course.learningOutcomes = ["Hiểu React", "Build apps"]
  → 1 query, no JOIN, simple CRUD
  → Data ít thay đổi, không cần filter/search bên trong

Option B: Separate table (❌ Overkill)
  CourseLearningOutcome { id, courseId, text, order }
  → Extra table, extra JOINs, extra migration
  → Chỉ là list of strings — không cần relation
```

---

## 3. FIND BY ID — INSTRUCTOR EDIT WIZARD

### 3.1 Tại sao cần endpoint riêng?

```
Public: GET /api/courses/:slug
  → Chỉ trả PUBLISHED courses
  → Instructor DRAFT course → 404!

Instructor: GET /api/instructor/courses/:id
  → Trả course ở MỌI status (DRAFT, REJECTED, PUBLISHED...)
  → Include full curriculum tree cho edit wizard
```

### 3.2 Implementation

```typescript
async findById(courseId: string, instructorId: string) {
  const course = await this.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      courseTags: { include: { tag: true } },
      sections: {
        orderBy: { order: 'asc' },
        include: {
          chapters: {
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                orderBy: { order: 'asc' },
                select: {
                  id: true, title: true, type: true, order: true,
                  textContent: true,        // ← Include cho instructor editing
                  estimatedDuration: true,
                  chapterId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!course || course.deletedAt) throw new NotFoundException();
  if (course.instructorId !== instructorId) throw new ForbiddenException();

  return course;
}
```

**So sánh với public findBySlug:**

| | Public `findBySlug` | Instructor `findById` |
|--|---------------------|----------------------|
| Auth | Optional | Required (INSTRUCTOR) |
| Status filter | PUBLISHED only | Any status |
| Lessons include | 5 fields (no textContent) | 7 fields (with textContent) |
| Reviews | Top 5 included | Not included |
| View tracking | Yes (Redis) | No |
| Use case | Student portal detail page | Management portal edit wizard |

---

## 4. UPDATE — STATUS CHECK + SLUG REGENERATION

```typescript
async update(courseId: string, instructorId: string, dto: UpdateCourseDto) {
  const course = await this.verifyOwnership(courseId, instructorId);

  // ① Status guard
  if (!['DRAFT', 'REJECTED'].includes(course.status)) {
    throw new BadRequestException({ code: 'COURSE_NOT_EDITABLE' });
  }

  const { tags, learningOutcomes, prerequisites, ...updateData } = dto;

  // ② Slug regeneration if title changed
  const data: Prisma.CourseUpdateInput = { ...updateData };
  if (dto.title && dto.title !== course.title) {
    data.slug = generateUniqueSlug(dto.title);
  }

  // ③ Transaction: update tags + course atomically
  return this.prisma.$transaction(async (tx) => {
    if (tags !== undefined) {
      await tx.courseTag.deleteMany({ where: { courseId } });
      if (tags.length > 0) { /* recreate tags */ }
    }
    return tx.course.update({ where: { id: courseId }, data });
  });
}
```

**Tại sao chỉ DRAFT/REJECTED?**
- PUBLISHED course đã live — sửa title/description ảnh hưởng students.
- API doc: "Nếu APPROVED thì phải unpublish trước khi sửa".
- PENDING_REVIEW đang chờ admin — không nên thay đổi.

---

## 5. VERIFY OWNERSHIP — SHARED PATTERN

```typescript
async verifyOwnership(courseId: string, instructorId: string) {
  const course = await this.prisma.course.findUnique({ where: { id: courseId } });

  if (!course || course.deletedAt)
    throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

  if (course.instructorId !== instructorId)
    throw new ForbiddenException({ code: 'NOT_COURSE_OWNER' });

  return course;
}
```

**Tại sao method này là `public`?**
- Tất cả sub-services (sections, chapters, lessons, quizzes) đều cần verify ownership trước CRUD.
- Thay vì duplicate logic, chúng inject `CourseManagementService` và gọi `verifyOwnership`.

```
Dependency chain:
  SectionsService  → CourseManagementService.verifyOwnership()
  ChaptersService  → CourseManagementService.verifyOwnership()
  LessonsService   → CourseManagementService.verifyOwnership()
  QuizzesService   → CourseManagementService.verifyOwnership()
```

---

## 6. SUBMIT FOR REVIEW — VALIDATION

```typescript
async submitForReview(courseId: string, instructorId: string) {
  const course = await this.verifyOwnership(courseId, instructorId);

  // Status guard
  if (course.status !== 'DRAFT' && course.status !== 'REJECTED')
    throw new BadRequestException({ code: 'INVALID_COURSE_STATUS' });

  // Content validation
  await this.validateCourseCompleteness(courseId);

  return this.prisma.course.update({
    where: { id: courseId },
    data: { status: 'PENDING_REVIEW' },
  });
}
```

**validateCourseCompleteness checks:**
1. `title`, `description`, `categoryId` must be set
2. ≥ 1 section
3. ≥ 1 chapter with ≥ 1 lesson (has actual content)

**Publishing flow:**
```
DRAFT → [submitForReview] → PENDING_REVIEW → [admin approve] → APPROVED → PUBLISHED
                                             → [admin reject] → REJECTED → [edit + resubmit]
```

---

## 7. INSTRUCTOR COURSES LIST — STATUS FILTER

```typescript
async getInstructorCourses(instructorId: string, query: QueryCoursesDto) {
  const where: Prisma.CourseWhereInput = {
    instructorId,
    deletedAt: null,
  };

  if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
  if (query.status) where.status = query.status;  // ← NEW

  // ... findMany + count
}
```

**Frontend usage:**
```
GET /api/instructor/courses                    → Tất cả khóa học
GET /api/instructor/courses?status=DRAFT       → Chỉ nháp
GET /api/instructor/courses?status=PUBLISHED   → Đã xuất bản
GET /api/instructor/courses?search=react       → Tìm kiếm
```
