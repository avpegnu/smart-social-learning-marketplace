# 11 — Danh sách học viên trong trang chi tiết khóa học (Management Portal)

## Tổng quan

Thêm **tab Học viên** vào trang chi tiết khóa học trong management portal cho cả hai role **Instructor** và **Admin**.

- **Instructor** xem được danh sách học viên đã đăng ký khóa học của chính mình
- **Admin** xem được danh sách học viên của bất kỳ khóa học nào trên toàn hệ thống

Trước đây, instructor có một trang riêng `/instructor/courses/:id/students` (standalone page, 194 dòng). Admin không có cách nào xem danh sách học viên của một khóa học cụ thể. Thay đổi này tích hợp danh sách học viên trực tiếp vào trang chi tiết qua tab thứ hai, đồng thời bổ sung khả năng còn thiếu cho phía admin.

---

## Kiến trúc tổng thể

```
Management Portal
├── /instructor/courses/:id          ← Tabs: Tổng quan | Học viên (dùng instructor hook)
├── /instructor/courses/:id/students ← Redirect → detail page ?tab=students
└── /admin/courses/:id               ← Tabs: Tổng quan | Học viên (dùng admin hook)

Backend
└── GET /admin/courses/:id/students  ← Endpoint mới (chỉ ADMIN, không check ownership)

Shared Packages
├── adminService.getCourseStudents() ← API client method mới
├── useAdminCourseStudents()         ← TanStack Query hook mới
└── CourseStudentsTab component      ← Component dùng chung (mode: instructor | admin)
```

---

## Chi tiết từng thay đổi

### 1. Backend — Endpoint mới cho Admin

#### `apps/api/src/modules/admin/courses/admin-courses.service.ts`

Thêm method `getCourseStudents(courseId, query)`. Khác với phiên bản instructor (gọi `verifyOwnership` để kiểm tra quyền sở hữu khóa học), phiên bản admin chỉ kiểm tra course có tồn tại không, sau đó truy vấn toàn bộ enrollments mà không có ràng buộc ownership.

```typescript
async getCourseStudents(courseId: string, query: QueryCourseStudentsDto) {
  const course = await this.prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.deletedAt) {
    throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
  }

  const where = {
    courseId,
    ...(query.search && {
      user: { fullName: { contains: query.search, mode: 'insensitive' as const } },
    }),
  };

  const [enrollments, total] = await Promise.all([
    this.prisma.enrollment.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.enrollment.count({ where }),
  ]);

  return createPaginatedResult(enrollments, total, query.page, query.limit);
}
```

**Tái sử dụng:** `QueryCourseStudentsDto` từ `modules/courses/management/dto/` (hỗ trợ `page`, `limit`, `search`). Không cần tạo DTO mới.

