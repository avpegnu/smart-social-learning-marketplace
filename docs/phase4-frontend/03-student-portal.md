# 3. STUDENT PORTAL — Chi tiết Pages & Components

> URL: student.app.com | Target: Guest + Student + Instructor (as learner)
> Framework: Next.js 16 (App Router) | Rendering: Server Components + Streaming

---

## 3.1 Sitemap & Route Structure

```
app/[locale]/
├── layout.tsx                         # Root layout (ThemeProvider, i18n, fonts)
├── page.tsx                           # Homepage
├── not-found.tsx                      # 404 page
├── error.tsx                          # Error boundary
├── loading.tsx                        # Root loading skeleton
│
├── (auth)/                            # Auth group (no navbar/footer)
│   ├── layout.tsx                     # Auth layout (centered card)
│   ├── login/page.tsx                 # Đăng nhập
│   ├── register/page.tsx              # Đăng ký
│   ├── verify-email/page.tsx          # Xác nhận email
│   ├── forgot-password/page.tsx       # Quên mật khẩu
│   ├── reset-password/page.tsx        # Đặt lại mật khẩu
│   └── google/callback/page.tsx       # Google OAuth callback
│
├── (main)/                            # Main layout group (navbar + footer)
│   ├── layout.tsx                     # Main layout
│   ├── courses/
│   │   ├── page.tsx                   # Browse/Search courses
│   │   └── [slug]/page.tsx            # Course detail
│   │
│   ├── my-learning/
│   │   ├── page.tsx                   # Learning dashboard
│   │   └── certificates/page.tsx      # My certificates
│   │
│   ├── social/
│   │   ├── page.tsx                   # News feed
│   │   └── groups/
│   │       ├── page.tsx               # Groups listing
│   │       └── [groupId]/page.tsx     # Group detail
│   │
│   ├── qna/
│   │   ├── page.tsx                   # Q&A listing
│   │   ├── ask/page.tsx               # Ask question form
│   │   └── [questionId]/page.tsx      # Question detail + answers
│   │
│   ├── chat/page.tsx                  # Chat (conversations + messages)
│   │
│   ├── ai-tutor/page.tsx             # AI Tutor (session list + chat)
│   │
│   ├── cart/page.tsx                  # Shopping cart
│   ├── checkout/page.tsx              # Checkout (order summary + QR)
│   ├── payment/[orderId]/page.tsx     # Payment waiting (QR + polling)
│   │
│   ├── orders/
│   │   ├── page.tsx                   # Order history
│   │   └── [orderId]/page.tsx         # Order detail
│   │
│   ├── wishlist/page.tsx              # Wishlist
│   │
│   ├── profile/
│   │   ├── [userId]/page.tsx          # Public profile
│   │   └── edit/page.tsx              # Edit my profile
│   │
│   ├── settings/page.tsx              # Settings (tabs: profile, account, notifications, appearance)
│   │
│   ├── become-instructor/page.tsx     # Instructor application form
│   │
│   └── notifications/page.tsx         # All notifications
│
└── (learning)/                        # Learning layout (no footer, custom header)
    ├── layout.tsx                     # Learning layout (minimal chrome)
    └── courses/[courseId]/
        └── lessons/[lessonId]/page.tsx # Course player
```

---

## 3.2 Page Details — Từng page chi tiết

---

### PAGE: Homepage (`/`)

