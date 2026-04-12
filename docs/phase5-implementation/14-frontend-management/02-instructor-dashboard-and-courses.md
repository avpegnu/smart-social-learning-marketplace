# 02 — Instructor Dashboard & Course List: API Integration, Server-Side DataTable, Auth Loop Fixes

> Giải thích chi tiết Phase 5.14b — instructor dashboard wired với real API,
> course list với server-side pagination, DataTable extension, và 5 bug fixes
> (hydration guards, auth loop, unauthorized route conflict, STUDENT role, formatPrice).

---

## 1. TỔNG QUAN

### 1.1 Bài toán

Dashboard và courses page dùng mock data từ `lib/mock-data.ts`:
- Stats hardcoded ("₫12,450,000", "156", "5", "4.7")
- Courses list là array tĩnh, search/filter chỉ client-side
- DataTable chỉ hỗ trợ client-side pagination
- Import `formatCurrency` từ mock-data thay vì shared utils

Ngoài ra, phát hiện **5 bugs** khi test thực tế:
1. Infinite loop khi login (hydration timing)
2. Infinite loop khi STUDENT login (unauthorized ↔ dashboard)
3. "Back to Login" trên unauthorized page gây loop
4. Unauthorized page nằm sai route group
5. Import function từ mock-data

### 1.2 Giải pháp

```
Layer 1: Shared API Hooks
  ├── use-instructor.ts — 4 hooks (dashboard, profile, updateProfile, application)
  └── use-courses.ts   — 7 hooks (list, detail, create, update, delete, submit, tags)

Layer 2: Dashboard Page
  └── Real API data → StatCards + courseStats table + recentEarnings list

Layer 3: Courses Page
  ├── Server-side search (debounced) + status filter
  ├── Server-side pagination via DataTable extension
  └── ConfirmDialog for delete + submit

Layer 4: Bug Fixes
  ├── useAuthHydrated in all 4 layouts/pages
  ├── unauthorized moved out of (auth) route group
  ├── Auth layout only redirects INSTRUCTOR/ADMIN
  ├── "Back to Login" → logout first
  └── formatPrice from @shared/utils
```

---

## 2. PLAN vs REALITY — Backend Response

### 2.1 Dashboard API — Plan sai, thực tế khác

**Plan giả định:**
```typescript
{
  totalRevenue, totalStudents, publishedCourses, averageRating,
  revenueGrowth, studentGrowth,      // ← Không tồn tại
  revenueByMonth: [...],             // ← Không tồn tại
  recentEnrollments: [...],          // ← Không tồn tại
  topCourses: [{ enrollmentCount, revenue }]  // ← Sai fields
}
```

**Backend thực tế (`instructor.service.ts → getDashboard`):**
```typescript
{
  overview: {
    totalRevenue,       // Từ InstructorProfile
    totalStudents,      // Từ InstructorProfile
    totalCourses,       // Count courses (not deleted)
    availableBalance,   // Aggregate Earning (status AVAILABLE)
    pendingBalance,     // Aggregate Earning (status PENDING)
  },
  recentEarnings: [{    // 10 recent earnings (30 days)
    id, netAmount, createdAt,
    orderItem: { title, price },
  }],
  courseStats: [{       // Top 10 by students
    id, title, totalStudents, avgRating,
  }],
}
```

**Key differences:**
- Không có `revenueGrowth` / `studentGrowth` — backend không tính growth %
- Không có `revenueByMonth` — không có chart data (bỏ ChartWidget)
- Thay `recentEnrollments` bằng `recentEarnings` (từ Earning model)
- Thêm `availableBalance` / `pendingBalance` (quan trọng cho instructor)

### 2.2 Tại sao quan trọng phải check backend trước?

Plan viết dựa trên design doc. Backend implement có thể khác:
- Service method chọn fields khác
- Prisma query JOIN khác (include vs select)
- Business logic thay đổi (revenue tính từ Earning, không từ Order)

**Rule:** Luôn đọc `*.service.ts` + `*.controller.ts` trước khi implement frontend.

---

## 3. SHARED API HOOKS — apiClient.get() Gotcha

### 3.1 Flat params, không phải { params }

```typescript
// ❌ SAI — apiClient.get() không nhận nested object
apiClient.get('/instructor/courses', { params: { page: 1 } })

// ✅ ĐÚNG — apiClient.get() nhận flat Record<string, string>
apiClient.get('/instructor/courses', { page: '1', status: 'DRAFT' })
```

**Lý do:** `apiClient.get()` implementation:
```typescript
async get<T>(path: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return this.fetch<T>(`${path}${query}`);
}
```

`new URLSearchParams()` chỉ nhận flat key-value strings.

### 3.2 Convert params trong hook

