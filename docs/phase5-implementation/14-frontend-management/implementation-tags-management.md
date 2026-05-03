# Implementation — Tags Management (Admin CRUD + Instructor Tag Selector)

---

## 1. TỔNG QUAN

### Mục tiêu

1. **Admin quản lý Tags** — CRUD trang `/admin/tags` (tạo, sửa, xóa tags)
2. **Instructor gắn tags** — Thay thế free-text input bằng tag selector dropdown trong Course Wizard
3. **Public API** — Endpoint lấy danh sách tags cho cả instructor lẫn student sử dụng

### Hiện trạng

| Component | Status | Ghi chú |
|-----------|--------|---------|
| Database: Tag, CourseTag models | ✅ Done | `name`, `slug`, `courseCount`, many-to-many |
| Backend: `POST/PATCH/DELETE /admin/tags` | ✅ Done | AdminContentService — create, update, delete |
| Backend: `GET /admin/tags` (list all) | ❌ Missing | Cần thêm |
| Backend: `GET /tags` (public) | ❌ Missing | Cần cho instructor tag selector |
| Shared: adminService.getTags() | ✅ Done | Gọi `GET /admin/tags` |
| Shared: useCreateTag, useUpdateTag, useDeleteTag | ✅ Done | Mutations trong use-admin.ts |
| Shared: useGetTags (query hook) | ❌ Missing | Cần thêm |
| Frontend: Admin tags page | ❌ Missing | Cần tạo |
| Frontend: Sidebar link | ❌ Missing | Cần thêm |
| Frontend: Course Wizard tag selector | ❌ Partial | Hiện dùng free-text input, cần đổi sang dropdown |
| i18n keys | ❌ Missing | Cần thêm `tags.*` namespace |

---

## 2. BACKEND — Thêm GET endpoints

### 2.1 `GET /admin/tags` — Admin list all tags

**File:** `apps/api/src/modules/admin/content/admin-content.service.ts`

Thêm method:
```typescript
async getTags() {
  return this.prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { courseTags: true } } },
  });
}
```

**File:** `apps/api/src/modules/admin/content/admin-content.controller.ts`

Thêm endpoint (đặt trước `POST /admin/tags`):
```typescript
@Get('tags')
@ApiOperation({ summary: 'List all tags' })
async getTags() {
  return this.service.getTags();
}
```

**Response format:**
```json
[
  { "id": "clx...", "name": "React", "slug": "react", "courseCount": 0, "_count": { "courseTags": 5 } },
  { "id": "clx...", "name": "TypeScript", "slug": "typescript", "courseCount": 0, "_count": { "courseTags": 3 } }
]
```

> **Lưu ý:** Field `courseCount` trên Tag model là denormalized counter (hiện chưa sync — luôn = 0). Dùng `_count.courseTags` từ Prisma include để lấy số chính xác.

### 2.2 `GET /tags` — Public endpoint cho instructor/student

**File:** `apps/api/src/modules/categories/categories.controller.ts`

Thêm endpoint vào CategoriesController (vì tags và categories cùng domain "catalog"):
```typescript
@Get('/tags')
@Public()
@ApiOperation({ summary: 'List all tags (public)' })
async getAllTags() {
  return this.prisma.tag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}
```

**Hoặc** tạo controller riêng nếu muốn tách biệt. Tuy nhiên, vì chỉ có 1 endpoint public đơn giản, đặt chung vào CategoriesController là hợp lý — giống pattern GET /categories.

**Alternative**: Dùng trực tiếp `GET /admin/tags` cho instructor (instructor cũng có auth). Nhưng endpoint admin yêu cầu role ADMIN → instructor không truy cập được. Nên cần public endpoint riêng.

---

## 3. SHARED LAYER

### 3.1 Tag service

**File:** `packages/shared-hooks/src/services/tag.service.ts` (tạo mới)

```typescript
import { apiClient } from '@shared/api-client';

export const tagService = {
  /** Public endpoint — dùng cho instructor tag selector */
  getAll: () => apiClient.get('/tags'),
};
```

