# 4. MANAGEMENT PORTAL — Instructor & Admin Pages

> URL: manage.app.com | Target: Instructor + Admin
> Framework: Next.js 16 (App Router) | Min screen: 1024px (desktop-only)
> Layout: Sidebar + Header + Content

---

## 4.1 Route Structure

```
app/[locale]/
├── layout.tsx                              # Root layout
├── not-found.tsx                           # 404
├── error.tsx                               # Error boundary
│
├── (auth)/
│   ├── layout.tsx                          # Auth layout (centered card)
│   ├── login/page.tsx                      # Login (shared credentials)
│   └── unauthorized/page.tsx               # "Bạn chưa có quyền truy cập"
│
├── (instructor)/                           # Instructor pages
│   ├── layout.tsx                          # Sidebar layout (Instructor nav)
│   ├── dashboard/page.tsx                  # Instructor dashboard
│   ├── courses/
│   │   ├── page.tsx                        # My courses list
│   │   ├── new/page.tsx                    # Create course wizard
│   │   └── [courseId]/
│   │       ├── edit/page.tsx               # Edit course wizard
│   │       ├── curriculum/page.tsx         # Curriculum editor
│   │       └── students/page.tsx           # Student list for this course
│   ├── revenue/page.tsx                    # Revenue dashboard
│   ├── withdrawals/page.tsx                # Withdrawal requests
│   ├── coupons/
│   │   ├── page.tsx                        # Coupon list
│   │   └── new/page.tsx                    # Create coupon
│   ├── qna/page.tsx                        # Q&A from students
│   └── settings/page.tsx                   # Instructor settings
│
└── (admin)/                                # Admin pages
    ├── layout.tsx                          # Sidebar layout (Admin nav)
    ├── dashboard/page.tsx                  # Admin analytics dashboard
    ├── users/
    │   ├── page.tsx                        # User management
    │   └── [userId]/page.tsx               # User detail
    ├── approvals/
    │   ├── instructors/page.tsx            # Instructor applications
    │   └── courses/page.tsx                # Course reviews
    ├── courses/page.tsx                    # All courses list
    ├── categories/page.tsx                 # Category CRUD
    ├── withdrawals/page.tsx                # Withdrawal requests (admin view)
    ├── reports/page.tsx                    # Content reports
    ├── analytics/page.tsx                  # Detailed analytics
    └── settings/page.tsx                   # Platform settings
```

---

## 4.2 Portal Access Control

```
Login Flow (manage.app.com/login):
  1. User enters email + password (same as Student Portal)
  2. POST /api/auth/login → receive JWT
  3. Check user.role:
     - INSTRUCTOR → redirect /instructor/dashboard
     - ADMIN      → redirect /admin/dashboard
     - STUDENT    → redirect /unauthorized ("Bạn chưa có quyền truy cập")

Cross-portal (from Student Portal):
  1. Click "Cổng quản lý" → POST /api/auth/ott (One-Time Token)
  2. Redirect: manage.app.com/auth/exchange?token=xxx
  3. Backend validates OTT → issue new JWT for management portal
  4. Redirect to appropriate dashboard

Layout Guard:
  - (instructor) layout.tsx → check role === INSTRUCTOR || ADMIN
  - (admin) layout.tsx → check role === ADMIN only
  - Unauthorized → redirect to /unauthorized
```

---

## 4.3 Management Portal Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌────────┬─────────────────────────────────────────────────┐   │
│  │        │  Header                                         │   │
│  │        │  ┌─────────────────────────────────────────────┐│   │
│  │        │  │ ☰ │ Dashboard > Courses   │ 🔍 │ 🔔 │🌙│🌐│👤│  │
│  │        │  └─────────────────────────────────────────────┘│   │
│  │ SIDEBAR├─────────────────────────────────────────────────┤   │
│  │        │                                                 │   │
│  │  Logo  │              PAGE CONTENT                       │   │
│  │  ────  │                                                 │   │
│  │        │              (max-w-6xl, responsive padding)    │   │
│  │  Nav   │                                                 │   │
│  │  items │                                                 │   │
│  │        │                                                 │   │
│  │  ────  │                                                 │   │
│  │        │                                                 │   │
│  │  ← ☐   │                                                 │   │
│  │ Collapse│                                                │   │
│  │        │                                                 │   │
│  │  ────  │                                                 │   │
│  │  👤    │                                                 │   │
│  │  User  │                                                 │   │
│  │  menu  │                                                 │   │
│  │        │                                                 │   │
│  └────────┴─────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Sidebar: 260px (expanded) / 68px (collapsed, icon-only)
  - Collapse toggle button at bottom
  - State persisted in localStorage
  - Hover on collapsed sidebar → show tooltip with label