```
Route:     /
Auth:      Public (Guest + Authenticated)
Rendering: Server Component + Suspense streaming
Cache:     ISR — revalidate mỗi 5 phút (homepage data ít thay đổi)
API Calls: GET /api/courses (featured, new, popular) + GET /api/categories
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    HERO SECTION                             │  │
│  │                                                             │  │
│  │  "Học tập thông minh, kết nối cộng đồng"                   │  │
│  │  "Nền tảng học trực tuyến kết hợp..."                       │  │
│  │                                                             │  │
│  │  [ Khám phá khóa học ]  [ Tìm hiểu thêm ]                 │  │
│  │                                                             │  │
│  │  📚 500+ Khóa học | 👨‍🎓 10K+ Học viên | ⭐ 4.8 Rating      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  📂 CATEGORIES — Horizontal scroll (icons + labels)        │  │
│  │  [🌐 Web Dev] [📱 Mobile] [🤖 AI/ML] [📊 Data] [🎨 Design] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔥 KHÓA HỌC NỔI BẬT                          [Xem tất cả] │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │  │
│  │  │Course│ │Course│ │Course│ │Course│  ← Horizontal scroll  │  │
│  │  │Card  │ │Card  │ │Card  │ │Card  │    on mobile          │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🆕 KHÓA HỌC MỚI NHẤT                         [Xem tất cả] │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │  │
│  │  │Card  │ │Card  │ │Card  │ │Card  │                      │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💡 GỢI Ý CHO BẠN (nếu đã login)              [Xem tất cả] │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │  │
│  │  │Card  │ │Card  │ │Card  │ │Card  │                      │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ✨ TẠI SAO CHỌN CHÚNG TÔI?                               │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │  │
│  │  │ 👥         │ │ 🤖         │ │ ✅         │              │  │
│  │  │ Học tập    │ │ AI Tutor   │ │ Khóa học   │              │  │
│  │  │ xã hội    │ │ thông minh │ │ chất lượng │              │  │
│  │  └────────────┘ └────────────┘ └────────────┘              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Components Used

- `Hero` — Full-width hero with CTA buttons, stats counters
- `CategoryBar` — Horizontal scrollable category chips
- `CourseSection` — Title + "View all" link + CourseCard grid (4 cols desktop, 2 mobile)
- `CourseCard` — Thumbnail, title, instructor, rating, price, badge (bestseller/new)
- `WhyUsSection` — 3-column feature cards

#### Data Fetching (Server Component)

```typescript
// Parallel fetches trong Server Component
async function HomePage() {
  const [featured, newest, categories] = await Promise.all([
    api.courses.list({ sort: 'popular', limit: 8 }),
    api.courses.list({ sort: 'newest', limit: 8 }),
    api.categories.list(),
  ])

  // Recommendations chỉ khi có user (cookie-based auth check)
  const user = await getServerUser()
  const recommended = user
    ? await api.recommendations.get({ context: 'homepage', limit: 8 })
    : null

  return (
    <>
      <Hero />
      <CategoryBar categories={categories.data} />
      <CourseSection title={t('home.featuredCourses')} courses={featured.data} />
      <CourseSection title={t('home.newCourses')} courses={newest.data} />
      {recommended && (
        <CourseSection title={t('home.recommendedCourses')} courses={recommended.data} />
      )}
      <WhyUsSection />
    </>
  )
}
```

---

### PAGE: Login (`/login`)

```
Route:     /login
Auth:      Public (redirect if already logged in)
Rendering: Client Component (form interactivity)
Layout:    Auth layout — centered card, no navbar
```

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                     ┌────────────────────┐                   │
│                     │    🎓 Logo         │                   │
│                     │                    │                   │
│                     │    Đăng nhập       │                   │
│                     │    "Chào mừng..."  │                   │
│                     │                    │                   │
│                     │  ┌──────────────┐  │                   │
│                     │  │ Email        │  │                   │
│                     │  └──────────────┘  │                   │
│                     │  ┌──────────────┐  │                   │
│                     │  │ Password 👁  │  │                   │
│                     │  └──────────────┘  │                   │
│                     │                    │                   │
│                     │  [Quên mật khẩu?]  │                   │
│                     │                    │                   │
│                     │  [  Đăng nhập   ]  │ ← Primary button │
│                     │                    │                   │
│                     │  ─── Hoặc ───      │                   │
│                     │                    │                   │
│                     │  [G Đăng nhập     ]│ ← Google OAuth   │
│                     │  [  với Google    ]│                   │
│                     │                    │                   │
│                     │  Chưa có TK?       │                   │
│                     │  [Đăng ký ngay]    │                   │
│                     │                    │                   │
│                     │  🌙/☀️  🌐 VI/EN   │ ← Theme + Locale │
│                     └────────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Component Logic

```typescript
// Login flow:
// 1. Submit email + password → POST /api/auth/login
// 2. Response: { accessToken, user } + Set-Cookie: refreshToken (httpOnly)
// 3. Store accessToken in memory (Zustand store)
// 4. Merge localStorage cart → POST /api/cart/merge
// 5. Redirect to: returnUrl (from query param) || /
//
// Google OAuth:
// 1. Click Google → redirect to /api/auth/google
// 2. Google consent → callback → /auth/google/callback?code=xxx
// 3. Backend exchanges code → creates/links user → returns JWT
// 4. Same flow as step 2-5 above
```

---

### PAGE: Register (`/register`)

```
Route:     /register
Auth:      Public (redirect if already logged in)
Rendering: Client Component
Layout:    Auth layout
```

#### Layout — Tương tự Login nhưng thêm fields

```
Fields:
  - Họ và tên (fullName)
  - Email
  - Mật khẩu (có password strength indicator)
  - Xác nhận mật khẩu
  - Google OAuth button
  - Checkbox: Đồng ý điều khoản
  - Link: Đã có tài khoản? → Đăng nhập

Validation (Zod, realtime):
  - Email: required + email format
  - Password: min 8 + 1 uppercase + 1 number (show strength bar)
  - Confirm password: must match
  - fullName: 2-100 characters

After submit:
  → Redirect to /verify-email?email=user@example.com
```

---

### PAGE: Browse Courses (`/courses`)

```
Route:     /courses?q=react&category=web&level=BEGINNER&sort=popular&page=1
Auth:      Public
Rendering: Server Component (search params → server fetch) + Client filters
Cache:     Dynamic — depends on query params
API:       GET /api/courses?q=...&category=...&level=...&sort=...&page=...&limit=12
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔍 [ Tìm kiếm khóa học...                              ] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┬─────────────────────────────────────────────────┐  │
│  │          │                                                 │  │
│  │ FILTERS  │  "128 khóa học được tìm thấy"   Sort: [▾ Popular]│ │
│  │          │                                                 │  │
│  │ Danh mục │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │  │
│  │ ☑ Web    │  │Course│ │Course│ │Course│ │Course│          │  │
│  │ ☐ Mobile │  │Card  │ │Card  │ │Card  │ │Card  │          │  │
│  │ ☐ AI/ML  │  └──────┘ └──────┘ └──────┘ └──────┘          │  │
│  │ ☐ Data   │                                                 │  │
│  │          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │  │
│  │ Trình độ │  │Course│ │Course│ │Course│ │Course│          │  │
│  │ ☑ Cơ bản │  │Card  │ │Card  │ │Card  │ │Card  │          │  │
│  │ ☐ T.cấp │  └──────┘ └──────┘ └──────┘ └──────┘          │  │
│  │ ☐ N.cao  │                                                 │  │
│  │          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │  │
│  │ Giá      │  │Course│ │Course│ │Course│ │Course│          │  │
│  │ ○ Tất cả │  │Card  │ │Card  │ │Card  │ │Card  │          │  │
│  │ ○ M.phí  │  └──────┘ └──────┘ └──────┘ └──────┘          │  │
│  │ ○ Có phí │                                                 │  │
│  │          │  ← 1  2  3  4  5  ... 11 →                     │  │
│  │ Đánh giá │                                                 │  │
│  │ ★★★★☆+  │                                                 │  │
│  │ ★★★☆☆+  │                                                 │  │
│  │          │                                                 │  │
│  │ [Xóa lọc]│                                                 │  │
│  └──────────┴─────────────────────────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

Mobile: Filters → Sheet (slide from left) khi tap "Bộ lọc" button
```

#### Interaction Details

```
Search:
  - Debounce 300ms → update URL search params → server re-fetch
  - Search icon + clear button

Filters:
  - Category: checkbox group (multi-select)
  - Level: checkbox group
  - Price: radio group (All / Free / Paid)
  - Rating: radio group (4★+, 3★+, all)
  - All filters update URL params → server re-render
  - Active filters shown as chips above results

Sort:
  - Dropdown: Popular (default), Newest, Highest Rated, Price Low→High, Price High→Low

Pagination:
  - Server-side pagination (page param in URL)
  - 12 items per page
  - Page numbers + Previous/Next

Mobile:
  - Search bar full-width
  - "Bộ lọc" button → opens Sheet (drawer) with all filters
  - Course grid: 1 column (list view on very small screens)