### 3.2 Query hook — useGetTags (public)

**File:** `packages/shared-hooks/src/queries/use-tags.ts` (tạo mới)

```typescript
import { useQuery } from '@tanstack/react-query';
import { tagService } from '../services/tag.service';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => tagService.getAll(),
    staleTime: 10 * 60 * 1000, // 10 min — tags ít thay đổi
  });
}
```

### 3.3 Query hook — useAdminTags

**File:** `packages/shared-hooks/src/queries/use-admin.ts` (thêm vào)

```typescript
export function useAdminTags() {
  return useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: () => adminService.getTags(),
  });
}
```

### 3.4 Export từ index

**File:** `packages/shared-hooks/src/index.ts`

Thêm:
```typescript
export { useTags } from './queries/use-tags';
export { useAdminTags } from './queries/use-admin';
// useCreateTag, useUpdateTag, useDeleteTag đã export rồi
```

---

## 4. FRONTEND — Admin Tags Page

### 4.1 Trang `/admin/tags`

**File:** `apps/management-portal/src/app/[locale]/admin/tags/page.tsx` (tạo mới)

**Pattern:** Copy từ admin categories page, đơn giản hơn vì tags KHÔNG có tree structure.

**UI Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Tags                                    [+ Add Tag]  │
├──────────────────────────────────────────────────────┤
│ Name          │ Slug           │ Courses  │ Actions  │
│───────────────│────────────────│──────────│──────────│
│ React         │ react          │ 5        │ ✏️ 🗑️    │
│ TypeScript    │ typescript     │ 3        │ ✏️ 🗑️    │
│ JavaScript    │ javascript     │ 7        │ ✏️ 🗑️    │
│ Node.js       │ nodejs         │ 2        │ ✏️ 🗑️    │
└──────────────────────────────────────────────────────┘
```

**Tính năng:**
- DataTable: columns = name, slug, course count (từ `_count.courseTags`), actions
- Create dialog: Input name (auto-generate slug ở backend)
- Edit dialog: Sửa name (slug tự update)
- Delete: ConfirmDialog, disabled nếu `_count.courseTags > 0`
- Delete disabled tooltip: "Cannot delete tag with courses"

**Hooks sử dụng:**
- `useAdminTags()` — fetch list
- `useCreateTag()` — tạo
- `useUpdateTag()` — sửa
- `useDeleteTag()` — xóa

**Code structure:**
```tsx
export default function TagsPage() {
  const t = useTranslations('tags');
  const { data, isLoading } = useAdminTags();
  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TagRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null);
  const [name, setName] = useState('');

  const tags = (data?.data as TagRow[]) ?? [];

  // ... handlers: openCreate, openEdit, handleSave, handleDelete

  const columns: Column<TagRow>[] = [
    { key: 'name', header: t('name'), render: (tag) => <span className="font-medium">{tag.name}</span> },
    { key: 'slug', header: t('slug'), render: (tag) => <span className="text-muted-foreground text-sm">{tag.slug}</span> },
    { key: 'courseCount', header: t('courseCount'), render: (tag) => <Badge variant="secondary">{tag._count?.courseTags ?? 0}</Badge> },
    { key: 'actions', header: '', render: (tag) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => openEdit(tag)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive"
          onClick={() => setDeleteTarget(tag)}
          disabled={(tag._count?.courseTags ?? 0) > 0}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    )},
  ];

  // Return: DataTable + Create/Edit dialog (ReactDOM.createPortal) + ConfirmDialog delete
}
```

### 4.2 Sidebar link

**File:** `apps/management-portal/src/components/navigation/sidebar.tsx`

Thêm item "Tags" ngay sau "Categories" trong admin nav:
```typescript
{ label: t('tags'), href: `/${locale}/admin/tags`, icon: Tag }
```

Icon: `Tag` từ lucide-react.

---

## 5. FRONTEND — Course Wizard Tag Selector

### 5.1 Thay đổi approach

**Hiện tại:** Instructor gõ tag name vào text input tự do → backend `findOrCreateTags()` tự upsert.

**Sau khi sửa:** Instructor chọn tags từ dropdown (tags đã tồn tại) + có thể tạo tag mới inline.

### 5.2 Tạo TagSelector component

**File:** `apps/management-portal/src/components/courses/wizard/tag-selector.tsx` (tạo mới)

**UI:** Multi-select dropdown với:
- Dropdown hiển thị danh sách tags từ `useTags()`
- Click tag → toggle selected/unselected
- Selected tags hiện dạng badge phía trên dropdown
- Click X trên badge → bỏ chọn
- Input search filter tags trong dropdown
- Nút "Create new tag" ở cuối dropdown nếu search term không match tag nào

```
┌──────────────────────────────────────────┐
│ Tags                                     │
│ ┌──────────────────────────────────────┐ │
│ │ [React ×] [TypeScript ×] [Next.js ×]│ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 🔍 Search tags...                    │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ ☑ React                         │ │ │
│ │ │ ☑ TypeScript                    │ │ │
│ │ │ ☑ Next.js                       │ │ │
│ │ │ ☐ Node.js                       │ │ │
│ │ │ ☐ JavaScript                    │ │ │
│ │ │ ☐ Python                        │ │ │
│ │ └──────────────────────────────────┘ │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Props interface:**
```typescript
interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  maxTags?: number; // default 10
}
```

