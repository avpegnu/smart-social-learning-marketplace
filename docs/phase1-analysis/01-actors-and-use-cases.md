# 1. ACTORS, KIẾN TRÚC & USE CASES

## 1.1 Kiến trúc 2 Web App riêng biệt

```
┌─────────────────────────────────────────────────────────┐
│                    SHARED BACKEND API                    │
│              (REST API + WebSocket Server)               │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
    ┌──────────▼──────────┐ ┌────────▼────────────────┐
    │   WEB APP 1:        │ │   WEB APP 2:            │
    │   STUDENT PORTAL    │ │   MANAGEMENT PORTAL     │
    │                     │ │                         │
    │ - Landing page      │ │ - Login (chung 1 form)  │
    │ - Browse courses    │ │ - Sau login → phân UI   │
    │ - Learning player   │ │   theo role:            │
    │ - Social features   │ │                         │
    │ - AI Tutor          │ │   INSTRUCTOR:           │
    │ - Profile           │ │   - Course management   │
    │ - "Upgrade to       │ │   - Revenue dashboard   │
    │    Instructor" btn  │ │   - Student analytics   │
    │                     │ │                         │
    │ URL: app.com        │ │   ADMIN:                │
    │                     │ │   - User management     │
    │                     │ │   - Approval queue      │
    │                     │ │   - Platform analytics  │
    │                     │ │   - System config       │
    │                     │ │                         │
    │                     │ │ URL: manage.app.com     │
    └─────────────────────┘ └─────────────────────────┘
```

### Flow: Student → Instructor Upgrade

```
Student (app.com)                     Backend                    Management Portal
      │                                  │                            │
      │ 1. Click "Trở thành giảng viên"  │                            │
      │ 2. Điền form + upload CV/certs   │                            │
      │────────────────────────────────► │                            │
      │                                  │ 3. Lưu application         │
      │                                  │    status: PENDING         │
      │                                  │                            │
      │                                  │ 4. Notify Admin            │
      │                                  │───────────────────────────►│
      │                                  │                            │ 5. Admin review
      │                                  │                            │ 6. Approve/Reject
      │                                  │◄───────────────────────────│
      │                                  │ 7. Update role             │
      │                                  │    Student → Instructor    │
      │ 8. Notification:                 │                            │
      │    "Bạn đã được duyệt!"         │                            │
      │◄─────────────────────────────────│                            │
      │                                  │                            │
      │ 9. UI hiển thị button:           │                            │
      │    "Đi tới Management Portal"    │                            │
      │    → redirect manage.app.com     │                            │
      │                                  │                            │
```

### Management Portal — Phân quyền UI sau login

```
Login (manage.app.com/login)
    │
    │ Nhập email + password (cùng tài khoản Student Portal)
    │
    ▼
Backend kiểm tra role
    │
    ├── role === INSTRUCTOR
    │   └── Redirect → /instructor/dashboard
    │       ├── Sidebar: Courses, Revenue, Students, Q&A, Settings
    │       └── Không thấy menu Admin
    │
    ├── role === ADMIN
    │   └── Redirect → /admin/dashboard
    │       ├── Sidebar: Users, Approvals, Reports, Analytics, Config
    │       └── Toàn quyền
    │
    └── role === STUDENT (chưa được duyệt)
        └── Redirect về app.com + thông báo "Bạn chưa có quyền truy cập"
```

## 1.2 Primary Actors

### Student (Học viên)

- **Portal:** Student Portal (app.com)
- **Mô tả:** Người mua và học khóa học
- **Mục tiêu:** Tìm khóa phù hợp, học tập, tương tác cộng đồng
- **Đặc điểm:** Có thể nộp đơn upgrade thành Instructor

### Instructor (Giảng viên)

- **Portal:** Management Portal (manage.app.com) — Instructor UI
- **Mô tả:** Người tạo và bán khóa học
- **Mục tiêu:** Quản lý khóa học, theo dõi doanh thu, hỗ trợ học viên
- **Đặc điểm:**
  - Đăng nhập cùng tài khoản, khác portal
  - Vẫn có thể dùng Student Portal để học khóa người khác
  - Cần được Admin phê duyệt từ Student

### Admin (Quản trị viên)

- **Portal:** Management Portal (manage.app.com) — Admin UI
- **Mô tả:** Người quản lý toàn bộ nền tảng
- **Mục tiêu:** Phê duyệt, quản lý users/content, cấu hình hệ thống
- **Đặc điểm:** Tài khoản được tạo sẵn (seeded), không đăng ký public

## 1.3 Secondary Actors (Hệ thống bên ngoài)

| Actor                | Vai trò                                      |
| -------------------- | -------------------------------------------- |
| Payment Gateway      | Xử lý thanh toán (SePay (QR bank transfer))  |
| Notification Service | Email (Gmail SMTP), Push notification        |
| Cloud Storage        | Lưu video, tài liệu (Cloudinary)             |
| Video Processing     | Transcode video async (FFmpeg/cloud service) |

## 1.4 Ma trận Actor — Quyền hạn (theo Portal)

### Student Portal (app.com)

| Chức năng                    | Guest | Student | Instructor\* |
| ---------------------------- | ----- | ------- | ------------ |
| Xem danh sách khóa học       | ✅    | ✅      | ✅           |
| Xem chi tiết khóa (preview)  | ✅    | ✅      | ✅           |
| Đăng ký / Đăng nhập          | ✅    | —       | —            |
| Mua khóa học                 | —     | ✅      | ✅           |
| Học bài (xem video, làm bài) | —     | ✅      | ✅           |
| Chat với AI Tutor            | —     | ✅      | ✅           |
| Social (post, chat, follow)  | —     | ✅      | ✅           |
| Q&A Forum                    | —     | ✅      | ✅           |
| Nộp đơn Instructor           | —     | ✅      | —            |
| Xem nút "Management Portal"  | —     | —       | ✅           |

_Instructor cũng dùng Student Portal để học_

### Management Portal (manage.app.com)

| Chức năng                   | Instructor | Admin |
| --------------------------- | ---------- | ----- |
| Tạo/Quản lý khóa học (CRUD) | ✅         | ✅    |
| Upload video/tài liệu       | ✅         | —     |
| Xem doanh thu cá nhân       | ✅         | —     |
| Quản lý coupon              | ✅         | —     |
| Yêu cầu rút tiền            | ✅         | —     |
| Trả lời Q&A của học viên    | ✅         | —     |
| Phê duyệt Instructor        | —          | ✅    |
| Phê duyệt khóa học          | —          | ✅    |
| Quản lý users               | —          | ✅    |
| Xử lý reports               | —          | ✅    |
| Cấu hình hoa hồng           | —          | ✅    |
| Dashboard thống kê nền tảng | —          | ✅    |
| Quản lý categories          | —          | ✅    |

---

# 2. USE CASES CHI TIẾT — Với Implementation Strategy

> Mỗi Use Case bao gồm: Actor, Flow, Business Rules, và **cách triển khai cụ thể (Implementation)**

---

# MODULE 1: AUTHENTICATION & USER MANAGEMENT

---

## UC-01: Đăng ký tài khoản

**Actor:** Guest → Student
**Portal:** Student Portal

### Flow chính

1. Guest chọn "Đăng ký"
2. Nhập: email, mật khẩu, họ tên
3. Hệ thống validate → Gửi email xác nhận
4. Guest click link xác nhận → Tài khoản kích hoạt

### Flow thay thế

- 2a. Đăng ký bằng Google OAuth → Bỏ qua bước xác nhận email
- 3a. Email đã tồn tại → Lỗi "Email đã được sử dụng"
- 3b. Mật khẩu yếu → Lỗi "Mật khẩu cần ít nhất 8 ký tự, 1 chữ hoa, 1 số"

### Implementation

```
Client                         Backend                        Database
  │                              │                              │
  │ POST /api/auth/register      │                              │
  │ {email, password, fullName}  │                              │
  │─────────────────────────────►│                              │
  │                              │ 1. Validate input (Joi/Zod)  │
  │                              │ 2. Check email unique         │
  │                              │ 3. Hash password (bcrypt 12)  │
  │                              │ 4. Generate verification token│
  │                              │    (crypto.randomUUID)        │
  │                              │────────────────────────────►  │
  │                              │    INSERT users               │
  │                              │    (status: UNVERIFIED)       │
  │                              │                              │
  │                              │ 5. Send verification email   │
  │                              │    (queue → email service)    │
  │  201: "Check your email"     │                              │
  │◄─────────────────────────────│                              │
  │                              │                              │
  │ GET /api/auth/verify?token=x │                              │
  │─────────────────────────────►│                              │
  │                              │ 6. Find user by token        │
  │                              │ 7. Check token not expired   │
  │                              │    (24h TTL)                 │
  │                              │ 8. Update status: ACTIVE     │
  │  200: "Account verified"     │                              │
  │◄─────────────────────────────│                              │
```

**Chi tiết kỹ thuật:**

- **Password hashing:** bcrypt với salt rounds = 12 (~250ms/hash, đủ chậm để chống brute force)
- **Verification token:** UUID v4, lưu vào DB cùng `expires_at = now + 24h`
- **Email queue:** Không gửi email trực tiếp trong request (chậm). Đẩy vào message queue (Bull/BullMQ + Redis), worker xử lý async → User nhận response nhanh
- **Race condition:** Dùng UNIQUE constraint trên email trong DB, không chỉ check bằng SELECT

---

## UC-02: Đăng nhập & JWT Token

**Actor:** Student, Instructor, Admin
**Portal:** Cả 2 portal (dùng chung API)

### Flow chính

1. Nhập email + mật khẩu
2. Backend xác thực → Cấp access token + refresh token
3. Frontend lưu token → Redirect theo role

### Implementation

