# Explanation — Phase 5.13b: Course Browse & Detail

> Replace mock data with real API on Homepage, Courses Browse, and Course Detail.
> Student portal's first real data-driven pages.

---

## 1. Three-Layer Architecture for Public Course Data

### Pattern

Followed the same 3-layer pattern established in Phase 5.14 (management portal):

```
Service (plain API functions) → Query Hook (TanStack Query) → Component (UI)
```

### Implementation

**Services added:**
- `courseService.getReviews()` / `.createReview()` — appended to existing course service
- `enrollmentService` — new file: `check`, `enrollFree`, `getMyLearning`

**Query hooks added:**
- `useCourses(params)` — public browse with server-side filtering
- `useCourseDetail(slug)` — full course data by slug
- `useCourseReviews(courseId, params)` — paginated reviews
- `useEnrollmentCheck(courseId)` — only fires when authenticated (`enabled: isAuthenticated`)
- `useEnrollFree()` — mutation with triple invalidation (enrollment check + my-learning + courses list)
- `useMyLearning(params)` — prepared for Phase 5.13d

### Why separate enrollment service

Enrollments are a distinct domain from courses. The enrollment service handles the student-course relationship (check, enroll), while the course service handles browsing/viewing. Keeping them separate follows the same module boundaries as the backend.

---

## 2. CourseCard Backward Compatibility

### Problem

When we changed `CourseCard` to use real API fields (`avgRating`, `reviewCount`, `instructor.fullName`), **other pages still using mock data broke** — e.g., wishlist page imports mock `Course` type which has `rating`, `totalRatings`, `instructor.name`.

### Solution: Loose interface with field fallbacks

```typescript
export interface CourseCardCourse {
  // Required
  id: string; slug: string; title: string; price: number;
  instructor: { id?: string; fullName?: string; name?: string; avatarUrl?: string | null };

  // Optional — real API fields
  avgRating?: number;
  reviewCount?: number;

  // Optional — legacy mock fields
  rating?: number;
  totalRatings?: number;
}
```

In the component body, resolve with fallbacks:
```typescript
const avgRating = course.avgRating ?? course.rating ?? 0;
const reviewCount = course.reviewCount ?? course.totalRatings ?? 0;
const instructorName = course.instructor.fullName ?? course.instructor.name ?? '';
```

### Why not just fix all pages

Other pages (wishlist, cart, orders, social) still use mock data — they'll be wired to real API in later phases (5.13c-g). Forcing all pages to update now would be scope creep. The loose interface lets both real and mock data coexist during the transition.

---

## 3. Filter State → URL Sync Pattern

### Problem

Course browse page needs shareable URLs. Visiting `/courses?category=web-dev&level=BEGINNER` should show filtered results.

### Implementation

```
URL searchParams → useState (initial) → useMemo (API params) → useCourses() → UI
                                    ↕
                              useEffect → router.replace (sync back to URL)
```

**Key details:**

1. **Init from URL:** `useState(() => ({ search: searchParams.get('search') ?? '' }))`
2. **Build API params:** `useMemo` maps filter state to API query string — e.g., `price: 'free'` → `maxPrice: '0'`
3. **Sync to URL:** `useEffect` writes filter state back to URL via `router.replace` with `{ scroll: false }`
4. **Page reset:** Every filter change resets `page` to 1 (except explicit page changes)
5. **Debounced search:** Search input uses `useDebounce(300ms)` to avoid API spam

### Price filter mapping

The API supports `minPrice`/`maxPrice` but the UI shows simple radio buttons:
- `all` → no price filter
- `free` → `maxPrice: '0'`
- `paid` → `minPrice: '1'`

### Category filter

API accepts `categorySlug` (single value), so categories are **single-select radio buttons**, not multi-select checkboxes (unlike the original mock UI).

---

## 4. Course Detail — 3-Level Curriculum

### Problem

The mock UI had a 2-level structure: `sections > lessons`. But the real API returns a 3-level structure: `sections > chapters > lessons`.

### Solution

```
▼ Section: Introduction (2 chapters)
  ┃ Chapter: Getting Started [Free Preview]
  ┃   📹 Lesson: Welcome           [Preview]  5:30
  ┃   📄 Lesson: Setup Guide       [Preview]  3:00
  ┃ Chapter: Core Concepts
  ┃   📹 Lesson: First Steps                  8:00
  ┃   📝 Quiz: Knowledge Check
```

Section headers are collapsible (accordion). Chapters show as sub-headers with lesson lists beneath. Free preview chapters show a badge on the chapter header AND individual "Preview" badges on each lesson.

---

## 5. CTA Button Logic

### State-based rendering

```
isEnrolled     → "Tiếp tục học"       → /my-learning
isInCart        → "Xem giỏ hàng"      → /cart
price === 0    → "Đăng ký miễn phí"  → enrollFree mutation
else            → "Thêm vào giỏ"     → cartStore.addItem()
!authenticated → redirect to /login first
```

### TypeScript closure issue

`renderCTA()` is a nested function that references `course`, but TypeScript can't prove `course` is non-null inside a closure even after an early return guard:

```typescript
if (!course) return <NotFound />;
// TypeScript still thinks course might be undefined in closures below
function renderCTA() { course.price } // ❌ Error
```

**Fix:** Extract the needed value before the closure:
```typescript
const coursePrice = course.price; // ✅ Narrowed here
function renderCTA() { coursePrice } // ✅ Works
```

---

## 6. Component Extraction for Maintainability

### Problem