**Implementation notes:**
- Fetch tags: `useTags()` → cache 10 phút
- Search: client-side filter bằng `tag.name.toLowerCase().includes(search)`
- Toggle: click tag → add/remove từ selectedTagIds array
- Max 10 tags (validation ở cả frontend + backend DTO đã có `@ArrayMaxSize(10)`)
- Dropdown đóng khi click outside (useEffect + ref)

### 5.3 Cập nhật step-basics.tsx

**File:** `apps/management-portal/src/components/courses/wizard/step-basics.tsx`

**Thay đổi:**

1. **Import:** Thay `DynamicStringList` cho tags bằng `TagSelector`

2. **Form schema:** Tags field đổi từ `{ value: string }[]` sang `string[]` (array of tag IDs)

3. **Trong JSX:** Thay block:
```tsx
{/* Tags — OLD */}
<DynamicStringList
  label={t('tags')}
  fields={tags.fields}
  onAppend={() => tags.append({ value: '' })}
  onRemove={tags.remove}
  register={register}
  name="tags"
  placeholder={t('tagPlaceholder')}
/>
```

Bằng:
```tsx
{/* Tags — NEW */}
<div className="space-y-2">
  <Label>{t('tags')}</Label>
  <TagSelector
    selectedTagIds={watch('tagIds') ?? []}
    onChange={(ids) => setValue('tagIds', ids, { shouldValidate: true })}
    maxTags={10}
  />
</div>
```

4. **Form default values:** Khi edit course, map từ `course.courseTags` sang tagIds:
```typescript
// buildDefaults — sửa tags thành tagIds
tagIds: ((course.courseTags as Array<{ tag: { id: string } }>) ?? []).map((ct) => ct.tag.id),
```

5. **Submit payload:** Tags gửi lên backend dạng tagIds (array of IDs) thay vì tag names:
```typescript
const payload = {
  ...data,
  // Bỏ field tags cũ, thêm tagIds
  tagIds: data.tagIds,
};
```

### 5.4 Cập nhật validation schema

**File:** `apps/management-portal/src/lib/validations/course.ts`

Sửa tags field:
```typescript
// OLD
tags: z.array(z.object({ value: z.string() })).optional(),

// NEW
tagIds: z.array(z.string()).max(10).optional(),
```

### 5.5 Cập nhật backend — updateTags endpoint wiring

**Hiện tại** backend đã có `updateTags(courseId, instructorId, tagIds)` method.

Khi instructor update course (step basics), payload chứa `tagIds: string[]`. Cần đảm bảo `CourseManagementService.update()` xử lý `tagIds` field:

**File:** `apps/api/src/modules/courses/management/course-management.service.ts`