```

---

### PAGE: Course Detail (`/courses/[slug]`)

```
Route:     /courses/[slug]
Auth:      Public (enrolled status affects UI)
Rendering: Server Component (SEO-critical, full data fetch)
Cache:     ISR — revalidate mỗi 30 phút
API:       GET /api/courses/:slug (includes curriculum, instructor, reviews, recommendations)
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  COURSE HEADER (dark bg)                                    │  │
│  │                                                             │  │
│  │  Web Development > React                    ← Breadcrumb   │  │
│  │                                                             │  │
│  │  ┌─────────────────────────┐  ┌──────────────────────────┐ │  │
│  │  │                         │  │ Lập trình React từ       │ │  │
│  │  │    Preview Video /      │  │ cơ bản đến nâng cao      │ │  │
│  │  │    Thumbnail            │  │                          │ │  │
│  │  │    ▶ (click to play)    │  │ Mô tả ngắn về khóa...   │ │  │
│  │  │                         │  │                          │ │  │
│  │  └─────────────────────────┘  │ ⭐ 4.7 (234 đánh giá)   │ │  │
│  │                               │ 👨‍🎓 1,234 học viên       │ │  │
│  │                               │ 🎓 Nguyễn Văn A         │ │  │
│  │                               │ 📅 Cập nhật 01/2026     │ │  │
│  │                               │ 🌐 Tiếng Việt            │ │  │
│  │                               │ 📊 Trung cấp             │ │  │
│  │                               └──────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────┬────────────────────────┐  │
│  │                                   │                        │  │
│  │  TAB NAVIGATION:                  │  STICKY PURCHASE CARD  │  │
│  │  [Tổng quan] [Nội dung]          │                        │  │
│  │  [Đánh giá] [Hỏi đáp]           │  💰 499,000₫           │  │
│  │                                   │  ~~799,000₫~~ -37%    │  │
│  │  ─── TAB: TỔNG QUAN ───         │                        │  │
│  │                                   │  [Thêm vào giỏ hàng]  │  │
│  │  📋 Bạn sẽ học được gì           │  [Mua ngay]            │  │
│  │  ✓ Hiểu React fundamentals      │                        │  │
│  │  ✓ Build SPA apps               │  ♡ Yêu thích | ↗ Chia  │  │
│  │  ✓ Redux state management        │     sẻ                 │  │
│  │  ✓ Next.js integration          │                        │  │
│  │                                   │  ── Bao gồm ──        │  │
│  │  📝 Mô tả chi tiết               │  📹 24 giờ video       │  │
│  │  (expandable rich text)           │  📝 15 bài viết        │  │
│  │                                   │  📋 8 bài kiểm tra     │  │
│  │  📋 Yêu cầu tiên quyết           │  📎 20 tài liệu        │  │
│  │  • JavaScript cơ bản             │  🏆 Chứng chỉ          │  │
│  │  • HTML/CSS cơ bản               │  ♾️ Truy cập trọn đời  │  │
│  │                                   │                        │  │
│  │  👨‍🏫 Giảng viên                    │  ── Mua theo chương ── │  │
│  │  ┌──────┐ Nguyễn Văn A           │  Ch.1: React Basic     │  │
│  │  │Avatar│ ⭐ 4.8 | 5 khóa        │       99,000₫ [Mua]   │  │
│  │  └──────┘ 1,200 học viên         │  Ch.2: Hooks           │  │
│  │  "Bio ngắn..."                   │       149,000₫ [Mua]   │  │
│  │                                   │  Ch.3: State Mgmt      │  │
│  │  ─── TAB: NỘI DUNG ───          │       149,000₫ [Mua]   │  │
│  │                                   │                        │  │
│  │  ▼ Section 1: Giới thiệu (3 bài) │                        │  │
│  │    📹 Bài 1: Welcome (5:30) FREE │                        │  │
│  │    📹 Bài 2: Setup (10:15) 🔒   │                        │  │
│  │    📝 Bài 3: Overview (5 min) 🔒 │                        │  │
│  │  ▼ Section 2: Components (5 bài) │                        │  │
│  │    ...                            │                        │  │
│  │                                   │                        │  │
│  │  ─── TAB: ĐÁNH GIÁ ───          │                        │  │
│  │                                   │                        │  │
│  │  ⭐ 4.7 trung bình               │                        │  │
│  │  ████████████░ 5★ (156)          │                        │  │
│  │  ████████░░░░ 4★ (52)            │                        │  │
│  │  ███░░░░░░░░ 3★ (18)            │                        │  │
│  │  █░░░░░░░░░░ 2★ (5)             │                        │  │
│  │  ░░░░░░░░░░░ 1★ (3)             │                        │  │
│  │                                   │                        │  │
│  │  [★★★★★ Viết đánh giá]           │                        │  │
│  │                                   │                        │  │
│  │  ┌─── Review Card ────┐          │                        │  │
│  │  │ 👤 Trần Thị B      │          │                        │  │
│  │  │ ★★★★★ · 2 ngày trước│         │                        │  │
│  │  │ "Khóa học rất hay..."│         │                        │  │
│  │  │ 👍 Hữu ích (12)    │          │                        │  │
│  │  └────────────────────┘          │                        │  │
│  │                                   │                        │  │
│  │  ─── KHÓA HỌC LIÊN QUAN ───     │                        │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐     │                        │  │
│  │  │Card  │ │Card  │ │Card  │     │                        │  │
│  │  └──────┘ └──────┘ └──────┘     │                        │  │
│  └───────────────────────────────────┴────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

Mobile:
  - Purchase card → Sticky bottom bar (Price + "Thêm vào giỏ" button)
  - Tabs → Scrollable tab bar
  - Curriculum → Accordion (collapsed by default)
```

#### Conditional UI States

```
Guest:
  - Hiện CTA: "Đăng nhập để mua" hoặc "Thêm vào giỏ hàng"
  - Curriculum: hiển thị lesson titles, lock icon cho paid lessons

Student (chưa mua):
  - Hiện CTA: "Thêm vào giỏ hàng" + "Mua ngay"
  - Wishlist button
  - Chapter pricing visible