```typescript
export function useInstructorCourses(params?: CourseListParams) {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = String(params.page);
  if (params?.limit) queryParams.limit = String(params.limit);
  if (params?.status) queryParams.status = params.status;
  if (params?.search) queryParams.search = params.search;

  return useQuery({
    queryKey: ['instructor', 'courses', params],  // Original params for cache key
    queryFn: () => apiClient.get('/instructor/courses', queryParams),  // Flat params for URL
  });
}
```

**queryKey dùng `params` gốc** (object) — TanStack Query dùng deep equality cho cache.
**queryFn dùng `queryParams`** (flat strings) — apiClient cần strings cho URLSearchParams.

### 3.3 Delete invalidates dashboard

```typescript
export function useDeleteCourse() {
  return useMutation({
    mutationFn: (courseId: string) => apiClient.del(`/instructor/courses/${courseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard'] });
    },
  });
}
```

Delete course → `totalCourses` giảm → dashboard stats thay đổi → invalidate cả 2.

---

## 4. DataTable — Server-Side Mode

### 4.1 Backward-Compatible Extension

Thêm optional props. Khi KHÔNG truyền → client-side (unchanged). Khi truyền → server-side.

```typescript
// Detection: server mode khi cả 2 props có mặt
const isServerMode = serverPage !== undefined && onServerPageChange !== undefined;
```

### 4.2 Client-Side vs Server-Side

| Feature | Client-Side | Server-Side |
|---------|-------------|-------------|
| Data source | `data` prop (full array) | `data` prop (current page only) |
| Filtering | Client filter by `searchKey` | API filter (parent controls) |
| Pagination | Client slice | API pagination (parent controls `serverPage`) |
| Loading | None | Skeleton rows when `isLoading` |
| Page index | 0-based internal | 1-based `serverPage` (converted internally) |
| Total items | `filteredData.length` | `serverTotal` prop |

### 4.3 Loading Skeleton

```tsx
{isLoading ? (
  Array.from({ length: pageSize }).map((_, i) => (
    <TableRow key={i}>
      {columns.map((col) => (
        <TableCell key={col.key}>
          <Skeleton className="h-5 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ))
) : /* ... render data */}
```

Skeleton rows match cấu trúc cột — user thấy layout giống data thật.

### 4.4 Server Page Index Conversion

```typescript
// Server pages are 1-indexed (from API meta)
// Internal state is 0-indexed (for array slicing)
const currentPage = isServerMode ? (serverPage ?? 1) - 1 : clientPage;

const handlePageChange = (newPage: number) => {
  if (isServerMode) {
    onServerPageChange!(newPage + 1); // Convert back to 1-indexed
  } else {
    setClientPage(newPage);
  }
};
```

Backend pagination dùng `page: 1, 2, 3...` (1-indexed).
Frontend DataTable dùng `0, 1, 2...` internally cho array operations.

---

## 5. CONFIRM DIALOG — Reusable Pattern

### 5.1 Design

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;   // Default: t('common.confirm')
  onConfirm: () => void;
  isLoading?: boolean;      // Disable buttons + show spinner
  variant?: 'destructive' | 'default';  // Red or blue confirm button
}
```

### 5.2 Usage pattern — Open/Close with target ID

```tsx
const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

// Open: set target course ID
<Button onClick={() => setDeleteTarget(course.id)}>Delete</Button>

// Dialog: open when target is set
<ConfirmDialog
  open={!!deleteTarget}
  onOpenChange={(open) => !open && setDeleteTarget(null)}
  onConfirm={() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget, {
        onSuccess: () => setDeleteTarget(null),  // Close on success
      });
    }
  }}
/>
```

**Pattern:** `useState<string | null>(null)` thay vì `useState<boolean>(false)`.
Vừa track open state VÀ target ID trong 1 state variable.

---

## 6. BUG FIXES — Chi tiết

### 6.1 Hydration Guards — useAuthHydrated ở tất cả layouts

**Timeline TRƯỚC fix:**
```
F5 → Zustand default: { isAuthenticated: false }
  → Instructor layout useEffect: "not authenticated → redirect /login"
  → Auth layout: "authenticated (hydrated) → redirect /instructor/dashboard"
  → LOOP!
```

**Timeline SAU fix:**
```
F5 → hydrated = false → all layouts return null (blank)
  → Zustand hydrate (~50ms) → hydrated = true
  → Instructor layout: "authenticated + INSTRUCTOR → render dashboard"
  → No redirect, no loop ✅
```

4 files cần `useAuthHydrated()`:
- `(auth)/layout.tsx` — chờ hydrate trước khi redirect authenticated users
- `instructor/layout.tsx` — chờ hydrate trước khi check role
- `admin/layout.tsx` — chờ hydrate trước khi check role
- `[locale]/page.tsx` — chờ hydrate trước khi redirect to dashboard

### 6.2 Unauthorized Route Group Conflict

```
TRƯỚC:
  app/[locale]/(auth)/
    ├── layout.tsx          ← "IF authenticated → redirect to dashboard"
    ├── login/page.tsx
    └── unauthorized/page.tsx ← Cần authenticated user xem → CONFLICT!

SAU:
  app/[locale]/(auth)/
    ├── layout.tsx          ← "IF authenticated → redirect to dashboard"
    └── login/page.tsx
  app/[locale]/unauthorized/
    └── page.tsx            ← Standalone, no auth layout → NO CONFLICT
```

**Root cause:** `(auth)` route group dành cho GUEST pages (login, register).
`/unauthorized` là page cho AUTHENTICATED users có sai role. Hai mục đích
ngược nhau → không thể cùng route group.

### 6.3 Auth Layout — STUDENT Role

**TRƯỚC:**
```typescript
if (isAuthenticated && user) {
  if (user.role === 'ADMIN') router.replace('/admin/dashboard');
  else router.replace('/instructor/dashboard');  // ← STUDENT cũng vào đây!
}
```

STUDENT login → auth layout redirect `/instructor/dashboard` → instructor layout
reject (not INSTRUCTOR) → redirect `/unauthorized` → auth layout redirect lại → LOOP.

**SAU:**
```typescript
if (user.role === 'ADMIN') router.replace('/admin/dashboard');
else if (user.role === 'INSTRUCTOR') router.replace('/instructor/dashboard');
// STUDENT: no redirect → they stay on /unauthorized
```

### 6.4 "Back to Login" — Logout trước

**TRƯỚC:** `<Link href="/login">` — user vẫn authenticated → auth layout redirect.

**SAU:**
```typescript
logoutMutation.mutate(undefined, {
  onSettled: () => {
    window.location.href = '/login';  // Full reload after logout
  },
});
```

`onSettled` (không phải `onSuccess`) — logout phải clear session DÙ API fail.
`window.location.href` (không phải `router.push`) — full reload xóa mọi client state.

### 6.5 formatPrice từ @shared/utils

**TRƯỚC:**
```typescript
import { formatCurrency } from '@/lib/mock-data';
```

**SAU:**
```typescript
import { formatPrice } from '@shared/utils';
```

`@shared/utils` đã có `formatPrice(amount, locale)`. Thêm `formatDate(date, locale)`
cũng vào đây. Mock-data file chỉ nên dùng cho development preview, không import
vào production code.

---

## 7. SEARCH DEBOUNCE — UX Detail

```tsx
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

const { data, isLoading } = useInstructorCourses({
  search: debouncedSearch || undefined,
  page,
  ...
});
```

- `search` state cập nhật ngay khi user gõ (Input responsive)
- `debouncedSearch` chỉ thay đổi sau 300ms ngừng gõ
- API chỉ gọi khi `debouncedSearch` thay đổi (qua TanStack Query key)
- Tránh spam API request mỗi keystroke

`useDebounce` hook đã có sẵn từ `@shared/hooks` (Phase 5.12).

---

## 8. FILES CREATED / MODIFIED

### Created (3 files):

| File | Lines | Mục đích |
|------|-------|----------|
| `shared-hooks/src/api/use-instructor.ts` | 46 | 4 instructor hooks (dashboard, profile, application) |
| `shared-hooks/src/api/use-courses.ts` | 99 | 7 course CRUD hooks |
| `management-portal/src/components/confirm-dialog.tsx` | 56 | Reusable confirm dialog (destructive/default) |

### Modified — Management Portal (8 files):

| File | Changes |
|------|---------|
| `instructor/dashboard/page.tsx` | Mock → API (overview + courseStats + earnings), skeleton, formatPrice |
| `instructor/courses/page.tsx` | Mock → API, debounced search, server-side pagination, confirm dialogs |
| `data-display/data-table.tsx` | + server-side mode (isLoading, serverPage, searchValue, onSearchChange) |
| `(auth)/layout.tsx` | + useAuthHydrated, only redirect INSTRUCTOR/ADMIN (not STUDENT) |
| `instructor/layout.tsx` | + useAuthHydrated guard |
| `admin/layout.tsx` | + useAuthHydrated guard |
| `[locale]/page.tsx` | + useAuthHydrated guard |
| `unauthorized/page.tsx` | Moved from (auth)/, self-contained layout, logout before "Back to Login" |

### Modified — Shared Packages (2 files):

| File | Changes |
|------|---------|
| `shared-hooks/src/index.ts` | + export 11 hooks (4 instructor + 7 courses) |
| `shared-utils/src/index.ts` | + formatDate function |

### Modified — i18n (2 files):

| File | Changes |
|------|---------|
| `messages/vi.json` | + 11 keys (dashboard: availableBalance, recentEarnings, noCourses, noEarnings, courseTitle; courses: lessons, submitForReview, confirmDelete, confirmSubmit) |
| `messages/en.json` | Same 11 keys in English |
