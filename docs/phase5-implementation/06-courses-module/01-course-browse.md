# 01 — Course Browse: Public Search, Filters, Detail, và View Tracking

> Giải thích chi tiết CoursesService + CoursesController — browse endpoints cho Student Portal,
> filter/sort pattern, course detail với curriculum, Redis view dedup, và CategoriesModule.

---

## 1. TỔNG QUAN

### 1.1 Vai trò

CoursesService xử lý **public-facing endpoints** — browse danh sách khóa học và xem chi tiết. Đây là traffic cao nhất của hệ thống (mọi visitor, không cần auth).

```
CoursesService — 2 public methods:

  findAll(query)                → Browse + filter + sort + pagination
  findBySlug(slug, currentUserId?) → Course detail + curriculum + top 5 reviews

Private Helpers:
  buildWhereFilter(query)       → Convert DTO → Prisma where
  buildSortOrder(sort)          → Convert enum → Prisma orderBy
  trackView(courseId, userId)   → Redis dedup view counter
```

### 1.2 Dependencies

```
CoursesService
  ├── PrismaService  → Database queries
  └── RedisService   → View count dedup + counter
```

### 1.3 File Location

```
courses/browse/
  ├── courses.controller.ts     → 2 endpoints
  ├── courses.service.ts        → Business logic
  ├── courses.controller.spec.ts
  └── courses.service.spec.ts
```

---

## 2. FILTER/SORT PATTERN

### 2.1 QueryCoursesDto — Input

```typescript
export class QueryCoursesDto extends PaginationDto {
  search?: string;          // Full-text search title + shortDescription
  categorySlug?: string;    // Filter by category slug (user-friendly URL)
  level?: CourseLevel;      // BEGINNER | INTERMEDIATE | ADVANCED | ALL_LEVELS
  minPrice?: number;        // Price range filter
  maxPrice?: number;
  minRating?: number;       // 0-5
  language?: string;        // 'vi' | 'en'
  tagId?: string;           // Filter by tag
  sort?: CourseSortBy;      // newest | popular | highest_rated | price_asc | price_desc
  status?: CourseStatus;    // Chỉ dùng cho instructor view
}
```

### 2.2 buildWhereFilter — Tại sao không dùng spread?

```typescript
// ❌ Plan ban đầu — dùng spread + `any`
const where = {
  status: 'PUBLISHED',
  ...(query.minPrice !== undefined && {
    price: { ...((where as any).price || {}), lte: query.maxPrice },
  }),
};
// Vấn đề: dùng `any` vi phạm TypeScript strict mode

// ✅ Implementation thực tế — build object riêng
private buildWhereFilter(query: QueryCoursesDto): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
  };

  // Price filter: build riêng object, tránh `any`
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const priceFilter: { gte?: number; lte?: number } = {};
    if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
    if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;
    where.price = priceFilter;
  }

  return where;
}
```

**Lý thuyết — Prisma WhereInput Composition:**
- Prisma `WhereInput` types là optional objects. Khi build dynamic filters, nên tạo typed object riêng rồi assign.
- Tránh spread vì nested objects (like `price: { gte, lte }`) không merge đúng.
- `Prisma.CourseWhereInput` type annotation đảm bảo compile-time safety.

### 2.3 buildSortOrder — Enum → Prisma OrderBy

```typescript
private buildSortOrder(sort?: CourseSortBy): Prisma.CourseOrderByWithRelationInput {
  switch (sort) {
    case CourseSortBy.POPULAR:       return { totalStudents: 'desc' };
    case CourseSortBy.HIGHEST_RATED: return { avgRating: 'desc' };
    case CourseSortBy.PRICE_ASC:     return { price: 'asc' };
    case CourseSortBy.PRICE_DESC:    return { price: 'desc' };
    default:                         return { publishedAt: 'desc' };
  }
}
```

**Tại sao dùng denormalized fields?**
- `totalStudents`, `avgRating` được lưu trực tiếp trên Course model.
- Nếu COUNT/AVG mỗi lần query → chậm trên large tables (N+1 hoặc subquery).
- Denormalized counters cho phép `ORDER BY` trực tiếp trên indexed column → O(log n).

### 2.4 categorySlug thay vì categoryId

```typescript
// API doc: ?categorySlug=web-development (user-friendly)
if (query.categorySlug) {
  where.category = { slug: query.categorySlug };
}
// Prisma tự động JOIN categories table và filter by slug
```

**Tại sao dùng slug?**
- URL: `/courses?categorySlug=web-development` readable hơn `?categoryId=clx123abc`
- SEO friendly — slug xuất hiện trong URL parameters
- Prisma relation filter: `where.category = { slug }` tự resolve thành JOIN

---

## 3. COURSE DETAIL

### 3.1 findBySlug — Nested Include Pattern