```
Client                         Backend                        Database/Redis
  │                              │                              │
  │ POST /api/auth/login         │                              │
  │ {email, password}            │                              │
  │─────────────────────────────►│                              │
  │                              │ 1. Find user by email        │
  │                              │ 2. bcrypt.compare(password)  │
  │                              │ 3. Check status === ACTIVE   │
  │                              │ 4. Check login attempts      │
  │                              │                              │
  │                              │ 5. Generate tokens:          │
  │                              │    Access Token (JWT):       │
  │                              │      payload: {userId, role} │
  │                              │      expires: 15 phút        │
  │                              │      sign: RS256 private key │
  │                              │                              │
  │                              │    Refresh Token:            │
  │                              │      random UUID             │
  │                              │      expires: 7 ngày         │
  │                              │      lưu vào Redis/DB        │
  │                              │────────────────────────────►  │
  │                              │    STORE refresh_tokens      │
  │  200: {accessToken,          │    {token, userId, expiresAt}│
  │        refreshToken,         │                              │
  │        user: {id, role...}}  │                              │
  │◄─────────────────────────────│                              │
  │                              │                              │
  │ (Frontend xử lý)            │                              │
  │ if portal === student:       │                              │
  │   redirect /dashboard        │                              │
  │ if portal === management:    │                              │
  │   if role===INSTRUCTOR       │                              │
  │     redirect /instructor     │                              │
  │   if role===ADMIN            │                              │
  │     redirect /admin          │                              │
  │   if role===STUDENT          │                              │
  │     redirect app.com +       │                              │
  │     toast "Không có quyền"   │                              │
```

**Token Refresh Flow:**

```
Client                         Backend                        Redis
  │                              │                              │
  │ (Access token hết hạn)       │                              │
  │                              │                              │
  │ POST /api/auth/refresh       │                              │
  │ {refreshToken}               │                              │
  │─────────────────────────────►│                              │
  │                              │ 1. Tìm refresh token         │
  │                              │    trong Redis/DB            │
  │                              │◄────────────────────────────│
  │                              │ 2. Check chưa hết hạn       │
  │                              │ 3. Xóa refresh token cũ     │
  │                              │    (Rotation — chống reuse)  │
  │                              │ 4. Tạo cặp token mới        │
  │                              │────────────────────────────►│
  │  200: {newAccessToken,       │    STORE new refresh token  │
  │        newRefreshToken}      │                              │
  │◄─────────────────────────────│                              │
```

**Chi tiết kỹ thuật:**

- **Access Token:** JWT, RS256, TTL 15 phút. Chứa `{userId, role, iat, exp}`. Frontend lưu trong memory (KHÔNG localStorage)
- **Refresh Token:** Opaque UUID, TTL 7 ngày. Lưu trong httpOnly cookie (chống XSS)
- **Token Rotation:** Mỗi lần refresh, xóa token cũ + tạo mới → Nếu token bị đánh cắp và dùng lại → phát hiện được (token cũ đã bị xóa)
- **Rate limiting login:** Redis counter per IP: `login_attempts:{ip}`, increment mỗi lần fail, expire 15 phút. Quá 5 lần → block 15 phút
- **Management Portal guard:** Frontend check `role` trong JWT payload trước khi render. Backend middleware cũng check role cho mọi API `/instructor/*` và `/admin/*`

---

## UC-03: Quản lý hồ sơ cá nhân

**Actor:** Student, Instructor

### Implementation

```
Cập nhật profile:
  PUT /api/users/me
  Body: { fullName, bio, skills[], socialLinks{} }

Upload avatar:
  POST /api/users/me/avatar
  Body: FormData (file)

  Flow xử lý avatar:
  1. Frontend resize ảnh client-side (max 500x500, < 2MB) trước khi upload
  2. Backend validate: type (jpg/png/webp), size (< 5MB)
  3. Upload lên Cloud Storage (Cloudinary)
  4. Nhận lại URL
  5. Lưu URL vào user.avatarUrl trong DB
  6. Xóa ảnh cũ trên Cloud (nếu có) → async, không block response

Instructor profile bổ sung:
  PUT /api/instructor/profile
  Body: { expertise, experience, qualifications[], certificates[] }
```

---

## UC-04: Đăng ký làm Instructor (Student → Instructor Upgrade)

**Actor:** Student
**Portal:** Student Portal → (sau duyệt) → Management Portal

### Flow chi tiết

```
Student Portal                  Backend                     Management Portal
     │                            │                              │
     │ 1. Click "Trở thành        │                              │
     │    giảng viên"              │                              │
     │                            │                              │
     │ 2. Form hiện ra:           │                              │
     │    - Chuyên môn (tags)     │                              │
     │    - Kinh nghiệm (text)   │                              │
     │    - Upload CV (PDF)       │                              │
     │    - Upload bằng cấp      │                              │
     │    - Link portfolio        │                              │
     │                            │                              │
     │ POST /api/instructor       │                              │
     │   /applications            │                              │
     │─────────────────────────► │                              │
     │                            │ 3. Upload files → Cloudinary │
     │                            │ 4. INSERT instructor_apps    │
     │                            │    status: PENDING           │
     │                            │ 5. Notify admins             │
     │                            │    (realtime + email)        │
     │                            │───────────────────────────► │
     │  200: "Đơn đã được gửi"   │                              │
     │◄──────────────────────────│                              │
     │                            │                              │
     │  (Chờ duyệt — có thể      │                              │
     │   xem status tại           │              Admin xem queue:│
     │   /profile/application)    │              GET /api/admin/ │
     │                            │              instructor-apps │
     │                            │                              │
     │                            │              Review đơn:     │
     │                            │              - Xem CV, certs │
     │                            │              - Xem profile   │
     │                            │                              │
     │                            │  PUT /api/admin/             │
     │                            │  instructor-apps/:id         │
     │                            │  {status: APPROVED}          │
     │                            │◄──────────────────────────── │
     │                            │                              │
     │                            │ 6. UPDATE users              │
     │                            │    SET role = INSTRUCTOR     │
     │                            │ 7. Tạo instructor_profile    │
     │                            │ 8. Send notification         │
     │                            │    + email cho student       │
     │                            │                              │
     │ 9. Notification:           │                              │
     │    "Chúc mừng! Bạn đã     │                              │
     │     trở thành giảng viên"  │                              │
     │                            │                              │
     │ 10. UI thay đổi:           │                              │
     │     Navbar hiển thị nút:   │                              │
     │     [🎓 Management Portal] │                              │
     │     → Click: redirect tới  │                              │
     │       manage.app.com       │                              │
     │       (auto login via      │                              │
     │        shared token)       │                              │
```

**Cross-portal authentication:**

```
Khi Student click "Management Portal":
1. Frontend gọi POST /api/auth/cross-portal-token
   → Backend tạo 1 one-time token (OTT), TTL = 30 giây
2. Redirect: manage.app.com/auth/callback?ott=<token>
3. Management Portal gọi POST /api/auth/exchange-ott {ott}
   → Backend verify OTT → trả về access + refresh token
   → Xóa OTT (single use)
4. User đã login trên Management Portal
```

---

# MODULE 2: ECOMMERCE (Mua bán khóa học)

---

## UC-05: Duyệt & Tìm kiếm khóa học

**Actor:** Guest, Student, Instructor
**Portal:** Student Portal

### Implementation: Search & Filter

```
GET /api/courses?
  search=react hooks          ← Full-text search
  &category=web-development   ← Filter by category
  &level=intermediate         ← Filter by level
  &minPrice=0                 ← Price range
  &maxPrice=500000
  &minRating=4                ← Min rating
  &language=vi                ← Language
  &sort=popular               ← Sort option
  &page=1                     ← Pagination
  &limit=20
```

**Full-text Search Implementation:**

```
Option A: PostgreSQL Full-Text Search (đơn giản, đủ dùng)

  -- Tạo search vector column
  ALTER TABLE courses ADD COLUMN search_vector tsvector;

  -- Update vector khi insert/update course
  UPDATE courses SET search_vector =
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(tags_text, '')), 'A');

  -- Tạo GIN index
  CREATE INDEX idx_courses_search ON courses USING GIN(search_vector);

  -- Query
  SELECT *, ts_rank(search_vector, query) AS rank
  FROM courses, plainto_tsquery('simple', 'react hooks') query
  WHERE search_vector @@ query
  ORDER BY rank DESC;

  Weight A (title, tags) quan trọng hơn Weight B (description)
  → Tìm "react" sẽ ưu tiên khóa có "React" trong tên

Option B: Elasticsearch (nếu scale lớn — phase sau)
```

**Caching strategy:**

```
- Trang danh sách phổ biến (no filter, sort=popular) → Cache Redis 5 phút
- Search results → Cache Redis 2 phút, key = hash(query_params)
- Invalidate cache khi: course mới publish, course cập nhật, review mới
```

---

## UC-06: Xem chi tiết khóa học

**Actor:** Guest, Student, Instructor

### Implementation

```
GET /api/courses/:slug

Response:
{
  id, title, slug, description, thumbnail,
  instructor: { id, name, avatar, bio, courseCount, studentCount, avgRating },
  category: { id, name },
  level: "intermediate",
  language: "vi",
  price: 499000,                    // Giá cả khóa

  curriculum: [                      // Mục lục
    {
      sectionId: 1,
      sectionTitle: "Getting Started",
      chapters: [
        {
          chapterId: 1,
          title: "Introduction",
          price: 79000,              // Giá mua lẻ chapter
          lessonsCount: 5,
          totalDuration: "45:00",
          isFreePreview: true,       // Chapter preview miễn phí
          isOwned: false             // User đã mua chưa (nếu logged in)
        },
        ...
      ]
    }
  ],

  stats: {
    totalStudents: 1250,
    totalLessons: 48,
    totalDuration: "12h 30m",
    avgRating: 4.7,
    reviewCount: 340
  },

  reviews: [...],                    // Paginated, mặc định 5 reviews đầu
  relatedCourses: [...],             // Content-Based recommendation
  aiChapterSuggestion: {            // Nếu logged in + có learning history
    shouldBuy: [1, 3, 4],
    canSkip: [2],
    bundlePrice: 210000,
    savingsVsFullCourse: 289000
  }
}
```

