# Phase 5.14d — Admin Panel

> Admin dashboard, user management, instructor/course approvals,
> withdrawal processing, categories/tags CRUD, reports, settings.
> Wires all admin mock UI pages to real backend APIs.

---

## 1. DESIGN DECISIONS

### 1.1 Scope — Wire existing mock pages to real APIs

All admin pages already exist with mock UI (created in Phase 5.12).
This phase **replaces mock data with real API calls** — no new pages needed.

**Pages to wire (8):**
1. Dashboard — real stats + pending counts
2. Users — server-side search/filter/pagination + suspend/activate
3. Instructor Applications — pending list + approve/reject
4. Course Reviews — pending list + preview + approve/reject with feedback
5. Withdrawals — pending list + approve/reject with reason
6. Categories — CRUD with confirm delete
7. Reports — content reports list + dismiss/action (if backend supports)
8. Settings — platform settings read/write

**NOT in scope:** Analytics (charts need historical data), admin courses list (separate phase).

### 1.2 Service layer pattern (from frontend refactor)

```
services/admin.service.ts  → plain API functions (Layer 1)
queries/use-admin.ts       → TanStack Query hooks (Layer 2)
pages/*.tsx                 → consume hooks, render UI
```

### 1.3 Reusable patterns from 5.14b/5.14c

- **DataTable server-side mode** — `serverPage`, `onServerPageChange`, `isLoading`
- **ConfirmDialog** with portal — approve/reject actions
- **Debounced search** — `useDebounce(300ms)` for user search
- **formatPrice** from `@shared/utils` — for monetary values
- **useApiError** — toast localized error messages

---

## 2. BACKEND API REFERENCE

### 2.1 Dashboard — `GET /admin/dashboard`

```typescript
Response: {
  overview: {
    totalUsers: number,
    totalCourses: number,
    totalRevenue: number,
    todayOrders: number,
    newUsersThisWeek: number
  },
  pendingApprovals: {
    instructorApps: number,
    courseReviews: number,
    reports: number,
    withdrawals: number
  },
  topCourses: Array<{ id, title, totalStudents, avgRating }>
}
```

### 2.2 Users — `GET /admin/users` + `PATCH /admin/users/:id/status`

```typescript
// GET — paginated + search + filter
Query: { page?, limit?, search?, role?: 'STUDENT'|'INSTRUCTOR'|'ADMIN', status?: 'ACTIVE'|'SUSPENDED' }
Response: { data: User[], meta: { page, limit, total, totalPages } }
// User shape: id, email, fullName, avatarUrl, role, status, createdAt, _count.enrollments

// PATCH — update status
Body: { status: 'ACTIVE'|'SUSPENDED', reason?: string }
Throws: USER_NOT_FOUND, CANNOT_MODIFY_ADMIN
```

### 2.3 Instructor Applications — `GET /admin/applications` + `PATCH /admin/applications/:id`

```typescript
// GET — pending only
Query: { page?, limit? }
Response: { data: Application[], meta }
// Application shape: id, status, userId, expertise, experience, createdAt,
//   user: { id, fullName, email, avatarUrl }

// PATCH — approve/reject
Body: { approved: boolean, reviewNote?: string }
// approved=true → user.role = 'INSTRUCTOR', creates InstructorProfile
// approved=false → application.status = 'REJECTED'
Throws: APPLICATION_NOT_FOUND, APPLICATION_ALREADY_REVIEWED
```

### 2.4 Course Reviews — `GET /admin/courses/pending` + `PATCH /admin/courses/:id/review`

```typescript
// GET — pending review courses
Query: { page?, limit? }
Response: { data: Course[], meta }
// Course shape: id, title, price, status, createdAt, updatedAt,
//   instructor: { id, fullName }, category: { id, name }, _count: { sections }

// PATCH — approve/reject
Body: { approved: boolean, feedback?: string }
// approved=true → status = 'PUBLISHED', creates discussion group
// approved=false → status = 'REJECTED'
Throws: COURSE_NOT_FOUND, COURSE_NOT_PENDING_REVIEW
```