```typescript
async findBySlug(slug: string, currentUserId?: string) {
  const course = await this.prisma.course.findFirst({
    where: { slug, status: 'PUBLISHED', deletedAt: null },
    include: {
      instructor: { select: { id, fullName, avatarUrl, instructorProfile } },
      category: { select: { id, name, slug } },
      courseTags: { include: { tag: true } },
      sections: {
        orderBy: { order: 'asc' },
        include: {
          chapters: {
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                orderBy: { order: 'asc' },
                select: { id, title, type, estimatedDuration, order },
              },
            },
          },
        },
      },
      reviews: { take: 5, orderBy: { createdAt: 'desc' }, include: { user } },
    },
  });
}
```

**Tại sao `findFirst` thay vì `findUnique`?**
- `slug` là `@unique` trong Prisma → `findUnique` hoạt động.
- Nhưng cần thêm `status: 'PUBLISHED'` và `deletedAt: null`.
- `findUnique` chỉ chấp nhận unique fields trong `where` clause.
- `findFirst` cho phép compound filter trên unique + non-unique fields.

**Tại sao lessons chỉ `select` 5 fields?**
- Public view không cần `textContent` (content bài học — chỉ enrolled users mới xem).
- Giảm payload size đáng kể (textContent có thể hàng nghìn chars).
- Frontend chỉ cần hiển thị curriculum sidebar: title, type icon, duration.

---

## 4. VIEW COUNT — REDIS DEDUP

### 4.1 Cơ chế

```typescript
private async trackView(courseId: string, userId?: string): Promise<void> {
  const viewerKey = userId ?? 'anon';
  const dedupKey = `viewed:${courseId}:${viewerKey}`;

  // Check nếu đã view trong 1h gần nhất
  const alreadyViewed = await this.redis.get(dedupKey);
  if (alreadyViewed) return;

  // Đánh dấu đã view + increment counter
  await this.redis.set(dedupKey, '1', 'EX', 3600);  // expire 1h
  await this.redis.incr(`course_views:${courseId}`);
}
```

### 4.2 Tại sao cần dedup?

```
Không dedup:
  User refresh page 10 lần → viewCount += 10  (sai!)

Có dedup (Redis key expire 1h):
  User refresh page 10 lần trong 1h → viewCount += 1  (đúng!)
  User quay lại sau 1h → viewCount += 1  (đúng!)
```

### 4.3 Redis key structure

```
viewed:{courseId}:{userId}  → dedup key, TTL 1h
  Ví dụ: viewed:course-1:user-123   = "1" (expire 3600s)
         viewed:course-1:anon       = "1" (anonymous)

course_views:{courseId}  → counter, persistent
  Ví dụ: course_views:course-1      = "42"
```

### 4.4 Sync counter → DB

Counter lưu trong Redis, sync về DB bằng cron job (Phase 5.11):
```
Cron mỗi 5 phút:
  KEYS course_views:*
  → Batch UPDATE courses SET viewCount = viewCount + delta
  → DEL processed keys
```

---

## 5. CATEGORIES MODULE

### 5.1 Tại sao tách module riêng?

```
CLAUDE.md project structure:
  modules/
    ├── categories/    ← Separate module
    ├── courses/
    └── ...
```

- Categories phục vụ nhiều nơi (browse filter, admin CRUD, course form dropdown).
- Read-only trong Phase 5.6 (GET only), admin CRUD thêm ở Phase 5.11.
- Exported `CategoriesService` để các module khác inject nếu cần.

### 5.2 Nested Categories — Parent/Children

```typescript
async findAll() {
  return this.prisma.category.findMany({
    where: { parentId: null },     // Chỉ top-level
    orderBy: { order: 'asc' },
    include: {
      children: { orderBy: { order: 'asc' } },  // Sub-categories
      _count: { select: { courses: true } },      // Course count per category
    },
  });
}
```

Response:
```json
[
  {
    "id": "cat-1",
    "name": "Web Development",
    "slug": "web-development",
    "children": [
      { "id": "cat-2", "name": "Frontend", "slug": "frontend" },
      { "id": "cat-3", "name": "Backend", "slug": "backend" }
    ],
    "_count": { "courses": 25 }
  }
]
```

---

## 6. CONTROLLER — `@Public()` VỚI OPTIONAL AUTH

```typescript
@Public()
@Get(':slug')
async findBySlug(@Param('slug') slug: string, @CurrentUser() user?: JwtPayload) {
  return this.coursesService.findBySlug(slug, user?.sub);
}
```

**Pattern: Public endpoint có thể nhận auth context.**
- `@Public()` bypass global `JwtAuthGuard` → không cần token.
- `@CurrentUser()` với `?` optional → nếu có token, trả `JwtPayload`; nếu không, trả `undefined`.
- Dùng để: track view theo userId (dedup chính xác hơn anonymous).
- Tương lai: hiển thị `isInWishlist`, `enrollment` nếu user đã login.