**View count tracking:**

```
Mỗi lần xem chi tiết → increment view count
Chống spam views:
  - Dùng Redis SET: viewed:{courseId}:{userId hoặc IP}
  - TTL = 1 giờ → cùng user chỉ count 1 lần/giờ
  - Batch update vào DB mỗi 5 phút (cron) để giảm DB writes
```

---

## UC-07: Mua khóa học (Cả khóa)

**Actor:** Student

### Flow thanh toán chi tiết

```
Student                    Frontend              Backend                SePay
  │                          │                     │                      │
  │ 1. Click "Thanh toán"    │                     │                      │
  │─────────────────────────►│                     │                      │
  │                          │ 2. POST /api/orders │                      │
  │                          │ {items, couponCode} │                      │
  │                          │────────────────────►│                      │
  │                          │                     │ 3. Validate items    │
  │                          │                     │ 4. Tính giá          │
  │                          │                     │ 5. CREATE order      │
  │                          │                     │    status: PENDING   │
  │                          │                     │    orderCode:        │
  │                          │                     │    "SSML" + orderId  │
  │                          │                     │    (VD: SSML000123)  │
  │                          │                     │                      │
  │                          │ 6. {orderId,        │                      │
  │                          │     paymentInfo: {  │                      │
  │  ┌───────────────────┐   │       bank: "MB",  │                      │
  │  │ Trang thanh toán  │   │       accountNo:   │                      │
  │  │                   │   │         "0123...",  │                      │
  │  │  ┌─────────────┐  │   │       accountName: │                      │
  │  │  │   QR CODE   │  │   │         "NGUYEN..",│                      │
  │  │  │             │  │   │       amount:      │                      │
  │  │  │  (VietQR)   │  │   │         399200,    │                      │
  │  │  │             │  │   │       content:     │                      │
  │  │  └─────────────┘  │   │         "SSML123"  │                      │
  │  │                   │   │     }              │                      │
  │  │  Số TK: 0123...  │   │     qrUrl,         │                      │
  │  │  Số tiền: 399,200│   │     expiresAt}     │                      │
  │  │  Nội dung: SSML123│  │◄────────────────────│                      │
  │  │                   │   │                     │                      │
  │  │  ⏳ Đang chờ      │   │                     │                      │
  │  │     xác nhận...   │   │ 7. Frontend polling │                      │
  │  │     (polling)     │   │    GET /api/orders/ │                      │
  │  └───────────────────┘   │    :id/status       │                      │
  │                          │    (mỗi 3 giây)     │                      │
  │◄─────────────────────────│                     │                      │
  │                          │                     │                      │
  │ 8. Student mở app        │                     │                      │
  │    ngân hàng, quét QR    │                     │                      │
  │    → Chuyển khoản        │                     │                      │
  │                          │                     │                      │
  │                          │                     │  9. SePay detect     │
  │                          │                     │     giao dịch mới   │
  │                          │                     │                      │
  │                          │                     │  POST webhook:       │
  │                          │                     │◄─────────────────────│
  │                          │                     │  {                   │
  │                          │                     │    "gateway":"MBBank"│
  │                          │                     │    "transactionDate":│
  │                          │                     │      "2024-01-15",  │
  │                          │                     │    "accountNumber":  │
  │                          │                     │      "0123...",     │
  │                          │                     │    "transferType":   │
  │                          │                     │      "in",          │
  │                          │                     │    "transferAmount": │
  │                          │                     │      399200,        │
  │                          │                     │    "content":        │
  │                          │                     │      "SSML000123",  │
  │                          │                     │    "referenceCode":  │
  │                          │                     │      "FT24015..."   │
  │                          │                     │  }                   │
  │                          │                     │                      │
  │                          │                     │ 10. Backend xử lý:   │
  │                          │                     │   a. Verify webhook  │
  │                          │                     │      (API key/secret)│
  │                          │                     │   b. Parse content   │
  │                          │                     │      → extract       │
  │                          │                     │      orderCode       │
  │                          │                     │      "SSML000123"    │
  │                          │                     │   c. Find order by   │
  │                          │                     │      orderCode       │
  │                          │                     │   d. Verify amount   │
  │                          │                     │      matches         │
  │                          │                     │   e. BEGIN TRANSACTION│
  │                          │                     │      - order→COMPLETED│
  │                          │                     │      - create enroll │
  │                          │                     │      - calc earnings │
  │                          │                     │      COMMIT          │
  │                          │                     │   f. Async: email,   │
  │                          │                     │      notify          │
  │                          │                     │                      │
  │                          │ 11. Polling response:│                     │
  │                          │     status:COMPLETED │                     │
  │  ┌───────────────────┐   │◄────────────────────│                     │
  │  │ ✅ Thanh toán      │   │                     │                     │
  │  │    thành công!     │   │                     │                     │
  │  │                   │   │                     │                     │
  │  │ [Bắt đầu học →]   │   │                     │                     │
  │  └───────────────────┘   │                     │                     │
  │◄─────────────────────────│                     │                     │
```

### Code Implementation

```javascript
// Backend: Tạo order + QR
async createOrder(userId, items, couponCode) {
  // ... validate, tính giá (giống cũ) ...

  const order = await this.prisma.order.create({
    data: {
      userId,
      orderCode: `SSML${String(orderId).padStart(6, '0')}`, // SSML000123
      totalAmount: finalPrice,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 phút
    }
  });

  // Tạo VietQR URL (chuẩn Napas)
  const qrUrl = this.generateVietQR({
    bankId: 'MB',                    // Mã ngân hàng (từ config)
    accountNo: BANK_ACCOUNT_NUMBER,
    accountName: BANK_ACCOUNT_NAME,
    amount: finalPrice,
    description: order.orderCode     // Nội dung CK = mã order
  });

  return { orderId: order.id, orderCode: order.orderCode, qrUrl, ... };
}

// VietQR URL (chuẩn VN):
function generateVietQR({ bankId, accountNo, accountName, amount, description }) {
  // Dùng VietQR API hoặc tự generate
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png`
    + `?amount=${amount}&addInfo=${encodeURIComponent(description)}`
    + `&accountName=${encodeURIComponent(accountName)}`;
}

// Webhook handler: SePay gọi khi có giao dịch
// POST /api/webhooks/sepay
async handleSepayWebhook(body, headers) {
  // 1. Verify webhook (SePay gửi API key trong header)
  if (headers['x-api-key'] !== SEPAY_WEBHOOK_SECRET) {
    throw new UnauthorizedException();
  }

  // 2. Chỉ xử lý giao dịch nhận tiền
  if (body.transferType !== 'in') return;

  // 3. Parse order code từ nội dung chuyển khoản
  const content = body.content.toUpperCase();
  const orderCodeMatch = content.match(/SSML\d{6}/);
  if (!orderCodeMatch) return; // Không phải CK mua khóa

  const orderCode = orderCodeMatch[0];

  // 4. Tìm order
  const order = await this.prisma.order.findUnique({
    where: { orderCode, status: 'PENDING' }
  });
  if (!order) return;

  // 5. Verify số tiền
  if (body.transferAmount < order.totalAmount) {
    // Thiếu tiền → log warning, không complete
    await this.logPaymentMismatch(order.id, body);
    return;
  }

  // 6. Complete order (transaction — giống Stripe flow)
  await this.completeOrder(order.id, {
    paymentRef: body.referenceCode,
    paymentGateway: 'SEPAY',
    paidAmount: body.transferAmount,
    paidAt: new Date(body.transactionDate)
  });
}
```

**Business Rules:**

```
Hoa hồng nền tảng:
  - Admin cấu hình: platform_commission_rate (mặc định 30%)
  - Khi order COMPLETED:
    instructorEarning = finalPrice × (1 - commissionRate)
    platformEarning  = finalPrice × commissionRate

    VD: Khóa 399,200đ, commission 30%
      Instructor nhận: 279,440đ
      Platform nhận: 119,760đ

  - Lưu vào bảng earnings:
    INSERT INTO earnings (instructor_id, order_id, amount, commission_amount, status)
    VALUES (5, 100, 279440, 119760, 'PENDING_WITHDRAWAL')
```

**Edge Cases:**

```
1. Nội dung CK sai/thiếu mã order:
   → Webhook nhận nhưng không match → log "unmatched_payments"
   → Admin review thủ công → có thể manual complete order

2. Chuyển thiếu tiền:
   → Không complete order → log warning
   → Notify user: "Số tiền không khớp. Vui lòng liên hệ support"

3. Chuyển thừa tiền:
   → Complete order bình thường (amount >= orderTotal)
   → Log surplus → Admin review để refund phần thừa

4. Chuyển 2 lần (duplicate):
   → Order đã COMPLETED → skip webhook (idempotent)
   → Log duplicate payment → Admin review refund

5. Hết hạn 15 phút chưa chuyển:
   → Cron job: UPDATE orders SET status='EXPIRED' WHERE expiresAt < now AND status='PENDING'
   → Nếu CK đến sau khi expired → log "late_payment" → Admin xử lý thủ công

6. SePay webhook bị delay:
   → Frontend polling 3s → 15 phút timeout
   → User có thể vào "Lịch sử đơn hàng" → status sẽ tự update khi webhook đến