Student (đã mua cả khóa):
  - CTA thay bằng: "Tiếp tục học" (link to last lesson)
  - Progress bar hiện
  - Đánh giá form (nếu ≥30% progress)
  - AI Tutor button

Student (mua lẻ chapters):
  - Chapters đã mua: "Đã mua ✓"
  - Chapters chưa mua: "Mua chương này"
  - CTA: "Nâng cấp lên cả khóa — Tiết kiệm X₫"
  - Progress chỉ tính chapters đã mua

Instructor (chủ khóa):
  - CTA: "Chỉnh sửa khóa học" (link to management portal)
  - Không hiện purchase options
```

---

### PAGE: Course Player (`/courses/[courseId]/lessons/[lessonId]`)

```
Route:     /courses/[courseId]/lessons/[lessonId]
Auth:      Required (must be enrolled or lesson is free)
Rendering: Hybrid — Server (curriculum data) + Client (video player, progress)
Layout:    Learning layout (minimal header, no footer)
API:       GET /api/courses/:id/player + GET /api/learning/progress/:courseId
WebSocket: Connected for real-time features (AI Tutor)
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Quay lại khóa học  |  Tên khóa học  |  ████░░ 65%  |  ⚙️   │
├─────────────────────────────────────────────────────────────────┤
│                                          │                      │
│  ┌────────────────────────────────────┐  │  SIDEBAR (30%)       │
│  │                                    │  │                      │
│  │                                    │  │  [Nội dung] [Ghi chú]│
│  │          VIDEO PLAYER              │  │  [AI Tutor] [Tài liệu]│
│  │          (Video.js)                │  │                      │
│  │                                    │  │  ▼ Section 1          │
│  │  ▶ ████████░░░░░░ 12:34 / 30:00  │  │    ✅ Bài 1 (5:30)   │
│  │  🔊 ─── │ 1x │ 720p │ ⛶          │  │    ▶ Bài 2 (10:15)  │
│  │                                    │  │      ← đang xem      │
│  └────────────────────────────────────┘  │    🔒 Bài 3 (8:00)   │
│                                          │  ▼ Section 2          │
│  ┌────────────────────────────────────┐  │    ☐ Bài 4 (12:00)  │
│  │  [ Bài trước ]  ✅ Hoàn thành      │  │    ☐ Bài 5 (15:00)  │
│  │                  [ Bài tiếp theo ] │  │  ▼ Section 3          │
│  └────────────────────────────────────┘  │    ☐ Quiz: Test 1    │
│                                          │    ...               │
│  Hoặc nếu lesson type = TEXT:            │                      │
│  ┌────────────────────────────────────┐  │                      │
│  │                                    │  │                      │
│  │  Rich Text Content                 │  │                      │
│  │  (rendered from Tiptap JSON)       │  │                      │
│  │  Scroll tracking → progress        │  │                      │
│  │                                    │  │                      │
│  └────────────────────────────────────┘  │                      │
│                                          │                      │
│  Hoặc nếu lesson type = QUIZ:            │                      │
│  ┌────────────────────────────────────┐  │                      │
│  │  Quiz Player                       │  │                      │
│  │  Câu 1/10: ....?                   │  │                      │
│  │  ○ Option A                        │  │                      │
│  │  ● Option B ← selected            │  │                      │
│  │  ○ Option C                        │  │                      │
│  │  ○ Option D                        │  │                      │
│  │                                    │  │                      │
│  │  [ ← Trước ]         [ Tiếp → ]   │  │                      │
│  │              [ Nộp bài ]           │  │                      │
│  └────────────────────────────────────┘  │                      │
│                                          │                      │
└─────────────────────────────────────────────────────────────────┘

Mobile:
  - Video full-width (top)
  - Tabs below: [Nội dung] [Ghi chú] [AI Tutor] [Tài liệu]
  - Sidebar trở thành tab content
```

#### Video Player Features

```
- Video.js player (hoặc Plyr)
- Cloudinary streaming (adaptive quality)
- Controls: play/pause, seek, volume, speed (0.5x-2x), quality (480p/720p), fullscreen
- Progress tracking:
  - Report watchedSegments every 10 seconds → POST /api/learning/progress
  - Segments: [[0, 120], [150, 300]] (watched ranges in seconds)
  - Backend merges segments → calculates actual % watched
  - Lesson marked complete when ≥ 80% unique time watched
- Resume: auto-seek to lastPosition on load
- Keyboard: Space (play/pause), ←→ (seek 10s), ↑↓ (volume), F (fullscreen)
```

#### AI Tutor Tab

```
- Chat UI embedded in sidebar tab
- Context: current course → search relevant chunks
- Input: text + send button
- Response: SSE streaming → render markdown
- Usage counter: "3/10 câu hỏi hôm nay"
- Chat history persisted per course
```

---

### PAGE: Learning Dashboard (`/my-learning`)

```
Route:     /my-learning
Auth:      Required (Student)
Rendering: Server Component + Client tabs
API:       GET /api/learning/dashboard
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Học tập của tôi                                                 │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 📚 3     │ │ ✅ 2     │ │ ⏱ 24h    │ │ 🏆 1     │           │
│  │ Đang học │ │ Hoàn thành│ │ Giờ học  │ │ Chứng chỉ│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔥 CHUỖI NGÀY HỌC                                        │  │
│  │  Hiện tại: 7 ngày | Dài nhất: 14 ngày                     │  │
│  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐          │  │
│  │  │░│░│█│█│█│░│░│█│█│█│█│█│█│█│░│░│░│░│░│░│░│          │  │
│  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘          │  │
│  │   ← GitHub-style contribution calendar →                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Đang học] [Đã hoàn thành] [Tất cả]     ← Tab filters          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  Lập trình React                                │  │
│  │  │Thumb │  Nguyễn Văn A                                    │  │
│  │  │      │  ████████░░ 75%        [ Tiếp tục học ]          │  │
│  │  └──────┘  Bài tiếp: "Hooks nâng cao" (video, 12:30)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  Node.js Backend                                 │  │
│  │  │Thumb │  Trần Văn B                                      │  │
│  │  │      │  ███░░░░░░░ 30%        [ Tiếp tục học ]          │  │
│  │  └──────┘  Bài tiếp: "Express Middleware" (text, 8 min)    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🏷 BẢN ĐỒ KỸ NĂNG                                       │  │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────┐             │  │
│  │  │React   │ │JavaScript│ │Node.js │ │CSS   │             │  │
│  │  │████░ 4│ │██████ 6 │ │██░ 2  │ │███░ 3│             │  │
│  │  └────────┘ └──────────┘ └────────┘ └──────┘             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### PAGE: News Feed (`/social`)