**Phản hồi API** (cùng shape với endpoint instructor):
```json
{
  "data": [
    {
      "id": "enrollment_cuid",
      "type": "FULL",
      "progress": 0.45,
      "createdAt": "2026-01-15T...",
      "user": { "id": "...", "fullName": "Nguyễn Văn A", "email": "...", "avatarUrl": "..." }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

#### `apps/api/src/modules/admin/courses/admin-courses.controller.ts`

Thêm endpoint `GET :id/students`, được bảo vệ bởi `@Roles('ADMIN')` (kế thừa từ guard ở cấp controller).

```typescript
@Get(':id/students')
@ApiOperation({ summary: 'List enrolled students for a course (admin)' })
async getCourseStudents(
  @Param('id', ParseCuidPipe) id: string,
  @Query() query: QueryCourseStudentsDto,
) {
  return this.service.getCourseStudents(id, query);
}
```

---

### 2. Shared Hooks — Admin Service + Hook mới

#### `packages/shared-hooks/src/services/admin.service.ts`

Thêm `getCourseStudents` vào object `adminService`, theo đúng pattern chuyển đổi params sang querystring giống như `instructorService.getCourseStudents`:

```typescript
getCourseStudents: (
  courseId: string,
  params?: { page?: number; limit?: number; search?: string },
) => {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  if (params?.search) q.search = params.search;
  return apiClient.get(`/admin/courses/${courseId}/students`, q);
},
```

#### `packages/shared-hooks/src/queries/use-admin.ts`

Thêm hook `useAdminCourseStudents` ngay sau `useAdminCourseDetail`:

```typescript
export function useAdminCourseStudents(
  courseId: string,
  params?: { page?: number; limit?: number; search?: string },
) {
  return useQuery({
    queryKey: ['admin', 'courses', courseId, 'students', params],
    queryFn: () => adminService.getCourseStudents(courseId, params),
    enabled: !!courseId,
  });
}
```

Query key `['admin', 'courses', courseId, 'students', params]` là con của `['admin', 'courses', courseId]` (detail key), nên khi invalidate detail sẽ cascade xuống students nếu cần.

#### `packages/shared-hooks/src/index.ts`

Thêm `useAdminCourseStudents` vào named exports.

---

### 3. Management Portal — Component `CourseStudentsTab`

**File mới:** `apps/management-portal/src/components/courses/detail/course-students-tab.tsx`

Component dùng chung cho cả trang instructor và admin. Nhận `courseId` và `mode: 'instructor' | 'admin'` để chọn đúng hook bên trong.

**Quyết định thiết kế quan trọng:**

**Pattern dual hook, một hook bị vô hiệu hóa:** Cả hai hook `useInstructorCourseStudents` và `useAdminCourseStudents` đều được gọi vô điều kiện (React Rules of Hooks không cho phép gọi hook có điều kiện), nhưng hook không dùng đến nhận `''` làm `courseId`, kích hoạt `enabled: false` qua guard `!!courseId`. Hook bị vô hiệu hóa đăng ký một cache entry nhưng không bao giờ fetch — overhead không đáng kể.

**Không early return khi loading:** Card và Input luôn được mount. Trạng thái loading/refetch chỉ hiển thị dưới dạng skeleton rows *bên trong* `CardContent`. Điều này ngăn Input bị unmount khi search refetch, tránh bug mất focus (xem phần Bug Fixes bên dưới).

```tsx
return (
  <Card>
    <CardHeader>
      {/* Input luôn mount — không bao giờ unmount dù fetch state là gì */}
      <Input value={search} onChange={...} />
    </CardHeader>
    <CardContent>
      {isLoading || isFetching ? (
        <SkeletonRows />   {/* chỉ vùng table */}
      ) : students.length === 0 ? (
        <EmptyState />
      ) : (
        <Table>...</Table>
      )}
      {/* Prev / Trang X / Y / Next */}
    </CardContent>
  </Card>
);
```

**Tính năng:**
- Tìm kiếm theo tên học viên (debounce 500ms, reset về trang 1 khi search)
- Avatar + tên đầy đủ + email mỗi dòng
- Ngày đăng ký (đã format)
- Badge loại đăng ký: `FULL` (Toàn bộ) / `PARTIAL` (Từng phần)
- Progress bar + phần trăm tiến độ
- Pagination Prev/Next với chỉ số `trang / tổng trang`

---

### 4. Management Portal — Trang chi tiết Instructor (chuyển sang Tabs)

**File:** `apps/management-portal/src/app/[locale]/instructor/courses/[courseId]/page.tsx`

Chuyển từ layout cuộn dài sang layout hai tab dùng `Tabs` từ `@shared/ui`:

- **Tab 1 — Tổng quan** (`value="overview"`): toàn bộ nội dung cũ (CourseInfoCard, learning outcomes, prerequisites, tags, curriculum, pricing)
- **Tab 2 — Học viên** (`value="students"`): `<CourseStudentsTab courseId={courseId} mode="instructor" />`

Tab trigger Học viên hiển thị badge count khi `course.totalStudents > 0`:
```tsx
<TabsTrigger value="students">
  {t('tabStudents')}
  {(course.totalStudents as number) > 0 && (
    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
      {course.totalStudents as number}
    </Badge>
  )}