```

---

## UC-08: Mua từng chương (Chapter Purchase)

**Actor:** Student

### Implementation

```
POST /api/orders
{
  items: [
    { courseId: 1, chapterId: 3, type: "CHAPTER" },
    { courseId: 1, chapterId: 5, type: "CHAPTER" }
  ],
  couponCode: null
}
```

**Business Rules quan trọng:**

```javascript
// 1. Giá chapter > giá cả khóa (incentive mua full)
// Instructor set giá chapter, hệ thống validate:
totalChapterPrices = sum(allChapters.price); // VD: 650,000đ
fullCoursePrice = course.price; // VD: 499,000đ
assert(totalChapterPrices > fullCoursePrice); // Phải đúng

// 2. Smart upgrade suggestion
ownedChaptersValue = sum(purchasedChapters.price); // VD: 250,000đ đã mua
remainingFullCoursePrice = fullCoursePrice - ownedChaptersValue; // 249,000đ
remainingChaptersPrice = sum(notOwnedChapters.price); // VD: 400,000đ

if (remainingFullCoursePrice < remainingChaptersPrice) {
  // Gợi ý: "Nâng cấp lên full course chỉ 249,000đ (tiết kiệm 151,000đ)!"
  showUpgradePrompt(remainingFullCoursePrice, savings);
}

// 3. Enrollment logic
// Mua chapter → enrollment type: PARTIAL
// Mua full course → enrollment type: FULL
// Upgrade → chuyển PARTIAL → FULL, mở khóa tất cả chapters
```

**Data model cho chapter ownership:**

```sql
-- Bảng enrollments (mua cả khóa)
CREATE TABLE enrollments (
  user_id INT, course_id INT, type ENUM('FULL', 'PARTIAL'),
  purchased_at TIMESTAMP, PRIMARY KEY (user_id, course_id)
);

-- Bảng chapter_purchases (mua lẻ)
CREATE TABLE chapter_purchases (
  user_id INT, course_id INT, chapter_id INT,
  price DECIMAL, purchased_at TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id)
);

-- Kiểm tra quyền truy cập lesson:
-- hasAccess = enrollment.type === 'FULL'
--          OR chapter_purchases.exists(userId, chapterId)
```

---

## UC-09: Giỏ hàng (Shopping Cart)

**Actor:** Student

### Implementation

```
Lưu cart ở đâu?
├── Guest (chưa login): localStorage (Frontend)
├── Student (đã login): Database (Backend) + sync từ localStorage khi login
└── Merge: Khi login, merge localStorage cart + DB cart → DB

API:
  POST   /api/cart/items         { courseId, chapterId? }   // Thêm
  DELETE /api/cart/items/:itemId                             // Xóa
  GET    /api/cart                                           // Xem
  POST   /api/cart/apply-coupon  { code }                   // Áp coupon
  DELETE /api/cart/coupon                                    // Bỏ coupon

Response GET /api/cart:
{
  items: [
    {
      id: 1,
      course: { id: 5, title: "React Mastery", thumbnail: "..." },
      chapter: null,           // null = mua cả khóa
      price: 499000,
      originalPrice: 499000    // Trước discount
    },
    {
      id: 2,
      course: { id: 5, title: "React Mastery", thumbnail: "..." },
      chapter: { id: 12, title: "Advanced Hooks" },
      price: 89000,
      originalPrice: 89000
    }
  ],
  coupon: { code: "SAVE20", discountPercent: 20 },
  subtotal: 588000,
  discount: 117600,
  total: 470400
}

Validation khi thêm vào cart:
  - Đã mua course/chapter này → Lỗi "Bạn đã sở hữu"
  - Thêm chapter nhưng đã có cả course trong cart → Lỗi "Bạn đã có cả khóa trong giỏ"
  - Thêm course nhưng đã có chapters của course đó → Hỏi "Bạn muốn thay thế bằng cả khóa?"
```

---

## UC-10: Đánh giá & Review khóa học

**Actor:** Student

### Implementation

```
POST /api/courses/:courseId/reviews
{ rating: 5, content: "Khóa học rất hay..." }

Preconditions:
  1. Đã mua khóa (check enrollment)
  2. Đã học ≥ 30% (check progress ≥ 0.3)
  3. Chưa review khóa này (1 user = 1 review/course)

Sau khi tạo review:
  1. INSERT reviews (userId, courseId, rating, content)
  2. UPDATE courses: recalculate avg_rating, review_count
     → Dùng incremental average (không query lại toàn bộ):

     new_avg = ((old_avg × old_count) + new_rating) / (old_count + 1)

  3. Invalidate cache trang chi tiết course

Anti-spam:
  - Rate limit: 1 review/user/course (DB unique constraint)
  - Content filter: check profanity list (word filter đơn giản)
  - Cooldown: không cho review trong 1 giờ đầu sau mua (tránh fake)
```

---

## UC-11: Wishlist

**Actor:** Student

### Implementation

```
POST   /api/wishlist    { courseId }     // Thêm
DELETE /api/wishlist/:courseId            // Xóa
GET    /api/wishlist                      // Danh sách

Thông báo giảm giá:
  Khi instructor tạo coupon hoặc giảm giá khóa:
  1. Query: SELECT user_id FROM wishlists WHERE course_id = :courseId
  2. Với mỗi user → push notification + email (async queue):
     "Khóa [React Mastery] trong wishlist của bạn đang giảm 30%!"

  Batching: Nếu wishlist có 10,000 users → chia batch 100 users/job
  để không overload email service
```

---

# MODULE 3: COURSE MANAGEMENT (Instructor)

---

## UC-12: Tạo khóa học mới

**Actor:** Instructor
**Portal:** Management Portal

### Implementation

```
Tạo khóa học là multi-step process (wizard):

Step 1: Thông tin cơ bản
  POST /api/instructor/courses
  { title, description, categoryId, level, language, tags[] }
  → Tạo course với status: DRAFT
  → Trả về courseId

Step 2: Upload thumbnail
  POST /api/instructor/courses/:id/thumbnail
  Body: FormData (image)
  → Upload Cloudinary → lưu URL

Step 3: Tạo curriculum structure
  POST /api/instructor/courses/:id/sections
  { title: "Getting Started", order: 1 }

  POST /api/instructor/courses/:id/sections/:sectionId/chapters
  { title: "Introduction", order: 1, price: 79000, isFreePreview: false }

Step 4: Upload nội dung (xem UC-13 chi tiết)

Step 5: Thiết lập giá
  PUT /api/instructor/courses/:id/pricing
  { price: 499000, chapterPricingEnabled: true }
  → Validate: sum(chapter prices) > course price

Step 6: Submit review
  POST /api/instructor/courses/:id/submit
  → Validate: có ít nhất 1 section, 1 chapter, 1 lesson có nội dung
  → Status: DRAFT → PENDING_REVIEW
  → Notify admins

Trạng thái khóa học:
  DRAFT → PENDING_REVIEW → APPROVED (published) / REJECTED
                              ↓
                          UNPUBLISHED (instructor tự ẩn)
```

---

## UC-13: Upload Video & Nội dung bài học

**Actor:** Instructor

### Trước (S3): Client → Presigned URL → S3 → FFmpeg worker transcode

### Sau (Cloudinary): Client → Cloudinary Upload → Auto-transcode

```
Instructor                Frontend              Backend              Cloudinary
    │                       │                     │                      │
    │ 1. Chọn file video    │                     │                      │
    │──────────────────────►│                     │                      │
    │                       │                     │                      │
    │                       │ 2. Request upload    │                      │
    │                       │    signature         │                      │
    │                       │ POST /api/uploads/   │                      │
    │                       │   sign               │                      │
    │                       │ {filename, lessonId} │                      │
    │                       │────────────────────►│                      │
    │                       │                     │ 3. Generate:          │
    │                       │                     │    - signature        │
    │                       │                     │    - timestamp        │
    │                       │                     │    - upload_preset    │
    │                       │                     │    - folder path      │
    │                       │                     │    - eager transforms │
    │                       │                     │      (480p, 720p)     │
    │                       │                     │                      │
    │                       │                     │ 4. CREATE media       │
    │                       │                     │    record             │
    │                       │                     │    status: UPLOADING  │
    │                       │                     │                      │
    │                       │ {signature,          │                      │
    │                       │  timestamp,          │                      │
    │                       │  apiKey,             │                      │
    │                       │  uploadPreset,       │                      │
    │                       │  mediaId}            │                      │
    │                       │◄────────────────────│                      │
    │                       │                     │                      │
    │  [Progress bar]       │ 5. Upload TRỰC TIẾP │                      │
    │◄──────────────────────│    lên Cloudinary   │                      │
    │                       │    (không qua BE!)  │                      │
    │                       │ ════════════════════════════════════════►  │
    │                       │    POST https://     │                      │
    │                       │    api.cloudinary.   │                      │
    │                       │    com/v1_1/         │                      │
    │                       │    {cloud}/video/    │                      │
    │                       │    upload            │                      │
    │                       │                     │                      │
    │  [Upload 100%]        │ 6. Cloudinary trả về│                      │
    │  "Video đang xử lý"  │◄═══════════════════════════════════════   │
    │◄──────────────────────│    {                 │                      │
    │                       │      public_id,      │                      │
    │                       │      secure_url,     │                      │
    │                       │      duration,       │                      │
    │                       │      format,         │                      │
    │                       │      bytes,          │                      │
    │                       │      eager: [        │  ← Auto-transcode!  │
    │                       │        {480p url},   │                      │
    │                       │        {720p url}    │                      │
    │                       │      ]               │                      │
    │                       │    }                 │                      │
    │                       │                     │                      │
    │                       │ 7. Gửi result        │                      │
    │                       │    về backend        │                      │
    │                       │ POST /api/uploads/   │                      │
    │                       │   :mediaId/complete  │                      │
    │                       │ {cloudinaryResult}   │                      │
    │                       │────────────────────►│                      │
    │                       │                     │ 8. UPDATE media:      │
    │                       │                     │    status: READY      │
    │                       │                     │    cloudinary_id      │
    │                       │                     │    urls: {            │
    │                       │                     │      original,       │
    │                       │                     │      480p,           │
    │                       │                     │      720p            │
    │                       │                     │    }                 │
    │                       │                     │    duration: 1845    │
    │  ✅ "Video sẵn sàng!" │                     │                      │
    │◄──────────────────────────────────────────── │                     │