```
Route:     /social
Auth:      Required (Student)
Rendering: Client Component (real-time interactions, infinite scroll)
API:       GET /api/social/feed?cursor=xxx (cursor-based pagination)
WebSocket: Connected for real-time updates (new posts from followed users)
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┬───────────────────────────┬──────────────────┐ │
│  │              │                           │                  │ │
│  │  LEFT SIDEBAR│  MAIN FEED                │  RIGHT SIDEBAR   │ │
│  │  (hidden on  │                           │  (hidden < xl)   │ │
│  │   mobile)    │  ┌─────────────────────┐  │                  │ │
│  │              │  │ 👤 Bạn đang nghĩ gì?│  │  🔥 Trending     │ │
│  │  Quick Links │  │ [ Viết bài... ]     │  │  #react          │ │
│  │  🏠 Bảng tin │  │ 📷 🖥 | [Đăng bài] │  │  #nodejs         │ │
│  │  👥 Nhóm    │  └─────────────────────┘  │  #typescript     │ │
│  │  🔖 Đã lưu  │                           │                  │ │
│  │  ❓ Hỏi đáp │  ┌─────────────────────┐  │  👥 Gợi ý follow │ │
│  │              │  │ 👤 Nguyễn Văn A      │  │  ┌─────────────┐│ │
│  │  Nhóm của bạn│  │ 2 giờ trước          │  │  │👤 User 1    ││ │
│  │  📚 React VN │  │                      │  │  │ [Follow]    ││ │
│  │  📚 Node.js │  │ "Vừa học xong React │  │  ├─────────────┤│ │
│  │              │  │  Hooks, chia sẻ..."  │  │  │👤 User 2    ││ │
│  │              │  │                      │  │  │ [Follow]    ││ │
│  │              │  │ 👍 12 | 💬 5 | 🔖   │  │  └─────────────┘│ │
│  │              │  └─────────────────────┘  │                  │ │
│  │              │                           │  📚 Khóa học      │ │
│  │              │  ┌─────────────────────┐  │  gợi ý            │ │
│  │              │  │ 👤 Trần Thị B       │  │  ┌─────────────┐│ │
│  │              │  │ 5 giờ trước          │  │  │📚 Next.js   ││ │
│  │              │  │                      │  │  │   499,000₫  ││ │
│  │              │  │ "Code snippet..."    │  │  └─────────────┘│ │
│  │              │  │ ┌─── code block ───┐ │  │                  │ │
│  │              │  │ │ const x = ...    │ │  │                  │ │
│  │              │  │ └──────────────────┘ │  │                  │ │
│  │              │  │                      │  │                  │ │
│  │              │  │ 👍 8 | 💬 3 | 🔖    │  │                  │ │
│  │              │  └─────────────────────┘  │                  │ │
│  │              │                           │                  │ │
│  │              │  ⏳ Loading more...        │                  │ │
│  │              │  (Infinite scroll)         │                  │ │
│  │              │                           │                  │ │
│  └──────────────┴───────────────────────────┴──────────────────┘ │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

Mobile:
  - Full-width feed only
  - Post composer: floating action button (FAB) → opens modal
  - Sidebars: accessible via navigation tabs (Feed | Groups | Saved | Q&A)
```

#### Post Composer (Modal on mobile, inline on desktop)

```
┌─────────────────────────────────────────┐
│  Tạo bài viết                     ✕     │
├─────────────────────────────────────────┤
│  👤 Nguyễn Văn A                        │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Chia sẻ kiến thức, câu hỏi...     ││
│  │                                     ││
│  │                                     ││
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  📷 Ảnh   🖥 Code   📎 File             │
│                                         │
│  [           Đăng bài          ]        │
└─────────────────────────────────────────┘
```

---

### PAGE: Chat (`/chat`)

```
Route:     /chat
Auth:      Required
Rendering: Client Component (full real-time via WebSocket)
WebSocket: /chat namespace — join_conversation, send_message, typing, mark_read
```

#### Layout

````
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┬──────────────────────────────────────┐  │
│  │                    │                                      │  │
│  │  CONVERSATIONS     │  MESSAGES                            │  │
│  │                    │                                      │  │
│  │  🔍 [Tìm kiếm...] │  ┌────────────────────────────────┐  │  │
│  │                    │  │ 👤 Nguyễn Văn A     🟢 Online  │  │  │
│  │  ┌──────────────┐  │  └────────────────────────────────┘  │  │
│  │  │ 👤 🟢        │  │                                      │  │
│  │  │ Nguyễn Văn A │  │  ┌─────────────────────┐            │  │
│  │  │ "Bạn gửi..." │  │  │ Tin nhắn từ Văn A  │            │  │
│  │  │ 2 phút trước │  │  └─────────────────────┘            │  │
│  │  └──────────────┘  │                                      │  │
│  │  ┌──────────────┐  │         ┌─────────────────────┐      │  │
│  │  │ 👤           │  │         │ Tin nhắn từ bạn     │      │  │
│  │  │ Trần Thị B   │  │         └─────────────────────┘      │  │
│  │  │ "Cảm ơn!" ✓✓│  │                                      │  │
│  │  │ Hôm qua      │  │  ┌─────────────────────┐            │  │
│  │  └──────────────┘  │  │ Code snippet...      │            │  │
│  │  ┌──────────────┐  │  │ ```javascript        │            │  │
│  │  │ 👤           │  │  │ const x = 1          │            │  │
│  │  │ Lê Văn C     │  │  │ ```                  │            │  │
│  │  │ "File.pdf"   │  │  └─────────────────────┘            │  │
│  │  │ 3 ngày trước │  │                                      │  │
│  │  └──────────────┘  │  Nguyễn Văn A đang nhập...          │  │
│  │                    │                                      │  │
│  │                    │  ┌────────────────────────────────┐  │  │
│  │                    │  │ 📷 📎 🖥 [Nhập tin nhắn...]  ➤│  │  │
│  │                    │  └────────────────────────────────┘  │  │
│  └────────────────────┴──────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Mobile:
  - Conversations list full-width
  - Tap conversation → navigates to message view (full-screen)
  - Back button to return to conversations list
