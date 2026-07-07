# Sub-phase 5.13h — Course Recommendations

> Wire recommendation engine to student portal: homepage, course detail, post-purchase, and my-learning.
> Dependencies: 5.13a (Auth), 5.13b (Course cards), 5.13c (Ecommerce — order page).
> **Includes backend fix:** cron job delegation to RecommendationsService.

---

## 0. Pre-requisites Check

Before starting, verify:

```bash
cd apps/api
npx jest --testPathPattern=recommendations --verbose   # all 69 tests pass
```

Verify endpoint works:

```bash
curl http://localhost:3000/api/recommendations?context=homepage&limit=4
# → should return { data: [...courses with score, reason] }
```

---

## 1. Backend Fix — Cron Job Delegation

### Problem

`cron.service.ts` lines 199-249 **duplicates** recommendation computation logic instead of calling `RecommendationsService.computeAllSimilarities()`. The cron:
- Uses **Jaccard** on tags (should use **cosine similarity** via ContentBasedService)
- Only saves **one direction** (A→B, not B→A)
- Only computes **CONTENT** algorithm (misses COLLABORATIVE and HYBRID)

### Fix

**File:** `apps/api/src/modules/jobs/cron/cron.service.ts`

1. Import and inject `RecommendationsService`:

```typescript
import { RecommendationsService } from '@/modules/recommendations/recommendations.service';

constructor(
  // ... existing deps
  @Inject(RecommendationsService)
  private readonly recommendations: RecommendationsService,
) {}
```

2. Replace the entire `computeRecommendationMatrix()` method:

```typescript
@Cron('0 4 * * *')
async computeRecommendationMatrix() {
  this.logger.log('Starting recommendation matrix computation...');
  await this.recommendations.computeAllSimilarities();
  this.logger.log('Recommendation matrix computation complete');
}
```

3. Add `RecommendationsModule` to `JobsModule` imports:

```typescript
// apps/api/src/modules/jobs/jobs.module.ts
import { RecommendationsModule } from '@/modules/recommendations/recommendations.module';

@Module({
  imports: [
    // ... existing
    RecommendationsModule,
  ],
})
```

4. Update `RecommendationsModule` to export the service:

```typescript
// apps/api/src/modules/recommendations/recommendations.module.ts
@Module({
  // ...
  exports: [RecommendationsService],  // ensure exported
})
```

### Verify

```bash
npx jest --testPathPattern=cron --verbose
```

---

## 2. Backend Enhancement — Response Shape

The current endpoint returns courses but misses some fields the frontend needs. Verify `COURSE_SELECT` in `recommendations.service.ts` includes everything for course cards:

**File:** `apps/api/src/modules/recommendations/recommendations.service.ts`

Update `COURSE_SELECT`:

```typescript
const COURSE_SELECT = {
  id: true,
  title: true,
  slug: true,
  thumbnailUrl: true,
  avgRating: true,
  totalStudents: true,
  price: true,
  originalPrice: true,
  level: true,
  instructor: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
    },
  },
  _count: {
    select: { reviews: true, lessons: true },
  },
} as const;
```

Also add `originalPrice`, `level`, `instructor`, `_count` so the frontend `CourseCard` component has everything it needs.

---

## 3. Shared Layer — Service & Hooks

### 3.1 Recommendation Service

**New file:** `packages/shared-hooks/src/services/recommendation.service.ts`

```typescript
import { apiClient } from './api-client';

export interface RecommendedCourse {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  avgRating: number;
  totalStudents: number;
  price: number;
  originalPrice: number | null;
  level: string;
  score: number;
  reason: string;
  instructor: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  _count: {
    reviews: number;
    lessons: number;
  };
}

export type RecommendationContext =
  | 'homepage'
  | 'course_detail'
  | 'post_purchase'
  | 'post_complete';

export const recommendationService = {
  getRecommendations: (params: {
    context?: RecommendationContext;
    courseId?: string;
    limit?: number;
  }) =>
    apiClient.get<RecommendedCourse[]>('/recommendations', { params }),
};
```

### 3.2 Query Hooks

**New file:** `packages/shared-hooks/src/queries/use-recommendations.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import {
  recommendationService,
  type RecommendationContext,
} from '../services/recommendation.service';

export function useRecommendations(
  context: RecommendationContext = 'homepage',
  options?: {
    courseId?: string;
    limit?: number;
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ['recommendations', context, options?.courseId, options?.limit],
    queryFn: () =>
      recommendationService.getRecommendations({
        context,
        courseId: options?.courseId,
        limit: options?.limit,
      }),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 min — recommendations don't change often
    gcTime: 30 * 60 * 1000,   // 30 min
  });
}
```

### 3.3 Export from index.ts

**File:** `packages/shared-hooks/src/index.ts`

Add:

```typescript
export { useRecommendations } from './queries/use-recommendations';
export type {
  RecommendedCourse,
  RecommendationContext,
} from './services/recommendation.service';
```