```

### Code Implementation

```javascript
// Backend: Generate upload signature
// POST /api/uploads/sign
async signUpload(lessonId: string, userId: string) {
  // Validate: user owns this lesson's course
  const lesson = await this.validateLessonOwnership(lessonId, userId);

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `courses/${lesson.courseId}/lessons/${lessonId}`;

  // Eager transformations: auto-transcode khi upload
  const eager = 'c_scale,w_854,h_480|c_scale,w_1280,h_720';
  const eagerAsync = true; // Transcode async (không block upload response)

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, eager, eager_async: eagerAsync },
    CLOUDINARY_API_SECRET
  );

  // Tạo media record
  const media = await this.prisma.media.create({
    data: { lessonId, status: 'UPLOADING', type: 'VIDEO' }
  });

  return {
    mediaId: media.id,
    signature,
    timestamp,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
    folder,
    eager,
    eagerAsync
  };
}

// Frontend: Upload trực tiếp lên Cloudinary
async function uploadVideo(file, signData, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signData.apiKey);
  formData.append('timestamp', signData.timestamp);
  formData.append('signature', signData.signature);
  formData.append('folder', signData.folder);
  formData.append('eager', signData.eager);
  formData.append('eager_async', 'true');
  formData.append('resource_type', 'video');

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`,
    formData,
    {
      onUploadProgress: (e) => onProgress(Math.round(e.loaded / e.total * 100))
    }
  );

  // Upload xong → thông báo backend
  await api.post(`/uploads/${signData.mediaId}/complete`, {
    cloudinaryResult: response.data
  });
}
```

### Video Streaming (Cloudinary adaptive)

```javascript
// Cloudinary tự tạo adaptive streaming URL:
const videoUrl = cloudinary.url('courses/5/lessons/15/video', {
  resource_type: 'video',
  streaming_profile: 'auto', // Auto chọn quality theo bandwidth
  format: 'm3u8', // HLS format
});

// Hoặc đơn giản hơn — dùng URL transformation:
const urls = {
  original: `https://res.cloudinary.com/${cloud}/video/upload/courses/5/video.mp4`,
  hd720: `https://res.cloudinary.com/${cloud}/video/upload/c_scale,w_1280/courses/5/video.mp4`,
  sd480: `https://res.cloudinary.com/${cloud}/video/upload/c_scale,w_854/courses/5/video.mp4`,
};

// Frontend video player: user chọn chất lượng hoặc auto
```

### Instructor thoát giữa chừng?

```
Upload lên Cloudinary = ĐỒNG BỘ (client → Cloudinary trực tiếp)
  - Upload chưa xong mà thoát → Cloudinary tự cancel, không tốn storage
  - Upload xong → Cloudinary trả kết quả ngay (có URL)
  - Eager transforms (480p, 720p) chạy ASYNC trên Cloudinary
    → Instructor không cần chờ transcode
    → Backend nhận webhook khi transcode xong (hoặc poll)

  Khác S3: Cloudinary xử lý MỌI THỨ (upload + transcode + CDN + streaming)
  → Không cần build video processing pipeline riêng! ✅
```

### Giới hạn Cloudinary Free & Cách tối ưu

```
Storage: 25GB → ~50 videos × 500MB (gốc)
  Tối ưu:
  - Compress video trước khi upload (client-side, target 720p)
  - Set upload limit: max 500MB/video, max 30 phút
  - Xóa video gốc sau khi có bản transcode (giữ 480p + 720p)
    → Tiết kiệm ~60% storage

Bandwidth: 25GB/month → ~500 lượt xem video 720p (50MB/video)
  Tối ưu:
  - Default quality: 480p (tiết kiệm BW), user chọn 720p
  - Lazy loading: chỉ load video khi user click play

  → Đủ cho demo đồ án (50-100 users)
  → Nếu cần thêm: Cloudinary Plus = $89/month (không cần cho đồ án)
```

---

## UC-14: Quản lý Coupon/Khuyến mãi

**Actor:** Instructor

### Implementation

```
POST /api/instructor/coupons
{
  code: "REACT2024",              // Unique, uppercase
  discountType: "PERCENTAGE",     // PERCENTAGE hoặc FIXED_AMOUNT
  discountValue: 20,              // 20% hoặc 50000đ
  maxUses: 100,                   // Tối đa 100 lần dùng
  maxUsesPerUser: 1,              // Mỗi user dùng 1 lần
  minOrderAmount: 100000,         // Đơn tối thiểu 100k
  applicableCourses: [1, 5, 8],   // null = tất cả khóa của instructor
  startsAt: "2024-01-01",
  expiresAt: "2024-03-31"
}

Validation khi áp dụng coupon:
  1. Coupon exists && active
  2. Chưa hết hạn (startsAt <= now <= expiresAt)
  3. Chưa hết lượt (usageCount < maxUses)
  4. User chưa dùng quá maxUsesPerUser
  5. Áp dụng cho course trong cart (applicableCourses)
  6. Cart total >= minOrderAmount

  → Nếu fail bất kỳ điều kiện → trả lỗi cụ thể cho user

Race condition khi nhiều user cùng dùng coupon:
  UPDATE coupons
  SET usage_count = usage_count + 1
  WHERE id = :id AND usage_count < max_uses
  → Nếu affected rows = 0 → coupon đã hết
```

---

## UC-15: Xem thống kê & Doanh thu + Rút tiền ⭐

**Actor:** Instructor

### Dashboard API

```
GET /api/instructor/dashboard

{
  overview: {
    totalRevenue: 15000000,       // Tổng doanh thu (sau commission)
    totalStudents: 450,
    totalCourses: 5,
    avgRating: 4.6,
    pendingWithdrawal: 5000000,   // Số tiền chờ rút
    availableBalance: 10000000    // Số tiền có thể rút
  },
  revenueChart: [                 // 30 ngày gần nhất
    { date: "2024-01-01", revenue: 500000, enrollments: 12 },
    ...
  ],
  courseStats: [
    {
      courseId: 1, title: "React Mastery",
      revenue: 8000000, students: 200, rating: 4.8,
      completionRate: 0.35          // 35% học viên hoàn thành
    }
  ]
}
```

### Hệ thống Rút tiền (Withdrawal)

```
                    Earning Flow

Student mua khóa (499,000đ)
        │
        ▼
┌─────────────────────────────────┐
│ Order completed                 │
│                                 │
│ Platform commission: 30%        │
│ = 499,000 × 0.30 = 149,700đ   │
│                                 │
│ Instructor earning: 70%         │
│ = 499,000 × 0.70 = 349,300đ   │
│                                 │
│ INSERT earnings                 │
│   instructor_id: 5              │
│   amount: 349,300               │
│   status: AVAILABLE             │
│   available_at: now + 7 days    │  ← Giữ 7 ngày (refund period)
└─────────────────────────────────┘

        │ (Sau 7 ngày, không refund)
        ▼

┌─────────────────────────────────┐
│ Earning status: AVAILABLE       │
│ → Cộng vào availableBalance     │
└─────────────────────────────────┘

        │ Instructor yêu cầu rút
        ▼

POST /api/instructor/withdrawals
{ amount: 5000000, bankAccount: {...} }

Validation:
  - amount >= 200,000đ (minimum withdrawal)
  - amount <= availableBalance
  - Không có withdrawal PENDING nào khác
  - Bank account info đầy đủ

┌─────────────────────────────────┐
│ Withdrawal request              │
│ status: PENDING                 │
│                                 │
│ → Lock amount từ balance        │
│   (availableBalance -= amount)  │
│                                 │
│ → Notify Admin                  │
└─────────┬───────────────────────┘
          │
          ▼
    Admin review
    (manage.app.com/admin/withdrawals)
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
 APPROVED    REJECTED
    │           │
    ▼           │
 Admin chuyển  │ → Unlock amount
 tiền thủ công │   (availableBalance += amount)
 (hoặc API     │ → Notify instructor + lý do
  auto-payout) │
    │           │
    ▼
 status: COMPLETED
 → Notify instructor
 → Ghi log: withdrawal_history
```

### Rút tiền cho Instructor (SePay)

```
Vì dùng chuyển khoản NH → Rút tiền = Admin chuyển khoản thủ công

Flow:
1. Instructor request withdrawal (API vẫn giữ nguyên)
2. Admin approve trên Management Portal
3. Admin chuyển khoản thủ công từ TK NH của nền tảng → TK instructor
4. Admin mark withdrawal = COMPLETED trên hệ thống
5. System update balance + notify instructor

→ Đơn giản, phù hợp đồ án (không cần auto-payout)
→ Production: tích hợp API NH để auto-payout
```

**Cấu hình hoa hồng (Admin):**

```
PUT /api/admin/settings/commission
{
  defaultRate: 0.30,            // 30% mặc định
  tierRates: [                  // Giảm commission cho instructor tốt
    { minRevenue: 0,        rate: 0.30 },  // Mới: 30%
    { minRevenue: 10000000, rate: 0.25 },  // > 10M: 25%
    { minRevenue: 50000000, rate: 0.20 },  // > 50M: 20%
  ]
}

Khi tính earning:
  instructorTotalRevenue = sum(earnings WHERE instructor_id = X)
  applicableRate = tierRates.find(t => instructorTotalRevenue >= t.minRevenue)
  → Tier commission tự động → incentive instructor bán nhiều
```

---

# MODULE 4: LEARNING EXPERIENCE

---

## UC-16: Course Player (Xem bài học) ⭐

**Actor:** Student

### Implementation

```
GET /api/courses/:courseId/learn/:lessonId