### 2.5 Withdrawals — `GET /admin/withdrawals` + `PATCH /admin/withdrawals/:id`

```typescript
// GET — pending only
Query: { page?, limit? }
Response: { data: Withdrawal[], meta }
// Withdrawal shape: id, amount, status, createdAt,
//   instructor: { id, fullName, email }

// PATCH — process
Body: { status: 'COMPLETED'|'REJECTED', reviewNote?: string }
Throws: WITHDRAWAL_NOT_FOUND, WITHDRAWAL_NOT_PENDING
```

### 2.6 Categories — `POST/PATCH/DELETE /admin/categories`

```typescript
// POST — create
Body: { name: string, description?: string, iconUrl?: string, parentId?: string, order?: number }
Response: { id, name, slug, description, iconUrl, parentId, order }

// PATCH — update
Body: same as POST (partial)

// DELETE
Throws: CATEGORY_HAS_COURSES
```

### 2.7 Tags — `POST/PATCH/DELETE /admin/tags`

```typescript
// POST/PATCH
Body: { name: string }
Response: { id, name, slug }

// DELETE
Throws: TAG_HAS_COURSES
```

### 2.8 Settings — `GET/PUT /admin/settings`

```typescript
// GET — all settings
Response: Array<{ id, key, value, createdAt, updatedAt }>

// PUT — upsert one setting
Body: { key: string, value: unknown }
```

---

## 3. SERVICE LAYER

### File: `packages/shared-hooks/src/services/admin.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const adminService = {
  // Dashboard
  getDashboard: () => apiClient.get('/admin/dashboard'),

  // Users
  getUsers: (params: Record<string, string>) => apiClient.get('/admin/users', params),
  updateUserStatus: (userId: string, data: { status: string; reason?: string }) =>
    apiClient.patch(`/admin/users/${userId}/status`, data),

  // Applications
  getPendingApplications: (params: Record<string, string>) =>
    apiClient.get('/admin/applications', params),
  reviewApplication: (appId: string, data: { approved: boolean; reviewNote?: string }) =>
    apiClient.patch(`/admin/applications/${appId}`, data),

  // Courses
  getPendingCourses: (params: Record<string, string>) =>
    apiClient.get('/admin/courses/pending', params),
  reviewCourse: (courseId: string, data: { approved: boolean; feedback?: string }) =>
    apiClient.patch(`/admin/courses/${courseId}/review`, data),

  // Withdrawals
  getPendingWithdrawals: (params: Record<string, string>) =>
    apiClient.get('/admin/withdrawals', params),
  processWithdrawal: (withdrawalId: string, data: { status: string; reviewNote?: string }) =>
    apiClient.patch(`/admin/withdrawals/${withdrawalId}`, data),

  // Categories
  getCategories: () => apiClient.get('/categories'),
  createCategory: (data: { name: string; description?: string; parentId?: string; order?: number }) =>
    apiClient.post('/admin/categories', data),
  updateCategory: (id: string, data: { name?: string; description?: string; order?: number }) =>
    apiClient.patch(`/admin/categories/${id}`, data),
  deleteCategory: (id: string) => apiClient.del(`/admin/categories/${id}`),

  // Tags
  createTag: (data: { name: string }) => apiClient.post('/admin/tags', data),
  updateTag: (id: string, data: { name: string }) => apiClient.patch(`/admin/tags/${id}`, data),
  deleteTag: (id: string) => apiClient.del(`/admin/tags/${id}`),

  // Settings
  getSettings: () => apiClient.get('/admin/settings'),
  updateSetting: (data: { key: string; value: unknown }) => apiClient.put('/admin/settings', data),
};
```

---

## 4. QUERY HOOKS

### File: `packages/shared-hooks/src/queries/use-admin.ts`

One file with all admin hooks (admin module is self-contained):

```typescript
// Queries
useAdminDashboard()           → queryKey: ['admin', 'dashboard']
useAdminUsers(params)         → queryKey: ['admin', 'users', params]
useAdminPendingApps(params)   → queryKey: ['admin', 'applications', params]
useAdminPendingCourses(params)→ queryKey: ['admin', 'courses', params]
useAdminWithdrawals(params)   → queryKey: ['admin', 'withdrawals', params]
useAdminSettings()            → queryKey: ['admin', 'settings']