</TabsTrigger>
```

Thêm `useSearchParams()` để đọc `?tab=students` từ URL phục vụ use case redirect:
```typescript
const searchParams = useSearchParams();
const defaultTab = searchParams.get('tab') === 'students' ? 'students' : 'overview';
// <Tabs defaultValue={defaultTab}>
```

---

### 5. Management Portal — Trang chi tiết Admin (chuyển sang Tabs)

**File:** `apps/management-portal/src/app/[locale]/admin/courses/[courseId]/page.tsx`

Chuyển đổi layout sang tabs giống trang instructor. Điểm khác biệt:
- Không dùng `useSearchParams` (admin không điều hướng từ route `/students` cũ)
- Tab 2 render `<CourseStudentsTab courseId={courseId} mode="admin" />`
- Trang admin vẫn hiển thị thông tin instructor (tên + email) — feature đặc trưng của admin view

---

### 6. Management Portal — Trang standalone Students → Redirect

**File:** `apps/management-portal/src/app/[locale]/instructor/courses/[courseId]/students/page.tsx`

Trang standalone cũ (194 dòng) được thay thế bằng redirect để giữ backward compatibility cho các URL đã bookmark:

```typescript
import { use } from 'react';
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default function CourseStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string; locale: string }>;
}) {
  const { courseId, locale } = use(params);
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  redirect(`${prefix}/instructor/courses/${courseId}?tab=students`);
}
```

**Tại sao cần locale-aware redirect:** Management portal dùng `next-intl` với `localePrefix: 'as-needed'` (locale mặc định `vi` không có prefix, `en` dùng `/en/...`). Nếu dùng `redirect('/instructor/...')` thông thường sẽ strip locale prefix của user tiếng Anh và chuyển họ về route tiếng Việt. Đọc `locale` từ params và so sánh với `routing.defaultLocale` đảm bảo URL redirect giữ đúng locale.

---

### 7. i18n

**Files:** `apps/management-portal/messages/vi.json` và `en.json`

Thêm vào namespace `courseDetail`:
```json
"tabOverview": "Tổng quan",
"tabStudents": "Học viên"
```

Thêm vào namespace `courseStudents`:
```json
"completionRate": "Tỉ lệ hoàn thành"
```

> **Ghi chú:** Key `completionRate` đã được thêm vào translations nhưng UI tương ứng bị xóa sau review (xem phần Bug Fixes). Key vẫn giữ lại trong file translation để dùng trong tương lai nếu cần.

---

## Bug Fixes phát sinh trong quá trình review

### Bug 1 — Ô search mất focus sau khi gõ

**Triệu chứng:** Gõ ký tự vào ô tìm kiếm → component re-render → Input mất focus → phải click lại để gõ tiếp.

**Nguyên nhân gốc rễ (hai giai đoạn phân tích):**

*Phiên bản đầu tiên:* Component có `if (isLoading) return <Skeleton>` dưới dạng early return. Khi `debouncedSearch` thay đổi (500ms sau khi gõ), TanStack Query tạo query key mới. Nếu không có cache cho key đó, `isLoading = true` → early return kích hoạt → toàn bộ Card (bao gồm Input) bị unmount → mất focus.

*Lần fix đầu (chưa đúng):* Đổi thành `if (isLoading && !data) return <Skeleton>` với ý định chỉ hiển thị skeleton khi lần load đầu tiên (trước khi có bất kỳ data nào). Tuy nhiên, khi query key mới được tạo do search thay đổi, `data` cho key mới là `undefined` (không có cache) → `isLoading && !data` vẫn `true` → Input vẫn bị unmount mỗi khi search.

*Fix cuối cùng (đúng):* Xóa hoàn toàn early return. `Card` và `Input` **luôn được mount**, không bao giờ unmount bất kể trạng thái fetch. Skeleton rows loading chỉ render bên trong `CardContent`, thay thế phần table. Input nằm ngoài và phía trên vùng loading nên không bao giờ bị ảnh hưởng bởi fetch state.

```tsx
// Trước (lỗi): Card + Input bị unmount khi fetch
if (isLoading && !data) return <Skeleton />
return <Card><Input /><Table /></Card>