```

### Sidebar — Instructor

```
┌──────────────────────┐
│  🎓 SSML             │  ← Logo
│  Management           │
├──────────────────────┤
│                      │
│  📊 Bảng điều khiển  │  ← /instructor/dashboard
│  📚 Khóa học         │  ← /instructor/courses
│  💰 Doanh thu        │  ← /instructor/revenue
│  💸 Rút tiền         │  ← /instructor/withdrawals
│  🎫 Mã giảm giá     │  ← /instructor/coupons
│  ❓ Hỏi đáp          │  ← /instructor/qna
│                      │
├──────────────────────┤
│  ⚙ Cài đặt          │  ← /instructor/settings
│  ↩ Về Student Portal │  ← link to student.app.com
├──────────────────────┤
│  « Thu gọn           │
├──────────────────────┤
│  👤 Nguyễn Văn A     │
│  Instructor           │
│  [🚪 Đăng xuất]      │
└──────────────────────┘
```

### Sidebar — Admin

```
┌──────────────────────┐
│  🎓 SSML             │
│  Admin                │
├──────────────────────┤
│                      │
│  📊 Bảng điều khiển  │  ← /admin/dashboard
│  👥 Người dùng       │  ← /admin/users
│  ✅ Phê duyệt        │  ← Expandable
│    ├ Giảng viên      │  ← /admin/approvals/instructors
│    └ Khóa học        │  ← /admin/approvals/courses
│  📚 Khóa học         │  ← /admin/courses
│  🏷 Danh mục        │  ← /admin/categories
│  💸 Rút tiền         │  ← /admin/withdrawals
│  🚨 Báo cáo          │  ← /admin/reports
│  📈 Thống kê         │  ← /admin/analytics
│                      │
├──────────────────────┤
│  ⚙ Cấu hình         │  ← /admin/settings
├──────────────────────┤
│  « Thu gọn           │
├──────────────────────┤
│  👤 Admin             │
│  Administrator        │
│  [🚪 Đăng xuất]      │
└──────────────────────┘
```

---

## 4.4 Instructor Pages — Chi tiết

---

### PAGE: Instructor Dashboard (`/instructor/dashboard`)

```
Route:     /instructor/dashboard
Auth:      Instructor
Rendering: Server Component + Client charts
API:       GET /api/instructor/dashboard
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │ Header                                                │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│          │  Xin chào, Nguyễn Văn A!                             │
│          │                                                      │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│          │  │ 💰       │ │ 👨‍🎓      │ │ 📚       │ │ ⭐       ││
│          │  │ 12.5M₫   │ │ 1,234    │ │ 5        │ │ 4.7      ││
│          │  │ Tổng DT  │ │ Học viên │ │ Khóa học │ │ Đánh giá ││
│          │  │ ↑12%     │ │ ↑8%      │ │          │ │          ││
│          │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│          │                                                      │
│          │  ┌───────────────────────────────────────────────┐   │
│          │  │  📈 BIỂU ĐỒ DOANH THU (Recharts)             │   │
│          │  │                                               │   │
│          │  │  Line chart: Revenue by month (last 12 months)│   │
│          │  │  Toggle: [Theo tháng] [Theo tuần]             │   │
│          │  │                                               │   │
│          │  │  ▁▂▃▅▆▇█▇▆▅▃▂                                │   │
│          │  │  T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12     │   │
│          │  └───────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ┌────────────────────────┬──────────────────────┐   │
│          │  │                        │                      │   │
│          │  │  📋 ĐĂNG KÝ GẦN ĐÂY   │  🏆 KHÓA BÁN CHẠY   │   │
│          │  │                        │                      │   │
│          │  │  👤 User A → React     │  1. React Course     │   │
│          │  │     2 giờ trước        │     234 enrollments  │   │
│          │  │  👤 User B → Node.js   │  2. Node.js Course   │   │
│          │  │     5 giờ trước        │     189 enrollments  │   │
│          │  │  👤 User C → React     │  3. CSS Masterclass  │   │
│          │  │     1 ngày trước       │     156 enrollments  │   │
│          │  │                        │                      │   │
│          │  └────────────────────────┴──────────────────────┘   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: My Courses List (`/instructor/courses`)

