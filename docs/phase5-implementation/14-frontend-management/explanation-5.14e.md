# Giải thích — Phase 5.14e: Instructor Pages (Revenue, Withdrawals, Coupons, Students, Q&A, Settings)

> Wire 7 trang instructor từ mock data sang real API. Fix logic tính hoa hồng khi có coupon.

---

## 1. Tổng quan thay đổi

```
┌── TRƯỚC ──────────────────┐    ┌── SAU ────────────────────────┐
│                            │    │                                │
│ 7 trang dùng mock data     │───▷│ 7 trang wire API thật          │
│ Hoa hồng tính trên giá gốc│───▷│ Hoa hồng tính trên giá thực trả│
│ Balance tính bằng aggregate│───▷│ Balance cached trên profile     │
│ Withdrawal lock earning    │───▷│ Withdrawal trừ balance trực tiếp│
│                            │    │                                │
└────────────────────────────┘    └────────────────────────────────┘
```

---

## 2. Fix quan trọng: Hoa hồng + Coupon

### Vấn đề cũ

Khi student mua khóa học 10,000₫ với coupon giảm 1,000₫:
- Student trả thực tế: 9,000₫
- Nhưng earning tính trên `item.price` (giá gốc 10,000₫)
- Instructor nhận 70% × 10,000 = **7,000₫** → sai!
- Platform thu 30% × 10,000 = 3,000₫
- Tổng: 7,000 + 3,000 = 10,000 > 9,000 (thu thực tế) → **lỗ 1,000₫**

### Giải pháp: Per-item discount

**Bước 1 — Lưu discount per-item khi tạo order:**

```
Coupon SALE20: giảm 20% cho Course A + B (không áp dụng Course C)

Order: Course A (100k) + Course B (50k) + Course C (30k)
├── applicableAmount = 100k + 50k = 150k
├── totalDiscount = 150k × 20% = 30k
│
├── distributeDiscount():
│   ├── Item A: discount = (100/150) × 30k = 20k
│   ├── Item B: discount = (50/150) × 30k = 10k
│   └── Item C: discount = 0 (không applicable)
│
└── OrderItem lưu: { price: 100000, discount: 20000 }
                    { price: 50000,  discount: 10000 }
                    { price: 30000,  discount: 0 }
```

**Bước 2 — Webhook tính earning trên giá thực trả:**

```typescript
const actualPrice = item.price - item.discount;  // 100k - 20k = 80k
const commissionAmount = actualPrice * 0.3;       // 80k × 30% = 24k
const netAmount = actualPrice - commissionAmount;  // 80k - 24k = 56k
```

**Bước 3 — Coupon service trả thêm `applicableCourseIds`:**

```typescript
// Trước: return { couponId, discount }
// Sau:   return { couponId, discount, applicableCourseIds }
```

`applicableCourseIds = null` nghĩa là coupon áp dụng cho tất cả courses.

### distributeDiscount() — phân bổ thông minh

```typescript
private distributeDiscount(cartItems, discountAmount, applicableCourseIds) {
  // 1. Tìm items applicable (match courseIds hoặc all nếu null)
  // 2. Tính tổng giá applicable items
  // 3. Phân bổ proportionally: itemDiscount = (itemPrice / total) × discount
  // 4. Item cuối nhận remainder (tránh lỗi làm tròn)
  // 5. Items không applicable: discount = 0
}
```

---

## 3. Available Balance — Đơn giản hóa withdrawal

### Vấn đề cũ

```
Withdrawal cũ:
├── Tính balance = SUM(earnings WHERE status=AVAILABLE)  ← aggregate mỗi lần
├── Lock earnings: mark AVAILABLE → WITHDRAWN (FIFO)
├── Nếu earning > amount cần rút → phải split earning record
└── Phức tạp, dễ bug (VD: earning 6,300 rút 5,000 → mất 1,300)
```

### Giải pháp: Cached balance