````

#### Real-time Features

```
WebSocket Events:
  - send_message → broadcast to conversation room
  - typing / stop_typing → show typing indicator
  - mark_read → update read receipts (✓✓ blue)
  - user_online / user_offline → update online status dot

Optimistic Updates:
  - Sent message appears immediately (pending state)
  - Confirmed when server echoes back
  - Failed: show retry button

Message Types:
  - Text (plain + markdown rendering)
  - Image (thumbnail + lightbox on click)
  - Code snippet (syntax highlighted)
  - File (download link)
```

---

### PAGE: Q&A Forum (`/qna`)

```
Route:     /qna
Auth:      Required for posting, Public for viewing
Rendering: Server Component (listing) + Client (voting, answers)
API:       GET /api/qna/questions?sort=recent&page=1
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Hỏi đáp                              [ + Đặt câu hỏi ]        │
│                                                                  │
│  🔍 [Tìm kiếm câu hỏi...]                                      │
│                                                                  │
│  [Mới nhất] [Phổ biến] [Chưa trả lời] [Khóa của tôi]           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ▲ 12 ▼  Làm sao để fix lỗi useEffect chạy 2 lần?       │  │
│  │          [React] [Hooks] · 3 câu trả lời · 45 lượt xem   │  │
│  │          👤 Nguyễn Văn A · 2 giờ trước  [✅ Đã giải quyết]│  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  ▲  5 ▼  Cách tối ưu performance Next.js SSR?            │  │
│  │          [Next.js] [Performance] · 1 câu trả lời          │  │
│  │          👤 Trần Thị B · 5 giờ trước                      │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  ▲  0 ▼  TypeScript generic constraints là gì?            │  │
│  │          [TypeScript] · Chưa có trả lời                    │  │
│  │          👤 Lê Văn C · 1 ngày trước                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ← 1  2  3  ... →                                                │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### PAGE: AI Tutor (`/ai-tutor`)

```
Route:     /ai-tutor
Auth:      Required
Rendering: Client Component (SSE streaming)
API:       POST /api/ai/ask (SSE), GET /api/ai/sessions
```

#### Layout

````
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┬──────────────────────────────────────┐  │
│  │                    │                                      │  │
│  │  SESSIONS          │  CHAT                                │  │
│  │                    │                                      │  │
│  │  [+ Hội thoại mới] │  ┌────────────────────────────────┐  │  │
│  │                    │  │ 🤖 Khóa: Lập trình React       │  │  │
│  │  ┌──────────────┐  │  │    Chọn khóa: [▾ React ...]   │  │  │
│  │  │ React Hooks  │  │  └────────────────────────────────┘  │  │
│  │  │ 3 tin nhắn   │  │                                      │  │
│  │  │ 2 giờ trước  │  │  ┌─────────────────────────────┐    │  │
│  │  └──────────────┘  │  │ 🤖 Xin chào! Tôi là AI     │    │  │
│  │  ┌──────────────┐  │  │ Tutor. Hãy hỏi tôi về nội  │    │  │
│  │  │ Node.js Perf │  │  │ dung khóa React.            │    │  │
│  │  │ 5 tin nhắn   │  │  └─────────────────────────────┘    │  │
│  │  │ Hôm qua      │  │                                      │  │
│  │  └──────────────┘  │  ┌─────────────────────────────┐    │  │
│  │                    │  │ 👤 useEffect cleanup         │    │  │
│  │                    │  │ function hoạt động như       │    │  │
│  │                    │  │ nào?                         │    │  │
│  │                    │  └─────────────────────────────┘    │  │
│  │                    │                                      │  │
│  │                    │  ┌─────────────────────────────┐    │  │
│  │                    │  │ 🤖 useEffect cleanup...     │    │  │
│  │                    │  │ (markdown rendered)          │    │  │
│  │                    │  │                              │    │  │
│  │                    │  │ ```javascript                │    │  │
│  │                    │  │ useEffect(() => {            │    │  │
│  │                    │  │   // setup                   │    │  │
│  │                    │  │   return () => {             │    │  │
│  │                    │  │     // cleanup               │    │  │
│  │                    │  │   }                          │    │  │
│  │                    │  │ }, [deps])                   │    │  │
│  │                    │  │ ```                          │    │  │
│  │                    │  └─────────────────────────────┘    │  │
│  │                    │                                      │  │
│  │  ┌──────────────┐  │  3/10 câu hỏi hôm nay              │  │
│  │  │ ⚠ AI có thể │  │                                      │  │
│  │  │ mắc sai sót │  │  ┌────────────────────────────────┐  │  │
│  │  └──────────────┘  │  │ [Hỏi về nội dung khóa...]  ➤ │  │  │
│  │                    │  └────────────────────────────────┘  │  │
│  └────────────────────┴──────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
````

#### SSE Streaming Response

```typescript
// AI response renders in real-time via SSE
// Each token appended to message content
// Markdown rendered live (code blocks, lists, bold, etc.)
// "AI đang suy nghĩ..." shown during initial latency
// Copy button on code blocks
// Feedback: 👍/👎 on each AI response
```

---

### PAGE: Shopping Cart (`/cart`)

```
Route:     /cart
Auth:      Required (or localStorage cart for guest → merge on login)
Rendering: Client Component (cart mutations)
API:       GET /api/cart + PUT /api/cart + DELETE /api/cart/items/:id
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Giỏ hàng (3 khóa học)                                          │
│                                                                  │
│  ┌─────────────────────────────────────┬──────────────────────┐  │
│  │                                     │                      │  │
│  │  ┌──────────────────────────────┐   │  TÓM TẮT ĐƠN HÀNG  │  │
│  │  │ ┌──────┐ Lập trình React    │   │                      │  │
│  │  │ │Thumb │ Nguyễn Văn A       │   │  Tạm tính: 1,297,000₫│  │
│  │  │ │      │ ⭐ 4.7 | Trung cấp│   │  Giảm giá:  -200,000₫│  │
│  │  │ └──────┘ 499,000₫          │   │  ──────────────────   │  │
│  │  │ [♡ Yêu thích] [🗑 Xóa]    │   │  Tổng:    1,097,000₫ │  │
│  │  └──────────────────────────────┘   │                      │  │
│  │  ┌──────────────────────────────┐   │  ┌────────────────┐  │  │
│  │  │ ┌──────┐ Node.js Backend    │   │  │ Mã giảm giá    │  │  │
│  │  │ │Thumb │ Trần Văn B         │   │  │ [SAVE20  ][Áp] │  │  │
│  │  │ │      │ ⭐ 4.5 | Nâng cao │   │  │ ✅ Đã áp dụng  │  │  │
│  │  │ └──────┘ 599,000₫          │   │  │    "SAVE20"     │  │  │
│  │  │ [♡ Yêu thích] [🗑 Xóa]    │   │  └────────────────┘  │  │
│  │  └──────────────────────────────┘   │                      │  │
│  │  ┌──────────────────────────────┐   │                      │  │
│  │  │ ┌──────┐ CSS Masterclass    │   │  [  Thanh toán   ]   │  │
│  │  │ │Thumb │ Lê Thị C           │   │                      │  │
│  │  │ │      │ ⭐ 4.9 | Cơ bản   │   │                      │  │
│  │  │ └──────┘ 199,000₫          │   │                      │  │
│  │  │ [♡ Yêu thích] [🗑 Xóa]    │   │                      │  │
│  │  └──────────────────────────────┘   │                      │  │
│  │                                     │                      │  │
│  └─────────────────────────────────────┴──────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### PAGE: Payment Waiting (`/payment/[orderId]`)

