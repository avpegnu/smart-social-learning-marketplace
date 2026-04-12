# Sub-phase 5.13b — COURSE BROWSE & DETAIL

> Homepage, Courses Browse (filter/sort/search/pagination), Course Detail (curriculum, reviews, enrollment).
> Dependency: 5.13a (Auth + Navigation) ✅ done.

---

## Hiện trạng

### Đã có sẵn:
- **3 pages** mock UI: Homepage (`page.tsx`), Courses Browse (`courses/page.tsx`), Course Detail (`courses/[slug]/page.tsx`)
- **3 components**: `CourseCard`, `CourseGrid`, `PriceDisplay` — dùng `Course` type từ `mock-data.ts`
- **Service layer**: `courseService.browse()`, `courseService.getBySlug()` — đã có trong `shared-hooks`
- **Query hooks**: Chỉ có instructor hooks, **chưa có** public browse/detail hooks
- **Category hooks**: `useCategories()` đã có (staleTime 10min)
- **i18n**: `courses`, `courseDetail`, `course` namespace đã có đủ keys cơ bản
- **Navbar**: Đã wire real data (user, cart count, notifications)

### Cần thay đổi:
1. Tạo public course query hooks (`useCourses`, `useCourseDetail`, `useCourseReviews`)
2. Tạo enrollment service + hooks (`useEnrollmentCheck`, `useEnrollFree`)
3. Rewrite 3 pages thay `mockCourses` → real API
4. Update `CourseCard` + `CourseGrid` → dùng `Course` type từ `@shared/types` thay vì mock-data
5. Fix hardcoded colors (feature cards, course detail hero)
6. Thêm i18n keys mới (empty state, error, pagination, enrollment CTA)
7. Tạo skeleton components cho loading states

---

## Scope & File Mapping

### Shared Hooks Layer
| # | File | Action |
|---|------|--------|
| 1 | `shared-hooks/services/course.service.ts` | Update: thêm `getReviews`, `createReview` |
| 2 | `shared-hooks/services/enrollment.service.ts` | **Create**: `check`, `enrollFree`, `getMyLearning` |
| 3 | `shared-hooks/services/index.ts` | Update: export enrollment service |
| 4 | `shared-hooks/queries/use-courses.ts` | Update: thêm `useCourses`, `useCourseDetail`, `useCourseReviews` |
| 5 | `shared-hooks/queries/use-enrollments.ts` | **Create**: `useEnrollmentCheck`, `useEnrollFree`, `useMyLearning` |
| 6 | `shared-hooks/index.ts` | Update: export new hooks |

### Shared Components (reusable)
| # | File | Action |
|---|------|--------|
| 7 | `components/course/course-card.tsx` | Rewrite: loose interface, real thumbnail, API field mapping |
| 8 | `components/course/course-grid.tsx` | Rewrite: skeleton loading variant |
| 9 | `components/course/course-filters.tsx` | **Create**: filter sidebar (category/level/price) |
| 10 | `components/course/pagination.tsx` | **Create**: reusable pagination |

### Course Detail Sub-Components
| # | File | Action |
|---|------|--------|
| 11 | `components/course/detail/types.ts` | **Create**: API response types, lesson icon map |
| 12 | `components/course/detail/course-detail-skeleton.tsx` | **Create**: loading skeleton |
| 13 | `components/course/detail/course-hero.tsx` | **Create**: hero banner section |
| 14 | `components/course/detail/course-curriculum.tsx` | **Create**: 3-level curriculum accordion |
| 15 | `components/course/detail/course-reviews.tsx` | **Create**: reviews tab with pagination |
| 16 | `components/course/detail/purchase-card.tsx` | **Create**: sticky purchase sidebar |

### Pages
| # | File | Action |
|---|------|--------|
| 17 | `app/(main)/page.tsx` | Rewrite: API data, design token colors, skeletons |
| 18 | `app/(main)/courses/page.tsx` | Rewrite: API filters/search/pagination, URL sync |
| 19 | `app/(main)/courses/[slug]/page.tsx` | Rewrite: API detail, enrollment CTA, tabs |

### Config & i18n
| # | File | Action |
|---|------|--------|
| 20 | `app/globals.css` | Update: thêm `@tailwindcss/typography` |
| 21 | `messages/vi.json` | Update: thêm i18n keys |
| 22 | `messages/en.json` | Update: thêm i18n keys |

