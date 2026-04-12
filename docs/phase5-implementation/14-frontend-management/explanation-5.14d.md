# Phase 5.14d — Admin Panel: Explanation & Learnings

> Technical explanation of how Phase 5.14d was implemented,
> patterns used, problems encountered, and decisions made.

---

## 1. Wire Mock to Real API Pattern

Phase 5.12 created all admin pages with mock/hardcoded data so the UI could be reviewed without a working backend. Phase 5.14d systematically replaced every mock with real API calls by following a strict three-layer pattern:

```
Layer 1 — Service function (packages/shared-hooks/src/services/admin.service.ts)
  Plain async functions that call apiClient. No state, no hooks. Easily testable.

Layer 2 — Query hook (packages/shared-hooks/src/queries/use-admin.ts)
  TanStack Query wrappers around service functions.
  Each query has: queryKey, staleTime, enabled guard.
  Each mutation has: onSuccess invalidation + onError toast via useApiError.

Layer 3 — Page component (apps/management-portal/src/app/[locale]/admin/*/page.tsx)
  Calls hooks, passes data to UI components. No direct apiClient calls.
  Owns local UI state (filters, dialog open/close, form values).
```

The migration for each page followed the same checklist:
1. Remove the mock data array at the top of the file.
2. Replace `useState([...mockData])` with the appropriate query hook.
3. Thread `isLoading` into the DataTable `isLoading` prop.
4. Thread `meta.totalPages` / `meta.total` into the DataTable server-side props.
5. Replace inline action handlers with mutation hook calls.
6. Add toast on success via `t('successMessage')`.

---

## 2. Admin Course Viewing Problem

### Why the problem existed

The original plan explicitly deferred an admin courses list to a later phase. However, when wiring the course approvals page (`/admin/approvals/courses`), the "View" action needed to navigate to a course detail page. The natural choice was to reuse the instructor course detail page at `/instructor/courses/:id`.

This failed at the API level. The instructor course detail endpoint (`GET /courses/:id`) internally calls `coursesService.findById(courseId, userId)` which checks:

```typescript
if (course.instructorId !== userId) {
  throw new ForbiddenException({ code: 'COURSE_ACCESS_DENIED' });
}
```

An admin's `userId` is never the course owner, so every request returned 403.

### Solution: separate admin endpoints without ownership checks

Two new endpoints were added to `admin-courses.controller.ts`, guarded by `AdminGuard` (which verifies `user.role === 'ADMIN'`) rather than any ownership check:

- `GET /admin/courses` — lists all courses across all instructors, supports `page`, `limit`, `status`, and `search` query params
- `GET /admin/courses/:id` — returns full course detail including chapters, sections, and lesson list

The service methods (`getAllCourses`, `getCourseDetail`) are straightforward Prisma queries with no `where: { instructorId }` constraint. This is intentional and safe because the `AdminGuard` ensures only admins can reach these routes.

Two matching frontend pages were created:

- `/admin/courses` — DataTable of all courses with status filter (mirrors instructor courses list style from 5.14b but shows all instructors)
- `/admin/courses/:id` — Full course detail view reusing the same chapter/section/lesson UI components, but backed by the admin endpoint

The approvals/courses page "View" button was updated to navigate to `/admin/courses/:id` instead of `/instructor/courses/:id`.

---

## 3. ConfirmDialog with Custom Content

### The limitation

The existing `ConfirmDialog` component accepted a static `description` string. Admin reject actions need more than a yes/no confirmation — they require the admin to enter a reason or feedback that gets sent to the backend (`reviewNote`, `feedback`, `reason` fields).

Without `children` support, the options were:
- Create a separate dialog component for each reject action (high duplication)
- Build a generic "prompt dialog" with a built-in textarea (works but less flexible)
- Add `children?: React.ReactNode` to the existing component (minimal change, maximum flexibility)

### Implementation

The `children` prop was added to `ConfirmDialogProps` and rendered inside the dialog between the description text and the action buttons:

```tsx
// Inside ConfirmDialog render
<DialogDescription>{description}</DialogDescription>
{children}   {/* textarea, radio group, or any custom content */}
<DialogFooter>
  <Button onClick={onClose}>{cancelLabel}</Button>
  <Button onClick={onConfirm}>{confirmLabel}</Button>
</DialogFooter>
```

