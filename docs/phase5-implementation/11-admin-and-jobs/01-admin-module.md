# 01 — Admin Module: User Management, Approvals, Content CRUD, Analytics Dashboard

> Giải thích chi tiết AdminModule — 6 sub-services xử lý quản lý users, instructor applications,
> course review, withdrawals, content CRUD (categories/tags/commission tiers/settings), và analytics dashboard.
> Tất cả endpoints yêu cầu `@Roles('ADMIN')`.

---

## 1. TỔNG QUAN

### 1.1 Kiến trúc

AdminModule tách thành **6 sub-services** thay vì 1 file service khổng lồ — mỗi sub-service xử lý 1 domain:

```
AdminModule
├── users/              → List, filter, suspend/activate users
├── applications/       → Approve/reject instructor applications
├── courses/            → Approve/reject pending course reviews
├── withdrawals/        → Approve/reject withdrawal requests
├── content/            → Categories, Tags, CommissionTiers, Settings CRUD
└── analytics/          → Dashboard stats, analytics snapshots
```

### 1.2 Tại sao tách nhỏ?

**Single Responsibility Principle (SRP)** — mỗi service chỉ xử lý 1 concern:

```
❌ admin.service.ts (1 file, 500+ lines)
  → getUsers(), updateUserStatus(), reviewApplication(), reviewCourse(),
    processWithdrawal(), createCategory(), getDashboard(), ...
  → Khó maintain, khó test, khó tìm method

✅ 6 sub-services (mỗi file 50-100 lines)
  → Dễ navigate, dễ test riêng, dễ thêm logic mới
  → Controller tương ứng cũng tách riêng → route grouping rõ ràng
```

### 1.3 Security — Role Guard

Tất cả admin controllers sử dụng class-level guards:

```typescript
@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminUsersController { ... }
```

**Lý thuyết:**
- `JwtAuthGuard` (global) → verify JWT token, extract `user.sub` và `user.role`
- `RolesGuard` (class-level) → check `user.role` against `@Roles()` metadata
- Nếu role không match → `403 Forbidden`

NestJS guard execution order: **global guards → controller guards → route guards**. Vì `JwtAuthGuard` là global nên chạy trước, đảm bảo `user` object luôn có trong request khi `RolesGuard` kiểm tra.

---

## 2. USER MANAGEMENT

### 2.1 Dynamic Filter Pattern

```typescript
const where: Prisma.UserWhereInput = {
  ...(query.role && { role: query.role as Role }),
  ...(query.status && { status: query.status as UserStatus }),
  ...(query.search && {
    OR: [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ],
  }),
  deletedAt: null,
};
```

**Spread conditional pattern:** `...(condition && { field: value })` — chỉ thêm field vào `where` khi query param tồn tại. Nếu `query.role` là `undefined`, spread `...(undefined)` không thêm gì.

**`mode: 'insensitive'`** — PostgreSQL case-insensitive search (không cần `LOWER()` wrapper).

### 2.2 Admin Protection

```typescript
if (user.role === 'ADMIN') {
  throw new ForbiddenException({ code: 'CANNOT_MODIFY_ADMIN' });
}
```

**Tại sao?** Ngăn admin tự suspend chính mình hoặc admin khác → tránh lockout toàn bộ hệ thống. Rule: chỉ có database admin mới có thể modify admin accounts.

---

## 3. INSTRUCTOR APPLICATION REVIEW

### 3.1 Transaction — Approve Flow

```
reviewApplication(approved: true)
  │
  ├── 1. Update application: status → APPROVED, reviewedById, reviewedAt
  ├── 2. Promote user: role → INSTRUCTOR
  └── 3. Create InstructorProfile (upsert)
```

**Tại sao dùng `$transaction`?** 3 operations phải atomic:
- Nếu step 2 (promote user) fail → step 1 rollback → application vẫn PENDING
- Nếu step 3 (create profile) fail → step 1 + 2 rollback → user vẫn STUDENT

Nếu không dùng transaction, user có thể bị promote mà không có profile → lỗi khi vào instructor dashboard.

### 3.2 Upsert vs Create

```typescript
await tx.instructorProfile.upsert({
  where: { userId: application.userId },
  update: { expertise: application.expertise },
  create: { ... },
});
```

**Edge case:** User apply → rejected → apply lại → approved lần 2. Nếu lần rejected đầu tiên admin đã tạo profile (bug/manual), `create` sẽ fail vì unique constraint. `upsert` xử lý cả 2 case an toàn.

### 3.3 Double-Review Prevention

```typescript
if (application.status !== 'PENDING') {
  throw new BadRequestException({ code: 'APPLICATION_ALREADY_REVIEWED' });
}
```

**Race condition:** 2 admins mở cùng 1 application, cả 2 click approve. Không có check này → user được promote 2 lần, profile created 2 lần. Check status trước khi update đảm bảo chỉ admin đầu tiên thành công, admin thứ 2 nhận error.

---

## 4. COURSE REVIEW

### 4.1 Approve → Auto-Create Private Group

```typescript
if (dto.approved) {
  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({
      data: { status: 'PUBLISHED', publishedAt: course.publishedAt ?? new Date() },
    });

    // Auto-create private course group
    await tx.group.create({
      data: {
        name: updated.title,
        courseId: updated.id,
        ownerId: course.instructorId,
        privacy: 'PRIVATE',
      },
    });

    return updated;
  });
}
```

