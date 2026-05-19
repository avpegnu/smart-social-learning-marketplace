# Phase 5.14f — Giải thích chi tiết: Admin Reports, Analytics & Cleanup

---

## 1. Tổng quan

Phase này hoàn thiện **tất cả các trang còn lại** của Management Portal bằng cách thay thế mock data bằng API thật. Sau phase này, **không còn trang nào** trong management portal dùng mock data nữa.

### Phạm vi thay đổi

| Commit | Nội dung |
|--------|----------|
| `bdd96bf` | Fix rate limit backend (3→10 req/s), skip throttle cho admin analytics |
| `f8de4f1` | Thêm reports + analytics service methods và hooks vào shared layer |
| `3045c4b` | Wire 3 trang admin + xóa curriculum page + xóa mock-data.ts |

**12 files thay đổi**, xóa **1,756 dòng** mock data, thêm **553 dòng** code thật.

---

## 2. Các trang đã wire

### 2.1 Admin Reports (`/admin/reports`)

**Trước:** Dùng `contentReports` và `userReports` từ mock-data.ts — dữ liệu cứng, không có action thật.

**Sau:** Wire đầy đủ với `GET /admin/reports` và `PATCH /admin/reports/:id`.

**Tính năng:**
- **Filter theo target type:** 3 tab — All, Content (POST/COMMENT/COURSE/QUESTION), Users (USER)
- **Filter theo status:** Badge buttons — ALL, PENDING, REVIEWED, ACTION_TAKEN, DISMISSED
- **Server-side pagination:** Dùng `DataTable` server mode với `serverPage`, `serverTotalPages`, `onServerPageChange`
- **Review dialog:** Khi bấm Eye icon, mở dialog cho admin chọn status (REVIEWED/ACTION_TAKEN/DISMISSED) + ghi chú
- **Quick dismiss:** Bấm XCircle icon dismiss trực tiếp không cần dialog
- **Hiển thị reporter:** Avatar + tên từ `report.reporter` (backend include)

**Flow xử lý report:**
```
Admin mở /admin/reports
→ useAdminReports({ page, status, targetType })
→ GET /admin/reports?page=1&limit=10&status=PENDING
→ Hiển thị DataTable

Admin bấm Eye icon
→ Mở review dialog
→ Chọn status + ghi chú
→ useReviewReport({ id, data: { status, adminNote } })
→ PATCH /admin/reports/:id
→ Invalidate query → refetch list
```

**Lưu ý:** Không dùng `Select` component (chưa có trong shared-ui) → thay bằng Badge buttons cho status selection trong dialog.

---

### 2.2 Admin Analytics (`/admin/analytics`)

**Trước:** Dùng `adminUserGrowth`, `adminRevenueData`, `adminCategoryDistribution` từ mock-data.ts + hardcoded `completionData`.

**Sau:** Wire với `GET /admin/analytics` (4 loại) + `GET /admin/dashboard` (overview stats).

**4 biểu đồ:**

| Biểu đồ | AnalyticsType | Data Keys | Loại chart |
|----------|---------------|-----------|------------|
| User Registrations | DAILY_USERS | students, instructors | Area |
| Revenue Trends | DAILY_REVENUE | revenue | Line |
| Enrollments | DAILY_ENROLLMENTS | count | Bar |
| New Courses | DAILY_COURSES | count | Bar |

**Date range selector:** 4 options — 7 ngày, 30 ngày, 3 tháng, 12 tháng. Khi đổi range, tính lại `from`/`to` rồi refetch tất cả 4 queries.

**Overview stat cards:** 4 cards trên cùng — Total Users, Total Courses, Total Revenue, New Users This Week. Dữ liệu từ `useAdminDashboard().overview`.

**Transform data:** Backend trả `AnalyticsSnapshot[]` với `{ date, data: Json }`. Frontend transform:
```typescript
// Backend: { date: "2026-03-21", data: { students: 5, instructors: 1 } }
// → Recharts: { date: "21/3", students: 5, instructors: 1 }
```

**Empty state:** Khi chưa có data (bảng analytics_snapshots rỗng), hiển thị "No data yet" trên mỗi chart. Data được thu thập bởi cron job `recordDailyAnalytics` chạy hàng ngày.

---

### 2.3 Admin Approvals Hub (`/admin/approvals`)

**Trước:** Dùng `instructorApplications.filter(...)` và `pendingCourseReviews.length` từ mock-data — chỉ 2 cards.

**Sau:** Dùng `useAdminDashboard()` lấy `pendingApprovals` thật — 4 cards.