// Sau (đúng): Input luôn mounted, loading chỉ ảnh hưởng vùng table
return (
  <Card>
    <Input />  {/* luôn ở đây */}
    {isLoading || isFetching ? <SkeletonRows /> : <Table />}
  </Card>
)
```

### Bug 2 — Completion Rate hiển thị số liệu sai

**Vấn đề:** `CourseStudentsTab` ban đầu hiển thị stat "Tỉ lệ hoàn thành" tính từ `students.filter(s => s.progress >= 1).length / students.length`. Tuy nhiên `students` là trang hiện tại của kết quả (10 items), không phải toàn bộ học viên đã đăng ký. Với 100 học viên và 50 hoàn thành, tùy trang đang load có thể hiển thị "30%" thay vì "50%".

**Fix:** Xóa hoàn toàn stat completion rate. Tính toán chính xác cần aggregate từ backend — nằm ngoài scope của thay đổi này.

### Bug 3 — Pagination render quá nhiều button

**Vấn đề:** Pagination render `Array.from({ length: meta.totalPages })` thành các button riêng lẻ. Khóa học có 500 học viên (50 trang, limit=10) sẽ render 50 button, tràn layout và làm xấu UX trên mobile.

**Fix:** Thay bằng pattern Prev / `trang / tổng trang` / Next — chiều rộng cố định, scale được với bất kỳ số lượng trang nào.

### Bug 4 — Mất locale khi redirect

**Vấn đề:** Redirect ban đầu trong `students/page.tsx` dùng `redirect` từ `next/navigation`:
```typescript
redirect(`/instructor/courses/${courseId}?tab=students`);
```
User đang ở `/en/instructor/courses/:id/students` sẽ bị redirect về `/instructor/courses/:id?tab=students` (route tiếng Việt), làm mất prefix `/en`.

**Fix:** Đọc `locale` từ params, so sánh với `routing.defaultLocale`, thêm prefix locale nếu cần:
```typescript
const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
redirect(`${prefix}/instructor/courses/${courseId}?tab=students`);
```

---

## Danh sách file thay đổi

| File | Loại | Mô tả |
|------|------|-------|
| `apps/api/src/modules/admin/courses/admin-courses.service.ts` | Sửa | Thêm method `getCourseStudents()` |
| `apps/api/src/modules/admin/courses/admin-courses.controller.ts` | Sửa | Thêm endpoint `GET :id/students` |
| `packages/shared-hooks/src/services/admin.service.ts` | Sửa | Thêm `getCourseStudents` API client method |
| `packages/shared-hooks/src/queries/use-admin.ts` | Sửa | Thêm hook `useAdminCourseStudents` |
| `packages/shared-hooks/src/index.ts` | Sửa | Export `useAdminCourseStudents` |
| `apps/management-portal/src/components/courses/detail/course-students-tab.tsx` | **Mới** | Component tab Học viên dùng chung |
| `apps/management-portal/src/app/[locale]/instructor/courses/[courseId]/page.tsx` | Sửa | Chuyển sang layout tabs |
| `apps/management-portal/src/app/[locale]/instructor/courses/[courseId]/students/page.tsx` | Sửa | Thay bằng locale-aware redirect |
| `apps/management-portal/src/app/[locale]/admin/courses/[courseId]/page.tsx` | Sửa | Chuyển sang layout tabs |
| `apps/management-portal/messages/vi.json` | Sửa | Thêm `tabOverview`, `tabStudents`, `completionRate` |
| `apps/management-portal/messages/en.json` | Sửa | Thêm `tabOverview`, `tabStudents`, `completionRate` |