```
Route:     /instructor/courses
Auth:      Instructor
API:       GET /api/instructor/courses
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Khóa học của tôi                   [ + Tạo mới ]    │
│          │                                                      │
│          │  [Tất cả] [Nháp] [Chờ duyệt] [Đã duyệt] [Bị từ chối]│
│          │                                                      │
│          │  🔍 [Tìm kiếm khóa học...]                           │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │ DataTable                                      │  │
│          │  ├──────┬────────────┬────────┬────────┬──────────┤  │
│          │  │Thumb │ Tên        │Trạng th│Học viên│ Actions  │  │
│          │  ├──────┼────────────┼────────┼────────┼──────────┤  │
│          │  │ 🖼   │ React...   │🟢 Đã   │ 234    │ ✏️ 👁 📊│  │
│          │  │      │            │  duyệt │        │          │  │
│          │  ├──────┼────────────┼────────┼────────┼──────────┤  │
│          │  │ 🖼   │ Node.js... │🟡 Chờ  │ —      │ ✏️ 👁   │  │
│          │  │      │            │  duyệt │        │          │  │
│          │  ├──────┼────────────┼────────┼────────┼──────────┤  │
│          │  │ 🖼   │ CSS...     │⚪ Nháp │ —      │ ✏️ 🗑   │  │
│          │  └──────┴────────────┴────────┴────────┴──────────┘  │
│          │                                                      │
│          │  ← 1  2  3  →                                        │
└──────────┴──────────────────────────────────────────────────────┘

Actions per status:
  DRAFT:          Edit, Delete
  PENDING_REVIEW: Edit (limited), Preview
  APPROVED:       Edit content, Preview, View Students, Analytics
  REJECTED:       Edit (fix issues), Re-submit, View feedback
```

---

### PAGE: Course Wizard — Create/Edit (`/instructor/courses/new`)

```
Route:     /instructor/courses/new (hoặc /instructor/courses/[courseId]/edit)
Auth:      Instructor
Rendering: Client Component (multi-step form, drag & drop)
API:       POST/PUT /api/instructor/courses/:id + sub-resources
```

#### Multi-step Wizard