```
Schema mới: InstructorProfile.availableBalance Float @default(0)

Flow:
1. Cron hàng ngày 1 AM:
   ├── Tìm earnings: status=PENDING, availableAt <= now
   ├── Mark status → AVAILABLE
   └── instructorProfile.availableBalance += netAmount

2. Withdrawal:
   ├── Check: amount <= profile.availableBalance
   ├── Tạo withdrawal record
   └── instructorProfile.availableBalance -= amount

3. Dashboard:
   └── Đọc profile.availableBalance (không cần aggregate)
```

**Ưu điểm:**
- Không cần lock/split earning records
- Withdrawal chỉ là 1 phép trừ đơn giản
- Dashboard đọc 1 field thay vì aggregate toàn bộ earnings table
- Không mất tiền dư khi rút

---

## 4. Instructor Profile Counters

### Cập nhật khi thanh toán (webhook)

```
Thanh toán thành công → webhook completeOrder():
├── Tạo enrollment (FULL hoặc PARTIAL)
├── Tạo earning (PENDING, availableAt = +7 ngày)
│
├── InstructorProfile.totalRevenue += netAmount
│   (tổng doanh thu tích lũy, chỉ tăng)
│
└── InstructorProfile.totalStudents += 1
    (chỉ 1 lần per instructor per order, dùng Set track)
```

**Set track unique students:**
```typescript
const instructorStudentAdded = new Set<string>();
// ...
const studentIncrement = instructorStudentAdded.has(instructorId) ? 0 : 1;
instructorStudentAdded.add(instructorId);
```

Nếu 1 order mua 3 khóa của cùng 1 instructor → `totalStudents` chỉ +1.

---

## 5. Trang Revenue

### Dữ liệu từ `GET /instructor/dashboard`

```typescript
{
  overview: {
    totalRevenue: 15000000,      // Tổng tích lũy
    totalStudents: 120,          // Tổng học viên
    totalCourses: 5,             // Số khóa PUBLISHED
    availableBalance: 3200000,   // Số dư có thể rút
    pendingBalance: 800000       // Đang chờ (7 ngày)
  },
  recentEarnings: [              // 10 earnings gần nhất (30 ngày)
    { id, netAmount, status, createdAt, orderItem: { title, price } }
  ],
  courseStats: [                  // Top 10 courses theo students
    { id, title, totalStudents, avgRating }
  ]
}
```

### UI: 4 stat cards + 2 tables

- **Stat cards:** Total Revenue, Total Students, Pending Withdrawal, Available Balance
- **Recent Earnings:** bảng thu nhập gần đây với status badge (PENDING/AVAILABLE/WITHDRAWN)
- **Revenue by Course:** bảng khóa học với số lượng enrollment và rating
- **Nút "Withdraw"** → navigate sang trang Withdrawals

### Tại sao không có biểu đồ doanh thu theo tháng?

Dashboard API chỉ trả aggregate totals + 10 earnings gần nhất. Không có endpoint analytics monthly.
→ Thay biểu đồ bằng bảng Recent Earnings. Biểu đồ có thể thêm sau khi có analytics endpoint.

---

## 6. Trang Withdrawals

### Flow rút tiền

```
1. Instructor vào trang Withdrawals
   ├── Hiển thị: Available Balance (từ dashboard)
   ├── Hiển thị: Bảng lịch sử rút tiền
   └── Nút "Request Withdrawal" (disabled nếu balance < 5,000)

2. Ấn "Request Withdrawal" → mở Dialog
   ├── Input: Số tiền (min 5,000, max availableBalance)
   ├── Input: Tên ngân hàng
   ├── Input: Số tài khoản
   ├── Input: Tên chủ tài khoản
   └── Pre-fill bank info từ withdrawal gần nhất

3. Submit → POST /instructor/withdrawals
   ├── Backend check: amount <= availableBalance
   ├── Tạo Withdrawal record (status: PENDING)
   ├── InstructorProfile.availableBalance -= amount
   └── Invalidate queries: withdrawals + dashboard

4. Admin duyệt (ở trang Admin Withdrawals)
   ├── APPROVED → chuyển tiền thật
   └── REJECTED → reviewNote gửi lại instructor
```

### Bảng lịch sử