---

## Step 1 — Service & Hook Layer

### 1.1 Update `course.service.ts`

Thêm review service functions (reviews là sub-resource của course, không cần file riêng):

```typescript
// Thêm vào courseService object (bên dưới getBySlug)

  // Reviews
  getReviews: (courseId: string, params?: Record<string, string>) =>
    apiClient.get(`/courses/${courseId}/reviews`, params),
  createReview: (courseId: string, data: { rating: number; comment?: string }) =>
    apiClient.post(`/courses/${courseId}/reviews`, data),
```

### 1.2 Create `enrollment.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const enrollmentService = {
  check: (courseId: string) =>
    apiClient.get(`/enrollments/check/${courseId}`),

  enrollFree: (courseId: string) =>
    apiClient.post(`/enrollments/free/${courseId}`),

  getMyLearning: (params?: Record<string, string>) =>
    apiClient.get('/enrollments/my-learning', params),
};
```

### 1.3 Update `services/index.ts`

Thêm export `enrollmentService`.

### 1.4 Add public hooks to `use-courses.ts`

```typescript
// ── Public Course Browse ──
export function useCourses(params: Record<string, string>) {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => courseService.browse(params),
  });
}

// ── Course Detail by Slug ──
export function useCourseDetail(slug: string) {
  return useQuery({
    queryKey: ['courses', 'detail', slug],
    queryFn: () => courseService.getBySlug(slug),
    enabled: !!slug,
  });
}

// ── Course Reviews (paginated) ──
export function useCourseReviews(courseId: string, params: Record<string, string>) {
  return useQuery({
    queryKey: ['courses', courseId, 'reviews', params],
    queryFn: () => courseService.getReviews(courseId, params),
    enabled: !!courseId,
  });
}
```

### 1.5 Create `use-enrollments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiError } from '../use-api-error';
import { useAuthStore } from '../stores/auth-store';
import { enrollmentService } from '../services/enrollment.service';

// ── Check Enrollment ──
export function useEnrollmentCheck(courseId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['enrollments', 'check', courseId],
    queryFn: () => enrollmentService.check(courseId),
    enabled: !!courseId && isAuthenticated,
  });
}