```
Step Indicator:
  ① Thông tin ──── ② Nội dung ──── ③ Định giá ──── ④ Xem lại

┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Tạo khóa học mới                                    │
│          │                                                      │
│          │  ① ─── ② ─── ③ ─── ④                                │
│          │  ● Thông tin  ○ Nội dung  ○ Định giá  ○ Xem lại     │
│          │                                                      │
│          │  ═══════ STEP 1: THÔNG TIN CƠ BẢN ═══════           │
│          │                                                      │
│          │  Tên khóa học *                                      │
│          │  [Lập trình React từ cơ bản đến nâng cao       ]    │
│          │                                                      │
│          │  Mô tả ngắn *                                        │
│          │  [Khóa học toàn diện về React...                ]    │
│          │                                                      │
│          │  Mô tả chi tiết *                                    │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │  B I U ≡ ⟨⟩ 📷 │  Tiptap Rich Text Editor  │    │
│          │  │                                              │    │
│          │  │  Nội dung mô tả chi tiết...                  │    │
│          │  │                                              │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
│          │  Danh mục *            Trình độ *                    │
│          │  [▾ Web Development]   [▾ Trung cấp]                 │
│          │                                                      │
│          │  Thẻ (tags)                                           │
│          │  [React] [JavaScript] [Frontend] [+]                 │
│          │                                                      │
│          │  Ngôn ngữ *            Ảnh bìa                       │
│          │  [▾ Tiếng Việt]        [📷 Upload] (preview)        │
│          │                                                      │
│          │  Video giới thiệu                                    │
│          │  [📹 Upload video]  (hoặc nhập URL)                 │
│          │                                                      │
│          │  Bạn sẽ học được gì *                                │
│          │  ✓ [Hiểu React fundamentals              ] [✕]      │
│          │  ✓ [Build production-ready apps           ] [✕]      │
│          │  ✓ [                                       ] [+]     │
│          │                                                      │
│          │  Yêu cầu tiên quyết                                  │
│          │  • [JavaScript cơ bản                     ] [✕]      │
│          │  • [                                       ] [+]     │
│          │                                                      │
│          │  [ Lưu nháp ]              [ Tiếp theo → ]           │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### Step 2: Curriculum Editor

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  ═══════ STEP 2: NỘI DUNG ═══════                   │
│          │                                                      │
│          │  [ + Thêm phần ]                                     │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  ≡ Section 1: Giới thiệu React        ✏️ 🗑   │  │
│          │  │  ────────────────────────────────────────────  │  │
│          │  │                                                │  │
│          │  │  ┌──────────────────────────────────────────┐  │  │
│          │  │  │  ≡ Chapter 1: React là gì?       ✏️ 🗑  │  │  │
│          │  │  │  ┌────────────────────────────────────┐  │  │  │
│          │  │  │  │ ≡ 📹 Bài 1: Welcome (5:30)   ☐Free│  │  │  │
│          │  │  │  │   ✏️ 🗑    [📹 Upload video]      │  │  │  │
│          │  │  │  ├────────────────────────────────────┤  │  │  │
│          │  │  │  │ ≡ 📝 Bài 2: Setup Guide      ☐Free│  │  │  │
│          │  │  │  │   ✏️ 🗑                            │  │  │  │
│          │  │  │  ├────────────────────────────────────┤  │  │  │
│          │  │  │  │ ≡ 📋 Quiz: Kiểm tra hiểu biết    │  │  │  │
│          │  │  │  │   ✏️ 🗑                            │  │  │  │
│          │  │  │  └────────────────────────────────────┘  │  │  │
│          │  │  │  [ + Thêm bài học ]                      │  │  │
│          │  │  └──────────────────────────────────────────┘  │  │
│          │  │  [ + Thêm chương ]                             │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  ≡ Section 2: Components              ✏️ 🗑   │  │
│          │  │  ...                                           │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
│          │  ≡ = Drag handle (drag & drop to reorder)            │
│          │                                                      │
│          │  [ ← Quay lại ]          [ Lưu nháp ] [ Tiếp → ]   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘

Lesson Edit Modal (khi click ✏️ trên lesson):
┌─────────────────────────────────────────────────┐
│  Chỉnh sửa bài học                         ✕    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Tên bài học: [_________________________]       │
│                                                  │
│  Loại: ○ Video  ○ Bài viết  ○ Bài kiểm tra     │
│                                                  │
│  [Nếu Video:]                                    │
│  ┌─────────────────────────────────────────┐    │
│  │  📹 Upload video                        │    │
│  │  Drag & drop hoặc click để chọn file    │    │
│  │  MP4, max 500MB, max 30 phút            │    │
│  │                                          │    │
│  │  ████████████░░░░ 78% uploading...      │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  [Nếu Text:]                                     │
│  ┌─────────────────────────────────────────┐    │
│  │  Tiptap Rich Text Editor                │    │
│  │  B I U ≡ ⟨⟩ 📷 table link              │    │
│  │                                          │    │
│  │  Nội dung bài viết...                    │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  [Nếu Quiz:]                                     │
│  Câu 1:  [_________________________]            │
│  ○ A: [_____________]  ☐ Đáp án đúng           │
│  ○ B: [_____________]  ☐ Đáp án đúng           │
│  ○ C: [_____________]  ☐ Đáp án đúng           │
│  ○ D: [_____________]  ☐ Đáp án đúng           │
│  Giải thích: [_________________________]        │
│  [+ Thêm câu hỏi]                               │
│                                                  │
│  ☐ Bài học miễn phí (cho preview)               │
│                                                  │
│  [ Hủy ]                      [ Lưu ]           │
└─────────────────────────────────────────────────┘
```