| Cột | Dữ liệu |
|-----|----------|
| Date | withdrawal.createdAt |
| Amount | withdrawal.amount (formatPrice) |
| Bank | bankInfo.bankName |
| Account | bankInfo.accountNumber |
| Status | StatusBadge (PENDING/APPROVED/REJECTED) |
| Notes | reviewNote từ admin (khi REJECTED) |

---

## 7. Trang Coupons

### List page — Status logic

```typescript
function computeStatus(coupon): string {
  if (!coupon.isActive) return 'DISABLED';      // Admin/instructor đã tắt
  if (endDate < now)     return 'EXPIRED';       // Hết hạn
  if (startDate > now)   return 'SCHEDULED';     // Chưa tới ngày
  return 'ACTIVE';                               // Đang hoạt động
}
```

### Create Coupon — Form fields

| Field | Backend DTO | Validation |
|-------|-------------|------------|
| Code | `code: string` | Min 4 chars, uppercase alphanumeric, auto-generate |
| Type | `type: PERCENTAGE \| FIXED_AMOUNT` | Required |
| Value | `value: number` | > 0, PERCENTAGE: 1-100 |
| Usage Limit | `usageLimit?: number` | Optional, min 1 |
| Max Per User | `maxUsesPerUser?: number` | Default 1 |
| Min Order | `minOrderAmount?: number` | Optional |
| Max Discount | `maxDiscount?: number` | Only for PERCENTAGE |
| Courses | `applicableCourseIds?: string[]` | All or specific (PUBLISHED only) |
| Start Date | `startsAt: ISO string` | Required, < endDate |
| End Date | `expiresAt: ISO string` | Required |

### Preview card

Live preview bên phải form — hiển thị code, giá trị giảm, số lượng courses, thời hạn.

---

## 8. Trang Course Students

### Endpoint mới: GET /instructor/courses/:courseId/students

```
Controller nhận request
├── Verify ownership (instructorId === course.instructorId)
├── Query enrollments WHERE courseId, optional search by fullName
├── Include user: { id, fullName, email, avatarUrl }
└── Return paginated result
```

### UI

- Header: course title + "Students" subtitle
- Search input (debounced 500ms)
- Bảng: Student (avatar + name + email), Enrolled date, Type (FULL/PARTIAL badge), Progress bar
- Stat cards: Total Students, Completion Rate

---

## 9. Trang Q&A

### Filter strategy

```
Instructor Q&A = GET /questions?instructorId=xxx

Backend:
├── QueryQuestionsDto nhận instructorId (optional)
├── questions.service.findAll():
│   where: { course: { instructorId: query.instructorId } }
└── Trả questions từ TẤT CẢ courses của instructor
```

Không cần gọi API per-course. 1 query lấy hết questions.

### Course filter (frontend)

```
Badge buttons: [All] [Course A] [Course B] ...

- "All": không truyền courseId → hiện tất cả
- Click course: truyền courseId → server filter
- Courses lấy từ useInstructorCourses (PUBLISHED only)
```

### Status tabs

```
Tabs: All | Unanswered | Answered

- Server-side filter: status query param
- "all" → không truyền status
- "unanswered" → status=unanswered (bestAnswerId = null)
- "answered" → status=answered (bestAnswerId != null)
```

### Answer dialog

```
Click "Reply" → mở Dialog
├── Hiển thị question title + content
├── Textarea cho câu trả lời
├── Submit → POST /questions/:id/answers
├── Success → close dialog, toast, invalidate queries
└── Answer count tự tăng (server-side)
```

---

## 10. Trang Settings

### Profile tab

```
Dữ liệu từ GET /instructor/profile:
├── user.fullName (disabled — không sửa ở đây)
├── user.email (disabled)
├── headline: "Senior React Developer"
├── biography: "10 năm kinh nghiệm..."
└── expertise: ["React", "Node.js", "TypeScript"]

Save → PATCH /instructor/profile { headline, biography, expertise }
```

### Expertise tag input

```
Input + Enter → thêm tag
├── Kiểm tra trùng trước khi thêm
├── Click "×" → xóa tag
└── Gửi mảng string[] lên API
```