Kiểm tra method `update()` — nếu chưa handle `tagIds` riêng (chỉ handle `tags` string names), thêm logic:
```typescript
if (dto.tagIds) {
  await this.prisma.$transaction([
    this.prisma.courseTag.deleteMany({ where: { courseId } }),
    this.prisma.courseTag.createMany({
      data: dto.tagIds.map((tagId) => ({ courseId, tagId })),
    }),
  ]);
}
```

**File:** `apps/api/src/modules/courses/management/dto/update-course.dto.ts`

Thêm field (nếu chưa có):
```typescript
@IsOptional()
@IsArray()
@ArrayMaxSize(10)
@IsString({ each: true })
tagIds?: string[];
```

---

## 6. I18N

### 6.1 English — `apps/management-portal/messages/en.json`

Thêm namespace `tags`:
```json
"tags": {
  "title": "Tags",
  "addTag": "Add Tag",
  "editTag": "Edit Tag",
  "deleteTag": "Delete Tag",
  "name": "Name",
  "slug": "Slug",
  "courseCount": "Courses",
  "tagNamePlaceholder": "Enter tag name",
  "confirmDelete": "Delete Tag",
  "confirmDeleteDesc": "Are you sure you want to delete tag \"{name}\"? This action cannot be undone.",
  "tagCreated": "Tag created",
  "tagUpdated": "Tag updated",
  "tagDeleted": "Tag deleted",
  "cannotDeleteHasCourses": "Cannot delete tag that is used by courses",
  "cancel": "Cancel",
  "save": "Save",
  "create": "Create",
  "delete": "Delete",
  "noTags": "No tags yet. Create your first tag.",
  "searchTags": "Search tags...",
  "createNewTag": "Create \"{name}\"",
  "maxTagsReached": "Maximum {max} tags allowed",
  "selectedCount": "{count} tags selected"
}
```

### 6.2 Vietnamese — `apps/management-portal/messages/vi.json`

```json
"tags": {
  "title": "Thẻ",
  "addTag": "Thêm thẻ",
  "editTag": "Sửa thẻ",
  "deleteTag": "Xóa thẻ",
  "name": "Tên",
  "slug": "Slug",
  "courseCount": "Khóa học",
  "tagNamePlaceholder": "Nhập tên thẻ",
  "confirmDelete": "Xóa thẻ",
  "confirmDeleteDesc": "Bạn có chắc muốn xóa thẻ \"{name}\"? Hành động này không thể hoàn tác.",
  "tagCreated": "Đã tạo thẻ",
  "tagUpdated": "Đã cập nhật thẻ",
  "tagDeleted": "Đã xóa thẻ",
  "cannotDeleteHasCourses": "Không thể xóa thẻ đang được sử dụng",
  "cancel": "Hủy",
  "save": "Lưu",
  "create": "Tạo",
  "delete": "Xóa",
  "noTags": "Chưa có thẻ nào. Tạo thẻ đầu tiên.",
  "searchTags": "Tìm thẻ...",
  "createNewTag": "Tạo \"{name}\"",
  "maxTagsReached": "Tối đa {max} thẻ",
  "selectedCount": "Đã chọn {count} thẻ"
}
```

---

## 7. COMMIT PLAN

### Commit 1: Backend — Add GET tags endpoints
```
feat(api): add get tags endpoints for admin and public

- add GET /admin/tags with course count
- add GET /tags (public) for instructor tag selector
- add tagIds field to UpdateCourseDto
- handle tagIds in course update service
```

**Files:**
- `apps/api/src/modules/admin/content/admin-content.service.ts` — thêm `getTags()`
- `apps/api/src/modules/admin/content/admin-content.controller.ts` — thêm `@Get('tags')`
- `apps/api/src/modules/categories/categories.controller.ts` — thêm `@Get('/tags')`
- `apps/api/src/modules/categories/categories.service.ts` — thêm `getAllTags()` (hoặc inline trong controller)
- `apps/api/src/modules/courses/management/dto/update-course.dto.ts` — thêm `tagIds`
- `apps/api/src/modules/courses/management/course-management.service.ts` — handle `tagIds` trong update