**Business logic:**
- Mỗi published course có 1 discussion group riêng
- Group privacy = `PRIVATE` → chỉ enrolled students mới join được (check trong GroupsService.join)
- `ownerId = instructorId` → instructor là group owner mặc định

**`publishedAt ?? new Date()`** — chỉ set publishedAt lần đầu. Nếu course từng published, bị reject, rồi resubmit → giữ publishedAt gốc.

### 4.2 Reject → Simple Update

```typescript
return this.prisma.course.update({
  where: { id: courseId },
  data: { status: 'REJECTED' },
});
```

Reject không cần transaction vì chỉ có 1 operation. Instructor có thể edit và resubmit (Phase 5.6 `submitForReview` cho phép `DRAFT` hoặc `REJECTED` status).

---

## 5. CONTENT MANAGEMENT — Categories, Tags, Commission Tiers, Settings

### 5.1 Slug Generation

```typescript
async createCategory(dto: CreateCategoryDto) {
  const slug = generateSlug(dto.name);  // "Web Development" → "web-development"
  const existing = await this.prisma.category.findUnique({ where: { slug } });
  if (existing) throw new ConflictException({ code: 'CATEGORY_SLUG_EXISTS' });
  return this.prisma.category.create({ data: { ...dto, slug } });
}
```

**Pattern:** Auto-generate slug từ name, check duplicate trước khi create. Slug dùng trong URL (`/courses?category=web-development`).

### 5.2 Delete Protection

```typescript
async deleteCategory(id: string) {
  const count = await this.prisma.course.count({ where: { categoryId: id } });
  if (count > 0) throw new BadRequestException({ code: 'CATEGORY_HAS_COURSES' });
  return this.prisma.category.delete({ where: { id } });
}
```

**Referential integrity:** Prisma sẽ throw error nếu delete category có courses (FK constraint). Nhưng check trước cho user-friendly error message thay vì Prisma error.

### 5.3 Platform Settings — Key/Value Upsert

```typescript
async updateSetting(dto: UpdateSettingDto) {
  return this.prisma.platformSetting.upsert({
    where: { key: dto.key },
    update: { value: dto.value as Prisma.InputJsonValue },
    create: { key: dto.key, value: dto.value as Prisma.InputJsonValue },
  });
}
```

**Pattern:** Settings là key-value store với JSON value. `upsert` cho phép admin tạo setting mới hoặc update existing bằng 1 endpoint duy nhất. Value là `Json` type (Prisma) nên accept any JSON: number, string, boolean, object, array.

---

## 6. ANALYTICS DASHBOARD

### 6.1 Parallel Queries

```typescript
const [totalUsers, totalCourses, totalRevenue, todayOrders, ...] = await Promise.all([
  this.prisma.user.count({ where: { deletedAt: null } }),
  this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
  this.prisma.earning.aggregate({ _sum: { netAmount: true } }),
  this.prisma.order.count({ where: { status: 'COMPLETED', createdAt: { gte: today } } }),
  // ... 6 more queries
]);
```

**Tại sao `Promise.all`?** 10 queries riêng biệt, không dependency lẫn nhau. Sequential = 10 × roundtrip time. Parallel = max(10 roundtrips) ≈ 1 roundtrip time.

**Benchmarks (estimated):**
- Sequential (10 × 5ms): ~50ms
- Parallel: ~5-10ms

### 6.2 Response Structure

```typescript
return {
  overview: { totalUsers, totalCourses, totalRevenue, todayOrders, newUsersThisWeek },
  pendingApprovals: { instructorApps, courseReviews, reports, withdrawals },
  topCourses,
};
```

**`pendingApprovals`** — hiển thị badges trên admin sidebar:
```
📋 Applications (2)
📚 Course Reviews (3)
🚩 Reports (1)
💰 Withdrawals (0)
```

Admin thấy ngay có bao nhiêu items cần xử lý khi đăng nhập.

---

## 7. FILES CREATED

| File | Lines | Mục đích |
|------|-------|----------|
| `admin.module.ts` | 30 | Module registration |
| `users/admin-users.service.ts` | 75 | User list, filter, suspend |
| `users/admin-users.controller.ts` | 40 | GET /admin/users, PATCH /admin/users/:id/status |
| `applications/admin-applications.service.ts` | 90 | Application list, approve/reject |
| `applications/admin-applications.controller.ts` | 40 | GET/PATCH /admin/applications |
| `courses/admin-courses.service.ts` | 90 | Course review, auto-create group |
| `courses/admin-courses.controller.ts` | 40 | GET /admin/courses/pending, PATCH /admin/courses/:id/review |
| `withdrawals/admin-withdrawals.service.ts` | 100 | Withdrawal approve/reject, FIFO earning update |
| `withdrawals/admin-withdrawals.controller.ts` | 40 | GET/PATCH /admin/withdrawals |
| `content/admin-content.service.ts` | 110 | Categories, Tags, Tiers, Settings CRUD |
| `content/admin-content.controller.ts` | 100 | 10 endpoints for content management |
| `analytics/admin-analytics.service.ts` | 80 | Dashboard + analytics query |
| `analytics/admin-analytics.controller.ts` | 35 | GET /admin/dashboard, GET /admin/analytics |
| `dto/` (10 files) | ~130 | All admin DTOs with class-validator |
| Tests (8 files) | ~600 | 64 unit tests |