// Mutations (all with onSuccess invalidation + onError toast)
useUpdateUserStatus()    → invalidate ['admin', 'users'] + ['admin', 'dashboard']
useReviewApplication()   → invalidate ['admin', 'applications'] + ['admin', 'dashboard']
useReviewCourse()        → invalidate ['admin', 'courses'] + ['admin', 'dashboard']
useProcessWithdrawal()   → invalidate ['admin', 'withdrawals'] + ['admin', 'dashboard']
useCreateCategory()      → invalidate ['categories']
useUpdateCategory()      → invalidate ['categories']
useDeleteCategory()      → invalidate ['categories']
useCreateTag()           → invalidate ['admin', 'tags']
useUpdateTag()           → invalidate ['admin', 'tags']
useDeleteTag()           → invalidate ['admin', 'tags']
useUpdateSetting()       → invalidate ['admin', 'settings']
```

---

## 5. PAGE-BY-PAGE IMPLEMENTATION

### 5.1 Dashboard (`admin/dashboard/page.tsx`)

**Replace:** Mock stats → `useAdminDashboard()`

**UI structure:**
- 4 stat cards: totalUsers, totalCourses, totalRevenue (formatPrice), todayOrders
- Pending approvals section: 4 clickable cards (instructorApps, courseReviews, reports, withdrawals) → link to respective pages
- Top courses table: title, totalStudents, avgRating

**Loading:** Skeleton cards + skeleton table

### 5.2 Users (`admin/users/page.tsx`)

**Replace:** Mock users → `useAdminUsers(params)` server-side

**Features:**
- Debounced search (fullName + email)
- Role filter: All / Student / Instructor / Admin
- Status filter: All / Active / Suspended
- DataTable columns: Avatar+Name, Email, Role (Badge), Status (Badge), Joined, Courses, Actions
- Actions: Suspend/Activate button → ConfirmDialog with optional reason textarea
- ⚠️ Cannot modify ADMIN accounts (hide action button)

### 5.3 Instructor Applications (`admin/approvals/instructors/page.tsx`)

**Replace:** Mock apps → `useAdminPendingApps(params)` server-side

**Features:**
- DataTable: Avatar+Name, Email, Expertise, Applied Date, Actions
- Actions: Approve (green) / Reject (red) buttons
- Approve → ConfirmDialog "Approve this application?"
- Reject → ConfirmDialog with reviewNote textarea
- After action: invalidate + show toast
- Click row → expand/dialog showing full application details (experience, bio)

### 5.4 Course Reviews (`admin/approvals/courses/page.tsx`)

**Replace:** Mock courses → `useAdminPendingCourses(params)` server-side

**Features:**
- DataTable: Title, Instructor, Category, Price, Submitted Date, Sections count, Actions
- Actions: View (Eye → navigate to instructor course detail page), Approve, Reject
- Approve → ConfirmDialog
- Reject → ConfirmDialog with feedback textarea
- View → `router.push(`/instructor/courses/${courseId}`)` (reuse course detail page from 5.14c)

### 5.5 Withdrawals (`admin/withdrawals/page.tsx`)

**Replace:** Mock withdrawals → `useAdminWithdrawals(params)` server-side

**Features:**
- DataTable: Instructor Name, Email, Amount (formatPrice), Requested Date, Actions
- Actions: Approve / Reject buttons
- Approve → ConfirmDialog "Approve withdrawal of {amount}?"
- Reject → ConfirmDialog with reviewNote textarea

### 5.6 Categories (`admin/categories/page.tsx`)

**Replace:** Mock categories → `useCategories()` (public endpoint, already exists)

**Features:**
- DataTable: Name, Slug, Course Count, Description, Actions
- Add Category: Dialog with name + description inputs → `useCreateCategory()`
- Edit: Inline or dialog → `useUpdateCategory()`
- Delete: ConfirmDialog → `useDeleteCategory()`. Disabled if courseCount > 0
- Also manage Tags: Tab or separate section with similar CRUD

### 5.7 Reports (`admin/reports/page.tsx`)

**Note:** Backend has `ReviewReportDto` but reports controller may be limited.
Check `GET /admin/reports` endpoint exists. If not, show placeholder.

### 5.8 Settings (`admin/settings/page.tsx`)

**Replace:** Mock settings → `useAdminSettings()` + `useUpdateSetting()`

**Features:**
- Load all settings as key-value pairs
- Group by category (general, commission, etc.)
- Each setting: label + input/toggle based on value type
- Save button per setting or per group → `updateSetting({ key, value })`

---

## 6. IMPLEMENTATION ORDER

```
Step 1: Create admin.service.ts + use-admin.ts (service + hooks)
Step 2: Wire dashboard page
Step 3: Wire users page (search + filter + suspend/activate)
Step 4: Wire instructor applications page (approve/reject)
Step 5: Wire course reviews page (approve/reject + view detail)
Step 6: Wire withdrawals page (approve/reject)
Step 7: Wire categories page (CRUD)
Step 8: Wire settings page
Step 9: Add missing i18n keys
Step 10: Lint + verify
```

**Estimated: ~15 files modified/created**

---

## 7. FILES TO CREATE/MODIFY

### New files:
| File | Purpose |
|------|---------|
| `packages/shared-hooks/src/services/admin.service.ts` | Admin API service layer |
| `packages/shared-hooks/src/queries/use-admin.ts` | Admin TanStack Query hooks |

### Modified files:
| File | Changes |
|------|---------|
| `packages/shared-hooks/src/services/index.ts` | Export adminService |
| `packages/shared-hooks/src/index.ts` | Export admin hooks |
| `apps/management-portal/src/app/[locale]/admin/dashboard/page.tsx` | Wire to real API |
| `apps/management-portal/src/app/[locale]/admin/users/page.tsx` | Wire to real API |
| `apps/management-portal/src/app/[locale]/admin/approvals/instructors/page.tsx` | Wire to real API |
| `apps/management-portal/src/app/[locale]/admin/approvals/courses/page.tsx` | Wire to real API |
| `apps/management-portal/src/app/[locale]/admin/withdrawals/page.tsx` | Wire to real API |
| `apps/management-portal/src/app/[locale]/admin/categories/page.tsx` | Wire to real API |
| `apps/management-portal/src/app/[locale]/admin/settings/page.tsx` | Wire to real API |
| `apps/management-portal/messages/vi.json` | Add missing admin i18n keys |
| `apps/management-portal/messages/en.json` | Add missing admin i18n keys |

---

## 8. KEY IMPLEMENTATION NOTES

1. **Admin guards already in place** — `admin/layout.tsx` checks `user.role === 'ADMIN'`
2. **Sidebar admin nav already configured** — all menu items point to correct routes
3. **DataTable server-side mode available** — reuse pattern from instructor courses page
4. **ConfirmDialog with portal available** — reuse from 5.14c
5. **Course detail page reusable** — admin can view course detail at `/instructor/courses/:id`
6. **formatPrice already in @shared/utils** — use for all monetary values
7. **~80 error codes already localized** — from Phase 5.14c
8. **Mock data exists for reference** — use mock-data.ts interfaces as type reference, then replace with real API data

---

## 9. WHAT WAS ACTUALLY IMPLEMENTED (beyond original plan)

### 9.1 Admin Courses List and Detail Pages (new, unplanned)

**Problem discovered during implementation:** The original plan noted "admin courses list (separate phase)" but in practice the admin needed to view any instructor's course to make approval decisions. Using `/instructor/courses/:id` for this failed because that page's backend endpoint (`GET /courses/:id`) enforced ownership — it returned 403 when an admin (who is not the course owner) tried to fetch it.

**Solution — two new backend endpoints:**

| Endpoint | Controller | Service method |
|----------|-----------|----------------|
| `GET /admin/courses` | `admin-courses.controller.ts` | `getAllCourses(params)` |
| `GET /admin/courses/:id` | `admin-courses.controller.ts` | `getCourseDetail(courseId)` |

These endpoints skip ownership validation entirely (guarded by `AdminGuard` instead of checking `instructorId === user.sub`). They return the same shape as the instructor equivalents so existing UI components could be reused.

**Two new frontend pages created:**

| File | Route | Purpose |
|------|-------|---------|
| `apps/management-portal/src/app/[locale]/admin/courses/page.tsx` | `/admin/courses` | Browse all courses across all instructors with status filter |
| `apps/management-portal/src/app/[locale]/admin/courses/[courseId]/page.tsx` | `/admin/courses/:id` | View full course detail (chapters, sections, lessons) without ownership restriction |

The approvals/courses page now links to `/admin/courses/:id` instead of `/instructor/courses/:id`.

**New service methods added to `admin.service.ts`:**
```typescript
getAllCourses: (params) => apiClient.get('/admin/courses', params),
getCourseDetail: (courseId: string) => apiClient.get(`/admin/courses/${courseId}`),
```

**New hooks added to `use-admin.ts`:**
```typescript
useAdminCourses(params)      → queryKey: ['admin', 'all-courses', params]
useAdminCourseDetail(id)     → queryKey: ['admin', 'course-detail', id]
```

### 9.2 ConfirmDialog `children` Prop Addition

**Problem:** The original `ConfirmDialog` component only rendered a static description string. Several admin actions (reject instructor application, reject course review, reject withdrawal, suspend user) require the admin to enter a reason/feedback before confirming. There was no way to embed a textarea inside the dialog.

**Solution — added optional `children` prop to `ConfirmDialog`:**

```typescript
// Before
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  // ...
}