// ── Enroll Free Course ──
export function useEnrollFree() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => enrollmentService.enrollFree(courseId),
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'check', courseId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'my-learning'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
```

### 1.6 Update `shared-hooks/index.ts`

Export mới:
- `useCourses`, `useCourseDetail`, `useCourseReviews`
- `useEnrollmentCheck`, `useEnrollFree`
- `enrollmentService`

---

## Step 2 — CourseCard & CourseGrid Update

### 2.1 `course-card.tsx` — Rewrite

**Thay đổi chính:**
- Import `Course` từ `@shared/types` thay vì `@/lib/mock-data`
- Map field names theo API response:

| Mock field | API field | Notes |
|-----------|-----------|-------|
| `instructor.name` | `instructor.fullName` | |
| `instructor.avatar` | `instructor.avatarUrl` | Dùng `AvatarImage` nếu có |
| `rating` | `avgRating` | |
| `totalRatings` | `reviewCount` | |
| `totalDuration` (string) | `totalDuration` (number seconds) | Dùng `formatDuration()` |
| `isBestseller` | — | Bỏ |
| `isNew` | `publishedAt` | Check `< 30 days ago` |
| `thumbnail` | `thumbnailUrl` | `<img>` thật với fallback |

- Hiển thị thumbnail thật: `<img src={course.thumbnailUrl}>` với fallback gradient
- Free course: hiển thị `t('free')` thay vì `formatPrice(0)`
- Bỏ `isBestseller` badge (API không trả field này)
- `isNew` badge: tính từ `publishedAt` < 30 ngày

**API Course list fields (from `GET /courses`):**
```
id, title, slug, shortDescription, thumbnailUrl, level, language,
price, originalPrice, avgRating, reviewCount, totalStudents,
totalLessons, totalDuration (seconds), publishedAt,
instructor: { id, fullName, avatarUrl },
category: { id, name, slug }
```

### 2.2 `course-grid.tsx` — Update

- Import `Course` từ `@shared/types` thay vì mock-data
- Thêm `isLoading` + `skeletonCount` props cho skeleton variant:

```typescript
interface CourseGridProps {
  courses: Course[];
  isLoading?: boolean;
  skeletonCount?: number;
  className?: string;
  columns?: 2 | 3 | 4;
}
```

Khi `isLoading = true` → render `skeletonCount` (default 4) skeleton cards.

### 2.3 CourseCardSkeleton (inline trong course-grid.tsx)

```tsx
function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
      </CardContent>
    </Card>
  );
}
```

---

## Step 3 — Homepage Rewrite

### Thay đổi chính:

1. **Replace mock data** → 2 `useCourses` calls:
   - Popular: `{ sort: 'popular', limit: '4' }`
   - Newest: `{ sort: 'newest', limit: '4' }`

2. **Category bar** → `useCategories()` từ `@shared/hooks` (đã có)
   - Map `category.slug` → link `/courses?category=${cat.slug}`
   - API trả `iconUrl` hoặc null → bỏ icon emoji, dùng tên category thẳng

3. **Fix hardcoded colors:**
   - `text-blue-500 bg-blue-500/10` → `text-primary bg-primary/10`
   - `text-green-500 bg-green-500/10` → `text-success bg-success/10`

4. **Stats section** — giữ static (500+, 10K+, 4.8) vì không có public stats API

5. **Loading states:**
   - Course sections: `CourseGrid` với `isLoading` prop
   - Category bar: skeleton badges khi loading

### Data flow:
```
useCourses({ sort: 'popular', limit: '4' }) → popularCourses
useCourses({ sort: 'newest', limit: '4' })  → newCourses
useCategories()                               → categories
```

---

## Step 4 — Courses Browse Page Rewrite

### Thay đổi chính:

1. **Replace mock data** → `useCourses(params)` with server-side filtering
2. **Filter state** → synced to URL searchParams (shareable URLs)
3. **Category sidebar** → `useCategories()` real data, single-select (match API `categorySlug`)
4. **Level filter** → single-select radio: BEGINNER | INTERMEDIATE | ADVANCED
5. **Price filter** → radio: `all` / `free` (maxPrice=0) / `paid` (minPrice=1)
6. **Sort** → map to API enum: `newest`, `popular`, `highest_rated`, `price_asc`, `price_desc`
7. **Search** → `useDebounce(300ms)` + `search` query param
8. **Pagination** → server-side from `meta.page`, `meta.totalPages`, `meta.total`
9. **Replace `<select>`** → keep native select (simple, accessible) or use shadcn Select
10. **Empty state** → khi `courses.length === 0` và không loading
11. **Result count** → from `meta.total`

### Filter state management:

```typescript
const searchParams = useSearchParams();

const [filters, setFilters] = useState({
  search: searchParams.get('search') ?? '',
  category: searchParams.get('category') ?? '',
  level: searchParams.get('level') ?? '',
  price: searchParams.get('price') ?? '',
  sort: searchParams.get('sort') ?? 'popular',
  page: Number(searchParams.get('page') ?? '1'),
});

const debouncedSearch = useDebounce(filters.search, 300);
```

### Build API params:

```typescript
const apiParams = useMemo(() => {
  const p: Record<string, string> = {
    page: String(filters.page),
    limit: '12',
  };
  if (debouncedSearch) p.search = debouncedSearch;
  if (filters.category) p.categorySlug = filters.category;
  if (filters.level) p.level = filters.level;
  if (filters.sort) p.sort = filters.sort;
  if (filters.price === 'free') p.maxPrice = '0';
  if (filters.price === 'paid') p.minPrice = '1';
  return p;
}, [debouncedSearch, filters.category, filters.level, filters.sort, filters.price, filters.page]);

const { data, isLoading } = useCourses(apiParams);
```

### URL sync (state → URL):

```typescript
useEffect(() => {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.level) params.set('level', filters.level);
  if (filters.price) params.set('price', filters.price);
  if (filters.sort !== 'popular') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  const qs = params.toString();
  router.replace(qs ? `/courses?${qs}` : '/courses', { scroll: false });
}, [filters]);
```

### FilterSidebar rewrite:

**Current**: Local state, mock categories, multi-select checkboxes.
**New**:
- Lift state up: props `filters` + `onFilterChange` from parent
- Categories từ `useCategories()`, single-select (radio, match API `categorySlug`)
- Level: single-select radio (BEGINNER, INTERMEDIATE, ADVANCED)
- Price: radio (all / free / paid)
- Clear all button: reset filters to defaults
- Active filter count badge on mobile filter trigger button

### Pagination UI:

```typescript
const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