#### Step 3: Pricing

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  ═══════ STEP 3: ĐỊNH GIÁ ═══════                   │
│          │                                                      │
│          │  Giá cả khóa học *                                   │
│          │  [499,000] ₫     ○ Miễn phí                          │
│          │                                                      │
│          │  ── Giá theo chương ──                               │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │ Chapter              │ Lessons │ Giá (₫)       │  │
│          │  ├──────────────────────┼─────────┼───────────────┤  │
│          │  │ Ch.1: React Basic    │ 5       │ [99,000  ]    │  │
│          │  │ Ch.2: Hooks          │ 8       │ [149,000 ]    │  │
│          │  │ Ch.3: State Mgmt     │ 6       │ [149,000 ]    │  │
│          │  │ Ch.4: Advanced       │ 7       │ [149,000 ]    │  │
│          │  ├──────────────────────┼─────────┼───────────────┤  │
│          │  │ Tổng chapters        │ 26      │ 546,000₫     │  │
│          │  └──────────────────────┴─────────┴───────────────┘  │
│          │                                                      │
│          │  ✅ Tổng chapters (546,000₫) > giá cả khóa (499,000₫)│
│          │  → Khuyến khích mua cả khóa (tiết kiệm 47,000₫)    │
│          │                                                      │
│          │  [ ← Quay lại ]          [ Lưu nháp ] [ Tiếp → ]   │
└──────────┴──────────────────────────────────────────────────────┘
```

#### Step 4: Review & Submit

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  ═══════ STEP 4: XEM LẠI & GỬI DUYỆT ═══════       │
│          │                                                      │
│          │  ┌── Checklist ──────────────────────────────────┐   │
│          │  │ ✅ Thông tin cơ bản đầy đủ                    │   │
│          │  │ ✅ Có ít nhất 1 section, 1 chapter, 1 lesson  │   │
│          │  │ ✅ Tất cả video đã upload xong (status: READY)│   │
│          │  │ ✅ Giá hợp lệ (sum chapters > full price)     │   │
│          │  │ ✅ Có ảnh bìa                                 │   │
│          │  │ ⚠️ Chưa có video giới thiệu (không bắt buộc) │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ── Preview ──                                       │
│          │  (Compact view of all course info + curriculum)      │
│          │                                                      │
│          │  [ ← Quay lại ]   [ Lưu nháp ]   [ 🚀 Gửi duyệt ] │
│          │                                                      │
│          │  ⚠ Sau khi gửi duyệt, bạn không thể chỉnh sửa     │
│          │    cấu trúc (thêm/xóa bài) cho đến khi được duyệt. │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Revenue Dashboard (`/instructor/revenue`)

```
Route:     /instructor/revenue
Auth:      Instructor
API:       GET /api/instructor/revenue
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Doanh thu                                           │
│          │                                                      │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│          │  │ 💚       │ │ 🟡       │ │ 💸       │ │ 💰       ││
│          │  │ 3.2M₫    │ │ 1.5M₫    │ │ 8.5M₫    │ │ 13.2M₫   ││
│          │  │ Khả dụng │ │ Đang chờ │ │ Đã rút   │ │ Tổng     ││
│          │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│          │                                                      │
│          │  [ Yêu cầu rút tiền ]  (khi balance ≥ 200,000₫)    │
│          │                                                      │
│          │  ┌───────────────────────────────────────────────┐   │
│          │  │  📈 BIỂU ĐỒ THU NHẬP                         │   │
│          │  │  [Theo tháng ▾]  [Theo khóa học ▾]            │   │
│          │  │                                               │   │
│          │  │  Bar chart: monthly earnings                   │   │
│          │  └───────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ┌───────────────────────────────────────────────┐   │
│          │  │  📋 GIAO DỊCH GẦN ĐÂY                        │   │
│          │  │  ┌──────────┬──────────┬────────┬──────────┐  │   │
│          │  │  │ Ngày     │ Khóa học │ Số tiền│ TT       │  │   │
│          │  │  ├──────────┼──────────┼────────┼──────────┤  │   │
│          │  │  │ 12/03/26 │ React    │ 424,150│ Khả dụng│  │   │
│          │  │  │ 11/03/26 │ Node.js  │ 509,150│ Đang chờ│  │   │
│          │  │  │ 10/03/26 │ React    │ 424,150│ Khả dụng│  │   │
│          │  │  └──────────┴──────────┴────────┴──────────┘  │   │
│          │  │  (* Số tiền = giá bán - hoa hồng nền tảng)   │   │
│          │  └───────────────────────────────────────────────┘   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Coupon Management (`/instructor/coupons`)

```
Route:     /instructor/coupons
Auth:      Instructor
API:       GET /api/instructor/coupons + POST + PUT + DELETE
```

#### Create Coupon Dialog

```
┌─────────────────────────────────────────────────┐
│  Tạo mã giảm giá                          ✕    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Mã *                                            │
│  [SAVE20          ] [🔄 Tạo ngẫu nhiên]         │
│                                                  │
│  Loại giảm giá *                                 │
│  ○ Phần trăm (%)    ○ Cố định (₫)               │
│                                                  │
│  Giá trị giảm *                                  │
│  [20] %                                          │
│                                                  │
│  Áp dụng cho *                                   │
│  ○ Tất cả khóa học   ○ Khóa học cụ thể          │
│  [▾ Chọn khóa học...]                            │
│                                                  │
│  Giới hạn sử dụng           Đơn tối thiểu        │
│  [100] lượt                 [200,000] ₫          │
│                                                  │
│  Hiệu lực                                       │
│  Từ: [📅 01/04/2026]  Đến: [📅 30/04/2026]     │
│                                                  │
│  [ Hủy ]                    [ Tạo mã ]           │
└─────────────────────────────────────────────────┘
```