### Commit 2: Shared — Add tag hooks
```
feat(shared): add tag service and query hooks

- add tag.service.ts with getAll method
- add useTags hook for public tag list
- add useAdminTags hook for admin page
- export from index
```

**Files:**
- `packages/shared-hooks/src/services/tag.service.ts` — tạo mới
- `packages/shared-hooks/src/queries/use-tags.ts` — tạo mới
- `packages/shared-hooks/src/queries/use-admin.ts` — thêm `useAdminTags`
- `packages/shared-hooks/src/index.ts` — thêm exports

### Commit 3: Frontend — Admin tags page + sidebar
```
feat(management): add admin tags management page

- add /admin/tags page with crud operations
- add tags link to admin sidebar
- add i18n keys for tags namespace (vi + en)
```

**Files:**
- `apps/management-portal/src/app/[locale]/admin/tags/page.tsx` — tạo mới
- `apps/management-portal/src/components/navigation/sidebar.tsx` — thêm link
- `apps/management-portal/messages/en.json` — thêm `tags.*`
- `apps/management-portal/messages/vi.json` — thêm `tags.*`

### Commit 4: Frontend — Tag selector in course wizard
```
feat(management): replace free-text tags with tag selector in course wizard

- add TagSelector component with multi-select dropdown
- update step-basics to use TagSelector with tagIds
- update form validation schema for tagIds
```

**Files:**
- `apps/management-portal/src/components/courses/wizard/tag-selector.tsx` — tạo mới
- `apps/management-portal/src/components/courses/wizard/step-basics.tsx` — sửa tags → tagIds
- `apps/management-portal/src/lib/validations/course.ts` — sửa schema

---

## 8. VERIFICATION

1. **Admin tags page:**
   - Tạo tag mới → xuất hiện trong list
   - Sửa tag → name + slug cập nhật
   - Xóa tag không có course → thành công
   - Xóa tag có course → bị block, hiện toast error
   - Sidebar link highlight đúng khi ở trang tags

2. **Course wizard tag selector:**
   - Dropdown hiển thị đúng danh sách tags
   - Chọn tag → badge xuất hiện, bỏ chọn → badge biến mất
   - Search filter hoạt động
   - Max 10 tags → hiện warning
   - Save course → tags lưu đúng (reload page vẫn hiện)
   - Edit course → tags load đúng từ server

3. **Build check:**
   ```bash
   npm run build --workspace=apps/api
   npm run build --workspace=packages/shared-hooks
   npm run build --workspace=apps/management-portal
   ```

4. **Backend tests:** Thêm 2-3 tests cho getTags() nếu cần, chạy `cd apps/api && npx jest`

---

## 9. CẤU TRÚC SAU IMPLEMENT

```
apps/api/src/modules/admin/content/
├── admin-content.controller.ts    # + GET /admin/tags
└── admin-content.service.ts       # + getTags()

apps/api/src/modules/categories/
└── categories.controller.ts       # + GET /tags (public)

packages/shared-hooks/src/
├── services/tag.service.ts        # NEW
├── queries/use-tags.ts            # NEW — useTags()
├── queries/use-admin.ts           # + useAdminTags()
└── index.ts                       # + exports

apps/management-portal/src/
├── app/[locale]/admin/tags/
│   └── page.tsx                   # NEW — Admin tags CRUD
├── components/courses/wizard/
│   ├── tag-selector.tsx           # NEW — Multi-select tag dropdown
│   └── step-basics.tsx            # MODIFIED — use TagSelector
├── components/navigation/
│   └── sidebar.tsx                # MODIFIED — add Tags link
├── lib/validations/
│   └── course.ts                  # MODIFIED — tags → tagIds
└── messages/
    ├── en.json                    # + tags.* namespace
    └── vi.json                    # + tags.* namespace
```

| Commit | Created | Modified |
|--------|---------|----------|
| 1. Backend GET endpoints | 0 | 4 |
| 2. Shared hooks | 2 | 2 |
| 3. Admin tags page | 1 | 3 |
| 4. Tag selector wizard | 1 | 2 |
| **Total** | **4** | **~11** |
