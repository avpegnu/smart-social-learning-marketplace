# Phase 5.14b — Instructor Dashboard & Course List

> Wire instructor dashboard with real API stats, course list with
> server-side search/filter/pagination, course actions (delete, submit for review).
> Includes bug fixes: hydration guards, auth loop, formatPrice, unauthorized page.

---

## 1. OVERVIEW

### Backend Endpoints Used

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/instructor/dashboard` | Dashboard stats (overview, recentEarnings, courseStats) |
| GET | `/instructor/courses` | List instructor's courses with QueryCoursesDto |
| DELETE | `/instructor/courses/:id` | Soft delete course |
| POST | `/instructor/courses/:id/submit` | Submit course for admin review |

### Actual Backend Response — Dashboard

```typescript
{
  overview: {
    totalRevenue: number;
    totalStudents: number;
    totalCourses: number;
    availableBalance: number;
    pendingBalance: number;
  };
  recentEarnings: Array<{
    id: string;
    netAmount: number;
    createdAt: string;
    orderItem: { title: string; price: number };
  }>;
  courseStats: Array<{
    id: string;
    title: string;
    totalStudents: number;
    avgRating: number;
  }>;
}
```

Note: Backend does NOT return `revenueGrowth`, `studentGrowth`, `revenueByMonth`,
or `averageRating` at dashboard level. Original plan was wrong — implementation
matches actual backend response.

### Actual Backend Response — Course List

```typescript
{
  data: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    status: CourseStatus;
    price: number;
    totalStudents: number;
    totalLessons: number;
    avgRating: number;
    reviewCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

---

## 2. SHARED API HOOKS

### `packages/shared-hooks/src/api/use-instructor.ts`

4 hooks: `useInstructorDashboard`, `useInstructorProfile`, `useUpdateInstructorProfile`,
`useInstructorApplicationStatus`.

- Dashboard: `staleTime: 60_000` (1 min cache)
- Profile update: invalidates profile query + toast error

### `packages/shared-hooks/src/api/use-courses.ts`

7 hooks: `useInstructorCourses`, `useInstructorCourseDetail`, `useCreateCourse`,
`useUpdateCourse`, `useDeleteCourse`, `useSubmitCourseForReview`, `useUpdateCourseTags`.

- `useInstructorCourses`: converts params to flat `Record<string, string>` for apiClient.get()
- Delete: invalidates both courses list AND dashboard (stats change)
- All mutations: error toast via `useApiError()`

---

## 3. DASHBOARD PAGE — Actual Implementation

Uses `formatPrice` from `@shared/utils` (NOT `formatCurrency` from mock-data).

4 stat cards: totalRevenue, totalStudents, totalCourses, availableBalance.
2 tables: courseStats (top courses by students), recentEarnings (with orderItem title).
Loading skeleton with proper layout matching.

No chart — backend doesn't provide revenueByMonth data.

---

## 4. COURSES PAGE — Server-Side Pagination

- `useDebounce(search, 300)` for search input
- Status filter badges: ALL, DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED
- Per-status actions: DRAFT/REJECTED → Edit, Submit, Delete; PUBLISHED → Edit, View
- ConfirmDialog for delete and submit for review
- DataTable in server-side mode (`serverPage`, `onServerPageChange`)

---

## 5. DataTable — Server-Side Mode Extension

Extended with backward-compatible server-side props:

```typescript
interface DataTableProps {
  // ... existing client-side props
  isLoading?: boolean;          // Show skeleton rows
  serverPage?: number;          // 1-indexed server page
  serverTotalPages?: number;    // Total pages from API meta
  serverTotal?: number;         // Total items from API meta
  onServerPageChange?: (page: number) => void;
  searchValue?: string;         // Controlled search input
  onSearchChange?: (value: string) => void;
}
```

When `serverPage` + `onServerPageChange` provided → server-side mode:
- No client-side filtering/pagination
- Loading shows Skeleton rows
- Pagination calls `onServerPageChange(page)` (1-indexed)

When NOT provided → existing client-side behavior unchanged.

---

## 6. CONFIRM DIALOG

Reusable dialog with `variant: 'destructive' | 'default'`, loading state, i18n.

---

## 7. BUG FIXES (discovered during implementation)

### 7.1 Hydration Guards — All Layouts

**Problem:** Auth guards in layouts fired BEFORE Zustand hydrated from sessionStorage.
`isAuthenticated = false` (default) → redirect to `/login` → auth layout redirect back → **LOOP**.

**Fix:** Added `useAuthHydrated()` to ALL 4 components:
- `(auth)/layout.tsx`
- `instructor/layout.tsx`
- `admin/layout.tsx`
- `[locale]/page.tsx` (index)

```typescript
const hydrated = useAuthHydrated();
useEffect(() => {
  if (!hydrated) return; // Wait for Zustand to hydrate
  // ... auth checks
}, [hydrated, ...]);
if (!hydrated) return null;
```

### 7.2 Unauthorized Page — Route Group Conflict

**Problem:** `/unauthorized` was inside `(auth)` route group.
- `(auth)/layout.tsx`: "IF authenticated → redirect to dashboard"
- `(auth)/unauthorized/page.tsx`: shown TO authenticated users with wrong role
- **Conflict → infinite loop**

**Fix:** Moved `/unauthorized` OUT of `(auth)` route group:
```
BEFORE: (auth)/unauthorized/page.tsx → wrapped by auth layout
AFTER:  unauthorized/page.tsx        → standalone, no auth layout
```

Added self-contained centering layout to the page.

### 7.3 Auth Layout — STUDENT Role Loop

**Problem:** Auth layout redirected ALL authenticated users (including STUDENT) to
`/instructor/dashboard`. Instructor layout then rejected STUDENT → `/unauthorized`.
Auth layout redirected back. **LOOP.**

**Fix:** Auth layout only redirects INSTRUCTOR/ADMIN. STUDENT stays on auth pages.

```typescript
if (user.role === 'ADMIN') router.replace('/admin/dashboard');
else if (user.role === 'INSTRUCTOR') router.replace('/instructor/dashboard');
// STUDENT: no redirect — they'll see /unauthorized from login redirect
```

### 7.4 Unauthorized "Back to Login" — Logout First

**Problem:** "Back to Login" navigated to `/login`, but user was still authenticated →
auth layout redirected away → loop.

**Fix:** Logout before redirect:
```typescript
logoutMutation.mutate(undefined, {
  onSettled: () => { window.location.href = '/login'; },
});
```

### 7.5 formatCurrency → formatPrice from @shared/utils

**Problem:** Dashboard and courses pages imported `formatCurrency` from `@/lib/mock-data`.

**Fix:** Use `formatPrice` from `@shared/utils` (already exists). Added `formatDate`
to `@shared/utils` as well.

---

## 8. FILES SUMMARY

### Created (3 files):
| File | Lines | Purpose |
|------|-------|---------|
| `shared-hooks/src/api/use-instructor.ts` | 46 | 4 instructor hooks |
| `shared-hooks/src/api/use-courses.ts` | 99 | 7 course CRUD hooks |
| `management-portal/src/components/confirm-dialog.tsx` | 56 | Reusable confirm dialog |

### Modified — Management Portal (8 files):
| File | Changes |
|------|---------|
| `instructor/dashboard/page.tsx` | Real API data (overview, courseStats, earnings) + skeleton |
| `instructor/courses/page.tsx` | Server-side search/filter/pagination + confirm dialogs |
| `data-display/data-table.tsx` | + server-side mode (isLoading, serverPage, onServerPageChange) |
| `(auth)/layout.tsx` | + useAuthHydrated + only redirect INSTRUCTOR/ADMIN |
| `instructor/layout.tsx` | + useAuthHydrated guard |
| `admin/layout.tsx` | + useAuthHydrated guard |
| `[locale]/page.tsx` | + useAuthHydrated guard |
| `unauthorized/page.tsx` | Moved out of (auth), logout before "Back to Login" |

### Modified — Shared Packages (2 files):
| File | Changes |
|------|---------|
| `shared-hooks/src/index.ts` | + export 11 new hooks (instructor + courses) |
| `shared-utils/src/index.ts` | + formatDate function |

### Modified — i18n (2 files):
| File | Changes |
|------|---------|
| `messages/vi.json` | + dashboard keys (availableBalance, recentEarnings, noCourses, noEarnings, courseTitle) + courses keys (lessons, submitForReview, confirmDelete, confirmSubmit) |
| `messages/en.json` | Same keys in English |

---

## 9. VERIFICATION

- [x] Dashboard shows real stats from API (or loading skeleton)
- [x] Top courses table with students and rating
- [x] Recent earnings list with formatted price
- [x] Course list loads from API with server-side pagination
- [x] Status filter badges work (ALL, DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED)
- [x] Search with debounce filters courses by title
- [x] Delete course: confirm dialog → soft delete → refetch list
- [x] Submit for review: confirm dialog → status change → refetch
- [x] Create course button navigates to /instructor/courses/new
- [x] Empty state when no courses
- [x] No infinite loop when INSTRUCTOR login
- [x] No infinite loop when STUDENT login (sees /unauthorized)
- [x] "Back to Login" on unauthorized page → logout + redirect
- [x] No import from mock-data (uses @shared/utils)
- [x] Hydration guards on all layouts (no flash, no loop)
- [x] Both portals build cleanly
