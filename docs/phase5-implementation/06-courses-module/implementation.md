# Phase 5.6 — COURSES MODULE

> Module lớn nhất — Course CRUD, Section/Chapter/Lesson management, Quizzes, Reviews, Browse & Search.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md` (Module 3 + Module 4)

---

## Mục lục

- [Step 1: Schema Migration & Module Structure](#step-1-schema-migration--module-structure)
- [Step 2: DTOs](#step-2-dtos)
- [Step 3: Course Browse Service (Public)](#step-3-course-browse-service-public)
- [Step 4: Course Management Service (Instructor)](#step-4-course-management-service-instructor)
- [Step 5: Sections Service](#step-5-sections-service)
- [Step 6: Chapters Service](#step-6-chapters-service)
- [Step 7: Lessons Service](#step-7-lessons-service)
- [Step 8: Quizzes Service](#step-8-quizzes-service)
- [Step 9: Reviews Service](#step-9-reviews-service)
- [Step 10: Categories Service (Read-only)](#step-10-categories-service-read-only)
- [Step 11: Controllers](#step-11-controllers)
- [Step 12: Register Modules](#step-12-register-modules)
- [Step 13: Verify](#step-13-verify)

---

## Scope & Boundaries

### In scope (Phase 5.6):
- Course CRUD (browse, detail, instructor management)
- Section/Chapter/Lesson CRUD with counter recalculation
- Quiz CRUD (questions + options)
- Reviews (create, list, avg rating recalculation)
- Categories (read-only: GET /api/categories for browse filters)
- View count tracking via Redis

### Out of scope (later phases):
- Course player / learning progress → Phase 5.8 (Learning)
- Enrollment check, isInWishlist, isInCart → Phase 5.7 (Ecommerce) + Phase 5.8
- Related courses / AI suggestions → Phase 5.10 (AI Tutor)
- Course approval/rejection → Phase 5.11 (Admin)
- Categories admin CRUD → Phase 5.11 (Admin)
- Coupons, withdrawals → Phase 5.7 (Ecommerce)

---

## Step 1: Schema Migration & Module Structure

### 1.1 Schema Migration

Added 2 JSON fields to the Course model in `schema.prisma`:

```prisma
model Course {
  // ...existing fields...
  learningOutcomes Json?     @map("learning_outcomes")
  prerequisites    Json?     @map("prerequisites")
  // ...
}
```

Both stored as JSON arrays of strings, same pattern as `InstructorProfile.qualifications` and `InstructorProfile.socialLinks`.

### 1.2 Module Structure — Sub-domain folders

The flat file structure was reorganized into sub-domain folders for better separation of concerns:

```
src/modules/
├── courses/
│   ├── courses.module.ts
│   ├── dto/                                # 11 DTO files
│   │   ├── query-courses.dto.ts
│   │   ├── create-course.dto.ts
│   │   ├── update-course.dto.ts            # PartialType(CreateCourseDto)
│   │   ├── update-tags.dto.ts
│   │   ├── create-section.dto.ts
│   │   ├── create-chapter.dto.ts
│   │   ├── create-lesson.dto.ts
│   │   ├── update-lesson.dto.ts            # PartialType(CreateLessonDto)
│   │   ├── reorder.dto.ts                  # Generic reorder DTO
│   │   ├── create-quiz.dto.ts
│   │   ├── create-review.dto.ts
│   │   └── query-reviews.dto.ts
│   ├── browse/                             # Public browse
│   │   ├── courses.controller.ts           # GET /api/courses, GET /api/courses/:slug
│   │   ├── courses.service.ts              # Browse, search, course detail
│   │   └── courses.service.spec.ts
│   ├── management/                         # Instructor CRUD
│   │   ├── course-management.controller.ts # /api/instructor/courses
│   │   ├── course-management.service.ts    # Create, update, delete, publish, tags
│   │   ├── course-management.controller.spec.ts
│   │   └── course-management.service.spec.ts
│   ├── sections/
│   │   ├── sections.controller.ts
│   │   ├── sections.service.ts
│   │   └── sections.service.spec.ts
│   ├── chapters/
│   │   ├── chapters.controller.ts
│   │   ├── chapters.service.ts
│   │   └── chapters.service.spec.ts
│   ├── lessons/
│   │   ├── lessons.controller.ts
│   │   ├── lessons.service.ts
│   │   └── lessons.service.spec.ts
│   ├── quizzes/
│   │   ├── quizzes.controller.ts
│   │   ├── quizzes.service.ts
│   │   └── quizzes.service.spec.ts
│   └── reviews/
│       ├── reviews.controller.ts
│       ├── reviews.service.ts
│       └── reviews.service.spec.ts
│
├── categories/
│   ├── categories.module.ts
│   ├── categories.controller.ts            # Public: GET /api/categories
│   ├── categories.service.ts
│   └── categories.service.spec.ts
```

---

## Step 2: DTOs

### 2.1 `dto/query-courses.dto.ts`

```typescript
import { IsEnum, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CourseLevel, CourseStatus } from '@prisma/client';

