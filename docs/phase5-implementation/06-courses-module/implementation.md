# Phase 5.6 — COURSES MODULE

> Module lớn nhất — Course CRUD, Section/Chapter/Lesson management, Quizzes, Reviews, Browse & Search.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: DTOs](#step-2-dtos)
- [Step 3: Course Browse Service (Public)](#step-3-course-browse-service-public)
- [Step 4: Course Management Service (Instructor)](#step-4-course-management-service-instructor)
- [Step 5: Section/Chapter/Lesson CRUD](#step-5-sectionchapterlesson-crud)
- [Step 6: Quiz CRUD](#step-6-quiz-crud)
- [Step 7: Review Service](#step-7-review-service)
- [Step 8: Controllers](#step-8-controllers)
- [Step 9: Register Module](#step-9-register-module)
- [Step 10: Verify](#step-10-verify)

---

## Step 1: Module Structure

```
src/modules/courses/
├── courses.module.ts
├── courses.controller.ts           # Public browse: GET /api/courses
├── courses.service.ts              # Browse, search, course detail
├── course-management/
│   ├── course-management.controller.ts  # Instructor: /api/instructor/courses
│   └── course-management.service.ts     # Create, update, delete, publish
├── sections/
│   ├── sections.controller.ts
│   └── sections.service.ts
├── chapters/
│   ├── chapters.controller.ts
│   └── chapters.service.ts
├── lessons/
│   ├── lessons.controller.ts
│   └── lessons.service.ts
├── quizzes/
│   ├── quizzes.controller.ts
│   └── quizzes.service.ts
├── reviews/
│   ├── reviews.controller.ts
│   └── reviews.service.ts
└── dto/
    ├── create-course.dto.ts
    ├── update-course.dto.ts
    ├── query-courses.dto.ts
    ├── create-section.dto.ts
    ├── create-chapter.dto.ts
    ├── create-lesson.dto.ts
    ├── create-quiz.dto.ts
    ├── submit-quiz.dto.ts
    └── create-review.dto.ts
```

---

## Step 2: DTOs

### 2.1 `dto/query-courses.dto.ts`

```typescript
import { IsEnum, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CourseLevel } from '@prisma/client';

export class QueryCoursesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({ enum: ['newest', 'popular', 'rating', 'price_asc', 'price_desc'] })
  @IsOptional()
  @IsString()
  sort?: string;
}
```

### 2.2 `dto/create-course.dto.ts`

```typescript
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseLevel } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty({ example: 'NestJS Masterclass' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
```

### 2.3 `dto/create-section.dto.ts`

```typescript
import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSectionDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
}
```

### 2.4 `dto/create-chapter.dto.ts`

```typescript
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFreePreview?: boolean;
}
```

### 2.5 `dto/create-lesson.dto.ts`

```typescript
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ enum: LessonType }) @IsEnum(LessonType) type: LessonType;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() textContent?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() estimatedDuration?: number;
}
```

### 2.6 `dto/create-quiz.dto.ts`

```typescript
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class QuizOptionDto {
  @ApiProperty() @IsString() text: string;
  @ApiProperty() @IsBoolean() isCorrect: boolean;
}

class QuizQuestionDto {
  @ApiProperty() @IsString() question: string;
  @ApiPropertyOptional() @IsOptional() @IsString() explanation?: string;
  @ApiProperty({ type: [QuizOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];
}

export class CreateQuizDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() passingScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maxAttempts?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() timeLimitSeconds?: number;

  @ApiProperty({ type: [QuizQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions: QuizQuestionDto[];
}
```

### 2.7 `dto/create-review.dto.ts`

```typescript
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
```

---

## Step 3: Course Browse Service (Public)

### 3.1 `courses.service.ts` — Key methods

```typescript
@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(query: QueryCoursesDto) {
    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.level && { level: query.level }),
      ...(query.minPrice !== undefined && { price: { gte: query.minPrice } }),
      ...(query.maxPrice !== undefined && {
        price: { ...((where as any).price || {}), lte: query.maxPrice },
      }),
      ...(query.minRating && { avgRating: { gte: query.minRating } }),
      ...(query.tagId && { courseTags: { some: { tagId: query.tagId } } }),
    };

    const orderBy = this.buildSortOrder(query.sort);

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          level: true,
          price: true,
          originalPrice: true,
          avgRating: true,
          reviewCount: true,
          totalStudents: true,
          totalLessons: true,
          totalDuration: true,
          instructor: { select: { id: true, fullName: true, avatarUrl: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  async findBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: {
        instructor: {
          select: { id: true, fullName: true, avatarUrl: true, instructorProfile: true },
        },
        category: true,
        courseTags: { include: { tag: true } },
        sections: {
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
        },
      },
    });
    if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

    // Increment view count (Redis buffer → sync to DB via cron)
    await this.redis.incr(`course_views:${course.id}`);

    return course;
  }

  private buildSortOrder(sort?: string) {
    switch (sort) {
      case 'popular':
        return { totalStudents: 'desc' as const };
      case 'rating':
        return { avgRating: 'desc' as const };
      case 'price_asc':
        return { price: 'asc' as const };
      case 'price_desc':
        return { price: 'desc' as const };
      default:
        return { publishedAt: 'desc' as const };
    }
  }
}
```

---

## Step 4: Course Management Service (Instructor)

### 4.1 `course-management/course-management.service.ts` — Key methods

```typescript
@Injectable()
export class CourseManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(instructorId: string, dto: CreateCourseDto) {
    const slug = generateUniqueSlug(dto.title);
    return this.prisma.course.create({
      data: { ...dto, slug, instructorId },
    });
  }

  async update(courseId: string, instructorId: string, dto: UpdateCourseDto) {
    await this.verifyOwnership(courseId, instructorId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: dto,
    });
  }

  async submitForReview(courseId: string, instructorId: string) {
    await this.verifyOwnership(courseId, instructorId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'PENDING_REVIEW' },
    });
  }

  async softDelete(courseId: string, instructorId: string) {
    await this.verifyOwnership(courseId, instructorId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: { deletedAt: new Date() },
    });
  }

  async updateTags(courseId: string, instructorId: string, tagIds: string[]) {
    await this.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction([
      this.prisma.courseTag.deleteMany({ where: { courseId } }),
      this.prisma.courseTag.createMany({
        data: tagIds.map((tagId) => ({ courseId, tagId })),
      }),
    ]);
  }

  async getInstructorCourses(instructorId: string, query: PaginationDto) {
    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where: { instructorId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.course.count({ where: { instructorId, deletedAt: null } }),
    ]);
    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  private async verifyOwnership(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.instructorId !== instructorId) {
      throw new ForbiddenException({ code: 'NOT_COURSE_OWNER' });
    }
    return course;
  }
}
```

---

## Step 5: Section/Chapter/Lesson CRUD

Each sub-service follows the same pattern:

- Verify course ownership via `instructorId`
- CRUD operations on the nested resource
- Update denormalized counters (lessonsCount, totalDuration) via `$transaction`

### Key pattern for counter updates:

```typescript
// After creating/deleting a lesson in a chapter:
async recalculateChapterCounters(chapterId: string) {
  const lessons = await this.prisma.lesson.findMany({
    where: { chapterId },
    select: { estimatedDuration: true },
  });

  await this.prisma.chapter.update({
    where: { id: chapterId },
    data: {
      lessonsCount: lessons.length,
      totalDuration: lessons.reduce((sum, l) => sum + (l.estimatedDuration || 0), 0),
    },
  });
}

// After chapter changes, recalculate course counters:
async recalculateCourseCounters(courseId: string) {
  const chapters = await this.prisma.chapter.findMany({
    where: { section: { courseId } },
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

---

## Step 6: Quiz CRUD

### Key operations:

- Create quiz with questions + options in one transaction
- Update quiz questions (delete all + recreate for simplicity)
- Delete quiz cascades to questions + options

```typescript
async createQuiz(lessonId: string, dto: CreateQuizDto) {
  return this.prisma.quiz.create({
    data: {
      lessonId,
      passingScore: dto.passingScore,
      maxAttempts: dto.maxAttempts,
      timeLimitSeconds: dto.timeLimitSeconds,
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
    include: { questions: { include: { options: true } } },
  });
}
```

---

## Step 7: Review Service

```typescript
async createReview(userId: string, courseId: string, dto: CreateReviewDto) {
  // Check enrollment
  const enrollment = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) throw new ForbiddenException({ code: 'NOT_ENROLLED' });

  // Check minimum progress
  if (enrollment.progress < 0.3) {
    throw new BadRequestException({ code: 'INSUFFICIENT_PROGRESS' });
  }

  const review = await this.prisma.review.create({
    data: { userId, courseId, rating: dto.rating, comment: dto.comment },
  });

  // Recalculate course avg rating
  const agg = await this.prisma.review.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: true,
  });

  await this.prisma.course.update({
    where: { id: courseId },
    data: {
      avgRating: agg._avg.rating || 0,
      reviewCount: agg._count,
    },
  });

  return review;
}
```

---

## Step 8: Controllers

Follow the thin controller pattern for each sub-module. Key routes:

### Public routes (`@Public()`):

- `GET /api/courses` — Browse with filters
- `GET /api/courses/:slug` — Course detail

### Instructor routes (`@Roles('INSTRUCTOR')`):

- `POST /api/instructor/courses` — Create course
- `PATCH /api/instructor/courses/:id` — Update course
- `DELETE /api/instructor/courses/:id` — Soft delete
- `POST /api/instructor/courses/:id/submit` — Submit for review
- Section/Chapter/Lesson/Quiz CRUD nested under course

### Student routes (authenticated):

- `POST /api/courses/:id/reviews` — Write review
- `GET /api/courses/:id/reviews` — Get reviews (public)

---

## Step 9: Register Module

```typescript
@Module({
  controllers: [
    CoursesController,
    CourseManagementController,
    SectionsController,
    ChaptersController,
    LessonsController,
    QuizzesController,
    ReviewsController,
  ],
  providers: [
    CoursesService,
    CourseManagementService,
    SectionsService,
    ChaptersService,
    LessonsService,
    QuizzesService,
    ReviewsService,
  ],
  exports: [CoursesService],
})
export class CoursesModule {}
```

---

## Step 10: Verify

### Checklist

- [ ] Browse courses with filters (category, level, price, rating, tag)
- [ ] Sort by newest, popular, rating, price
- [ ] Course detail with full curriculum
- [ ] View count tracked via Redis
- [ ] Instructor can CRUD courses, sections, chapters, lessons
- [ ] Instructor can create/update quizzes with questions and options
- [ ] Course publishing flow: DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED
- [ ] Slug auto-generated and unique
- [ ] Ownership verification on all instructor routes
- [ ] Denormalized counters updated correctly
- [ ] Reviews require enrollment + minimum progress
- [ ] Average rating recalculated on new review