// After — children rendered between description and action buttons
interface ConfirmDialogProps {
  // ... same as before
  children?: React.ReactNode;   // ← new
}
```

Usage pattern for reject actions:
```tsx
<ConfirmDialog
  open={rejectOpen}
  onOpenChange={setRejectOpen}
  title={t('rejectCourse')}
  description={t('rejectCourseDescription')}
  onConfirm={handleReject}
  variant="destructive"
>
  <Textarea
    placeholder={t('feedbackPlaceholder')}
    value={feedback}
    onChange={(e) => setFeedback(e.target.value)}
  />
</ConfirmDialog>
```

This pattern was applied to: reject instructor application (`reviewNote`), reject course review (`feedback`), reject withdrawal (`reviewNote`), suspend user (`reason`).

### 9.3 Updated Files List

#### New files (beyond original plan):
| File | Purpose |
|------|---------|
| `apps/management-portal/src/app/[locale]/admin/courses/page.tsx` | Admin courses list — all courses across all instructors |
| `apps/management-portal/src/app/[locale]/admin/courses/[courseId]/page.tsx` | Admin course detail — no ownership restriction |

#### Modified files (beyond original plan):
| File | Changes |
|------|---------|
| `apps/api/src/modules/admin/courses/admin-courses.controller.ts` | Added `GET /` and `GET /:id` routes |
| `apps/api/src/modules/admin/courses/admin-courses.service.ts` | Added `getAllCourses()` and `getCourseDetail()` methods |
| `apps/management-portal/src/components/feedback/confirm-dialog.tsx` | Added `children?: React.ReactNode` prop |

### 9.4 Commits

| Commit | Scope | Description |
|--------|-------|-------------|
| `b0b1694` | api | Add admin course list and detail endpoints |
| `a4187db` | shared | Add admin service layer and query hooks |
| `fe18dd7` | management | Wire admin panel pages to real API |