---

## 4.5 Admin Pages — Chi tiết

---

### PAGE: Admin Dashboard (`/admin/dashboard`)

```
Route:     /admin/dashboard
Auth:      Admin
API:       GET /api/admin/analytics
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Thống kê nền tảng                                   │
│          │                                                      │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│          │  │ 👥       │ │ 📚       │ │ 💰       │ │ 🟢       ││
│          │  │ 1,234    │ │ 56       │ │ 45.2M₫   │ │ 89       ││
│          │  │ Người dùng│ │ Khóa học │ │ Tổng DT  │ │ HĐ hôm  ││
│          │  │ ↑12 hôm  │ │ 3 chờ    │ │ ↑15%     │ │ nay      ││
│          │  │ nay      │ │ duyệt   │ │          │ │          ││
│          │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│          │                                                      │
│          │  ┌─── Cần xử lý ──────────────────────────────────┐  │
│          │  │ 🟡 3 đơn giảng viên chờ duyệt    [Xem →]      │  │
│          │  │ 🟡 2 khóa học chờ duyệt          [Xem →]      │  │
│          │  │ 🟡 1 yêu cầu rút tiền            [Xem →]      │  │
│          │  │ 🔴 5 báo cáo vi phạm             [Xem →]      │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
│          │  ┌────────────────────┬───────────────────────────┐  │
│          │  │ 📈 Doanh thu       │ 👥 Người dùng mới        │  │
│          │  │ (Line chart)       │ (Bar chart)               │  │
│          │  │                    │                           │  │
│          │  │ ▁▂▃▅▆▇█▇▆        │ ▃▅▇▅▃▆▇▅▃▆              │  │
│          │  └────────────────────┴───────────────────────────┘  │
│          │                                                      │
│          │  ┌────────────────────┬───────────────────────────┐  │
│          │  │ 🏷 Top Danh mục   │ 🏆 Top Khóa học          │  │
│          │  │ 1. Web Dev (23)    │ 1. React Course (234)    │  │
│          │  │ 2. Mobile (15)     │ 2. Node.js (189)         │  │
│          │  │ 3. AI/ML (12)      │ 3. Python (156)          │  │
│          │  └────────────────────┴───────────────────────────┘  │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: User Management (`/admin/users`)

```
Route:     /admin/users
Auth:      Admin
API:       GET /api/admin/users?search=...&role=...&status=...&page=1
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Quản lý người dùng                                  │
│          │                                                      │
│          │  🔍 [Tìm kiếm người dùng...]                        │
│          │                                                      │
│          │  Filters: Role [▾ Tất cả]  Status [▾ Tất cả]        │
│          │                                                      │
│          │  ┌── DataTable ───────────────────────────────────┐  │
│          │  │ ☐ │ Avatar │ Tên      │ Email    │ Role │ TT  │ A │  │
│          │  ├───┼────────┼──────────┼──────────┼──────┼─────┼───┤  │
│          │  │ ☐ │ 👤     │ Nguyễn A │ a@e.com  │ 🎓   │ 🟢  │ ⋯ │  │
│          │  │ ☐ │ 👤     │ Trần B   │ b@e.com  │ 👨‍🏫   │ 🟢  │ ⋯ │  │
│          │  │ ☐ │ 👤     │ Lê C     │ c@e.com  │ 🎓   │ 🔴  │ ⋯ │  │
│          │  └───┴────────┴──────────┴──────────┴──────┴─────┴───┘  │
│          │                                                      │
│          │  Actions menu (⋯):                                   │
│          │    👁 Xem hồ sơ                                      │
│          │    🔄 Đổi vai trò (Student ↔ Instructor)             │
│          │    🔒 Tạm khóa / 🔓 Mở khóa                        │
│          │                                                      │
│          │  Hiển thị 1-10 trong 1,234  ← 1 2 3 ... →           │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Instructor Application Review (`/admin/approvals/instructors`)