---

## 4. Frontend — Reusable Recommendation Section Component

### 4.1 Component

**New file:** `apps/student-portal/src/components/course/recommendation-section.tsx`

This is the **single reusable component** used in all 4 integration points.

```
Props:
  - context: RecommendationContext
  - courseId?: string (for course_detail context)
  - limit?: number (default 4)
  - title: string (i18n translated)
  - emptyMessage?: string
```

Behavior:
- Calls `useRecommendations(context, { courseId, limit })`
- Shows loading skeleton (4 shimmer cards)
- Shows course cards in a responsive grid (1 col mobile, 2 tablet, 4 desktop)
- Each card reuses existing `CourseCard` component from course-grid
- If no recommendations, shows `emptyMessage` or hides entirely
- If error or not authenticated, falls back to popularity (backend handles this)

Structure:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRecommendations } from '@shared/hooks';
import type { RecommendationContext } from '@shared/hooks';
import { CourseCard } from './course-card'; // existing component

interface RecommendationSectionProps {
  context: RecommendationContext;
  courseId?: string;
  limit?: number;
  title: string;
  subtitle?: string;
  showReason?: boolean;
}

export function RecommendationSection({
  context,
  courseId,
  limit = 4,
  title,
  subtitle,
  showReason = false,
}: RecommendationSectionProps) {
  // fetch recommendations
  // show skeleton while loading
  // map data to CourseCard grid
  // hide section if empty
}
```

### 4.2 Check existing CourseCard compatibility

**File:** `apps/student-portal/src/components/course/course-card.tsx`

Verify `CourseCard` accepts the fields returned by recommendation API. The recommendation response includes `score` and `reason` which are extra fields — CourseCard should just ignore them (spread remaining props). If CourseCard expects a specific type, may need to map the recommendation response to match.

Key fields CourseCard needs:
- `id`, `title`, `slug`, `thumbnailUrl`
- `avgRating`, `price`, `originalPrice`
- `instructor.fullName`, `instructor.avatarUrl`
- `_count.reviews`, `_count.lessons` or `totalStudents`
- `level`

---

## 5. Frontend — Integration Points

### 5.1 Homepage — "Recommended for You"

**File:** `apps/student-portal/src/app/[locale]/(main)/page.tsx`

Add a `RecommendationSection` between "Popular Courses" and "New Courses" (or after "New Courses"). Only show for logged-in users.

```tsx
// After existing course sections
{user && (
  <RecommendationSection
    context="homepage"
    limit={4}
    title={t('recommendedForYou')}
    subtitle={t('recommendedSubtitle')}
  />
)}
```

Check the current homepage structure:
- Hero → Categories → Popular Courses → New Courses → Why Us
- Insert **after New Courses**, before Why Us
- Only visible when user is authenticated (use auth store)

### 5.2 Course Detail — "Similar Courses"

**File:** `apps/student-portal/src/app/[locale]/(main)/courses/[slug]/page.tsx`

Add after the Reviews tab content, before footer:

```tsx
<RecommendationSection
  context="course_detail"
  courseId={course.id}
  limit={4}
  title={t('similarCourses')}
/>
```

This shows content-based recommendations (similar tags/topics).
Works for both authenticated and anonymous users (anonymous gets popularity fallback).

### 5.3 Order Detail — Post-Purchase

**File:** `apps/student-portal/src/app/[locale]/(main)/orders/[orderId]/page.tsx`

Add after order confirmation details:

```tsx
<RecommendationSection
  context="post_purchase"
  limit={4}
  title={t('alsoLiked')}
  subtitle={t('alsoLikedSubtitle')}
/>
```

Shows collaborative filtering results ("students who bought this also bought...").

### 5.4 My Learning — "What to Learn Next"

**File:** `apps/student-portal/src/app/[locale]/(main)/my-learning/page.tsx`

Add after the course tabs (In Progress / Completed / All):

```tsx
<RecommendationSection
  context="post_complete"
  limit={4}
  title={t('whatToLearnNext')}