// Previous disabled when page === 1
// Next disabled when page === totalPages
// Show page numbers: [1] [2] ... [n] (max 5 visible)
```

---

## Step 5 — Course Detail Page Rewrite

### Thay đổi chính:

1. **Read slug** from route params: `const { slug } = use(params)` (Next.js 16)
2. **Course data** → `useCourseDetail(slug)` — full course with curriculum + latest 5 reviews
3. **Reviews** → `useCourseReviews(courseId, { page, sort })` — paginated reviews tab
4. **Enrollment check** → `useEnrollmentCheck(courseId)` — determines CTA button
5. **Fix hero gradient**: `from-gray-900 to-gray-800` → design tokens:
   ```
   bg-gradient-to-r from-primary to-primary/80 text-primary-foreground
   ```
6. **CTA button logic**:
   ```
   if (enrolled)   → "Tiếp tục học"       → link to /my-learning
   if (inCart)      → "Xem giỏ hàng"      → link to /cart
   if (price === 0) → "Đăng ký miễn phí"  → useEnrollFree mutation
   else             → "Thêm vào giỏ"      → useCartStore().addItem()
   ```
7. **Curriculum structure**: API returns 3 levels (sections > chapters > lessons)
   - Mock UI only has 2 levels (sections > lessons)
   - Update accordion: Section header → Chapter (collapsible) → Lesson list
8. **Instructor section**: `course.instructor` with `instructorProfile.headline/biography`
9. **Review section**: `user.fullName`, `user.avatarUrl`, `formatRelativeTime(createdAt)`
10. **Mobile sticky bar**: Wire real price + CTA

### Curriculum display layout:

```
▼ Section 1: Introduction (3 chapters, 8 lessons)
  ▼ Chapter 1: Getting Started
    📹 Lesson 1: Welcome                    5:30
    📄 Lesson 2: Setup Guide                3:00
  ▼ Chapter 2: Basics [Free Preview]
    📹 Lesson 3: First Steps                8:00
    📝 Quiz: Knowledge Check
```

### CTA logic:

```typescript
const { isAuthenticated } = useAuthStore();
const cartItems = useCartStore((s) => s.items);
const { data: enrollmentData } = useEnrollmentCheck(course.id);
const enrollFreeMutation = useEnrollFree();

const isEnrolled = enrollmentData?.data?.enrolled === true;
const isInCart = cartItems.some((item) => item.courseId === course.id);