```
Route:     /payment/[orderId]
Auth:      Required (order owner)
Rendering: Client Component (polling for payment confirmation)
API:       GET /api/orders/:id (polling every 3s for status change)
WebSocket: Listening for ORDER_COMPLETED notification
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │            Thanh toán đơn hàng #SSML000123                 │  │
│  │                                                            │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐   │  │
│  │  │                      │  │                          │   │  │
│  │  │    ╔══════════════╗  │  │  Tổng tiền: 1,097,000₫  │   │  │
│  │  │    ║              ║  │  │                          │   │  │
│  │  │    ║   QR CODE    ║  │  │  Nội dung CK:            │   │  │
│  │  │    ║   (VietQR)   ║  │  │  SSML000123              │   │  │
│  │  │    ║              ║  │  │                          │   │  │
│  │  │    ╚══════════════╝  │  │  Ngân hàng: MB Bank      │   │  │
│  │  │                      │  │  STK: 0123456789         │   │  │
│  │  │  Quét mã QR để       │  │  CTK: SMART LEARNING     │   │  │
│  │  │  thanh toán           │  │                          │   │  │
│  │  └──────────────────────┘  │  ⚠ Nhập đúng nội dung CK│   │  │
│  │                            │  để xác nhận tự động      │   │  │
│  │                            └──────────────────────────┘   │  │
│  │                                                            │  │
│  │  ⏰ Đơn hàng hết hạn sau: 12:34                           │  │
│  │  ⏳ Đang chờ thanh toán...  (spinner)                      │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  Chi tiết đơn hàng:                                │   │  │
│  │  │  1. Lập trình React         499,000₫               │   │  │
│  │  │  2. Node.js Backend         599,000₫               │   │  │
│  │  │  3. CSS Masterclass         199,000₫               │   │  │
│  │  │  Mã giảm giá (SAVE20):     -200,000₫              │   │  │
│  │  │  ────────────────────────────────────              │   │  │
│  │  │  Tổng cộng:               1,097,000₫              │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

States:
  PENDING  → QR code + countdown + polling spinner
  COMPLETED → ✅ "Thanh toán thành công!" + confetti animation + "Bắt đầu học"
  EXPIRED  → ❌ "Đơn hàng hết hạn" + "Tạo đơn mới" button
```

---

### PAGE: Public Profile (`/profile/[userId]`)

```
Route:     /profile/[userId]
Auth:      Public
Rendering: Server Component
API:       GET /api/users/:id/profile
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ┌──────┐                                                  │  │
│  │  │      │  Nguyễn Văn A                                    │  │
│  │  │Avatar│  "Full-stack developer, yêu React & Node.js"    │  │
│  │  │ 80px │                                                  │  │
│  │  └──────┘  📍 Hà Nội | 🎓 Tham gia 01/2025              │  │
│  │            📊 12 followers | 8 following                   │  │
│  │                                                            │  │
│  │  [ Follow ]  [ Nhắn tin ]                                  │  │
│  │                                                            │  │
│  │  🔗 github.com/user  |  linkedin.com/in/user              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Bài viết] [Khóa học đã học] [Kỹ năng] [Chứng chỉ]           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Tab content (posts list / course list / skills / certs)   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### PAGE: Settings (`/settings`)

```
Route:     /settings
Auth:      Required
Rendering: Client Component (form mutations)
API:       GET /api/users/me + PUT /api/users/me + PUT /api/users/me/preferences
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cài đặt                                                        │
│                                                                  │
│  ┌──────────────┬─────────────────────────────────────────────┐  │
│  │              │                                             │  │
│  │  Tabs (vert) │  TAB: HỒ SƠ CÁ NHÂN                       │  │
│  │              │                                             │  │
│  │  👤 Hồ sơ   │  Ảnh đại diện:                              │  │
│  │  🔐 Tài khoản│  ┌──────┐ [ Đổi ảnh ]                      │  │
│  │  🔔 Thông báo│  │Avatar│                                   │  │
│  │  🎨 Giao diện│  └──────┘                                   │  │
│  │              │                                             │  │
│  │              │  Họ và tên: [_______________]               │  │
│  │              │  Giới thiệu: [_______________]              │  │
│  │              │  [                           ]              │  │
│  │              │  Số điện thoại: [___________]               │  │
│  │              │                                             │  │
│  │              │  Liên kết:                                  │  │
│  │              │  GitHub: [_______________]                  │  │
│  │              │  LinkedIn: [_______________]                │  │
│  │              │                                             │  │
│  │              │  [ Lưu thay đổi ]                           │  │
│  │              │                                             │  │
│  │              │  ─── TAB: GIAO DIỆN ───                    │  │
│  │              │                                             │  │
│  │              │  Chủ đề:                                    │  │
│  │              │  ○ Sáng  ○ Tối  ● Hệ thống                │  │
│  │              │                                             │  │
│  │              │  Ngôn ngữ:                                  │  │
│  │              │  ● Tiếng Việt  ○ English                   │  │
│  │              │                                             │  │
│  └──────────────┴─────────────────────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