```
Route:     /admin/approvals/instructors
Auth:      Admin
API:       GET /api/admin/instructor-applications + PUT approve/reject
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Đơn đăng ký giảng viên               [3 chờ duyệt] │
│          │                                                      │
│          │  [Chờ duyệt] [Đã duyệt] [Đã từ chối]               │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  👤 Nguyễn Văn A                               │  │
│          │  │  📧 a@example.com                              │  │
│          │  │  📅 Nộp đơn: 10/03/2026                        │  │
│          │  │                                                │  │
│          │  │  Chuyên môn: Web Development, React, Node.js   │  │
│          │  │                                                │  │
│          │  │  Kinh nghiệm:                                  │  │
│          │  │  "3 năm làm frontend developer tại..."         │  │
│          │  │  [Xem đầy đủ ↓]                                │  │
│          │  │                                                │  │
│          │  │  Lý do:                                         │  │
│          │  │  "Muốn chia sẻ kiến thức React..."             │  │
│          │  │                                                │  │
│          │  │  Link mẫu: https://youtube.com/...             │  │
│          │  │                                                │  │
│          │  │  [ ✅ Duyệt ]     [ ❌ Từ chối ]               │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  👤 Trần Thị B    (another application)        │  │
│          │  │  ...                                           │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘

Reject Dialog:
┌─────────────────────────────────────────────────┐
│  Từ chối đơn đăng ký                       ✕    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Người nộp: Nguyễn Văn A                        │
│                                                  │
│  Lý do từ chối *                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ Chưa đủ kinh nghiệm hoặc mô tả chưa rõ... ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  ⚠ Người nộp sẽ nhận email thông báo kèm lý do  │
│                                                  │
│  [ Hủy ]                    [ Từ chối ]          │
└─────────────────────────────────────────────────┘
```

---

### PAGE: Course Review (`/admin/approvals/courses`)

```
Route:     /admin/approvals/courses
Auth:      Admin
API:       GET /api/admin/pending-courses + PUT approve/reject
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Duyệt khóa học                       [2 chờ duyệt] │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  ┌──────┐  Lập trình React nâng cao           │  │
│          │  │  │Thumb │  Nguyễn Văn A | Nộp: 10/03/2026     │  │
│          │  │  └──────┘  📊 Trung cấp | 🏷 Web Dev          │  │
│          │  │            📚 3 sections, 12 chapters, 36 lessons  │
│          │  │            ⏱ ~24 giờ video                     │  │
│          │  │            💰 499,000₫ (chapters: 546,000₫)    │  │
│          │  │                                                │  │
│          │  │  ── Checklist Đánh giá ──                      │  │
│          │  │  ☑ Chất lượng nội dung                         │  │
│          │  │  ☑ Chất lượng video/audio                      │  │
│          │  │  ☑ Giá cả hợp lý                              │  │
│          │  │  ☑ Mô tả đầy đủ, chính xác                    │  │
│          │  │  ☑ Không vi phạm nội dung                      │  │
│          │  │                                                │  │
│          │  │  [ 👁 Xem preview ]                            │  │
│          │  │                                                │  │
│          │  │  [ ✅ Phê duyệt ]     [ ❌ Từ chối ]           │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Category Management (`/admin/categories`)

```
Route:     /admin/categories
Auth:      Admin
API:       GET /api/admin/categories + POST + PUT + DELETE
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Quản lý danh mục                     [ + Tạo mới ]  │
│          │                                                      │
│          │  ┌── DataTable ───────────────────────────────────┐  │
│          │  │ Icon │ Tên              │ Slug      │ Khóa │ A  │  │
│          │  ├──────┼──────────────────┼───────────┼──────┼────┤  │
│          │  │ 🌐   │ Web Development  │ web-dev   │ 23   │ ✏🗑│  │
│          │  │ 📱   │ Mobile Dev       │ mobile    │ 15   │ ✏🗑│  │
│          │  │ 🤖   │ AI & ML          │ ai-ml     │ 12   │ ✏🗑│  │
│          │  │ 📊   │ Data Science     │ data      │ 8    │ ✏🗑│  │
│          │  │ 🎨   │ Design           │ design    │ 5    │ ✏🗑│  │
│          │  │ ☁️   │ DevOps           │ devops    │ 4    │ ✏🗑│  │
│          │  └──────┴──────────────────┴───────────┴──────┴────┘  │
│          │                                                      │
│          │  ⚠ Không thể xóa danh mục có khóa học               │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Withdrawal Management (`/admin/withdrawals`)