The calling component owns the state for the textarea value, passes it as `children`, and reads the accumulated value in its `onConfirm` callback:

```tsx
const [reason, setReason] = useState('');

<ConfirmDialog onConfirm={() => suspendUser({ userId, reason })}>
  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
</ConfirmDialog>
```

This pattern was applied to four actions: suspend user, reject instructor application, reject course review, reject withdrawal.

---

## 4. Server-Side DataTable Reuse

The `DataTable` component from `@shared/ui` supports two modes:

- **Client-side mode** — pass `data` array, component handles filtering/sorting/pagination internally
- **Server-side mode** — pass `data` (current page only), `serverPage`, `serverPageCount`, `onServerPageChange`, `isLoading`

All admin list pages use server-side mode because the datasets can be large and results must reflect real-time state (a user suspended by another admin should not appear active on a stale client page).

The pattern from 5.14b (instructor courses list) was copied verbatim for each admin page:

```typescript
const [page, setPage] = useState(1);
const { data, isLoading } = useAdminUsers({ page: String(page), limit: '20', search: debouncedSearch });

<DataTable
  columns={columns}
  data={data?.data ?? []}
  isLoading={isLoading}
  serverPage={page}
  serverPageCount={data?.meta.totalPages ?? 1}
  onServerPageChange={setPage}
/>
```

---

## 5. Debounced Search

The users page has a text input for searching by name or email. Firing an API request on every keystroke would cause excessive backend load and a degraded user experience (results flashing as the user types).

The solution uses a `useDebounce` hook (already in `@shared/hooks`) with a 300ms delay:

```typescript
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

// Only included in query params when non-empty, to avoid sending search=''
const { data } = useAdminUsers({
  page: String(page),
  ...(debouncedSearch ? { search: debouncedSearch } : {}),
});

// Reset to page 1 whenever the search term changes
useEffect(() => { setPage(1); }, [debouncedSearch]);
```

The `useEffect` page reset is important: without it, a user searching from page 5 would see page 5 of the new results, which is often empty and confusing.

---

## 6. Settings Key-Value Pattern

The settings API returns an array of `{ id, key, value }` objects. The value is typed as `unknown` because different settings can be strings, numbers, or booleans.

The page groups settings by a naming convention (keys prefixed with `general_`, `commission_`, etc.) and renders each setting as an appropriate input:

- String value → `<Input type="text" />`
- Number value → `<Input type="number" />`
- Boolean value → `<Switch />`

Each setting has its own "Save" button that fires `updateSetting({ key, value })` for that single setting only. This avoids the problem of a bulk "Save All" where a failed validation on one field blocks saving unrelated settings.

Local edit state is tracked per-key in a `Record<string, unknown>` map initialized from the API response. On successful save, the mutation's `onSuccess` invalidates `['admin', 'settings']` which re-fetches and resets the local state.

---

## 7. Category Tree Flattening

The categories API (`GET /categories`) returns a nested tree:

```json
[
  { "id": "1", "name": "Programming", "children": [
    { "id": "2", "name": "Web Development", "children": [] },
    { "id": "3", "name": "Data Science", "children": [] }
  ]}
]
```

A DataTable expects a flat array. A recursive `flattenCategories` utility was written inline in the categories page:

```typescript
function flattenCategories(categories: Category[], depth = 0): FlatCategory[] {
  return categories.flatMap((cat) => [
    { ...cat, depth },
    ...flattenCategories(cat.children ?? [], depth + 1),
  ]);
}
```

The `depth` value drives a left-padding style on the Name cell (`pl-${depth * 4}`) to visually represent the hierarchy. The Delete button is disabled when `cat._count.courses > 0` to prevent orphaning course records.

---

## 8. Files Created and Modified

### New files

| File | Purpose |
|------|---------|
| `packages/shared-hooks/src/services/admin.service.ts` | 15 admin API functions covering dashboard, users, applications, courses (pending + all + detail), withdrawals, categories, tags, and settings |
| `packages/shared-hooks/src/queries/use-admin.ts` | 17 TanStack Query hooks — 6 queries and 11 mutations — all with proper queryKey structure, invalidation, and error handling |
| `apps/management-portal/src/app/[locale]/admin/courses/page.tsx` | Admin courses list page showing all courses from all instructors with status filter and server-side pagination |
| `apps/management-portal/src/app/[locale]/admin/courses/[courseId]/page.tsx` | Admin course detail page using the new admin endpoint, bypasses instructor ownership check |