Access Control:
  1. Check enrollment (FULL) → access all lessons
  2. Check chapter_purchases → access lessons in purchased chapters
  3. Check isFreePreview → access preview lessons
  4. Else → 403 Forbidden

Response:
{
  lesson: {
    id: 15,
    title: "React Hooks Deep Dive",
    type: "VIDEO",                // VIDEO | TEXT | QUIZ
    video: {
      urls: {
        "480p": "https://cdn.../480p.m3u8",   // HLS streaming
        "720p": "https://cdn.../720p.m3u8",
        "1080p": "https://cdn.../1080p.m3u8"
      },
      duration: 1845,             // giây = 30:45
      thumbnailUrl: "...",
      subtitles: [
        { language: "vi", url: "..." },
        { language: "en", url: "..." }
      ]
    },
    textContent: null,            // Rich HTML (cho lesson type TEXT)
    attachments: [
      { name: "slides.pdf", url: "...", size: "2.5MB" }
    ],
    isCompleted: false,           // User đã hoàn thành chưa
    progress: {                   // Tiến trình video
      lastPosition: 543,         // giây — vị trí xem cuối cùng
      watchedPercent: 0.29       // 29% đã xem
    }
  },
  curriculum: [...]               // Sidebar — đánh dấu ✅ lessons đã xong
}
```

### Video Progress Tracking — Tính % xem video ⭐

```
Vấn đề: Làm sao biết user đã xem bao nhiêu % video?
  - Không thể chỉ dựa vào position (user có thể tua)
  - Cần track THỰC SỰ xem những đoạn nào

Giải pháp: Watched Segments Tracking

┌─── Video: 30 phút (1800 giây) ──────────────────────────────────┐
│                                                                   │
│ User xem:  ████░░░░░░████████░░░░████░░░░░░░░░░░░░░░░░░░░░░░░   │
│            0-4m      8-16m      20-24m                            │
│                                                                   │
│ Watched segments: [[0,240], [480,960], [1200,1440]]              │
│ Total watched: 240 + 480 + 240 = 960 giây                       │
│ Video duration: 1800 giây                                         │
│ Watched percent: 960/1800 = 53.3%                                │
│                                                                   │
│ Quy tắc hoàn thành: watchedPercent >= 80% → ✅ Completed         │
└───────────────────────────────────────────────────────────────────┘
```

**Frontend gửi progress mỗi 10 giây:**

```javascript
// Frontend (video player event)
let watchedSegments = loadFromServer(); // [[0,240], [480,960]]
let segmentStart = null;

videoPlayer.on('play', (currentTime) => {
  segmentStart = currentTime;
});

videoPlayer.on('pause/seek/end', (currentTime) => {
  if (segmentStart !== null) {
    watchedSegments.push([segmentStart, currentTime]);
    watchedSegments = mergeOverlappingSegments(watchedSegments);
    segmentStart = null;
  }
});

// Gửi lên server mỗi 10 giây (debounced)
setInterval(() => {
  if (hasChanges) {
    fetch('PUT /api/progress/:lessonId', {
      body: JSON.stringify({
        lastPosition: videoPlayer.currentTime,
        watchedSegments: watchedSegments,
      }),
    });
  }
}, 10000);
```

**Backend merge segments:**

```javascript
function mergeSegments(segments) {
  if (segments.length <= 1) return segments;

  // Sort by start time
  segments.sort((a, b) => a[0] - b[0]);

  const merged = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    if (segments[i][0] <= last[1]) {
      // Overlapping → merge
      last[1] = Math.max(last[1], segments[i][1]);
    } else {
      merged.push(segments[i]);
    }
  }
  return merged;
}

function calculateWatchedPercent(segments, duration) {
  const totalWatched = segments.reduce((sum, [start, end]) => sum + (end - start), 0);
  return Math.min(totalWatched / duration, 1.0); // Cap at 100%
}
```

**Lưu progress:**

```sql
CREATE TABLE lesson_progress (
  user_id INT,
  lesson_id INT,
  last_position INT,                    -- giây
  watched_segments JSONB,               -- [[0,240],[480,960]]
  watched_percent DECIMAL(5,4),         -- 0.5333
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id)
);

-- Trigger: khi watched_percent >= 0.80 → is_completed = true
```

---

## UC-17: Làm bài Quiz/Exercise

**Actor:** Student

### Implementation

```
GET /api/courses/:courseId/lessons/:lessonId/quiz

{
  quiz: {
    id: 10,
    title: "React Hooks Quiz",
    passingScore: 70,             // % để pass
    maxAttempts: 3,               // Số lần làm tối đa (null = unlimited)
    timeLimit: null,              // Giới hạn thời gian (null = không giới hạn)
    questions: [
      {
        id: 1,
        type: "MULTIPLE_CHOICE",
        question: "Hook nào dùng để quản lý side effects?",
        options: [
          { id: "a", text: "useState" },
          { id: "b", text: "useEffect" },
          { id: "c", text: "useRef" },
          { id: "d", text: "useMemo" }
        ],
        // correctAnswer KHÔNG gửi cho frontend!
      },
      {
        id: 2,
        type: "TRUE_FALSE",
        question: "useCallback return một memoized function?",
        options: [
          { id: "a", text: "True" },
          { id: "b", text: "False" }
        ]
      }
    ],
    userAttempts: 1,              // Số lần đã làm
    bestScore: null               // Điểm cao nhất (null = chưa làm)
  }
}

Submit:
POST /api/courses/:courseId/lessons/:lessonId/quiz/submit
{
  answers: [
    { questionId: 1, selectedOptionId: "b" },
    { questionId: 2, selectedOptionId: "a" }
  ]
}

Response:
{
  score: 100,
  passed: true,
  totalQuestions: 2,
  correctCount: 2,
  results: [
    {
      questionId: 1,
      correct: true,
      correctAnswer: "b",
      explanation: "useEffect dùng cho side effects như API calls, subscriptions..."
    },
    ...
  ],
  lessonCompleted: true           // Quiz pass → lesson marked as completed
}

Chống gian lận:
  - correctAnswer chỉ trả về SAU khi submit (không gửi cùng câu hỏi)
  - Shuffle thứ tự câu hỏi + options mỗi lần làm
  - Lưu thời gian bắt đầu → nếu submit quá nhanh (< 5 giây/câu) → flag suspicious
```

---

## UC-18: Placement Test (Đánh giá trình độ)

**Actor:** Student

### Implementation

```
POST /api/placement-tests/start
{ categoryId: 5 }      // VD: "JavaScript"

Hệ thống tạo test:
  1. Lấy predefined question pool theo category + level
  2. Chọn 15 câu: 5 beginner + 5 intermediate + 5 advanced
  3. Trả về test session

Submit:
POST /api/placement-tests/:testId/submit
{ answers: [...] }

Scoring:
  beginnerCorrect = count(correct, level=beginner)     // /5
  intermediateCorrect = count(correct, level=intermediate) // /5
  advancedCorrect = count(correct, level=advanced)     // /5

  if (beginnerCorrect < 3) → Level: BEGINNER
  else if (intermediateCorrect < 3) → Level: INTERMEDIATE
  else if (advancedCorrect < 3) → Level: ADVANCED
  else → Level: EXPERT

Response:
{
  level: "INTERMEDIATE",
  scores: { beginner: 5, intermediate: 3, advanced: 1 },
  weakTopics: ["async/await", "closures", "prototypes"],
  recommendedCourses: [...]       // Từ recommendation engine, filter by level
}

→ Lưu level vào user_skills table → dùng cho chapter suggestion
```

---

## UC-19: Xem tiến trình học tập — Tính Progress khóa học ⭐

**Actor:** Student

### Cách tính Course Progress

```
Course Progress = Tổng lessons đã hoàn thành / Tổng lessons có quyền truy cập

Case 1: Mua cả khóa (FULL enrollment)
  progress = completedLessons.count / allLessons.count

  VD: 48 lessons, hoàn thành 20
  progress = 20/48 = 41.7%

Case 2: Mua lẻ chapters (PARTIAL enrollment)
  ownedLessons = lessons thuộc chapters đã mua
  progress = completedLessons.count / ownedLessons.count

  VD: Mua 2 chapters (12 lessons), hoàn thành 8
  progress = 8/12 = 66.7%
```

**Khi nào lesson được coi là "completed"?**

```
Lesson type VIDEO:
  → watched_percent >= 80% (xem ít nhất 80% video)

Lesson type TEXT:
  → User click "Mark as completed"
  → HOẶC scroll đến cuối bài (auto-detect)
  → HOẶC thời gian đọc >= estimated_reading_time × 50%

Lesson type QUIZ:
  → Quiz score >= passing_score (VD: >= 70%)
```

**Implementation:**

```javascript
// API: GET /api/my-courses/:courseId/progress

async function getCourseProgress(userId, courseId) {
  const enrollment = await getEnrollment(userId, courseId);

  let accessibleLessons;
  if (enrollment.type === 'FULL') {
    accessibleLessons = await getAllLessons(courseId);
  } else {
    const ownedChapterIds = await getOwnedChapterIds(userId, courseId);
    accessibleLessons = await getLessonsByChapters(ownedChapterIds);
  }

  const completedLessons = await getCompletedLessons(
    userId,
    accessibleLessons.map((l) => l.id),
  );

  const progress = completedLessons.length / accessibleLessons.length;

  // Chi tiết per chapter
  const chapterProgress = groupByChapter(accessibleLessons).map((chapter) => ({
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    totalLessons: chapter.lessons.length,
    completedLessons: chapter.lessons.filter((l) => completedLessons.includes(l.id)).length,
    progress: completed / total,
  }));

  return {
    overallProgress: progress,
    totalLessons: accessibleLessons.length,
    completedLessons: completedLessons.length,
    chapterProgress,
    estimatedTimeRemaining: calculateRemainingTime(accessibleLessons, completedLessons),
  };
}
```

**Dashboard tiến trình:**

```
GET /api/my-learning/dashboard