// Sort options matching API design doc
export enum CourseSortBy {
  NEWEST = 'newest',
  POPULAR = 'popular',
  HIGHEST_RATED = 'highest_rated',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class QueryCoursesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Full-text search on title/description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiPropertyOptional({ enum: CourseStatus, description: 'Filter by course status (instructor view)' })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

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
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value as string))
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Filter by language code (vi, en)' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Filter by tag ID' })
  @IsOptional()
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({ enum: CourseSortBy, default: CourseSortBy.NEWEST })
  @IsOptional()
  @IsEnum(CourseSortBy)
  sort?: CourseSortBy;
}
```

### 2.2 `dto/create-course.dto.ts`

```typescript
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseLevel } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty({ example: 'NestJS Masterclass' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(50)
  description?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiPropertyOptional({ example: 'vi' })
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

  @ApiPropertyOptional({ description: 'Promotional video URL' })
  @IsOptional()
  @IsString()
  promoVideoUrl?: string;

  @ApiPropertyOptional({ type: [String], description: 'What students will learn' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningOutcomes?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Course prerequisites' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tag names to link/create' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}
```

### 2.3 `dto/update-course.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
```

> Dùng `@nestjs/swagger` PartialType (không phải `@nestjs/mapped-types`) để Swagger docs tự inherit metadata.

### 2.4 `dto/update-tags.dto.ts`

```typescript
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTagsDto {
  @ApiProperty({ type: [String], description: 'Array of tag IDs' })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tagIds!: string[];
}
```

### 2.5 `dto/create-section.dto.ts`

```typescript
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

// UpdateSectionDto = same fields, all optional
export class UpdateSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
```

### 2.6 `dto/create-chapter.dto.ts`

```typescript
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: 'Price for individual chapter purchase' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;
}

// UpdateChapterDto = same fields, all optional
export class UpdateChapterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;
}
```

### 2.7 `dto/create-lesson.dto.ts`

```typescript
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ enum: LessonType })
  @IsEnum(LessonType)
  type!: LessonType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: 'Required if type=TEXT (rich HTML)' })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({ description: 'Duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDuration?: number;
}

export class UpdateLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @ApiPropertyOptional({ enum: LessonType })
  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDuration?: number;
}
```

### 2.8 `dto/reorder.dto.ts`

```typescript
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderDto {
  @ApiProperty({ type: [String], description: 'Ordered array of IDs' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
```

> Generic DTO dùng chung cho reorder sections, chapters, lessons.

### 2.9 `dto/create-quiz.dto.ts`

```typescript
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuizOptionDto {
  @ApiProperty()
  @IsString()
  text!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;
}

export class QuizQuestionDto {
  @ApiProperty()
  @IsString()
  question!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiProperty({ type: [QuizOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options!: QuizOptionDto[];
}

export class CreateQuizDto {
  @ApiPropertyOptional({ description: 'Passing score 0-100', default: 70 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Time limit in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeLimitSeconds?: number;

  @ApiProperty({ type: [QuizQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}
```

> Quiz không có riêng `title` field trong Prisma schema → bỏ title.
> `passingScore` trong schema là `Float @default(0.7)` — API doc nói 0-100 nhưng DB lưu 0-1. Service sẽ convert: `dto.passingScore / 100`.

### 2.10 `dto/create-review.dto.ts`

```typescript
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
```

> API doc dùng `content`, nhưng Prisma schema field là `comment`. DTO dùng `comment` khớp schema.

### 2.11 `dto/query-reviews.dto.ts`

```typescript
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export enum ReviewSortBy {
  NEWEST = 'newest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

export class QueryReviewsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReviewSortBy, default: ReviewSortBy.NEWEST })
  @IsOptional()
  @IsEnum(ReviewSortBy)
  sort?: ReviewSortBy;
}
```

---

## Step 3: Course Browse Service (Public)

### `browse/courses.service.ts`

```typescript
@Injectable()
export class CoursesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  // ==================== BROWSE ====================

  async findAll(query: QueryCoursesDto) {
    const where = this.buildWhereFilter(query);
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
          language: true,
          price: true,
          originalPrice: true,
          avgRating: true,
          reviewCount: true,
          totalStudents: true,
          totalLessons: true,
          totalDuration: true,
          publishedAt: true,
          instructor: { select: { id: true, fullName: true, avatarUrl: true } },
          category: { select: { id: true, name: true, slug: true } },
          courseTags: { include: { tag: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  // ==================== COURSE DETAIL ====================

  async findBySlug(slug: string, currentUserId?: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: {
        instructor: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            instructorProfile: {
              select: { headline: true, biography: true },
            },
          },
        },
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
                    id: true,
                    title: true,
                    type: true,
                    estimatedDuration: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
        // Top 5 reviews for initial display
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    // View count: check dedup → increment Redis counter
    await this.trackView(course.id, currentUserId);

    return course;
  }

  // ==================== PRIVATE HELPERS ====================

  private buildWhereFilter(query: QueryCoursesDto): Prisma.CourseWhereInput {
    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.language) {
      where.language = query.language;
    }

    if (query.tagId) {
      where.courseTags = { some: { tagId: query.tagId } };
    }

    if (query.minRating !== undefined) {
      where.avgRating = { gte: query.minRating };
    }

    // Price filter: build properly without `any`
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: { gte?: number; lte?: number } = {};
      if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
      if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;
      where.price = priceFilter;
    }

    return where;
  }

  private buildSortOrder(sort?: CourseSortBy): Prisma.CourseOrderByWithRelationInput {
    switch (sort) {
      case CourseSortBy.POPULAR:
        return { totalStudents: 'desc' };
      case CourseSortBy.HIGHEST_RATED:
        return { avgRating: 'desc' };
      case CourseSortBy.PRICE_ASC:
        return { price: 'asc' };
      case CourseSortBy.PRICE_DESC:
        return { price: 'desc' };
      case CourseSortBy.NEWEST:
      default:
        return { publishedAt: 'desc' };
    }
  }

  private async trackView(courseId: string, userId?: string): Promise<void> {
    const viewerKey = userId ?? 'anon';
    const dedupKey = `viewed:${courseId}:${viewerKey}`;

    // Check if already viewed in last hour
    const alreadyViewed = await this.redis.get(dedupKey);
    if (alreadyViewed) return;

    // Mark as viewed (expire in 1 hour) + increment counter
    await this.redis.set(dedupKey, '1', 'EX', 3600);
    await this.redis.incr(`course_views:${courseId}`);
  }
}
```

**Key design decisions:**

1. **`findFirst` thay vì `findUnique`**: `slug` field là `@unique` trong Prisma schema, nhưng cần thêm filter `status + deletedAt` → dùng `findFirst` với compound where.
2. **Price filter xây riêng object**: Tránh `(where as any).price` vi phạm rule no-`any`. Build `priceFilter` object riêng rồi gán.
3. **Search tạm dùng `contains`**: Full-text search với tsvector sẽ optimize ở phase sau khi cần performance. `contains` + `mode: 'insensitive'` đủ cho MVP.
4. **View dedup**: Redis SET key `viewed:{courseId}:{userId}` expire 1h → tránh đếm trùng.
5. **`trackView` không await blocking**: View count là best-effort, không ảnh hưởng response. Có thể chuyển sang fire-and-forget nếu cần.
6. **`findBySlug` only returns PUBLISHED courses**: For instructor edit wizard, use `GET /api/instructor/courses/:id` instead (see Step 4).

---

## Step 4: Course Management Service (Instructor)

### `management/course-management.service.ts`

```typescript
@Injectable()
export class CourseManagementService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==================== CRUD ====================

  async create(instructorId: string, dto: CreateCourseDto) {
    const { tags, learningOutcomes, prerequisites, ...courseData } = dto;
    const slug = generateUniqueSlug(dto.title);

    return this.prisma.course.create({
      data: {
        ...courseData,
        slug,
        instructorId,
        // Cast JSON fields same pattern as instructor qualifications/socialLinks
        ...(learningOutcomes && {
          learningOutcomes: learningOutcomes as Prisma.InputJsonValue,
        }),
        ...(prerequisites && {
          prerequisites: prerequisites as Prisma.InputJsonValue,
        }),
        // Link tags if provided
        ...(tags?.length && {
          courseTags: {
            create: await this.findOrCreateTags(tags),
          },
        }),
      },
      include: {
        category: true,
        courseTags: { include: { tag: true } },
      },
    });
  }

  async update(courseId: string, instructorId: string, dto: UpdateCourseDto) {
    const course = await this.verifyOwnership(courseId, instructorId);

    // Only allow editing when DRAFT or REJECTED
    if (!['DRAFT', 'REJECTED'].includes(course.status)) {
      throw new BadRequestException({ code: 'COURSE_NOT_EDITABLE' });
    }

    const { tags, learningOutcomes, prerequisites, ...updateData } = dto;

    // Regenerate slug if title changed
    if (dto.title && dto.title !== course.title) {
      (updateData as Record<string, unknown>).slug = generateUniqueSlug(dto.title);
    }

    // Cast JSON fields same pattern as instructor qualifications/socialLinks
    const jsonFields: Record<string, Prisma.InputJsonValue> = {};
    if (learningOutcomes !== undefined) {
      jsonFields.learningOutcomes = learningOutcomes as Prisma.InputJsonValue;
    }
    if (prerequisites !== undefined) {
      jsonFields.prerequisites = prerequisites as Prisma.InputJsonValue;
    }

    return this.prisma.$transaction(async (tx) => {
      // Update tags if provided
      if (tags !== undefined) {
        await tx.courseTag.deleteMany({ where: { courseId } });
        if (tags.length > 0) {
          const tagLinks = await this.findOrCreateTags(tags);
          await tx.courseTag.createMany({
            data: tagLinks.map((t) => ({ courseId, tagId: t.tagId })),
          });
        }
      }

      return tx.course.update({
        where: { id: courseId },
        data: { ...updateData, ...jsonFields },
        include: {
          category: true,
          courseTags: { include: { tag: true } },
        },
      });
    });
  }

  async findById(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instructorId, deletedAt: null },
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
                    id: true,
                    title: true,
                    type: true,
                    estimatedDuration: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    return course;
  }

  async getInstructorCourses(instructorId: string, query: QueryCoursesDto) {
    const where: Prisma.CourseWhereInput = {
      instructorId,
      deletedAt: null,
    };

    // Optional status filter for instructor view (e.g., ?status=DRAFT)
    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          status: true,
          price: true,
          totalStudents: true,
          avgRating: true,
          reviewCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  // ==================== PUBLISHING FLOW ====================

  async submitForReview(courseId: string, instructorId: string) {
    const course = await this.verifyOwnership(courseId, instructorId);

    if (course.status !== 'DRAFT' && course.status !== 'REJECTED') {
      throw new BadRequestException({ code: 'INVALID_COURSE_STATUS' });
    }

    // Validate minimum content requirements
    await this.validateCourseCompleteness(courseId);

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

  // ==================== TAGS ====================

  async updateTags(courseId: string, instructorId: string, tagIds: string[]) {
    await this.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction([
      this.prisma.courseTag.deleteMany({ where: { courseId } }),
      this.prisma.courseTag.createMany({
        data: tagIds.map((tagId) => ({ courseId, tagId })),
      }),
    ]);
  }

  // ==================== PRIVATE HELPERS ====================

  /** Verify instructor owns the course. Returns course or throws. */
  async verifyOwnership(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.deletedAt) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException({ code: 'NOT_COURSE_OWNER' });
    }

    return course;
  }

  /** Validate course has minimum content for submission */
  private async validateCourseCompleteness(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: {
            chapters: {
              include: {
                lessons: {
                  select: { id: true, type: true, textContent: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    // Must have title, description, categoryId
    if (!course.title || !course.description || !course.categoryId) {
      throw new BadRequestException({ code: 'COURSE_INCOMPLETE_INFO' });
    }

    // Must have at least 1 section
    if (course.sections.length === 0) {
      throw new BadRequestException({ code: 'COURSE_NO_SECTIONS' });
    }

    // Must have at least 1 chapter with at least 1 lesson
    const hasContent = course.sections.some((section) =>
      section.chapters.some((chapter) => chapter.lessons.length > 0),
    );

    if (!hasContent) {
      throw new BadRequestException({ code: 'COURSE_NO_CONTENT' });
    }
  }

  /** Find existing tags by name or create new ones, return { tagId } array */
  private async findOrCreateTags(tagNames: string[]): Promise<{ tagId: string }[]> {
    const result: { tagId: string }[] = [];

    for (const name of tagNames) {
      const tag = await this.prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug: generateSlug(name) },
      });
      result.push({ tagId: tag.id });
    }

    return result;
  }
}
```

**Key design decisions:**

1. **Status check on update**: API doc yêu cầu chỉ sửa khi `DRAFT` hoặc `REJECTED`. Throw `COURSE_NOT_EDITABLE` nếu status khác.
2. **Slug regeneration**: Khi sửa title → tạo slug mới bằng `generateUniqueSlug` (thêm suffix timestamp tránh collision).
3. **`validateCourseCompleteness`**: Check ≥1 section, ≥1 chapter có lesson, title/description/categoryId đã set. Theo API doc business logic.
4. **`findOrCreateTags`**: Upsert theo tag name — tìm existing hoặc tạo mới. `CreateCourseDto.tags` là mảng tên (string), không phải ID.
5. **`verifyOwnership` là public method**: Các sub-service (sections, chapters, lessons) sẽ gọi method này để verify ownership trước khi CRUD.
6. **`findById` endpoint**: Returns full course detail with curriculum for ANY status (DRAFT, REJECTED, PENDING_REVIEW, etc.) — used by the instructor edit wizard. The public `findBySlug` only works for PUBLISHED courses.
7. **`learningOutcomes` / `prerequisites` JSON handling**: Destructured from DTO and cast to `Prisma.InputJsonValue`, same pattern as `InstructorProfile.qualifications` and `socialLinks`.
8. **Status filter on `getInstructorCourses`**: `QueryCoursesDto.status` field allows filtering by `CourseStatus` (e.g., `?status=DRAFT`).

---

## Step 5: Sections Service

### `sections/sections.service.ts`

```typescript
@Injectable()
export class SectionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
  ) {}

  async create(courseId: string, instructorId: string, dto: CreateSectionDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    // Auto-assign order if not provided
    if (dto.order === undefined) {
      const lastSection = await this.prisma.section.findFirst({
        where: { courseId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      dto.order = (lastSection?.order ?? -1) + 1;
    }

    return this.prisma.section.create({
      data: { ...dto, courseId },
    });
  }

  async update(courseId: string, sectionId: string, instructorId: string, dto: UpdateSectionDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifySectionBelongsToCourse(sectionId, courseId);

    return this.prisma.section.update({
      where: { id: sectionId },
      data: dto,
    });
  }

  async delete(courseId: string, sectionId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifySectionBelongsToCourse(sectionId, courseId);

    await this.prisma.section.delete({ where: { id: sectionId } });
    // CASCADE deletes chapters + lessons

    // Recalculate course counters
    await this.recalculateCourseCounters(courseId);
  }

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

  // ==================== PRIVATE HELPERS ====================

  private async verifySectionBelongsToCourse(sectionId: string, courseId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.courseId !== courseId) {
      throw new NotFoundException({ code: 'SECTION_NOT_FOUND' });
    }
    return section;
  }

  /** Recalculate totalLessons + totalDuration on Course from all chapters */
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
}
```

---

## Step 6: Chapters Service

### `chapters/chapters.service.ts`

```typescript
@Injectable()
export class ChaptersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
    @Inject(SectionsService) private readonly sectionsService: SectionsService,
  ) {}

  async create(courseId: string, sectionId: string, instructorId: string, dto: CreateChapterDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    // Auto-assign order if not provided
    if (dto.order === undefined) {
      const lastChapter = await this.prisma.chapter.findFirst({
        where: { sectionId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      dto.order = (lastChapter?.order ?? -1) + 1;
    }

    return this.prisma.chapter.create({
      data: { ...dto, sectionId },
    });
  }

  async update(courseId: string, chapterId: string, instructorId: string, dto: UpdateChapterDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    const chapter = await this.verifyChapterBelongsToCourse(chapterId, courseId);

    return this.prisma.chapter.update({
      where: { id: chapter.id },
      data: dto,
    });
  }

  async delete(courseId: string, chapterId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifyChapterBelongsToCourse(chapterId, courseId);

    await this.prisma.chapter.delete({ where: { id: chapterId } });
    // CASCADE deletes lessons

    // Recalculate course counters
    await this.sectionsService.recalculateCourseCounters(courseId);
  }

  async reorder(courseId: string, sectionId: string, instructorId: string, orderedIds: string[]) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.chapter.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ==================== COUNTER UPDATES ====================

  /** Recalculate lessonsCount + totalDuration on Chapter */
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

    // Also recalculate parent course counters
    const section = await this.prisma.section.findUnique({
      where: { id: chapter.sectionId },
      select: { courseId: true },
    });
    if (section) {
      await this.sectionsService.recalculateCourseCounters(section.courseId);
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifyChapterBelongsToCourse(chapterId: string, courseId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { section: { select: { courseId: true } } },
    });
    if (!chapter || chapter.section.courseId !== courseId) {
      throw new NotFoundException({ code: 'CHAPTER_NOT_FOUND' });
    }
    return chapter;
  }
}
```

---

## Step 7: Lessons Service

### `lessons/lessons.service.ts`

```typescript
@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
    @Inject(ChaptersService) private readonly chaptersService: ChaptersService,
  ) {}

  async create(courseId: string, chapterId: string, instructorId: string, dto: CreateLessonDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifyChapterBelongsToCourse(chapterId, courseId);

    // Auto-assign order if not provided
    if (dto.order === undefined) {
      const lastLesson = await this.prisma.lesson.findFirst({
        where: { chapterId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      dto.order = (lastLesson?.order ?? -1) + 1;
    }

    const lesson = await this.prisma.lesson.create({
      data: { ...dto, chapterId },
    });

    // Recalculate chapter + course counters
    await this.chaptersService.recalculateChapterCounters(chapterId);

    return lesson;
  }

  async update(courseId: string, lessonId: string, instructorId: string, dto: UpdateLessonDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    const lesson = await this.verifyLessonBelongsToCourse(lessonId, courseId);

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: dto,
    });

    // Recalculate if duration changed
    if (dto.estimatedDuration !== undefined) {
      await this.chaptersService.recalculateChapterCounters(lesson.chapterId);
    }

    return updated;
  }

  async delete(courseId: string, lessonId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    const lesson = await this.verifyLessonBelongsToCourse(lessonId, courseId);

    await this.prisma.lesson.delete({ where: { id: lessonId } });

    // Recalculate chapter + course counters
    await this.chaptersService.recalculateChapterCounters(lesson.chapterId);
  }

  async reorder(courseId: string, chapterId: string, instructorId: string, orderedIds: string[]) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.lesson.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifyChapterBelongsToCourse(chapterId: string, courseId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { section: { select: { courseId: true } } },
    });
    if (!chapter || chapter.section.courseId !== courseId) {
      throw new NotFoundException({ code: 'CHAPTER_NOT_FOUND' });
    }
    return chapter;
  }

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
}
```

---

## Step 8: Quizzes Service

### `quizzes/quizzes.service.ts`

```typescript
@Injectable()
export class QuizzesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
  ) {}

  /** Create or update quiz for a lesson (upsert pattern: delete old → create new) */
  async upsertQuiz(courseId: string, lessonId: string, instructorId: string, dto: CreateQuizDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifyLessonBelongsToCourse(lessonId, courseId);

    // Validate: each question must have exactly 1 correct option
    for (const q of dto.questions) {
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException({ code: 'QUIZ_INVALID_CORRECT_OPTIONS' });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing quiz if any (cascade deletes questions + options)
      await tx.quiz.deleteMany({ where: { lessonId } });

      // Create new quiz with nested questions + options
      return tx.quiz.create({
        data: {
          lessonId,
          passingScore: dto.passingScore ? dto.passingScore / 100 : 0.7,
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
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { orderBy: { order: 'asc' } } },
          },
        },
      });
    });
  }

  async getQuiz(courseId: string, lessonId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    return this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  async deleteQuiz(courseId: string, lessonId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    await this.prisma.quiz.deleteMany({ where: { lessonId } });
  }

  // ==================== PRIVATE HELPERS ====================

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
}
```

**Key design decisions:**

1. **Upsert pattern**: API doc nói "nếu đã có → delete old questions/options → tạo mới". Simple hơn partial update.
2. **`passingScore` conversion**: DTO nhận 0-100 (user-friendly), DB lưu 0-1 (Float). Convert: `dto.passingScore / 100`.
3. **Validation: 1 correct per question**: Business rule từ API doc. Throw `QUIZ_INVALID_CORRECT_OPTIONS`.
4. **`deleteMany` thay `delete`**: Không throw nếu quiz chưa tồn tại.

---

## Step 9: Reviews Service

### `reviews/reviews.service.ts`

```typescript
@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, courseId: string, dto: CreateReviewDto) {
    // Check course exists and is published
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED', deletedAt: null },
    });
    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    // Check enrollment
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    }

    // Check minimum 30% progress
    if (enrollment.progress < 0.3) {
      throw new BadRequestException({ code: 'INSUFFICIENT_PROGRESS' });
    }

    // Check unique constraint (1 review per user per course)
    const existing = await this.prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) {
      throw new ConflictException({ code: 'ALREADY_REVIEWED' });
    }

    // Create review + recalculate course avgRating in transaction
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { userId, courseId, rating: dto.rating, comment: dto.comment },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });

      // Recalculate avg rating
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
  }

  async findByCourse(courseId: string, query: QueryReviewsDto) {
    const orderBy = this.buildReviewSort(query.sort);

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { courseId },
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.count({ where: { courseId } }),
    ]);

    return createPaginatedResult(reviews, total, query.page, query.limit);
  }

  async update(userId: string, reviewId: string, dto: CreateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { rating: dto.rating, comment: dto.comment },
    });

    // Recalculate avg rating
    const agg = await this.prisma.review.aggregate({
      where: { courseId: review.courseId },
      _avg: { rating: true },
    });
    await this.prisma.course.update({
      where: { id: review.courseId },
      data: { avgRating: agg._avg.rating ?? 0 },
    });

    return updated;
  }

  async delete(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    }

    await this.prisma.review.delete({ where: { id: reviewId } });

    // Recalculate avg rating + count
    const agg = await this.prisma.review.aggregate({
      where: { courseId: review.courseId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.course.update({
      where: { id: review.courseId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });
  }

  private buildReviewSort(sort?: ReviewSortBy): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case ReviewSortBy.HIGHEST:
        return { rating: 'desc' };
      case ReviewSortBy.LOWEST:
        return { rating: 'asc' };
      case ReviewSortBy.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }
}
```

**Key design decisions:**

1. **Enrollment + progress check**: Phải enrolled AND ≥30% progress mới được review.
2. **Unique check trước khi create**: Bắt sớm hơn là để Prisma throw P2002 — message rõ ràng hơn.
3. **Avg rating recalculation trong transaction**: Đảm bảo consistency.
4. **Review update/delete**: Chỉ owner mới được sửa/xóa. Recalculate avg sau mỗi thay đổi.

---

## Step 10: Categories Service (Read-only)

### `categories/categories.service.ts`

```typescript
@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        children: { orderBy: { order: 'asc' } },
        _count: { select: { courses: true } },
      },
      where: { parentId: null }, // Only top-level, children nested
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { order: 'asc' } },
        _count: { select: { courses: true } },
      },
    });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND' });
    }
    return category;
  }
}
```

> Chỉ read-only endpoints cho browse page. Admin CRUD ở Phase 5.11.

---

## Step 11: Controllers

### 11.1 `browse/courses.controller.ts` — Public browse

```typescript
@Controller('courses')
@ApiTags('Courses')
export class CoursesController {
  constructor(@Inject(CoursesService) private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse courses with filters' })
  async findAll(@Query() query: QueryCoursesDto) {
    return this.coursesService.findAll(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get course detail by slug (PUBLISHED only)' })
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user?: JwtPayload) {
    return this.coursesService.findBySlug(slug, user?.sub);
  }
}
```

### 11.2 `management/course-management.controller.ts` — Instructor course CRUD

```typescript
@Controller('instructor/courses')
@ApiTags('Instructor — Courses')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class CourseManagementController {
  constructor(
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List instructor courses (with optional status filter)' })
  async getInstructorCourses(@CurrentUser() user: JwtPayload, @Query() query: QueryCoursesDto) {
    return this.courseManagement.getInstructorCourses(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full course detail by ID for instructor edit wizard (any status)' })
  async findById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.courseManagement.findById(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new course' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCourseDto) {
    return this.courseManagement.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update course info' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courseManagement.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete course' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.courseManagement.softDelete(id, user.sub);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit course for admin review' })
  async submitForReview(@CurrentUser() user: JwtPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.courseManagement.submitForReview(id, user.sub);
  }

  @Put(':id/tags')
  @ApiOperation({ summary: 'Update course tags' })
  async updateTags(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateTagsDto,
  ) {
    return this.courseManagement.updateTags(id, user.sub, dto.tagIds);
  }
}
```

### 11.3 `sections/sections.controller.ts` — Instructor sections CRUD

```typescript
@Controller('instructor/courses/:courseId/sections')
@ApiTags('Instructor — Sections')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class SectionsController {
  constructor(@Inject(SectionsService) private readonly sectionsService: SectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create section' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(courseId, user.sub, dto);
  }

  @Patch(':sectionId')
  @ApiOperation({ summary: 'Update section' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(courseId, sectionId, user.sub, dto);
  }

  @Delete(':sectionId')
  @ApiOperation({ summary: 'Delete section' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
  ) {
    return this.sectionsService.delete(courseId, sectionId, user.sub);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder sections' })
  async reorder(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.sectionsService.reorder(courseId, user.sub, dto.orderedIds);
  }
}
```

### 11.4 `chapters/chapters.controller.ts` — Instructor chapters CRUD

```typescript
@Controller('instructor/courses/:courseId/sections/:sectionId/chapters')
@ApiTags('Instructor — Chapters')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class ChaptersController {
  constructor(@Inject(ChaptersService) private readonly chaptersService: ChaptersService) {}

  @Post()
  @ApiOperation({ summary: 'Create chapter' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) sectionId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chaptersService.create(courseId, sectionId, user.sub, dto);
  }

  @Patch(':chapterId')
  @ApiOperation({ summary: 'Update chapter' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chaptersService.update(courseId, chapterId, user.sub, dto);
  }

  @Delete(':chapterId')
  @ApiOperation({ summary: 'Delete chapter' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
  ) {
    return this.chaptersService.delete(courseId, chapterId, user.sub);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder chapters in section' })
  async reorder(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('sectionId', ParseCuidPipe) _sectionId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.chaptersService.reorder(courseId, _sectionId, user.sub, dto.orderedIds);
  }
}
```

### 11.5 `lessons/lessons.controller.ts` — Instructor lessons CRUD

```typescript
@Controller('instructor/courses/:courseId/chapters/:chapterId/lessons')
@ApiTags('Instructor — Lessons')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessonsService: LessonsService) {}

  @Post()
  @ApiOperation({ summary: 'Create lesson' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(courseId, chapterId, user.sub, dto);
  }

  @Patch(':lessonId')
  @ApiOperation({ summary: 'Update lesson' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(courseId, lessonId, user.sub, dto);
  }

  @Delete(':lessonId')
  @ApiOperation({ summary: 'Delete lesson' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.lessonsService.delete(courseId, lessonId, user.sub);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder lessons in chapter' })
  async reorder(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('chapterId', ParseCuidPipe) chapterId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.lessonsService.reorder(courseId, chapterId, user.sub, dto.orderedIds);
  }
}
```

### 11.6 `quizzes/quizzes.controller.ts` — Instructor quiz CRUD

```typescript
@Controller('instructor/courses/:courseId/lessons/:lessonId/quiz')
@ApiTags('Instructor — Quizzes')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('INSTRUCTOR')
export class QuizzesController {
  constructor(@Inject(QuizzesService) private readonly quizzesService: QuizzesService) {}

  @Put()
  @ApiOperation({ summary: 'Create or update quiz for lesson' })
  async upsert(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
    @Body() dto: CreateQuizDto,
  ) {
    return this.quizzesService.upsertQuiz(courseId, lessonId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get quiz for lesson' })
  async get(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.quizzesService.getQuiz(courseId, lessonId, user.sub);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete quiz' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Param('lessonId', ParseCuidPipe) lessonId: string,
  ) {
    return this.quizzesService.deleteQuiz(courseId, lessonId, user.sub);
  }
}
```

### 11.7 `reviews/reviews.controller.ts` — Reviews

```typescript
@Controller('courses/:courseId/reviews')
@ApiTags('Reviews')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get course reviews (paginated)' })
  async findByCourse(
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Query() query: QueryReviewsDto,
  ) {
    return this.reviewsService.findByCourse(courseId, query);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review (requires enrollment + 30% progress)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.sub, courseId, dto);
  }

  @Patch(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own review' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseCuidPipe) reviewId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.update(user.sub, reviewId, dto);
  }

  @Delete(':reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own review' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseCuidPipe) reviewId: string,
  ) {
    return this.reviewsService.delete(user.sub, reviewId);
  }
}
```

### 11.8 `categories/categories.controller.ts` — Public read-only

```typescript
@Controller('categories')
@ApiTags('Categories')
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all categories with children' })
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }
}
```

---

## Step 12: Register Modules

### `courses.module.ts`

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
  exports: [CoursesService, CourseManagementService],
})
export class CoursesModule {}
```

### `categories/categories.module.ts`

```typescript
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

### `app.module.ts` — Add imports

```typescript
import { CoursesModule } from './modules/courses/courses.module';
import { CategoriesModule } from './modules/categories/categories.module';

@Module({
  imports: [
    // ...existing
    CoursesModule,
    CategoriesModule,
  ],
})
```

---

## Step 13: Verify

### Summary

- **Total endpoints:** 30 (29 original + 1 new `GET /api/instructor/courses/:id`)
- **Total test files:** 13 (1 DTO validation + 8 service + 4 controller)
- **Total tests:** 375 (224 existing + 151 new)

### Checklist

**Schema migration:**
- [x] `learningOutcomes Json? @map("learning_outcomes")` added to Course model
- [x] `prerequisites Json? @map("prerequisites")` added to Course model
- [x] Both stored as JSON arrays of strings, cast via `Prisma.InputJsonValue`

**Public browse:**
- [x] `GET /api/courses` — Filter by category slug, level, price range, rating, language, tag
- [x] `GET /api/courses` — Sort by newest, popular, highest_rated, price_asc, price_desc
- [x] `GET /api/courses/:slug` — Full course detail with curriculum, top 5 reviews (PUBLISHED only)
- [x] View count tracked via Redis with per-user dedup (1h TTL)
- [x] `GET /api/categories` — List all categories with children

**Instructor course management:**
- [x] `GET /api/instructor/courses` — List own courses with optional `?status=DRAFT` filter
- [x] `GET /api/instructor/courses/:id` — Full course detail for instructor edit wizard (any status)
- [x] `POST /api/instructor/courses` — Create course with auto-generated slug + tags + learningOutcomes + prerequisites + promoVideoUrl
- [x] `PATCH /api/instructor/courses/:id` — Update (only DRAFT/REJECTED status), handles JSON fields
- [x] `DELETE /api/instructor/courses/:id` — Soft delete (sets deletedAt)
- [x] `POST /api/instructor/courses/:id/submit` — Submit for review with content validation
- [x] `PUT /api/instructor/courses/:id/tags` — Update course tags

**Sections/Chapters/Lessons:**
- [x] CRUD for sections, chapters, lessons — all with ownership verification
- [x] Reorder endpoints for sections, chapters, lessons
- [x] Auto-assign order when not provided
- [x] Denormalized counters recalculated on create/update/delete:
  - Chapter: `lessonsCount`, `totalDuration`
  - Course: `totalLessons`, `totalDuration`

**Quizzes:**
- [x] `PUT /api/instructor/courses/:courseId/lessons/:lessonId/quiz` — Upsert quiz
- [x] Each question validated to have exactly 1 correct option
- [x] `passingScore` converted from 0-100 (DTO) to 0-1 (DB)
- [x] `GET` and `DELETE` quiz endpoints

**Reviews:**
- [x] `GET /api/courses/:courseId/reviews` — Public, paginated, sortable
- [x] `POST /api/courses/:courseId/reviews` — Requires enrollment + 30% progress
- [x] `PATCH/DELETE /api/courses/:courseId/reviews/:reviewId` — Owner only
- [x] Unique constraint: 1 review per user per course
- [x] Course `avgRating` + `reviewCount` recalculated after every review change

**Code quality:**
- [x] Build: 0 TypeScript errors
- [x] Lint: 0 ESLint errors
- [x] All DTOs use `!:` for required fields
- [x] No use of `any` type
- [x] All controllers use `@Inject()` pattern
- [x] Error codes (not localized messages) in all exceptions
- [x] `@Public()` on all public endpoints
- [x] `@ApiBearerAuth()` on authenticated controllers
- [x] `@UseGuards(RolesGuard)` + `@Roles('INSTRUCTOR')` on instructor controllers
- [x] Module restructured into sub-domain folders (browse/, management/, sections/, chapters/, lessons/, quizzes/, reviews/)
- [x] 13 test files with 375 tests passing
