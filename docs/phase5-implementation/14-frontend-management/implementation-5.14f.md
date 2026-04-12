# Phase 5.14f — Admin Reports, Analytics & Remaining Pages

> Wire remaining mock-data pages to real API: Admin Reports, Admin Analytics,
> Admin Approvals hub, and Instructor Curriculum redirect.

---

## 1. OVERVIEW

### Scope

4 pages still use mock data from `@/lib/mock-data`. This phase replaces all with real API calls.

| Page | Current State | Target |
|------|---------------|--------|
| `/admin/reports` | Full mock data (contentReports, userReports) | Wire to `GET/PATCH /admin/reports` |
| `/admin/analytics` | Full mock data (adminUserGrowth, etc.) | Wire to `GET /admin/analytics` + dashboard stats |
| `/admin/approvals` | Mock counts from instructorApplications/pendingCourseReviews | Use `useAdminDashboard()` for real counts |
| `/instructor/courses/[id]/curriculum` | Mock curriculumSections | Delete page (CourseWizard in edit page handles curriculum) |

### Backend Endpoints (Already Exist)

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/admin/reports` | List reports with filters | `{ data: Report[], meta }` |
| PATCH | `/admin/reports/:id` | Review report | `Report` |
| GET | `/admin/analytics` | Analytics by type & date range | `AnalyticsSnapshot[]` |
| GET | `/admin/dashboard` | Platform stats (already used) | `{ overview, pendingApprovals, topCourses }` |

### Backend DTOs

**QueryReportsDto** (GET /admin/reports):
```typescript
{
  page?: number;     // default 1
  limit?: number;    // default 10
  status?: 'PENDING' | 'REVIEWED' | 'ACTION_TAKEN' | 'DISMISSED';
  targetType?: 'POST' | 'COMMENT' | 'USER' | 'COURSE' | 'QUESTION';
}
```

**ReviewReportDto** (PATCH /admin/reports/:id):
```typescript
{
  status: 'REVIEWED' | 'ACTION_TAKEN' | 'DISMISSED';  // required
  adminNote?: string;                                   // optional, max 1000
}
```

**Analytics query params** (GET /admin/analytics):
```
type: AnalyticsType (DAILY_USERS | DAILY_REVENUE | DAILY_ENROLLMENTS | DAILY_COURSES)
from: ISO date string
to: ISO date string
```

**AnalyticsSnapshot response:**
```typescript
{
  id: string;
  date: Date;      // YYYY-MM-DD
  type: string;    // AnalyticsType
  data: Json;      // flexible JSON, e.g. { students: 5, instructors: 1 } or { revenue: 150000 }
}
```

---

## 2. SHARED LAYER CHANGES

### 2.1 admin.service.ts — Add 2 methods

```typescript
// Reports
getReports: (params: Record<string, string>) =>
  apiClient.get('/admin/reports', params),
reviewReport: (id: string, data: { status: string; adminNote?: string }) =>
  apiClient.patch(`/admin/reports/${id}`, data),

// Analytics
getAnalytics: (params: { type: string; from: string; to: string }) =>
  apiClient.get('/admin/analytics', params as unknown as Record<string, string>),
```

### 2.2 use-admin.ts — Add 2 hooks

```typescript
// Query
export function useAdminReports(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'reports', params],
    queryFn: () => adminService.getReports(params),
  });
}

// Mutation
export function useReviewReport() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; adminNote?: string } }) =>
      adminService.reviewReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      toast.success('Report reviewed');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
```

### 2.3 index.ts — Export new hooks

Add `useAdminReports`, `useReviewReport` to exports.

---

## 3. ADMIN REPORTS PAGE

### File: `apps/management-portal/src/app/[locale]/admin/reports/page.tsx`

**Replace mock data with `useAdminReports()` + `useReviewReport()`.**

**UI Layout (keep existing structure):**
```
Reports
[Content | Users] (tabs by targetType filter)

┌── DataTable ──────────────────────────────────────┐
│ Reporter │ Type │ Content │ Reason │ Date │ Status │ Actions │
├──────────┼──────┼─────────┼────────┼──────┼────────┼─────────┤
│ User A   │ POST │ "Lorem" │ Spam   │ 3/21 │ Pending│ 👁 ✕ 🛑│
└──────────┴──────┴─────────┴────────┴──────┴────────┴─────────┘
```

**Key changes:**
1. Replace `contentReports` / `userReports` mock imports with `useAdminReports(params)`
2. `params` built from: `{ page, limit: '10', status: statusFilter, targetType: tabFilter }`
3. Tab "Content" → filter `targetType` = `POST,COMMENT,COURSE,QUESTION`
4. Tab "Users" → filter `targetType` = `USER`
5. Status filter badges: ALL, PENDING, REVIEWED, ACTION_TAKEN, DISMISSED
6. Review actions open dialog with status select + adminNote textarea
7. Action buttons:
   - Eye (review detail) → open dialog
   - XCircle (dismiss) → `useReviewReport({ status: 'DISMISSED' })`
   - ShieldBan (take action) → `useReviewReport({ status: 'ACTION_TAKEN', adminNote })`
8. Use `data?.meta` for pagination
9. Loading skeleton while fetching
10. Empty state when no reports

**Report response shape (from backend):**
```typescript
interface Report {
  id: string;
  reporterId: string;
  targetType: 'POST' | 'COMMENT' | 'USER' | 'COURSE' | 'QUESTION';
  targetId: string;
  reason: string;
  description?: string;
  status: 'PENDING' | 'REVIEWED' | 'ACTION_TAKEN' | 'DISMISSED';
  createdAt: string;
  reporter: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}