// Render based on state:
// 1. isEnrolled → "Tiếp tục học" button → /my-learning
// 2. isInCart → "Xem giỏ hàng" button → /cart
// 3. price === 0 → "Đăng ký miễn phí" → enrollFreeMutation.mutate(course.id)
// 4. else → "Thêm vào giỏ" → cartStore.addItem()
// 5. !isAuthenticated → "Thêm vào giỏ" / "Đăng ký miễn phí" → redirect to login first
```

### Rating distribution:

API does NOT return distribution breakdown. For this phase:
- Show `avgRating` + `reviewCount` summary
- Skip distribution progress bars (can add later with aggregation endpoint)
- Show review list with pagination

### Loading/Error states:

```typescript
if (isLoading) return <CourseDetailSkeleton />;
if (!course) return <NotFoundState message={t('notFound')} />;
```

---

## Step 6 — i18n Updates

### New keys for `courses` namespace:

| Key | VI | EN |
|-----|----|----|
| `pageTitle` | Khám phá khóa học | Browse Courses |
| `noResults` | Không tìm thấy khóa học nào | No courses found |
| `noResultsDesc` | Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm | Try changing filters or search terms |
| `clearFilters` | Xóa bộ lọc | Clear filters |
| `allCategories` | Tất cả danh mục | All categories |
| `allLevels` | Tất cả cấp độ | All levels |

### New keys for `courseDetail` namespace:

| Key | VI | EN |
|-----|----|----|
| `notFound` | Không tìm thấy khóa học | Course not found |
| `chapters` | chương | chapters |
| `continueLearning` | Tiếp tục học | Continue Learning |
| `goToCart` | Xem giỏ hàng | Go to Cart |
| `enrollFree` | Đăng ký miễn phí | Enroll Free |
| `enrolling` | Đang đăng ký... | Enrolling... |
| `enrolled` | Đã đăng ký | Enrolled |
| `freePreview` | Xem trước miễn phí | Free Preview |
| `noReviews` | Chưa có đánh giá nào | No reviews yet |
| `loginToEnroll` | Đăng nhập để đăng ký | Login to enroll |
| `free` | Miễn phí | Free |

### New keys for `course` namespace (CourseCard):

| Key | VI | EN |
|-----|----|----|
| `students` | học viên | students |

---

## Step 7 — Cleanup

1. Remove `mockCourses`, `categories`, `mockReviews` imports from 3 pages
2. Remove `Course` type import from `@/lib/mock-data` in `course-card.tsx`, `course-grid.tsx`
3. **DO NOT delete** `mock-data.ts` — other pages (cart, orders, social, chat, etc.) still use it

---

## Commits

| # | Scope | Message |
|---|-------|---------|
| 1 | shared | `feat(shared): add public course browse and enrollment hooks` |
| 2 | student | `feat(student): wire homepage to real api` |
| 3 | student | `feat(student): wire course browse page with filters and pagination` |
| 4 | student | `feat(student): wire course detail page with reviews and enrollment` |

---

## Verification Checklist

### Homepage
- [ ] Popular courses section loads from API with skeleton
- [ ] New courses section loads from API with skeleton
- [ ] Category bar loads from API (real categories, slug-based links)
- [ ] Feature cards use design tokens (not hardcoded blue/green)
- [ ] Empty state when no courses
- [ ] Dark mode correct

### Courses Browse
- [ ] Search with debounce (300ms) triggers API call
- [ ] Category filter updates results (single-select, by slug)
- [ ] Level filter works (BEGINNER/INTERMEDIATE/ADVANCED)
- [ ] Price filter works (free = maxPrice=0, paid = minPrice=1)
- [ ] Sort dropdown works (5 options matching API enum)
- [ ] URL params sync (shareable, browser back works)
- [ ] Page resets to 1 on filter/search change
- [ ] Pagination renders from API meta
- [ ] Result count from API meta.total
- [ ] Skeleton grid while loading
- [ ] Empty state when no results with clear filters button
- [ ] Mobile: filter sidebar in Sheet
- [ ] Dark mode correct

### Course Detail
- [ ] Slug from URL loads correct course
- [ ] Hero section uses design tokens (not hardcoded gray)
- [ ] Curriculum accordion: 3-level (section > chapter > lesson)
- [ ] Lesson type icons: VIDEO → Play, TEXT → FileText, QUIZ → FileQuestion
- [ ] Duration: `formatDuration(seconds)` for individual lessons and totals
- [ ] Reviews tab loads with pagination
- [ ] CTA: "Thêm vào giỏ" for paid courses (not enrolled)
- [ ] CTA: "Đăng ký miễn phí" for free courses
- [ ] CTA: "Tiếp tục học" if enrolled
- [ ] CTA: "Xem giỏ hàng" if course in cart
- [ ] Free enrollment mutation works with success feedback
- [ ] Instructor card shows real data (name, headline, bio)
- [ ] Mobile sticky bottom bar with price + CTA
- [ ] Loading skeleton while fetching
- [ ] Not-found state when course doesn't exist
- [ ] Dark mode correct

### CourseCard
- [ ] Real thumbnail image with fallback gradient when null
- [ ] Links to `/courses/${slug}`
- [ ] Instructor `fullName` displayed
- [ ] `avgRating` + star icons + `reviewCount`
- [ ] `formatDuration(totalDuration)` for time display
- [ ] `totalLessons` count
- [ ] Price via `formatPrice()`, "Miễn phí" for price === 0
- [ ] "New" badge for courses published < 30 days ago

### Cross-cutting
- [ ] No remaining `mockCourses`/`mockReviews`/`categories` imports in these 3 pages
- [ ] All user-facing strings via `useTranslations()`
- [ ] Build passes: `npm run build --workspace=apps/student-portal`
- [ ] No TypeScript errors