{
  activeCourses: [
    { courseId: 1, title: "React", progress: 0.65, lastAccessedAt: "..." },
    { courseId: 3, title: "Node.js", progress: 0.30, lastAccessedAt: "..." }
  ],
  completedCourses: [
    { courseId: 2, title: "CSS", completedAt: "...", certificate: {...} }
  ],
  streak: {
    current: 7,                   // 7 ngày liên tục
    longest: 15,                  // Kỷ lục
    todayCompleted: true          // Hôm nay đã học chưa
  },
  totalLearningTime: 3600,        // phút (tích lũy)
  skillsMap: [
    { skill: "JavaScript", level: "ADVANCED", coursesCompleted: 3 },
    { skill: "React", level: "INTERMEDIATE", coursesCompleted: 1 }
  ]
}
```

**Streak tracking:**

```sql
-- Mỗi ngày user hoàn thành ít nhất 1 lesson → streak + 1
-- Dùng bảng daily_activity:
CREATE TABLE daily_activity (
  user_id INT,
  activity_date DATE,
  lessons_completed INT,
  time_spent_minutes INT,
  PRIMARY KEY (user_id, activity_date)
);

-- Tính streak: đếm ngày liên tục từ hôm nay đi ngược lại
-- VD: 2024-01-15, 2024-01-14, 2024-01-13, (thiếu 01-12) → streak = 3
```

---

## UC-20: Nhận Certificate

**Actor:** Student

### Implementation

```
Trigger: Khi course progress = 100% (tất cả lessons completed)

Auto-generate certificate:
  1. Check: tất cả lessons completed + final quiz passed (nếu có)
  2. Generate unique certificate ID: CERT-{courseId}-{userId}-{timestamp}
     VD: CERT-005-00123-20240115
  3. Generate PDF certificate:
     - Template HTML/CSS → Puppeteer render PDF
     - Nội dung: tên student, tên khóa, tên instructor, ngày hoàn thành, cert ID
     - Upload PDF → S3
  4. INSERT certificates (userId, courseId, certId, pdfUrl, issuedAt)
  5. Notify student

Verify certificate:
  GET /api/certificates/verify/:certId
  → Public API, ai cũng truy cập được
  → Trả về: student name, course name, issued date, valid/invalid

Share:
  GET /api/certificates/:certId/share
  → Trả về public URL có thể share lên LinkedIn, Facebook...
```

---

# MODULE 5: SOCIAL LEARNING NETWORK

---

## UC-21 & UC-22: News Feed & Tạo Post

**Actor:** Student, Instructor

### Tạo Post

```
POST /api/posts
{
  content: "Vừa học xong React Hooks, chia sẻ notes...",
  type: "TEXT",                   // TEXT | IMAGE | CODE_SNIPPET | LINK
  images: ["uploaded-url-1.jpg"], // Nếu có hình
  codeSnippet: {                  // Nếu có code
    language: "javascript",
    code: "const [state, setState] = useState(0);"
  },
  tags: ["react", "hooks"],
  visibility: "PUBLIC",           // PUBLIC | FOLLOWERS | GROUP
  groupId: null                   // Nếu post trong group
}
```

### News Feed — Fanout on Write Strategy

```
Vấn đề: User A follow 200 người. Khi load feed → query 200 bảng posts? Quá chậm!

Giải pháp: Fanout on Write (precompute feed)

Khi User B tạo post mới:
  1. INSERT posts (author: B, content: ...)
  2. Lấy danh sách followers của B: [A, C, D, E, ...]
  3. Với MỖI follower → INSERT feed_items (userId: A, postId: 123, createdAt: ...)
  → Feed của mỗi follower đã được chuẩn bị sẵn!

Khi User A load feed:
  SELECT p.* FROM feed_items fi
  JOIN posts p ON fi.post_id = p.id
  WHERE fi.user_id = :userId
  ORDER BY fi.created_at DESC
  LIMIT 20 OFFSET :offset
  → Chỉ 1 query đơn giản, có index → nhanh!

Nhưng nếu user có 100,000 followers? (celebrity problem)
  → Async: đẩy vào queue, worker xử lý batch 1000 followers/job
  → User B thấy post ngay lập tức (hiển thị trong feed của chính họ)
  → Followers nhận trong feed sau vài giây (eventual consistency — chấp nhận được)
```

```sql
-- Bảng feed_items (pre-computed feed)
CREATE TABLE feed_items (
  id BIGSERIAL,
  user_id INT,          -- feed owner
  post_id INT,          -- the post
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, id)    -- Partition by user_id nếu cần
);
CREATE INDEX idx_feed_user_time ON feed_items(user_id, created_at DESC);

-- Feed size limit: giữ tối đa 1000 feed items/user
-- Cron job: xóa feed_items cũ > 1000 items per user
```

### Tương tác: Like, Comment, Share

```
POST /api/posts/:postId/like        // Toggle like
POST /api/posts/:postId/comments    { content: "..." }
POST /api/posts/:postId/share       // Share to own feed
POST /api/posts/:postId/bookmark    // Save for later

Like count optimization:
  - Không COUNT(*) mỗi lần hiển thị (chậm!)
  - Lưu like_count trực tiếp trên posts table
  - Khi like → UPDATE posts SET like_count = like_count + 1
  - Dùng Redis counter cho high-traffic posts: likes:{postId}
  - Sync Redis → DB mỗi 1 phút (batch update)
```

---

## UC-23: Follow/Unfollow

```
POST   /api/users/:userId/follow      // Follow
DELETE /api/users/:userId/follow       // Unfollow

Bảng:
CREATE TABLE follows (
  follower_id INT,
  following_id INT,
  created_at TIMESTAMP,
  PRIMARY KEY (follower_id, following_id)
);

Khi follow:
  1. INSERT follows
  2. UPDATE users SET follower_count += 1 WHERE id = following_id
  3. UPDATE users SET following_count += 1 WHERE id = follower_id
  4. Notify: "User X đã follow bạn"
```

---

## UC-24: Real-time Chat

**Actor:** Student, Instructor

### Implementation: WebSocket (Socket.io)

```
Architecture:

Client ←──WebSocket──→ Socket.io Server ←──→ Redis Pub/Sub ←──→ Database
                                                    ↑
                                              (Nếu scale nhiều
                                               server instances)

Flow gửi tin nhắn:
  1. Client emit: socket.emit('send_message', {
       conversationId: "conv_123",
       content: "Hello!",
       type: "TEXT"        // TEXT | IMAGE | CODE | FILE
     })

  2. Server nhận:
     a. Validate: user thuộc conversation này?
     b. INSERT messages (conversationId, senderId, content, type, createdAt)
     c. UPDATE conversations SET lastMessageAt = now, lastMessage = content
     d. Emit tới tất cả members online trong conversation:
        io.to("conv_123").emit('new_message', { message })
     e. Members OFFLINE → lưu unread count:
        Redis: INCR unread:{userId}:{conversationId}

  3. Client nhận: socket.on('new_message') → hiển thị tin nhắn

Typing indicator:
  socket.emit('typing', { conversationId })
  → Broadcast to room (trừ sender)
  → Auto-clear sau 3 giây không có event mới

Read receipts:
  socket.emit('mark_read', { conversationId, messageId })
  → UPDATE: last_read_message_id cho user trong conversation
  → Redis: DEL unread:{userId}:{conversationId}
  → Broadcast: "User X đã đọc đến message Y"
```

**Business rule — Ai được chat với ai:**

```
Student ↔ Student: Tự do (cả hai đã follow nhau HOẶC cùng group)
Student → Instructor: Chỉ khi student đã mua khóa của instructor đó
Instructor → Student: Chỉ reply, không spam
```

---

## UC-25: Groups (Nhóm học tập)

```
POST /api/groups
{
  name: "React Vietnam Learners",
  description: "...",
  privacy: "PUBLIC",         // PUBLIC (ai cũng join) | PRIVATE (cần approve)
  type: "USER_CREATED"       // USER_CREATED | COURSE_AUTO
}

Auto-create group cho khóa học:
  Khi course status → APPROVED:
    INSERT groups (
      name: "Nhóm học: {course.title}",
      type: "COURSE_AUTO",
      courseId: course.id,
      ownerId: course.instructorId
    )

  Khi student mua khóa → auto join group:
    INSERT group_members (groupId, userId, role: "MEMBER")

Group post:
  POST /api/groups/:groupId/posts
  → Tương tự UC-22 nhưng visibility = GROUP
  → Chỉ members thấy (private group)
```

---

## UC-26: Q&A Forum

```
POST /api/questions
{
  title: "Tại sao useEffect chạy 2 lần?",
  content: "Khi tôi dùng React 18...",
  tags: ["react", "hooks", "useEffect"],
  courseId: 5,                    // Optional — gắn với khóa học
  codeSnippet: { language: "jsx", code: "..." }
}

Trả lời:
POST /api/questions/:questionId/answers
{ content: "Vì React 18 StrictMode..." }

Vote:
POST /api/answers/:answerId/vote
{ value: 1 }                     // 1 = upvote, -1 = downvote

Best Answer (chỉ người hỏi hoặc instructor mark):
PUT /api/questions/:questionId/best-answer
{ answerId: 45 }

Gợi ý câu hỏi tương tự (simple — không AI):
  Khi user gõ title → search existing questions bằng full-text search:
  GET /api/questions/similar?title=useEffect chạy 2 lần
  → Trả về 5 câu hỏi matching → "Có phải bạn muốn hỏi...?"
  → Giảm câu hỏi trùng lặp