```

**Review dialog:**
```tsx
<Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
  <DialogContent>
    <DialogHeader><DialogTitle>{t('reviewReport')}</DialogTitle></DialogHeader>
    <Select value={reviewStatus} onValueChange={setReviewStatus}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="REVIEWED">{t('reviewed')}</SelectItem>
        <SelectItem value="ACTION_TAKEN">{t('actionTaken')}</SelectItem>
        <SelectItem value="DISMISSED">{t('dismissed')}</SelectItem>
      </SelectContent>
    </Select>
    <Textarea
      value={adminNote}
      onChange={(e) => setAdminNote(e.target.value)}
      placeholder={t('adminNotePlaceholder')}
    />
    <Button onClick={handleReview} disabled={reviewMutation.isPending}>
      {t('submit')}
    </Button>
  </DialogContent>
</Dialog>
```

---

## 4. ADMIN ANALYTICS PAGE

### File: `apps/management-portal/src/app/[locale]/admin/analytics/page.tsx`

**Replace all mock data with real API calls.**

**Data sources:**
1. **Overview stats** → `useAdminDashboard()` — totalUsers, totalCourses, totalRevenue, newUsersThisWeek
2. **Chart data** → `GET /admin/analytics?type=X&from=DATE&to=DATE` — 4 separate calls

**4 charts, each with own AnalyticsType:**

| Chart | AnalyticsType | Data Keys | Chart Type |
|-------|---------------|-----------|------------|
| User Registrations | `DAILY_USERS` | `data.students`, `data.instructors` | Area |
| Revenue Trends | `DAILY_REVENUE` | `data.revenue` | Line |
| Enrollments | `DAILY_ENROLLMENTS` | `data.count` | Bar |
| New Courses | `DAILY_COURSES` | `data.count` | Bar |

**Date range calculation:**
```typescript
const ranges = {
  '7days': 7,
  '30days': 30,
  '3months': 90,
  '12months': 365,
};

const [dateRange, setDateRange] = useState('30days');

const { from, to } = useMemo(() => {
  const to = new Date().toISOString().split('T')[0]; // today
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - ranges[dateRange]);
  return { from: fromDate.toISOString().split('T')[0], to };
}, [dateRange]);
```

**Fetching strategy — 1 query per chart type, all in parallel:**
```typescript
// Custom hook to fetch analytics by type
function useAnalytics(type: string, from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'analytics', type, from, to],
    queryFn: () => adminService.getAnalytics({ type, from, to }),
  });
}

// In component:
const usersData = useAnalytics('DAILY_USERS', from, to);
const revenueData = useAnalytics('DAILY_REVENUE', from, to);
const enrollmentsData = useAnalytics('DAILY_ENROLLMENTS', from, to);
const coursesData = useAnalytics('DAILY_COURSES', from, to);
```

**Transform AnalyticsSnapshot[] → chart data:**
```typescript
// AnalyticsSnapshot has { date, data: Json }
// Transform for Recharts:
const chartData = snapshots?.map((s) => ({
  date: formatDate(s.date),  // "21/03"
  ...s.data,                 // spread { students: 5, instructors: 1 }
})) ?? [];
```

**NOTE:** Analytics data requires cron job `recordDailyAnalytics` to populate `analytics_snapshots` table. If no data exists yet, charts will be empty — show appropriate empty state: "No analytics data available. Data is collected daily."

**Fallback for empty data:**
If analytics table is empty (fresh install), show stat cards from dashboard data instead of empty charts.

---

## 5. ADMIN APPROVALS HUB PAGE

### File: `apps/management-portal/src/app/[locale]/admin/approvals/page.tsx`

**Minimal change: replace mock counts with `useAdminDashboard()` real counts.**

```typescript
// Before (mock):
import { instructorApplications, pendingCourseReviews } from '@/lib/mock-data';
const pendingInstructors = instructorApplications.filter(a => a.status === 'PENDING').length;
const pendingCourses = pendingCourseReviews.length;