Mobile: Vertical tabs → Horizontal tab bar on top
```

---

### PAGE: Become Instructor (`/become-instructor`)

```
Route:     /become-instructor
Auth:      Required (Student role only)
Rendering: Client Component (form)
API:       POST /api/instructor/apply
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    🎓                                      │  │
│  │            Trở thành giảng viên                            │  │
│  │  "Chia sẻ kiến thức và tạo thu nhập từ khóa học"         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────┬─────────────────────────────┐  │
│  │                              │                             │  │
│  │  LỢI ÍCH                    │  FORM ĐĂNG KÝ               │  │
│  │                              │                             │  │
│  │  💰 Tạo thu nhập            │  Lĩnh vực chuyên môn:       │  │
│  │  👥 Tiếp cận học viên       │  [___________________]      │  │
│  │  🏫 Xây dựng cộng đồng     │                             │  │
│  │  🛠 Công cụ chuyên nghiệp  │  Kinh nghiệm giảng dạy:     │  │
│  │                              │  [___________________]      │  │
│  │                              │  [                   ]      │  │
│  │                              │                             │  │
│  │                              │  Lý do muốn giảng dạy:     │  │
│  │                              │  [___________________]      │  │
│  │                              │  [                   ]      │  │
│  │                              │                             │  │
│  │                              │  Link bài giảng mẫu:       │  │
│  │                              │  [___________________]      │  │
│  │                              │                             │  │
│  │                              │  [   Nộp đơn đăng ký   ]  │  │
│  └──────────────────────────────┴─────────────────────────────┘  │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

States:
  - Student: show form
  - Already applied (PENDING): "Đơn đang được xem xét" message
  - Instructor already: redirect to management portal
```

---

### PAGE: Notifications (`/notifications`)

```
Route:     /notifications
Auth:      Required
Rendering: Client Component (mark read mutations, real-time updates)
API:       GET /api/notifications?page=1 + PUT /api/notifications/read-all
WebSocket: /notifications namespace → pushNotification
```

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Thông báo (3 chưa đọc)          [ Đánh dấu tất cả đã đọc ]   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔵 📚 Nguyễn Văn A đã đăng ký khóa "React..."          │  │
│  │       2 phút trước                                        │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  🔵 💬 Trần Thị B đã bình luận bài viết của bạn          │  │
│  │       15 phút trước                                       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  🔵 ✅ Đơn hàng #SSML000123 đã được xác nhận             │  │
│  │       1 giờ trước                                         │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  ○ 👍 Lê Văn C đã thích bài viết của bạn                 │  │
│  │       Hôm qua                                              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  ○ 🏆 Bạn đã nhận chứng chỉ hoàn thành "Node.js..."     │  │
│  │       2 ngày trước                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ Xem thêm ]                                                    │
│                                                                  │
│  Footer                                                          │
└─────────────────────────────────────────────────────────────────┘

Features:
  - Unread: blue dot indicator + bold text
  - Click notification → mark as read + navigate to target
  - Real-time: new notification prepended to list
  - Navbar badge: unread count (max "99+")
  - Bell icon dropdown (navbar): last 5 notifications + "Xem tất cả" link
```

---

### PAGE: Orders History (`/orders`)

```
Route:     /orders
Auth:      Required
Rendering: Server Component
API:       GET /api/orders?page=1
```

---

### PAGE: Wishlist (`/wishlist`)

```
Route:     /wishlist
Auth:      Required
Rendering: Server Component
API:       GET /api/wishlists
```

---

### PAGE: Certificates (`/my-learning/certificates`)

```
Route:     /my-learning/certificates
Auth:      Required
Rendering: Server Component
API:       GET /api/learning/certificates
```

---

## 3.3 Shared Components — Student Portal

### Navbar (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│  🎓 Logo   │  🔍 [Tìm kiếm...]  │  Khóa học  │  Cộng đồng    │
│             │                     │            │               │
│             │                     │  Học tập ▾ │  🛒 (2)  🔔 (3)│
│             │                     │            │  🌙  🌐  👤 ▾ │
└─────────────────────────────────────────────────────────────────┘

Avatar Dropdown:
  👤 Nguyễn Văn A
  student@email.com
  ────────────────
  📚 Khóa học của tôi
  📦 Đơn hàng
  ♡ Yêu thích
  🏆 Chứng chỉ
  ────────────────
  👨‍🏫 Trở thành giảng viên (hoặc "Cổng quản lý" nếu Instructor)
  ────────────────
  ⚙ Cài đặt
  🚪 Đăng xuất

Learning Dropdown:
  📚 Khóa học của tôi
  📊 Tiến trình học tập
  🏆 Chứng chỉ
```

### Navbar (Mobile — Bottom Navigation)

```
┌─────────────────────────────────────────┐
│  🏠      📚      🔍      💬      👤    │
│  Home   Courses  Search  Chat   Profile │
└─────────────────────────────────────────┘

Top bar (mobile): ☰ Logo                🔔 🛒
  ☰ opens side drawer with full navigation
```

### Footer

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  🎓 Smart Social Learning                                       │
│  Nền tảng học trực tuyến kết hợp                                │
│  mạng xã hội và AI                                              │
│                                                                  │
│  Khám phá        Hỗ trợ           Pháp lý                       │
│  Khóa học        Trung tâm hỗ trợ  Điều khoản                  │
│  Giảng viên      Liên hệ          Bảo mật                      │
│  Danh mục        FAQ              Cookie                        │
│                                                                  │
│  ─────────────────────────────────────────────                   │
│  © 2026 Smart Social Learning. All rights reserved.             │
│  🌙/☀️  🌐 VI/EN                                                │
└─────────────────────────────────────────────────────────────────┘
```
