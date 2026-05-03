# Phase 5.14g — Giải thích chi tiết: Tags Management (Quản lý thẻ khóa học)

---

## 1. Tổng quan

Phase này implement tính năng **Tags Management** — cho phép admin CRUD tags tập trung, và instructor chọn tags từ dropdown khi tạo/chỉnh sửa khóa học. Trước đó, instructor phải gõ tay tag names → dễ bị trùng lặp ("React" vs "react" vs "ReactJS"). Giờ admin quản lý danh sách tags chuẩn, instructor chọn từ multi-select dropdown → data sạch, recommendation engine hoạt động chính xác hơn.

### Tác dụng của Tags

1. **Recommendation System** — Content-based algorithm dùng tag vectors để tính cosine similarity giữa các khóa học. Tags sạch = recommendations chính xác.
2. **Course Filtering** — Student có thể lọc khóa học theo tags trên browse page.
3. **Organization** — Phân loại chi tiết hơn categories (1 khóa có nhiều tags, nhưng chỉ thuộc 1 category).

### Phạm vi thay đổi

| Layer | Files | Nội dung |
|-------|-------|----------|
| Backend | 6 files | GET /admin/tags (paginated + search), GET /tags (public), tagIds trong course DTO, 3 tests mới |
| Shared | 4 files | tag.service.ts, use-tags.ts, useAdminTags + CRUD hooks, barrel export |
| Frontend | 6 files | Admin tags page, TagSelector component, step-basics refactor, sidebar, i18n |

---

## 2. Backend Changes

### 2.1 Admin Tags Endpoint (Paginated + Search)

**File:** `apps/api/src/modules/admin/content/admin-content.controller.ts`

```
GET /api/admin/tags?page=1&limit=20&search=react
```

- Pagination: page + limit query params, mặc định page=1, limit=20
- Search: filter by name (case-insensitive `contains`)
- Response format: `{ data: Tag[], meta: { page, limit, total, totalPages } }` — dùng `createPaginatedResult` helper
- Include `_count.courseTags` để hiển thị số courses đang dùng tag

### 2.2 Public Tags Endpoint

**File:** `apps/api/src/modules/categories/categories.controller.ts`

```
GET /api/tags
```

- Tạo `TagsController` riêng (không cần auth — `@Public()`)
- Trả về tất cả tags: `{ id, name, slug }`, sorted by name
- Dùng cho TagSelector dropdown ở instructor side
- Đặt trong categories module vì cùng domain "content classification"

### 2.3 Course DTO — tagIds field

**File:** `apps/api/src/modules/courses/dto/create-course.dto.ts`

```typescript
@IsOptional()
@IsArray()
@ArrayMaxSize(10)
@IsString({ each: true })
tagIds?: string[];
```

- `tagIds` (array of IDs từ selector) ưu tiên hơn `tags` (string names) — backward compatible
- Giới hạn tối đa 10 tags per course

### 2.4 Course Management Service

**File:** `apps/api/src/modules/courses/management/course-management.service.ts`

Logic xử lý trong `create()` và `update()`:

```
if tagIds provided → link trực tiếp bằng ID (từ TagSelector)
else if tags provided → findOrCreate by name (backward compatible)
```

Khi update: xóa tất cả courseTags cũ → tạo lại từ tagIds mới (replace strategy).

### 2.5 Unit Tests

**File:** `apps/api/src/modules/admin/content/admin-content.service.spec.ts`

3 tests mới cho `getTags()`:
1. Return paginated tags with course count
2. Filter by search term (case-insensitive)
3. Default pagination when params not provided

---

## 3. Shared Layer

### 3.1 Tag Service

**File:** `packages/shared-hooks/src/services/tag.service.ts`

```typescript
export const tagService = {
  getAll: () => apiClient.get('/tags'),
};
```

Chỉ cần `getAll` — public endpoint, không cần auth.

### 3.2 useTags Hook

**File:** `packages/shared-hooks/src/queries/use-tags.ts`

- `staleTime: 10 * 60 * 1000` (10 phút) — tags ít thay đổi, cache lâu
- Dùng cho TagSelector component

### 3.3 Admin Hooks

**File:** `packages/shared-hooks/src/queries/use-admin.ts`

4 hooks mới:
- `useAdminTags(params?)` — GET paginated tags
- `useCreateTag()` — POST, invalidate `['admin', 'tags']` + `['tags']`
- `useUpdateTag()` — PATCH, invalidate cả 2 query keys
- `useDeleteTag()` — DELETE, invalidate cả 2 query keys

Invalidate cả `['tags']` (public) để TagSelector cũng nhận data mới.

---

## 4. Frontend — Admin Tags Page

**File:** `apps/management-portal/src/app/[locale]/admin/tags/page.tsx`

### Features:
- **DataTable** — hiển thị tags với columns: Name, Slug (auto-generated), Courses count
- **Search** — debounced (300ms), reset page về 1 khi search
- **Server-side pagination** — truyền `serverPage`, `serverTotalPages`, `serverTotal`
- **Create/Edit dialog** — dùng `ReactDOM.createPortal` (tránh z-index issues với sidebar)
- **Delete** — ConfirmDialog, disabled khi tag đang được courses sử dụng (`_count.courseTags > 0`)

### Pattern:
Theo đúng pattern của Categories page — cùng layout, cùng UX flow.

---

## 5. Frontend — TagSelector Component

**File:** `apps/management-portal/src/components/courses/wizard/tag-selector.tsx`

### Multi-select dropdown:
- **Selected tags** hiển thị dạng Badge với nút X để remove
- **Search input** — filter client-side từ danh sách tags đã fetch
- **Dropdown** mở lên trên (`bottom-full`) vì component nằm cuối form
- **Checkbox list** — toggle select/deselect, max 10 tags
- **Outside click** close dropdown
- **Dark mode** — divider giữa items, `bg-primary/10` cho selected state

### Integration vào Step Basics:
- Thay thế `DynamicStringList` (gõ tay) bằng `TagSelector` (chọn từ list)
- Form field: `tags: {value: string}[]` → `tagIds: string[]`
- Validation: `z.array(z.string()).max(10).optional()`
- Submit payload: gửi `tagIds` thay vì `tags`

---

## 6. i18n

### Thêm vào cả en.json và vi.json:

**Namespace `tags`** (~15 keys):
- CRUD labels: title, addTag, editTag, name, slug, courseCount
- Actions: create, save, cancel, delete, confirmDelete
- Search: searchPlaceholder, searchTags
- Status: tagCreated, tagUpdated, tagDeleted, noTags, maxTagsReached

**Namespace `nav`**:
- `tags`: "Tags" / "Thẻ"

---

## 7. Data Flow

```
Admin creates tags:
  Admin Page → useCreateTag → POST /admin/tags → DB
  → invalidate ['admin','tags'] + ['tags']

Instructor selects tags:
  TagSelector → useTags (GET /tags) → dropdown list
  → select tags → tagIds[] in form state
  → submit → POST/PATCH /courses → tagIds sent to backend
  → course-management.service links courseTag records

Recommendation uses tags:
  Cron job → popularity.service → tag vector cosine similarity
  → suggest courses with similar tags
```

---

## 8. Tổng kết

| Metric | Value |
|--------|-------|
| Files created | 4 (tag.service, use-tags, admin tags page, tag-selector) |
| Files modified | 12 (controller, service, spec, DTO, course service, sidebar, i18n, etc.) |
| New tests | 3 |
| New i18n keys | ~30 (15 per locale) |
| New API endpoints | 2 (GET /admin/tags, GET /tags) |
| Breaking changes | 0 (tagIds is additive, tags still works) |