/>
```

Shows content-based recommendations based on user's enrolled courses.

---

## 6. i18n Translations

**Files:** `apps/student-portal/messages/vi.json` & `en.json`

Add under `"courses"` or new `"recommendations"` namespace:

```json
{
  "recommendations": {
    "recommendedForYou": "Gợi ý cho bạn",
    "recommendedSubtitle": "Dựa trên sở thích và lịch sử học tập của bạn",
    "similarCourses": "Khóa học tương tự",
    "alsoLiked": "Học viên cũng thích",
    "alsoLikedSubtitle": "Những người mua khóa học này cũng đăng ký",
    "whatToLearnNext": "Học tiếp gì nữa?",
    "noRecommendations": "Chưa có gợi ý nào",
    "viewAll": "Xem tất cả"
  }
}
```

English:

```json
{
  "recommendations": {
    "recommendedForYou": "Recommended for You",
    "recommendedSubtitle": "Based on your interests and learning history",
    "similarCourses": "Similar Courses",
    "alsoLiked": "Students Also Liked",
    "alsoLikedSubtitle": "People who enrolled in this also bought",
    "whatToLearnNext": "What to Learn Next?",
    "noRecommendations": "No recommendations yet",
    "viewAll": "View All"
  }
}
```

---

## 7. Implementation Order

| Step | Task | Files | Est. |
|------|------|-------|------|
| 1 | Fix cron job delegation | `cron.service.ts`, `jobs.module.ts` | 10 min |
| 2 | Enhance COURSE_SELECT | `recommendations.service.ts` | 5 min |
| 3 | Create shared service + hooks | `recommendation.service.ts`, `use-recommendations.ts`, `index.ts` | 15 min |
| 4 | Build RecommendationSection component | `recommendation-section.tsx` | 20 min |
| 5 | Integrate into Homepage | `page.tsx` (main) | 10 min |
| 6 | Integrate into Course Detail | `page.tsx` (courses/[slug]) | 10 min |
| 7 | Integrate into Order Detail | `page.tsx` (orders/[orderId]) | 10 min |
| 8 | Integrate into My Learning | `page.tsx` (my-learning) | 10 min |
| 9 | Add i18n translations | `vi.json`, `en.json` | 5 min |
| 10 | Test all 4 contexts | Manual testing | 15 min |

---

## 8. Commit Plan

```
1. fix(api): delegate cron recommendation computation to service
   - cron.service.ts, jobs.module.ts, recommendations.module.ts

2. feat(api): enhance recommendation response with course card fields
   - recommendations.service.ts (COURSE_SELECT update)

3. feat(shared): add recommendation service and query hooks
   - recommendation.service.ts, use-recommendations.ts, index.ts

4. feat(student): add recommendation sections to all pages
   - recommendation-section.tsx, homepage, course detail, order, my-learning
   - vi.json, en.json
```

---

## 9. Technical Decisions

### 9.1 Single Reusable Component

One `RecommendationSection` component handles all 4 contexts. The `context` prop determines which algorithm the backend uses. This keeps the frontend simple — no need for separate components.

### 9.2 Backend Handles Algorithm Selection

Frontend doesn't decide which algorithm to use. It passes `context` and lets the backend route:
- `homepage` → Hybrid (content 50% + collaborative 50%)
- `course_detail` → Content-based (tag similarity)
- `post_purchase` → Collaborative (enrollment overlap)
- `post_complete` → Content-based (from last enrolled course)

Unauthenticated users always get popularity-based results (Wilson Score + Time Decay).

### 9.3 Stale Time Strategy

Recommendations are cached client-side for 5 minutes (`staleTime: 5 * 60 * 1000`). Pre-computed similarity matrix updates daily at 4 AM, so short-term caching is safe. This prevents unnecessary API calls when navigating between pages.

### 9.4 Graceful Degradation

- No auth → popularity fallback (backend)
- No enrollments → popularity fallback (backend)
- Empty results → hide section entirely (frontend)
- API error → hide section, no error toast (non-critical feature)
- Loading → shimmer skeleton cards

### 9.5 CourseCard Reuse

The recommendation response is mapped to match existing `CourseCard` props. No new card component needed. The `score` and `reason` fields are extra metadata — `reason` can optionally be shown as a small badge/subtitle under the card.

---

## 10. Edge Cases

| Case | Behavior |
|------|----------|
| New user, 0 enrollments | Backend returns popularity-based |
| User enrolled in all courses | Backend returns empty → section hidden |
| Course has no tags | Content-based returns nothing → popularity fallback |
| No similarity data (matrix not computed yet) | Popularity fallback |
| Anonymous user on homepage | Popularity-based (public endpoint) |
| Anonymous user on course detail | Popularity-based for similar courses |
| Only 1 course in system | No similarity pairs → popularity |
| `courseId` param missing for `course_detail` | Backend returns popularity fallback |

---

## 11. Verification Checklist

- [ ] Cron job calls `RecommendationsService.computeAllSimilarities()`
- [ ] `GET /recommendations?context=homepage` returns courses with instructor and counts
- [ ] `GET /recommendations?context=course_detail&courseId=xxx` returns similar courses
- [ ] Shared hooks export `useRecommendations`
- [ ] Homepage shows "Recommended for You" section (logged-in only)
- [ ] Course detail shows "Similar Courses" section
- [ ] Order detail shows "Students Also Liked" section
- [ ] My Learning shows "What to Learn Next" section
- [ ] Sections hide when no recommendations returned
- [ ] Loading skeleton displays correctly
- [ ] Both vi and en translations work
- [ ] Dark mode renders correctly
- [ ] Mobile responsive (1 col → 2 col → 4 col grid)
- [ ] All existing tests still pass