Initial implementation put everything in page files:
- `courses/page.tsx` — 415 lines (filters, pagination, grid, toolbar)
- `courses/[slug]/page.tsx` — 757 lines (hero, tabs, curriculum, reviews, purchase card)

### Solution: Domain-based component structure

```
components/course/
├── course-card.tsx              # Individual course card
├── course-grid.tsx              # Grid layout with skeleton
├── course-filters.tsx           # Filter sidebar (category/level/price)
├── pagination.tsx               # Reusable pagination
├── price-display.tsx            # Price with discount
└── detail/
    ├── types.ts                 # Shared types + constants
    ├── course-detail-skeleton.tsx
    ├── course-hero.tsx          # Hero banner
    ├── course-curriculum.tsx    # 3-level accordion
    ├── course-reviews.tsx       # Reviews with pagination
    └── purchase-card.tsx        # Sticky purchase sidebar
```

### Results

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `courses/page.tsx` | 415 | 230 | -45% |
| `courses/[slug]/page.tsx` | 757 | 285 | -62% |

Each component has a single responsibility:
- `CourseFilterSidebar` owns filter UI + "clear all" logic
- `CourseCurriculum` owns section expand/collapse state
- `CourseReviews` owns review pagination state + query
- `PurchaseCard` is a pure presentational component (CTA passed as `ReactNode`)

### Key design decision: PurchaseCard receives CTA as prop

The CTA button depends on enrollment state, cart state, and auth state — all managed by the parent page. Rather than passing 5+ props to PurchaseCard, we pass the rendered CTA button as a `ReactNode`:

```typescript
<PurchaseCard
  ctaButton={renderCTA('full')}
  // ... other props
/>
```

This keeps PurchaseCard purely presentational while the page owns the business logic.

---

## 7. Typography Plugin for Rich Content

### Problem

Course descriptions are stored as HTML (from Tiptap editor in management portal). The student portal rendered raw HTML without proper styling — lists showed without bullets, blockquotes had no visual distinction.

### Fix

Install `@tailwindcss/typography` and add to `globals.css`:
```css
@plugin '@tailwindcss/typography';
```

This enables `prose` classes:
```html
<div class="prose prose-sm dark:prose-invert max-w-none"
     dangerouslySetInnerHTML={{ __html: course.description }} />
```

Management portal already had this plugin; student portal was missing it.

---

## 8. Design Token Color Fixes

### Before (hardcoded)
```typescript
// Homepage feature cards
color: 'text-blue-500 bg-blue-500/10'
color: 'text-green-500 bg-green-500/10'

// Course detail hero
className="bg-gradient-to-r from-gray-900 to-gray-800"
```

### After (design tokens)
```typescript
// Homepage feature cards
color: 'text-primary bg-primary/10'
color: 'text-success bg-success/10'

// Course detail hero
className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
```

Design tokens adapt to both light and dark themes automatically.

---

## Files Summary

### Created (10 files)
| File | Purpose |
|------|---------|
| `shared-hooks/services/enrollment.service.ts` | Enrollment API functions |
| `shared-hooks/queries/use-enrollments.ts` | Enrollment query hooks |
| `components/course/course-filters.tsx` | Filter sidebar component |
| `components/course/pagination.tsx` | Reusable pagination |
| `components/course/detail/types.ts` | Shared types + lesson icons |
| `components/course/detail/course-detail-skeleton.tsx` | Loading skeleton |
| `components/course/detail/course-hero.tsx` | Hero banner |
| `components/course/detail/course-curriculum.tsx` | 3-level curriculum |
| `components/course/detail/course-reviews.tsx` | Reviews + pagination |
| `components/course/detail/purchase-card.tsx` | Purchase sidebar |

### Modified (12 files)
| File | Change |
|------|--------|
| `shared-hooks/services/course.service.ts` | Added `getReviews`, `createReview` |
| `shared-hooks/queries/use-courses.ts` | Added `useCourses`, `useCourseDetail`, `useCourseReviews` |
| `shared-hooks/services/index.ts` | Export enrollment service |
| `shared-hooks/index.ts` | Export 6 new hooks |
| `components/course/course-card.tsx` | Loose interface, real thumbnails, field fallbacks |
| `components/course/course-grid.tsx` | Skeleton loading support |
| `app/(main)/page.tsx` | Real API data, design token colors |
| `app/(main)/courses/page.tsx` | Server filters, URL sync, pagination |
| `app/(main)/courses/[slug]/page.tsx` | Real API, enrollment CTA, tabs |
| `app/globals.css` | Added `@tailwindcss/typography` |
| `messages/vi.json` | +18 new keys |
| `messages/en.json` | +18 new keys |

---

## Key Learnings

1. **Loose interfaces bridge migration periods** — When transitioning from mock to real data across many pages, make shared components accept both shapes with fallbacks rather than forcing all consumers to update simultaneously.

2. **URL sync requires careful page reset** — Every filter change must reset page to 1, but page changes themselves should not reset filters. The `handleFilterChange` callback handles this with a conditional: `page: key === 'page' ? prev.page : 1`.

3. **TypeScript closures don't narrow** — Even after an `if (!x) return` guard, nested functions can't see the narrowing. Extract values to local `const` before defining closures.

4. **Component extraction pays off immediately** — A 757-line page is hard to modify. After splitting into 7 focused components, each file is under 150 lines and changes are localized.

5. **Free preview is a chapter-level concept** — Individual lessons don't have preview flags. The `isFreePreview` is on the chapter, and all lessons in that chapter are accessible without enrollment.