### Payout tab — tại sao không có form ngân hàng?

`InstructorProfile` model KHÔNG có fields bank info. Bank info được lưu per-withdrawal (`Withdrawal.bankInfo: Json`).
→ Payout tab hiển thị thông báo + link sang Withdrawals page.
→ Mỗi lần rút tiền instructor nhập bank info (pre-fill từ lần trước).

### Notifications tab — "Coming soon"

Backend chưa có model `NotificationPreference`. Hiện chỉ hiện thông báo "Coming soon".

---

## 11. API Client pattern: toQuery()

### Vấn đề

`apiClient.get(path, params)` nhận `Record<string, string>` — flat object.

```typescript
// ❌ Sai: gửi { params: [object Object] } → API nhận ?params=[object Object]
apiClient.get('/coupons', { params })

// ✅ Đúng: gửi ?page=1&limit=10
apiClient.get('/coupons', toQuery(params))
```

### Giải pháp

Mỗi service có helper `toQuery()`:
```typescript
function toQuery(params?: { page?: number; limit?: number }): Record<string, string> {
  const q: Record<string, string> = {};
  if (params?.page) q.page = String(params.page);
  if (params?.limit) q.limit = String(params.limit);
  return q;
}
```

Pattern giống `courseService.toQueryParams()` đã có sẵn.

---

## 12. Data extraction pattern

### Paginated endpoints

```typescript
// API trả: { data: [...], meta: { page, limit, total, totalPages } }
// useQuery wraps: { data: { data: [...], meta: {...} } }

const { data } = useInstructorCoupons();
const coupons = (data?.data ?? []) as Coupon[];  // mảng items
const meta = data?.meta;                          // pagination meta
```

### Non-paginated endpoints

```typescript
// API trả: { data: { overview, recentEarnings, courseStats } }
// useQuery wraps: { data: { data: { overview, ... } } }

const { data } = useInstructorDashboard();
const dashboard = data?.data as DashboardData;   // object trực tiếp
```

---

## 13. Hydration fix — Navbar cart badge

### Vấn đề

`cartCount` từ Zustand persist (localStorage):
- Server render: `cartCount = 0` (không có localStorage)
- Client hydrate: `cartCount = 3` (từ localStorage)
→ Mismatch → React warning

### Fix

```tsx
// Trước: {cartCount > 0 && <span>...</span>}
// Sau:   {hydrated && cartCount > 0 && <span>...</span>}
```

`hydrated` = `useAuthHydrated()` → `false` on server, `true` after client hydration.
→ Badge ẩn on server, hiện on client → không mismatch.

---

## 14. Tóm tắt files

| Action | Count |
|--------|-------|
| Created | 10 files (1 DTO, 3 services, 3 hooks, 1 UI component, 1 migration, 1 explanation) |
| Modified | 21 files (7 backend, 5 shared, 7 pages, 2 i18n) |
| **Total** | **31 files** |

---

## 15. Bài học rút ra

1. **Per-item discount** — Coupon giảm ở tổng order nhưng earning tính per-item → phải phân bổ discount xuống từng item và lưu lại. Không thể tính lại lúc webhook vì coupon có thể hết hạn.

2. **Cached counters vs Aggregates** — `availableBalance` cached trên profile tốt hơn aggregate toàn bộ earnings table mỗi lần load dashboard. Trade-off: phải đảm bảo cập nhật đúng ở mọi nơi (cron, withdrawal).

3. **apiClient.get() nhận flat params** — Không phải axios-style `{ params: {...} }`. Cần convert qua `toQuery()` helper.

4. **Data extraction** — Paginated: `data?.data` = array, `data?.meta` = meta. Non-paginated: `data?.data` = object. Không nest thêm 1 lớp.

5. **Hydration mismatch** — Client-only state (localStorage, Zustand persist) phải được guard bằng `hydrated` check để tránh SSR mismatch.

6. **InstructorProfile counters** — `totalStudents` chỉ increment 1 per instructor per order (dùng Set), không phải per item. Tránh đếm trùng khi mua nhiều khóa cùng instructor.