```

---

## UC-27: Notifications

### Implementation: Multi-channel Notification System

```
                    ┌──────────────────┐
                    │ Notification     │
   Event xảy ra    │ Service          │
   ─────────────── │                  │
   (like, comment, │ Queue: Bull/     │
    purchase, etc.) │ BullMQ + Redis  │
                    │                  │
                    └──┬────┬────┬────┘
                       │    │    │
                 ┌─────┘    │    └─────┐
                 ▼          ▼          ▼
          ┌──────────┐ ┌────────┐ ┌────────┐
          │ In-App   │ │ Email  │ │ Push   │
          │ (DB +    │ │(Send-  │ │(Web    │
          │ WebSocket│ │ Grid)  │ │ Push)  │
          │ realtime)│ │        │ │        │
          └──────────┘ └────────┘ └────────┘

Tạo notification:
  1. Event xảy ra (VD: User B like post của User A)
  2. Push notification job vào queue:
     {
       recipientId: A,
       type: "POST_LIKED",
       data: { actorId: B, postId: 123 },
       channels: ["IN_APP", "PUSH"]      // Theo user preferences
     }
  3. Worker xử lý:
     a. INSERT notifications (recipient, type, data, read: false)
     b. Emit WebSocket: io.to("user_A").emit("notification", { ... })
     c. Send push notification (nếu user enable)
  4. Email: chỉ cho events quan trọng (purchase, approval) hoặc digest

Notification preferences (user tự cấu hình):
  PUT /api/users/me/notification-preferences
  {
    "POST_LIKED":     { inApp: true,  email: false, push: true  },
    "NEW_FOLLOWER":   { inApp: true,  email: false, push: true  },
    "PURCHASE":       { inApp: true,  email: true,  push: true  },
    "COURSE_APPROVED":{ inApp: true,  email: true,  push: true  },
    "LEARNING_REMIND":{ inApp: true,  email: true,  push: false }
  }

Batch/Aggregate notifications:
  Thay vì "User B liked", "User C liked", "User D liked" (3 notifications)
  → Gom: "User B, C, D và 5 người khác đã thích bài viết của bạn" (1 notification)

  Implementation: delay 5 phút trước khi send → group by (type + targetId)
```

---

# MODULE 6: AI FEATURES

---

## UC-28: AI Tutor (Chat với AI)

**Actor:** Student

### Thay đổi

```
Trước:  OpenAI GPT-4 ($30/1M tokens) + OpenAI Embeddings ($0.1/1M tokens)
Sau:    Groq Llama 3.3 70B (FREE) + Local Embeddings (FREE)
```

### RAG Pipeline với Groq

```
                   ┌─────────────────────────────┐
                   │     RAG PIPELINE (FREE)      │
                   │                              │
  Student asks     │  1. Embed question           │
  "Giải thích      │     (local model)            │
   useEffect?"     │           │                  │
       │           │           ▼                  │
       │           │  2. Search pgvector          │
       │           │     → Top 5 relevant chunks  │
       │           │           │                  │
       │           │           ▼                  │
       │           │  3. Compose prompt           │
       │           │     [system + context +      │
       │           │      question]               │
       │           │           │                  │
       │           │           ▼                  │
       │           │  4. Groq API (Llama 3.3 70B) │
       │           │     → Stream response        │
       │           │     → ~500 tokens/sec 🚀     │
       │           │                              │
       └──────────►│  5. Return answer            │
                   │                              │
                   └─────────────────────────────┘
```

### Embedding Solution (Free)

```javascript
// Option A: Transformers.js (chạy local trên backend, FREE, không cần API)
// Model: all-MiniLM-L6-v2 (~80MB, load 1 lần khi server start)

import { pipeline } from '@xenova/transformers';

let embedder;

async function initEmbedder() {
  // Load model 1 lần khi server start (~5 giây)
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
}

async function getEmbedding(text) {
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data); // Vector 384 dimensions
}

// Lưu embedding vào pgvector:
// INSERT INTO course_chunks (lesson_id, content, embedding)
// VALUES ($1, $2, $3::vector)

// Search:
// SELECT content, 1 - (embedding <=> $1::vector) AS similarity
// FROM course_chunks
// WHERE course_id = $2
// ORDER BY embedding <=> $1::vector
// LIMIT 5
```

### Groq API Call

```javascript
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function askAITutor(question, contextChunks, courseTitle) {
  const context = contextChunks.map((c) => c.content).join('\n\n');

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile', // Free, 128K context
    messages: [
      {
        role: 'system',
        content: `Bạn là AI Tutor cho khóa học "${courseTitle}".
Trả lời câu hỏi DỰA TRÊN nội dung khóa học bên dưới.
Nếu câu hỏi ngoài phạm vi → nói rõ "Câu hỏi này nằm ngoài nội dung khóa học".
Trả lời bằng tiếng Việt, dễ hiểu, có ví dụ nếu cần.`,
      },
      {
        role: 'user',
        content: `NỘI DUNG KHÓA HỌC:\n${context}\n\nCÂU HỎI: ${question}`,
      },
    ],
    stream: true,
    max_tokens: 1024,
    temperature: 0.3, // Low temperature → ít sáng tạo, bám sát context
  });

  return stream; // Streaming response → frontend hiển thị từng token
}
```

### Rate Limiting (Groq free)

```
Groq free tier: 30 requests/minute, 14,400 requests/day

Chiến lược:
  - Mỗi user: max 10 câu hỏi/ngày (→ 1,440 users/day nếu ai cũng hỏi max)
  - Redis counter: INCR ai_usage:{userId}:{date}, EXPIRE 86400
  - Nếu đạt limit → "Bạn đã hết lượt hỏi hôm nay. Quay lại ngày mai!"

  Backend rate limit Groq:
  - Queue AI requests (in-memory queue)
  - Process max 25 requests/minute (buffer 5 cho safety)
  - Nếu queue full → "AI Tutor đang bận, vui lòng thử lại sau 1 phút"
```

---

## UC-29 & UC-30: Recommendation & Chapter Suggestion

> Xem file [05-recommendation-system.md](05-recommendation-system.md) cho chi tiết thuật toán

---

# MODULE 7: ADMIN MANAGEMENT

---

## UC-31: Phê duyệt Instructor

```
GET /api/admin/instructor-applications?status=PENDING

Response: [
  {
    id: 1,
    user: { id: 5, name: "Nguyễn Văn A", email: "..." },
    expertise: ["React", "Node.js"],
    experience: "5 năm kinh nghiệm...",
    cvUrl: "https://s3.../cv.pdf",
    certificateUrls: ["..."],
    portfolioUrl: "https://github.com/...",
    submittedAt: "2024-01-10",
    status: "PENDING"
  }
]

Approve:
PUT /api/admin/instructor-applications/:id
{ status: "APPROVED", note: "Hồ sơ tốt, welcome!" }
→ UPDATE users SET role = 'INSTRUCTOR'
→ CREATE instructor_profiles
→ Notify user

Reject:
PUT /api/admin/instructor-applications/:id
{ status: "REJECTED", note: "Cần bổ sung bằng cấp" }
→ Notify user + lý do
→ User có thể submit lại sau 30 ngày
```

---

## UC-32: Phê duyệt khóa học

```
GET /api/admin/course-reviews?status=PENDING_REVIEW

Checklist admin khi review:
  □ Nội dung phù hợp, không vi phạm
  □ Video chất lượng tối thiểu (720p, âm thanh rõ)
  □ Mô tả đầy đủ, chính xác
  □ Giá hợp lý
  □ Có ít nhất 5 lessons

PUT /api/admin/course-reviews/:courseId
{
  status: "APPROVED",         // hoặc "REJECTED"
  feedback: "..."             // Nếu rejected → lý do chi tiết
}

Approve:
  → Course status: APPROVED (hiện trên marketplace)
  → Auto-create course group (UC-25)
  → Notify instructor
  → Index vào search (update search_vector)

Reject:
  → Course status: REJECTED
  → Notify instructor + feedback
  → Instructor sửa → re-submit → PENDING_REVIEW lại
```

---

## UC-33 & UC-34: Quản lý Users & Xử lý Reports

```
Users:
  GET /api/admin/users?role=STUDENT&status=ACTIVE&search=nguyen
  PUT /api/admin/users/:id  { status: "SUSPENDED", reason: "..." }
  → Suspended user không login được → email thông báo

Reports:
  POST /api/reports         (user tạo report)
  { targetType: "POST", targetId: 123, reason: "SPAM", description: "..." }

  GET  /api/admin/reports?status=PENDING
  PUT  /api/admin/reports/:id
  { action: "REMOVE_CONTENT", note: "Vi phạm quy định" }
  → Actions: DISMISS | WARNING | REMOVE_CONTENT | SUSPEND_USER
  → Notify reporter + reported user
```

---

## UC-35: Dashboard thống kê nền tảng

```
GET /api/admin/dashboard

{
  overview: {
    totalUsers: 15000,
    totalInstructors: 120,
    totalCourses: 850,
    totalRevenue: 2500000000,       // Tổng doanh thu nền tảng
    platformEarnings: 750000000,    // Hoa hồng nền tảng
    pendingWithdrawals: 50000000
  },
  charts: {
    userGrowth: [                   // 30 ngày
      { date: "2024-01-01", newUsers: 45, activeUsers: 1200 }
    ],
    revenueChart: [
      { date: "2024-01-01", revenue: 15000000, orders: 35 }
    ]
  },
  topCourses: [...],                // Top 10 by revenue
  topInstructors: [...],            // Top 10 by revenue
  recentReports: [...]              // 10 reports mới nhất
}

Optimization:
  - Dashboard data = heavy queries → pre-compute daily (cron job lúc 2AM)
  - Lưu vào bảng analytics_snapshots
  - Admin load dashboard → đọc snapshot (instant) + realtime counters từ Redis
```