// After (API):
const { data: dashboard } = useAdminDashboard();
const pendingInstructors = dashboard?.pendingApprovals?.instructorApps ?? 0;
const pendingCourses = dashboard?.pendingApprovals?.courseReviews ?? 0;
```

Also add pending reports and withdrawals counts:
```
4 cards grid:
- Instructor Applications (pendingApprovals.instructorApps)
- Course Reviews (pendingApprovals.courseReviews)
- Reports (pendingApprovals.reports)
- Withdrawals (pendingApprovals.withdrawals)
```

---

## 6. INSTRUCTOR CURRICULUM PAGE — DELETE

### Delete: `apps/management-portal/src/app/[locale]/instructor/courses/[courseId]/curriculum/page.tsx`

**This page duplicates CourseWizard functionality** (phase 5.14c already has full curriculum editing with sections/chapters/lessons API calls in the course edit wizard).

**Solution: Delete the page entirely.** Update any sidebar/navigation links that pointed to `/instructor/courses/[id]/curriculum` to point to `/instructor/courses/[id]/edit` instead.

---

## 7. i18n UPDATES

### Keys to add (en.json + vi.json):

```json
{
  "reports": {
    "reviewReport": "Review Report / Xem xét báo cáo",
    "reviewed": "Reviewed / Đã xem xét",
    "actionTaken": "Action Taken / Đã xử lý",
    "dismissed": "Dismissed / Bác bỏ",
    "adminNotePlaceholder": "Add a note... / Thêm ghi chú...",
    "submit": "Submit / Gửi",
    "noReports": "No reports / Không có báo cáo",
    "question": "Question / Câu hỏi",
    "user": "User / Người dùng"
  },
  "analytics": {
    "noData": "No analytics data available / Không có dữ liệu phân tích",
    "noDataDescription": "Data is collected daily / Dữ liệu được thu thập hàng ngày",
    "enrollments": "Enrollments / Đăng ký",
    "newCourses": "New Courses / Khóa học mới"
  },
  "approvals": {
    "reportsTitle": "Reports / Báo cáo vi phạm",
    "pendingReports": "pending reports / báo cáo chờ xử lý",
    "withdrawalsTitle": "Withdrawals / Rút tiền",
    "pendingWithdrawals": "pending withdrawals / yêu cầu rút tiền chờ duyệt"
  },
  "common": {
    "statusLabels": {
      "REVIEWED": "Reviewed / Đã xem xét",
      "ACTION_TAKEN": "Action Taken / Đã xử lý",
      "DISMISSED": "Dismissed / Bác bỏ"
    }
  }
}
```

---

## 8. CLEANUP

After all pages are wired, remove unused mock data from `apps/management-portal/src/lib/mock-data.ts`:
- `adminUserGrowth`
- `adminRevenueData`
- `adminCategoryDistribution`
- `completionData` (inline in analytics page)
- `contentReports`
- `userReports`
- `instructorApplications` (used only in approvals hub)
- `pendingCourseReviews` (used only in approvals hub)
- `curriculumSections`

If no other pages import from mock-data, consider removing the file entirely.

---

## 9. FILES SUMMARY

### Created: 0 files

### Modified:
| File | Changes |
|------|---------|
| `packages/shared-hooks/src/services/admin.service.ts` | + `getReports()`, `reviewReport()`, `getAnalytics()` |
| `packages/shared-hooks/src/queries/use-admin.ts` | + `useAdminReports()`, `useReviewReport()` |
| `packages/shared-hooks/src/index.ts` | + export new hooks |
| `apps/management-portal/.../admin/reports/page.tsx` | Replace mock → API |
| `apps/management-portal/.../admin/analytics/page.tsx` | Replace mock → API + dashboard |
| `apps/management-portal/.../admin/approvals/page.tsx` | Replace mock counts → dashboard API |
| `apps/management-portal/.../instructor/courses/[courseId]/curriculum/page.tsx` | Redirect to edit |
| `apps/management-portal/messages/en.json` | + report review, analytics, approval i18n keys |
| `apps/management-portal/messages/vi.json` | + report review, analytics, approval i18n keys |
| `apps/management-portal/src/lib/mock-data.ts` | Remove unused exports |

### Commits (3):
1. `feat(shared): add admin reports and analytics service methods and hooks`
2. `feat(management): wire admin reports, analytics and approvals hub to api`
3. `chore(management): remove unused mock data and redirect curriculum page`

---

## 10. VERIFICATION

- [ ] Reports page loads with real data from GET /admin/reports
- [ ] Status filter tabs filter by report status
- [ ] Content/Users tab filters by targetType
- [ ] Review dialog works — can dismiss/action/review with note
- [ ] Analytics page shows charts from GET /admin/analytics
- [ ] Date range selector changes query params and refetches
- [ ] Empty state shown when no analytics data
- [ ] Approvals hub shows real pending counts from dashboard API
- [ ] Approvals hub has 4 cards (instructors, courses, reports, withdrawals)
- [ ] Curriculum page redirects to course edit
- [ ] No more imports from @/lib/mock-data in any page
- [ ] All text uses i18n
- [ ] Dark mode works
- [ ] No TypeScript errors