**4 cards:**
1. **Instructor Applications** → link tới `/admin/approvals/instructors`
2. **Course Reviews** → link tới `/admin/approvals/courses`
3. **Reports** → link tới `/admin/reports` (mới thêm)
4. **Withdrawals** → link tới `/admin/withdrawals` (mới thêm)

Mỗi card hiển thị:
- Tên + icon
- Số lượng pending (Badge destructive nếu > 0)
- Mô tả

---

## 3. Cleanup

### 3.1 Xóa Curriculum Page

`/instructor/courses/[courseId]/curriculum/page.tsx` đã bị **xóa hoàn toàn**.

**Lý do:** Trang này trùng chức năng với CourseWizard (phase 5.14c). CourseWizard đã có tab curriculum editor đầy đủ — CRUD sections/chapters/lessons, reorder, upload video, tạo quiz. Giữ lại trang curriculum riêng sẽ duplicate code và phải maintain 2 nơi.

Instructor muốn chỉnh curriculum → vào `/instructor/courses/[id]/edit` → tab Curriculum.

### 3.2 Xóa mock-data.ts

File `apps/management-portal/src/lib/mock-data.ts` (1,361 dòng) đã bị **xóa hoàn toàn**.

Sau khi wire tất cả các trang, không còn file nào import từ `@/lib/mock-data`. Kiểm tra bằng:
```bash
grep -r "mock-data" apps/management-portal/src/  # → No matches
```

---

## 4. Backend Fix: Rate Limiting

### Vấn đề
Trang Analytics gửi **5 request đồng thời** (dashboard + 4 analytics types). Rate limit cũ `short: 3 req/s` → request thứ 4+ bị **429 Too Many Requests**.

### Giải pháp
1. **Tăng rate limit** cho hợp lý hơn:
   - `short`: 3 → **10** req/s
   - `medium`: 20 → **50** req/10s
   - `long`: 100 → **200** req/min

2. **Skip throttle cho admin analytics controller** vì admin đã xác thực, không cần giới hạn chặt:
   ```typescript
   @Controller('admin')
   @SkipThrottle()  // Skip rate limiting
   @Roles('ADMIN')  // Already requires admin auth
   ```

### Lưu ý về rate limit
- Rate limit tính **per IP** — nhiều user cùng IP (NAT, VPN) chia chung limit
- Login endpoint có rate limit riêng qua Redis (5 lần / 15 phút) — không bị ảnh hưởng bởi ThrottlerModule
- Sections/Chapters controller cũng đã `@SkipThrottle()` (từ phase 5.14c) vì curriculum editing gửi nhiều request liên tiếp

---

## 5. Shared Layer

### admin.service.ts — 3 methods mới

```typescript
// Reports
getReports(params)    → GET /admin/reports?page=1&status=PENDING&targetType=POST
reviewReport(id, data) → PATCH /admin/reports/:id { status, adminNote }

// Analytics
getAnalytics(params)  → GET /admin/analytics?type=DAILY_USERS&from=2026-02-20&to=2026-03-22
```

### use-admin.ts — 3 hooks mới

| Hook | Loại | Mục đích |
|------|------|----------|
| `useAdminReports(params)` | Query | Lấy danh sách reports với filter |
| `useReviewReport()` | Mutation | Xử lý report (review/dismiss/action) |
| `useAdminAnalytics(params)` | Query | Lấy analytics data theo type + date range |

`useAdminAnalytics` có `enabled` guard — chỉ fetch khi có đủ `type`, `from`, `to`.

---

## 6. i18n

Thêm khoảng **20 keys** cho cả en.json và vi.json:

- `reports`: question, user, reviewReport, actionTaken, adminNote, adminNotePlaceholder
- `analytics`: totalUsers, totalCourses, totalRevenue, newUsersThisWeek, noData, enrollments, newCourses, revenue
- `approvals`: reportsTitle, pendingReports, withdrawalsTitle, pendingWithdrawals
- `common.statusLabels`: ACTION_TAKEN
- `common`: success

---

## 7. Kết quả

Sau phase này, **toàn bộ Management Portal đã hoàn thiện**:

### Instructor (10 trang) ✅
- Dashboard, Courses, Course Create/Edit, Course Students
- Revenue, Withdrawals, Coupons, Coupons/New, Q&A, Settings

### Admin (12 trang) ✅
- Dashboard, Users, Courses, Course Detail
- Categories, Approvals Hub, Instructor Approvals, Course Approvals
- Reports, Analytics, Withdrawals, Settings

**Tổng: 22 trang** — tất cả đã wire API thật, không còn mock data.