```
Route:     /admin/withdrawals
Auth:      Admin
API:       GET /api/admin/withdrawals + PUT approve/reject
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Yêu cầu rút tiền                                   │
│          │                                                      │
│          │  [Chờ xử lý] [Hoàn thành] [Từ chối]                 │
│          │                                                      │
│          │  ┌── DataTable ───────────────────────────────────┐  │
│          │  │ GV        │ Số tiền   │ NH         │ Ngày │ TT │  │
│          │  ├───────────┼───────────┼────────────┼──────┼────┤  │
│          │  │ Nguyễn A  │ 2,000,000 │ MB Bank    │ 12/3 │ ⏳ │  │
│          │  │           │           │ 012345678  │      │    │  │
│          │  │           │           │ NGUYEN A   │      │    │  │
│          │  │           │           │            │      │    │  │
│          │  │ [ ✅ Duyệt & đã chuyển ]  [ ❌ Từ chối ]      │  │
│          │  └───────────────────────────────────────────────┘  │
│          │                                                      │
│          │  Quy trình:                                          │
│          │  1. GV yêu cầu rút tiền (API)                       │
│          │  2. Admin thấy yêu cầu tại đây                      │
│          │  3. Admin chuyển khoản THỦ CÔNG đến TK GV            │
│          │  4. Admin click "Duyệt & đã chuyển"                  │
│          │  5. Hệ thống trừ balance + notify GV                 │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Reports Management (`/admin/reports`)

```
Route:     /admin/reports
Auth:      Admin
API:       GET /api/admin/reports + PUT resolve/dismiss
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Báo cáo vi phạm                                     │
│          │                                                      │
│          │  [Chờ xử lý] [Đã xử lý] [Đã bác bỏ]               │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  🚨 Report #45                                 │  │
│          │  │  Loại: Bài viết | Báo cáo bởi: Trần B         │  │
│          │  │  Ngày: 12/03/2026                              │  │
│          │  │                                                │  │
│          │  │  Đối tượng: Post "..." bởi Nguyễn A            │  │
│          │  │  [👁 Xem nội dung]                              │  │
│          │  │                                                │  │
│          │  │  Lý do: "Nội dung spam, quảng cáo"             │  │
│          │  │                                                │  │
│          │  │  Actions:                                       │  │
│          │  │  [ Bác bỏ ]  [ ⚠ Cảnh cáo ]                    │  │
│          │  │  [ 🗑 Xóa nội dung ]  [ 🔒 Khóa TK ]          │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

### PAGE: Platform Settings (`/admin/settings`)

```
Route:     /admin/settings
Auth:      Admin
API:       GET /api/admin/settings + PUT
```

#### Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Sidebar  │                                                      │
│          │  Cấu hình hệ thống                                  │
│          │                                                      │
│          │  ── Hoa hồng ──                                     │
│          │                                                      │
│          │  Tỷ lệ hoa hồng nền tảng                            │
│          │  [15] %                                               │
│          │  (Nền tảng giữ lại 15% mỗi giao dịch,               │
│          │   Instructor nhận 85%)                               │
│          │                                                      │
│          │  ── Thông tin nền tảng ──                            │
│          │                                                      │
│          │  Tên nền tảng                                        │
│          │  [Smart Social Learning Marketplace          ]       │
│          │                                                      │
│          │  Email liên hệ                                       │
│          │  [admin@smartsocial.com                       ]       │
│          │                                                      │
│          │  ── Thanh toán ──                                    │
│          │                                                      │
│          │  Ngân hàng nhận tiền                                 │
│          │  [MB Bank                                     ]      │
│          │  Số tài khoản                                        │
│          │  [0123456789                                  ]       │
│          │  Chủ tài khoản                                       │
│          │  [SMART LEARNING                              ]      │
│          │                                                      │
│          │  Số tiền rút tối thiểu (Instructor)                  │
│          │  [200,000] ₫                                         │
│          │                                                      │
│          │  [ Lưu thay đổi ]                                    │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 4.6 Responsive Strategy — Management Portal

```
Management Portal KHÔNG responsive cho mobile.

< 1024px:
┌─────────────────────────────────────────────────┐
│                                                  │
│              🖥                                  │
│     Vui lòng sử dụng máy tính                   │
│                                                  │
│     Cổng quản lý yêu cầu màn hình               │
│     tối thiểu 1024px để hoạt động                │
│     tốt nhất.                                    │
│                                                  │
│     [ Về Student Portal ]                        │
│                                                  │
└─────────────────────────────────────────────────┘

Lý do:
  - Instructor cần desktop để upload video, edit curriculum
  - Admin cần DataTable rộng để review
  - Giảm complexity cho đồ án
  - Management portal = internal tool, không cần mobile
```