### Modified files

| File | Changes |
|------|---------|
| `apps/api/src/modules/admin/courses/admin-courses.controller.ts` | Added `@Get()` and `@Get(':id')` routes for listing all courses and fetching course detail |
| `apps/api/src/modules/admin/courses/admin-courses.service.ts` | Added `getAllCourses(params)` and `getCourseDetail(courseId)` methods without ownership validation |
| `apps/management-portal/src/app/[locale]/admin/dashboard/page.tsx` | Replaced mock stats with `useAdminDashboard()`, added loading skeletons |
| `apps/management-portal/src/app/[locale]/admin/users/page.tsx` | Replaced mock users with `useAdminUsers()`, added debounced search, role filter, status filter, suspend/activate mutations |
| `apps/management-portal/src/app/[locale]/admin/approvals/instructors/page.tsx` | Replaced mock applications with `useAdminPendingApps()`, added approve/reject with ConfirmDialog (reject includes reviewNote textarea) |
| `apps/management-portal/src/app/[locale]/admin/approvals/courses/page.tsx` | Replaced mock courses with `useAdminPendingCourses()`, View links to `/admin/courses/:id`, approve/reject with feedback textarea |
| `apps/management-portal/src/app/[locale]/admin/withdrawals/page.tsx` | Replaced mock withdrawals with `useAdminWithdrawals()`, approve/reject with reviewNote textarea |
| `apps/management-portal/src/app/[locale]/admin/categories/page.tsx` | Replaced mock categories with `useCategories()`, added CRUD mutations, recursive flatten for DataTable display |
| `apps/management-portal/src/app/[locale]/admin/settings/page.tsx` | Replaced mock settings with `useAdminSettings()`, per-key save with `useUpdateSetting()` |
| `apps/management-portal/src/app/[locale]/admin/reports/page.tsx` | Wired to backend if reports endpoint exists; shows informational placeholder if not |
| `apps/management-portal/src/components/feedback/confirm-dialog.tsx` | Added `children?: React.ReactNode` prop rendered between description and action buttons |
| `packages/shared-hooks/src/services/index.ts` | Added export for `adminService` |
| `packages/shared-hooks/src/index.ts` | Added exports for all admin hooks from `use-admin.ts` |
| `apps/management-portal/messages/vi.json` | Added admin namespace keys: dashboard stats labels, user management strings, approval action labels, settings labels |
| `apps/management-portal/messages/en.json` | Same keys in English |

---

## 9. Key Learnings

**Ownership guards silently break admin workflows.** Reusing instructor endpoints for admin viewing seems convenient but fails at runtime because services enforce ownership at the data layer, not just the route level. Admin endpoints must be distinct and bypass these checks. The pattern is: same response shape, different service method, different guard.

**`children` prop is the right tool for flexible dialogs.** A confirm dialog that sometimes needs a textarea and sometimes needs a radio group cannot be served by a fixed `description` string or a separate component per variant. Adding `children` keeps the component small while making it composable. The parent retains full control over the embedded content and its state.

**Three-layer architecture pays off at scale.** Having service functions separate from hooks means the service can be called in non-hook contexts (e.g., server actions, tests) without mocking the entire TanStack Query stack. The discipline of keeping page components stateless with respect to server data — they only hold UI state like `search`, `page`, `dialogOpen` — makes each page straightforward to reason about.

**Debounce + page reset must go together.** Forgetting to reset `page` to `1` on search change is a subtle bug that only manifests when the user happens to be on a later page. The `useEffect(() => setPage(1), [debouncedSearch])` pattern should be a standard part of any server-side filtered list.

**Flat arrays with depth metadata are more practical than tree components.** Rendering a category tree as a `<TreeView>` requires a specialized component. Flattening to `{ ...category, depth }` and using padding to show hierarchy works in any standard DataTable and is trivial to implement with a recursive `flatMap`.
