# SSLM Codebase Reading Plan

> Lộ trình đọc hiểu toàn bộ dự án Smart Social Learning Marketplace từ nền tảng đến nghiệp vụ phức tạp.
> Thời gian ước tính: **20–30 giờ** đọc chủ động (có ghi chú, trace code).

---

## Mục tiêu

Sau khi hoàn thành plan này, bạn sẽ:
- Hiểu từng dòng code và **tại sao** nó được viết như vậy
- Nắm được toàn bộ data flow: DB → Service → Controller → API Client → UI Component
- Biết cách các module phụ thuộc lẫn nhau
- Có thể debug, mở rộng hoặc refactor bất kỳ phần nào trong dự án

---

## Cách đọc hiệu quả

| Kỹ thuật | Mô tả |
|----------|-------|
| **F12 Go to Definition** | Khi gặp type/function lạ, nhảy vào xem định nghĩa thay vì đoán |
| **Ctrl+Shift+F** | Search toàn project khi cần tìm nơi một function được gọi |
| **Đọc spec trước service** | File `*.spec.ts` giải thích edge cases rõ hơn comment |
| **Mở schema.prisma song song** | Khi đọc service, luôn mở schema để hiểu cấu trúc dữ liệu |
| **Ghi chú flow diagram** | Vẽ sơ đồ luồng cho mỗi feature phức tạp khi đọc xong |

---

## GIAI ĐOẠN 0 — Bức tranh tổng thể (2–3h)

> **Mục tiêu:** Hiểu dự án làm gì, cấu trúc ra sao, và các quy tắc code trước khi đọc bất kỳ dòng logic nào.

### 0.1 — Monorepo & Config gốc

| File | Đọc để hiểu gì |
|------|---------------|
| [`CLAUDE.md`](../CLAUDE.md) | Rules bắt buộc: naming conventions, patterns, anti-patterns |
| [`package.json`](../package.json) | Workspaces structure, scripts (dev/build/test) |
| [`turbo.json`](../turbo.json) | Task pipeline: thứ tự build, cache strategy |
| [`docker-compose.yml`](../docker-compose.yml) | PostgreSQL + Redis local setup |
| [`.husky/`](../.husky/) | Git hooks: pre-commit runs lint-staged, commit-msg runs commitlint |
| [`commitlint.config.js`](../commitlint.config.js) | Commit convention enforcement |

**Điểm chú ý:** Turborepo chạy tasks theo dependency graph — `build` của `api` phụ thuộc `build` của `shared-*` packages. Hiểu điều này giải thích tại sao thứ tự build quan trọng.

### 0.2 — Thiết kế Database (QUAN TRỌNG NHẤT)

Đây là nền tảng của toàn bộ dự án. **Đọc kỹ trước khi đọc bất kỳ dòng backend nào.**

| File | Đọc để hiểu gì |
|------|---------------|
| [`docs/phase2-database/01-database-design.md`](phase2-database/01-database-design.md) | 61 entities, ERD diagram, relationships |
| [`apps/api/src/prisma/schema.prisma`](../apps/api/src/prisma/schema.prisma) | Schema thực tế: models, enums, indexes |
| [`apps/api/src/prisma/migrations/`](../apps/api/src/prisma/migrations/) | Lịch sử thay đổi schema (đọc tên file hiểu evolution) |

**Các model cốt lõi cần nắm:**
- `User`, `InstructorProfile` — Authentication & roles
- `Course`, `Section`, `Chapter`, `Lesson` — Content hierarchy
- `Enrollment`, `LessonProgress`, `CourseCompletion` — Learning tracking
- `Order`, `OrderItem`, `Cart` — Ecommerce
- `Post`, `Comment`, `Group` — Social features
- `Notification`, `Message`, `Conversation` — Communication
- `QuizAttempt`, `PlacementTest` — Assessment

**Pattern đặc biệt cần chú ý trong schema:**
- Soft delete: `deletedAt DateTime?` trên User, Course, Post
- CUID làm ID: `@id @default(cuid())`
- `@@map("snake_case")` — field camelCase nhưng DB column snake_case
- `pgvector` extension: field `embedding Unsupported("vector(1536)")?` trên CourseEmbedding

### 0.3 — API Endpoints & Backend Architecture

| File | Đọc để hiểu gì |
|------|---------------|
| [`docs/phase3-backend/01-backend-architecture.md`](phase3-backend/01-backend-architecture.md) | Module structure, guards, interceptors |
| [`docs/phase3-backend/02-api-endpoints.md`](phase3-backend/02-api-endpoints.md) | ~90 endpoints, request/response shapes |
| [`docs/phase3-backend/03-realtime-and-services.md`](phase3-backend/03-realtime-and-services.md) | WebSocket events, cron jobs, external services |

---

## GIAI ĐOẠN 1 — Backend Foundation Layer (3–4h)

> **Mục tiêu:** Hiểu "xương sống" của NestJS app — những thứ chạy xuyên suốt mọi request.

### 1.1 — Application Bootstrap

**Thứ tự đọc:**

```
apps/api/src/main.ts
└── app.module.ts
    ├── config/ (tất cả modules config)
    ├── prisma/ (database connection)
    ├── redis/ (cache layer)
    ├── mail/ (email service)
    └── uploads/ (file handling)
```

**`main.ts`** — Chú ý:
- `ValidationPipe` global với `whitelist: true, forbidNonWhitelisted: true` — tự động strip unknown fields
- `useGlobalFilters` — HttpExceptionFilter + PrismaExceptionFilter
- `useGlobalInterceptors` — TransformInterceptor (wrap response thành `{ data: T }`)
- CORS configuration với credentials support
- Helmet, compression middleware

**`app.module.ts`** — Chú ý cách modules được import và thứ tự ưu tiên.

### 1.2 — Configuration Layer

| File | Giải thích |
|------|-----------|
| [`config/config.module.ts`](../apps/api/src/config/config.module.ts) | `ConfigModule.forRoot()` — load .env, validate với Joi |
| [`config/app.config.ts`](../apps/api/src/config/app.config.ts) | PORT, NODE_ENV, frontend URLs |
| [`config/auth.config.ts`](../apps/api/src/config/auth.config.ts) | JWT secrets, expiry times |
| [`config/database.config.ts`](../apps/api/src/config/database.config.ts) | DATABASE_URL, connection pool |
| [`config/redis.config.ts`](../apps/api/src/config/redis.config.ts) | Upstash Redis URL + token |
| [`config/cloudinary.config.ts`](../apps/api/src/config/cloudinary.config.ts) | Cloud name, API key/secret |
| [`config/groq.config.ts`](../apps/api/src/config/groq.config.ts) | Groq AI API key, model name |
| [`config/mail.config.ts`](../apps/api/src/config/mail.config.ts) | SMTP settings |
| [`config/sepay.config.ts`](../apps/api/src/config/sepay.config.ts) | Payment webhook secret |

**Tại sao cần đọc:** Hiểu các env vars nào tồn tại và được validate giúp tránh runtime errors.

### 1.3 — Prisma Service

| File | Giải thích |
|------|-----------|
| [`prisma/prisma.module.ts`](../apps/api/src/prisma/prisma.module.ts) | Global module, export PrismaService |
| [`prisma/prisma.service.ts`](../apps/api/src/prisma/prisma.service.ts) | Extends PrismaClient, `onModuleInit` connect |

**Chú ý:** `PrismaService` là `@Global()` — inject được ở mọi module mà không cần import PrismaModule.

### 1.4 — Common Infrastructure (ĐỌC KỸ — dùng ở mọi nơi)

#### Guards

| File | Giải thích |
|------|-----------|
| [`guards/jwt-auth.guard.ts`](../apps/api/src/common/guards/jwt-auth.guard.ts) | Verify JWT, attach user vào request. Bị override bởi `@Public()` |
| [`guards/roles.guard.ts`](../apps/api/src/common/guards/roles.guard.ts) | Check `user.role` có trong `@Roles(...)` không |
| [`guards/ws-auth.guard.ts`](../apps/api/src/common/guards/ws-auth.guard.ts) | Tương tự jwt-auth nhưng cho WebSocket |

**Flow quan trọng:** `JwtAuthGuard` → extract token từ `Authorization: Bearer <token>` → verify → attach `user: JwtPayload` vào `req.user`.

#### Decorators

| File | Giải thích |
|------|-----------|
| [`decorators/current-user.decorator.ts`](../apps/api/src/common/decorators/current-user.decorator.ts) | `@CurrentUser()` — lấy `req.user` từ request context |
| [`decorators/roles.decorator.ts`](../apps/api/src/common/decorators/roles.decorator.ts) | `@Roles(Role.INSTRUCTOR)` — set metadata cho RolesGuard |
| [`decorators/public.decorator.ts`](../apps/api/src/common/decorators/public.decorator.ts) | `@Public()` — bypass JwtAuthGuard |

#### Filters & Interceptors

| File | Giải thích |
|------|-----------|
| [`filters/http-exception.filter.ts`](../apps/api/src/common/filters/http-exception.filter.ts) | Chuẩn hóa error response: `{ code, message, statusCode, field? }` |
| [`filters/prisma-exception.filter.ts`](../apps/api/src/common/filters/prisma-exception.filter.ts) | Map Prisma errors (P2002 unique violation) → HTTP errors |
| [`interceptors/transform.interceptor.ts`](../apps/api/src/common/interceptors/transform.interceptor.ts) | Wrap success response: `{ data: T, meta?: {...} }` |
| [`interceptors/logging.interceptor.ts`](../apps/api/src/common/interceptors/logging.interceptor.ts) | Log request method, URL, duration |
| [`interceptors/timeout.interceptor.ts`](../apps/api/src/common/interceptors/timeout.interceptor.ts) | Timeout requests sau 30s |

#### DTOs & Interfaces

| File | Giải thích |
|------|-----------|
| [`dto/api-response.dto.ts`](../apps/api/src/common/dto/api-response.dto.ts) | Generic response wrapper types |
| [`dto/pagination.dto.ts`](../apps/api/src/common/dto/pagination.dto.ts) | `page`, `limit` query params với defaults |
| [`interfaces/jwt-payload.interface.ts`](../apps/api/src/common/interfaces/jwt-payload.interface.ts) | Shape của decoded JWT: `{ sub, email, role }` |
| [`interfaces/paginated-result.interface.ts`](../apps/api/src/common/interfaces/paginated-result.interface.ts) | `{ data, meta: { page, limit, total, totalPages } }` |

#### Utils

| File | Giải thích |
|------|-----------|
| [`utils/pagination.util.ts`](../apps/api/src/common/utils/pagination.util.ts) | Tính `skip/take` cho Prisma từ `page/limit` |
| [`utils/slug.util.ts`](../apps/api/src/common/utils/slug.util.ts) | Generate URL-safe slug từ title |
| [`utils/segments.util.ts`](../apps/api/src/common/utils/segments.util.ts) | Merge video segments cho streaming |

---

## GIAI ĐOẠN 2 — Backend Modules (6–8h)

> **Mục tiêu:** Hiểu business logic của từng feature. Đọc theo thứ tự dependency — module sau phụ thuộc module trước.
>
> **Công thức đọc mỗi module:** `module.ts` → `dto/` → `service.ts` → `controller.ts` → `spec.ts`

### 2.1 — Auth Module (CRITICAL — đọc đầu tiên)

**Path:** `apps/api/src/modules/auth/`

| File | Giải thích |
|------|-----------|
| `auth.module.ts` | Import PassportModule, JwtModule với config factory |
| `strategies/jwt.strategy.ts` | Validate JWT payload, fetch user từ DB |
| `strategies/jwt-refresh.strategy.ts` | Validate refresh token từ cookie |
| `strategies/google.strategy.ts` | OAuth2 với Google |
| `dto/login.dto.ts` | `email`, `password` với class-validator |
| `dto/register.dto.ts` | `email`, `password`, `name`, `role` |
| `auth.service.ts` | **Core logic:** hash password, tạo tokens, refresh, Google OAuth |
| `auth.controller.ts` | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/google` |
| `auth.service.spec.ts` | Test cases: login success/fail, register duplicate email, token refresh |

**Flow quan trọng cần trace:**
```
POST /auth/login
  → AuthService.login()
  → validate email/password (bcrypt.compare)
  → tạo accessToken (JWT, 15m) + refreshToken (JWT, 7d)
  → set refreshToken vào httpOnly cookie
  → trả về accessToken trong body
```

**Chú ý đặc biệt:**
- `refresh token rotation` — mỗi lần refresh tạo token mới, invalidate token cũ
- One-Time Token (OTT) cho cross-portal navigation
- Email verification flow: send email → click link → verify token

### 2.2 — Users Module

**Path:** `apps/api/src/modules/users/`

| File | Giải thích |
|------|-----------|
| `dto/` | Update profile, change password, upload avatar |
| `users.service.ts` | CRUD user, profile update, follow/unfollow |
| `users.controller.ts` | GET `/users/me`, PATCH `/users/profile`, POST `/users/:id/follow` |
| `users.service.spec.ts` | Test: update profile, follow logic |

### 2.3 — Categories Module

**Path:** `apps/api/src/modules/categories/`

Module đơn giản, không có nhiều dependency. Chú ý:
- Hierarchical categories (parent/child với `parentId`)
- Admin-only create/update, public read

### 2.4 — Media / Uploads Module

**Path:** `apps/api/src/uploads/` và `apps/api/src/modules/media/`

| File | Giải thích |
|------|-----------|
| `uploads.service.ts` | Upload lên Cloudinary: image (eager transform) + video (streaming) |
| `uploads.controller.ts` | POST `/uploads/image`, POST `/uploads/video` |

**Chú ý:** Video upload dùng Cloudinary's `upload_stream` — không lưu file local. Trả về `publicId`, `url`, `duration`, `thumbnailUrl`.

### 2.5 — Courses Module (PHỨC TẠP NHẤT)

**Path:** `apps/api/src/modules/courses/`

Module lớn nhất, chia thành submodules:

```
courses/
├── courses.module.ts          (orchestrator, import tất cả submodules)
├── browse/                    (public-facing course discovery)
│   ├── courses.service.ts     (filter, search, pagination)
│   └── courses.controller.ts  (GET /courses, GET /courses/:slug)
├── management/                (instructor course management)
│   ├── course-management.service.ts  (CRUD, publish/unpublish)
│   └── course-management.controller.ts
├── chapters/                  (chapter trong course)
├── sections/                  (section trong chapter)
├── lessons/                   (video/text/quiz/file lessons)
├── quizzes/                   (quiz definitions)
└── reviews/                   (student reviews)
```

**Data hierarchy:** `Course` → `Chapter` → `Section` → `Lesson`

**Chú ý trong `course-management.service.ts`:**
- `publishCourse()` — validate prerequisites (has lessons, priced correctly)
- `reorderChapters()` — dùng `position` field, Prisma transaction
- Soft delete với `deletedAt`

**Chú ý trong `browse/courses.service.ts`:**
- Full-text search dùng PostgreSQL `to_tsvector`
- Filter by category, level, price range, rating
- `SELECT ... WHERE deletedAt IS NULL AND status = 'PUBLISHED'`

### 2.6 — Enrollments Module

**Path:** `apps/api/src/modules/enrollments/`

| File | Giải thích |
|------|-----------|
| `enrollments.service.ts` | Check enrollment status, enroll free courses, get enrolled courses |
| `enrollments.controller.ts` | GET `/enrollments`, POST `/enrollments/:courseId/enroll` |

**Relationship:** `Enrollment` (courseId + userId + enrolledAt + completionStatus)

### 2.7 — Orders, Cart, Coupons (Ecommerce)

**Path:** `apps/api/src/modules/orders/`, `cart/`, `coupons/`

**Flow đặc biệt — Order creation:**
```
1. GET /cart        → lấy cart items
2. POST /orders     → tạo order từ cart, tính total (trừ coupon)
3. GET /orders/:id/payment-info → lấy QR code SePay
4. Webhook /orders/sepay-webhook → SePay callback → mark paid
5. POST /enrollments → auto-enroll sau khi thanh toán
```

**Chú ý trong `orders.service.ts`:**
- Prisma transaction cho toàn bộ order creation
- Coupon validation: expiry, usage limit, user eligibility
- `OrderStatus` enum: PENDING → PAID → CANCELLED

### 2.8 — Learning Module

**Path:** `apps/api/src/modules/learning/`

```
learning/
├── learning.module.ts
├── course-player/     (lesson access control)
├── progress/          (track lesson completion)
├── quiz-attempts/     (quiz taking)
├── certificates/      (generate certificate on completion)
├── placement-tests/   (entry-level assessment)
└── streaks/           (daily learning streaks)
```

**Flow quan trọng — Lesson completion:**
```
POST /learning/lessons/:lessonId/complete
  → check enrollment
  → update LessonProgress.completedAt
  → calculate course completion percentage
  → if 100% → generate Certificate
  → update streak
```

**Chú ý trong `quiz-attempts`:**
- `submitQuiz()` — grade tự động, calculate score
- Lưu `answers[]` với `isCorrect` flag mỗi câu
- `PASSING_SCORE` constant

### 2.9 — QnA Module

**Path:** `apps/api/src/modules/qna/`

```
qna/
├── questions/    (CRUD questions, với courseId + lessonId optional)
└── answers/      (CRUD answers, mark accepted answer)
```

**Chú ý:** `Question` có thể liên kết với lesson cụ thể hoặc course-level.

### 2.10 — Social Module

**Path:** `apps/api/src/modules/social/`

```
social/
├── posts/         (CRUD posts, rich text + media)
├── comments/      (threaded comments)
├── interactions/  (like, bookmark)
├── feed/          (personalized feed algorithm)
└── groups/        (learning groups)
```

**Feed algorithm** trong `feed/` — đọc kỹ:
- Follow-based feed (posts từ người follow)
- Course-based feed (posts về khóa học đang học)
- Popularity-based sorting

### 2.11 — Chat Module

**Path:** `apps/api/src/modules/chat/`

Kết hợp REST API (load history) + WebSocket (real-time):
- `ConversationService` — tạo/lấy conversations
- `MessageService` — send/receive messages
- `ChatGateway` — WebSocket events: `join_conversation`, `send_message`, `typing`

### 2.12 — Notifications Module

**Path:** `apps/api/src/modules/notifications/`

- REST: GET `/notifications`, PATCH `/notifications/:id/read`
- WebSocket: emit `notification` event khi có notification mới
- `NotificationService.create()` được gọi từ nhiều modules khác

### 2.13 — AI Tutor Module

**Path:** `apps/api/src/modules/ai-tutor/`

```
ai-tutor/
├── text-extraction/   (extract text từ PDF/DOCX lessons)
└── embeddings/        (tạo vector embeddings cho RAG)
```

**RAG Flow:**
```
1. Instructor upload lesson content
2. text-extraction: extract raw text
3. embeddings: call Groq API → tạo vector (1536 dimensions)
4. Lưu vào CourseEmbedding với pgvector

Student ask question:
1. Embed question → query vector
2. pgvector similarity search → tìm relevant chunks
3. Prompt Groq Llama với context
4. Stream response về client
```

### 2.14 — Admin Module

**Path:** `apps/api/src/modules/admin/`

```
admin/
├── users/          (ban/unban users, role management)
├── courses/        (approve/reject courses)
├── applications/   (instructor applications)
├── content/        (content moderation)
├── moderation/     (report handling)
├── analytics/      (platform statistics)
└── withdrawals/    (process instructor withdrawals)
```

### 2.15 — Jobs Module (Background Processing)

**Path:** `apps/api/src/modules/jobs/`

```
jobs/
├── processors/    (Bull queue processors)
│   ├── email.processor.ts         (async email sending)
│   ├── notification.processor.ts  (async notifications)
│   └── video-processing.processor.ts
└── cron/          (@nestjs/schedule cron jobs)
    ├── streak.cron.ts     (reset streaks nếu miss ngày)
    └── cleanup.cron.ts    (cleanup expired data)
```

**Chú ý:** Email/notification không được gửi synchronously — luôn thông qua Bull queue để tránh block request.

### 2.16 — Recommendations Module

**Path:** `apps/api/src/modules/recommendations/`

```
recommendations/
└── algorithms/    (collaborative filtering + content-based)
```

Dùng enrollment history + course embeddings để recommend courses phù hợp.

---

## GIAI ĐOẠN 3 — Shared Packages (2–3h)

> **Mục tiêu:** Hiểu code được tái sử dụng giữa student-portal và management-portal.

### 3.1 — shared-types

**Path:** `packages/shared-types/src/`

| File | Đọc để hiểu gì |
|------|---------------|
| `index.ts` | Tất cả TypeScript types/interfaces dùng chung |

**Các types quan trọng:** `User`, `Course`, `Lesson`, `Order`, `Notification`, `JwtPayload`

### 3.2 — shared-api-client

**Path:** `packages/shared-api-client/src/`

| File | Giải thích |
|------|-----------|
| `client.ts` | **QUAN TRỌNG:** Axios instance, interceptors, auto-refresh |
| `query-keys.ts` | TanStack Query key factory — hierarchical arrays |
| `index.ts` | Public exports |

**`client.ts` — đọc rất kỹ:**
```typescript
// Request interceptor: attach accessToken từ memory
// Response interceptor: nếu 401 → auto refresh → retry
// Refresh logic: lock để tránh race condition (nhiều requests 401 cùng lúc)
```

### 3.3 — shared-hooks

**Path:** `packages/shared-hooks/src/`

Đây là package lớn nhất và quan trọng nhất về frontend.

#### Services Layer (27 files)

Mỗi service là wrapper của Axios calls. Pattern:

```typescript
// Ví dụ: course.service.ts
export const CourseService = {
  getAll: (params: QueryCoursesDto) => apiClient.get('/courses', { params }),
  getBySlug: (slug: string) => apiClient.get(`/courses/${slug}`),
  create: (dto: CreateCourseDto) => apiClient.post('/courses', dto),
}
```

**Đọc theo thứ tự:**
1. `auth.service.ts` — login, register, refresh
2. `course.service.ts` — browse, CRUD
3. `enrollment.service.ts` — enroll, check status
4. `order.service.ts` — create order, payment
5. `learning.service.ts` — progress, completion
6. Còn lại đọc lướt để biết APIs nào tồn tại

#### Query Hooks (28 files)

Mỗi hook là TanStack Query wrapper. Pattern:

```typescript
// Ví dụ: use-courses.ts
export function useCourses(params: QueryCoursesDto) {
  return useQuery({
    queryKey: queryKeys.courses.list(params),
    queryFn: () => CourseService.getAll(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: CourseService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.courses.all }),
  });
}
```

**Đọc kỹ nhất:**
- `use-auth.ts` — login, register, logout mutations
- `use-courses.ts` — course queries + mutations
- `use-cart.ts` — cart management
- `use-learning.ts` — progress tracking
- `use-chat-socket.ts` và `use-notification-socket.ts` — WebSocket hooks

#### Stores (Zustand)

| File | State được quản lý |
|------|-------------------|
| `stores/auth-store.ts` | `user`, `accessToken`, `login()`, `logout()`, `setUser()` |
| `stores/cart-store.ts` | `items[]`, `coupon`, `addItem()`, `removeItem()`, persist localStorage |
| `stores/sidebar-store.ts` | `isOpen`, sidebar state cho curriculum |
| `stores/ui-store.ts` | `commandPaletteOpen`, `mobileNavOpen`, other UI flags |

**Rule quan trọng:** `accessToken` chỉ ở trong memory (Zustand), KHÔNG persist localStorage.

#### Custom Hooks

| File | Giải thích |
|------|-----------|
| `use-api-error.ts` | Map backend error codes → i18n message keys |
| `use-auth-hydrated.ts` | Chờ Zustand hydrate trước khi render (tránh hydration mismatch) |
| `use-infinite-scroll.ts` | IntersectionObserver + `fetchNextPage()` |
| `use-debounce.ts` | Debounce search input |
| `use-media-query.ts` | Responsive breakpoints trong JS |
| `use-file-proxy.ts` | Proxy file URLs qua backend để bypass CORS |

### 3.4 — shared-ui

**Path:** `packages/shared-ui/src/components/`

shadcn/ui components được customize cho SSLM:
- `button.tsx`, `input.tsx`, `select.tsx` — Form basics
- `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx` — Overlays
- `table.tsx`, `tabs.tsx`, `progress.tsx` — Display
- `skeleton.tsx` — Loading states
- `theme-toggle.tsx` — Dark/Light mode switch
- `file-viewer.tsx` — PDF/DOCX viewer (Google Docs Viewer embed)

---

## GIAI ĐOẠN 4 — Frontend Foundation (2–3h)

> **Mục tiêu:** Hiểu cấu trúc Next.js 16 App Router, i18n setup, auth flow frontend.

### 4.1 — Student Portal Entry Point

**Path:** `apps/student-portal/src/`

| File | Giải thích |
|------|-----------|
| `middleware.ts` | next-intl middleware: detect locale, redirect `/` → `/vi` |
| `app/layout.tsx` | Root layout: HTML lang, font variables |
| `app/[locale]/layout.tsx` | Locale layout: Providers (QueryProvider, AuthProvider, ThemeProvider, IntlProvider) |
| `i18n/routing.ts` | `defineRouting({ locales: ['vi', 'en'], defaultLocale: 'vi' })` |
| `i18n/request.ts` | Server-side i18n config cho `getTranslations()` |

**`messages/vi.json`** — Đọc lướt để thấy structure của 500+ translation keys.

### 4.2 — Providers (đọc kỹ — chạy trước mọi component)

| File | Giải thích |
|------|-----------|
| `providers/query-provider.tsx` | `QueryClientProvider` với config staleTime/gcTime |
| `providers/auth-provider.tsx` | Tương tự `shared-hooks/providers/auth-provider.tsx` — auto-refresh session on mount |

**`auth-provider.tsx` flow:**
```
mount → check accessToken trong Zustand
→ nếu không có → call /auth/refresh (dùng httpOnly cookie)
→ nếu thành công → set accessToken vào Zustand
→ nếu fail → logout
```

### 4.3 — Route Groups & Layouts

Cấu trúc App Router:
```
app/[locale]/
├── (auth)/          layout: no navbar, centered card
│   ├── login/
│   ├── register/
│   └── ...
├── (main)/          layout: navbar + footer
│   ├── page.tsx     (homepage)
│   ├── courses/
│   ├── social/
│   └── (protected)/ layout: auth check redirect
│       ├── my-learning/
│       ├── checkout/
│       └── ...
├── (fullscreen)/    layout: no navbar, fullscreen
│   ├── ai-tutor/
│   └── chat/
└── (learning)/      layout: no navbar, course player UI
    └── courses/[slug]/lessons/[lessonId]/
```

---

## GIAI ĐOẠN 5 — Frontend Features theo User Journey (4–5h)

> **Mục tiêu:** Trace từng feature từ page → component → hook → service → API.

### 5.1 — Auth Flow

**Files:**
- `app/[locale]/(auth)/login/page.tsx`
- `app/[locale]/(auth)/register/page.tsx`
- `components/auth/auth-guard.tsx`

**Trace:**
```
LoginPage
→ LoginForm (React Hook Form + Zod validation)
→ useLogin() mutation (từ shared-hooks)
→ AuthService.login()
→ Axios POST /auth/login
→ save accessToken vào AuthStore
→ redirect /vi/my-learning
```

**`auth-guard.tsx`** — HOC hoặc component wrap protected routes, redirect nếu chưa đăng nhập.

### 5.2 — Course Browse & Detail

**Files:**
- `app/[locale]/(main)/courses/page.tsx`
- `app/[locale]/(main)/courses/[slug]/page.tsx`
- `components/course/course-filters.tsx`
- `components/course/course-card.tsx`
- `components/course/detail/course-hero.tsx`
- `components/course/detail/purchase-card.tsx`

**Server Component pattern:**
```
CoursesPage (Server Component)
→ searchParams từ URL
→ prefetch với React Query server-side
→ truyền initialData xuống Client Components
```

### 5.3 — Ecommerce Flow

**Files:**
- `app/[locale]/(main)/(protected)/checkout/page.tsx`
- `app/[locale]/(main)/(protected)/payment/[orderId]/page.tsx`
- `app/[locale]/(main)/cart/page.tsx`

**Trace:**
```
CourseDetail → click "Mua ngay"
→ useAddToCart() → CartStore.addItem()
→ redirect /checkout
→ CheckoutPage hiện order summary + coupon input
→ useCreateOrder() → POST /orders
→ redirect /payment/:orderId
→ PaymentPage hiện QR code SePay (polling order status)
→ Webhook hits backend → order PAID → redirect /my-learning
```

### 5.4 — Learning Experience

**Files:**
- `app/[locale]/(learning)/courses/[slug]/lessons/[lessonId]/page.tsx`
- `components/learning/curriculum-sidebar.tsx`

**Player tùy loại lesson:**
- `VIDEO` → Video.js player
- `TEXT` → Tiptap read-only renderer
- `QUIZ` → Quiz component với timer
- `FILE` → `shared-ui/file-viewer.tsx` (Google Docs Viewer embed)

**Progress tracking:**
```
Video ends / Text scrolled / Quiz submitted
→ useCompleteLessonMutation()
→ POST /learning/lessons/:id/complete
→ invalidate course progress query
→ sidebar cập nhật checkmark
→ nếu 100% → Certificate modal
```

### 5.5 — Q&A Forum

**Files:**
- `app/[locale]/(main)/qna/page.tsx`
- `app/[locale]/(main)/qna/[questionId]/page.tsx`
- `app/[locale]/(main)/(protected)/qna/ask/page.tsx`

### 5.6 — AI Tutor

**File:** `app/[locale]/(fullscreen)/ai-tutor/page.tsx`

**Components:**
- `components/ai-tutor/chat-panel.tsx` — main chat UI
- `components/ai-tutor/session-sidebar.tsx` — history sessions
- `components/ai-tutor/streaming-indicator.tsx` — loading dots
- `components/ai-tutor/markdown-renderer.tsx` — render AI response

**Stream flow:**
```
User send message
→ POST /ai-tutor/sessions/:id/messages
→ Server-Sent Events hoặc WebSocket stream
→ markdown-renderer render incrementally
```

### 5.7 — Social & Chat

**Files:**
- `app/[locale]/(main)/social/page.tsx` — Feed
- `app/[locale]/(fullscreen)/chat/page.tsx` — Realtime chat

**Chat WebSocket flow:**
```
ChatPage mount
→ useAuthStore() → get accessToken
→ useSocket(WS_URL, { auth: { token } })
→ emit 'join_conversations' → nhận conversation list
→ click conversation → emit 'join_room'
→ send message → emit 'send_message'
→ on 'new_message' → update message list (optimistic)
```

---

## GIAI ĐOẠN 6 — Management Portal (2–3h)

> **Mục tiêu:** Hiểu Instructor và Admin flows. Structure tương tự Student Portal nên đọc nhanh hơn.

### 6.1 — Foundation (giống Student Portal)

**Path:** `apps/management-portal/src/`

Đọc tương tự Giai đoạn 4 nhưng chú ý:
- Route groups: `(auth)/`, `instructor/`, `admin/`
- Middleware: check role — instructor chỉ vào `/instructor/*`, admin vào `/admin/*`

### 6.2 — Instructor Dashboard

**Files:**
- `app/[locale]/instructor/dashboard/page.tsx`
- `app/[locale]/instructor/courses/page.tsx`
- `app/[locale]/instructor/courses/new/page.tsx`
- `app/[locale]/instructor/courses/[courseId]/edit/page.tsx`

**Course Creation Wizard:**
- `components/courses/wizard/` — Multi-step form
- Step 1: Basic info (title, description, category, level, price)
- Step 2: Curriculum (chapters → sections → lessons drag-drop)
- Step 3: Media (thumbnail upload)
- Step 4: Publish

**Curriculum Editor:**
- Drag-and-drop reorder chapters/sections/lessons
- Inline edit tên
- Add/delete lessons với confirmation

### 6.3 — Admin Panel

**Files:**
- `app/[locale]/admin/dashboard/page.tsx`
- `app/[locale]/admin/users/page.tsx`
- `app/[locale]/admin/courses/page.tsx`
- `app/[locale]/admin/approvals/page.tsx`
- `app/[locale]/admin/analytics/page.tsx`

**Analytics page** — đọc kỹ:
- Recharts LineChart cho revenue over time
- PieChart cho enrollment by category
- Data từ `useAdminAnalytics()` hook

---

## GIAI ĐOẠN 7 — Cross-Layer Flows (2–3h)

> **Mục tiêu:** Trace end-to-end flows quan trọng nhất xuyên qua tất cả layers.

### Flow 1 — Đăng ký khóa học (Purchase)

```
[Frontend] CourseDetail → useAddToCart → CartStore
[Frontend] CheckoutPage → useCreateOrder → OrderService.create()
[API] POST /orders
  → OrdersService.create()
  → validate cart items (courses exist, not already enrolled)
  → apply coupon (validate, reduce usedCount)
  → Prisma transaction: create Order + OrderItems
  → return orderId + total
[Frontend] PaymentPage → polling GET /orders/:id
[External] SePay webhook → POST /orders/sepay-webhook
[API] OrdersService.processPayment()
  → verify webhook signature
  → update Order.status = PAID
  → EnrollmentsService.enrollMultiple(userId, courseIds)
  → NotificationsService.create('PURCHASE_SUCCESS')
  → Jobs: send confirmation email
[Frontend] polling thấy PAID → redirect /my-learning
```

### Flow 2 — Video Upload

```
[Frontend] LessonEditor → file input
→ useUploadVideo() → UploadService.uploadVideo()
[API] POST /uploads/video
  → multer middleware parse multipart
  → Cloudinary.upload_stream() → streamable upload
  → return { publicId, url, duration, thumbnailUrl }
[Frontend] save publicId + url vào Lesson form
→ useUpdateLesson() → PATCH /courses/:id/lessons/:id
```

### Flow 3 — AI Tutor RAG

```
[Instructor] Upload FILE lesson (PDF/DOCX)
[API] After file upload success:
  → TextExtractionService.extract(publicId)
  → Cloudinary download raw file
  → parse với pdf-parse / mammoth
  → chunk text (500 chars với overlap)
  → EmbeddingsService.createEmbeddings(chunks)
  → Groq embedding API → vector[1536]
  → Prisma: upsert CourseEmbedding[]

[Student] Chat với AI Tutor
[API] POST /ai-tutor/sessions/:id/messages
  → embed question → query vector
  → pgvector: SELECT chunks ORDER BY embedding <=> $queryVec LIMIT 5
  → build prompt: system + context chunks + conversation history
  → Groq.chat.completions.create({ stream: true })
  → pipe stream về client
```

### Flow 4 — Real-time Notification

```
[Any module] NotificationsService.create({ userId, type, data })
  → Prisma: create Notification record
  → NotificationQueue.add({ userId, notificationId })
[Jobs] NotificationProcessor.process()
  → fetch notification details
  → emit via Socket.io: server.to(userId).emit('notification', data)
  → if email enabled → MailService.send()
[Frontend] useNotificationSocket()
  → on 'notification' → add to notifications cache
  → show toast (Sonner)
  → increment badge count
```

### Flow 5 — Auth Token Refresh

```
[Frontend] Any API request fails with 401
→ axios response interceptor triggers
→ if not already refreshing: set isRefreshing = true
→ POST /auth/refresh (httpOnly cookie auto-sent)
→ receive new accessToken
→ AuthStore.setAccessToken(newToken)
→ retry ALL queued requests với new token
→ if refresh fails (401) → AuthStore.logout() → redirect /login
```

---

## Checklist Hoàn Thành

Đánh dấu khi đã đọc và hiểu:

### Giai đoạn 0
- [ ] CLAUDE.md + conventions
- [ ] turbo.json + package.json
- [ ] Database design doc + schema.prisma
- [ ] API endpoints doc

### Giai đoạn 1 — Backend Foundation
- [ ] main.ts + app.module.ts
- [ ] Config layer (tất cả config files)
- [ ] Prisma service
- [ ] Guards (jwt, roles, ws)
- [ ] Decorators (current-user, roles, public)
- [ ] Filters (http-exception, prisma-exception)
- [ ] Interceptors (transform, logging, timeout)
- [ ] Common DTOs, interfaces, utils

### Giai đoạn 2 — Backend Modules
- [ ] auth (service + strategies + spec)
- [ ] users
- [ ] categories
- [ ] uploads/media
- [ ] courses (browse + management)
- [ ] chapters + sections + lessons
- [ ] enrollments
- [ ] orders + cart + coupons
- [ ] learning (progress + quiz + certificate)
- [ ] qna
- [ ] social (posts + feed + groups)
- [ ] chat (service + gateway)
- [ ] notifications
- [ ] ai-tutor (extraction + embeddings)
- [ ] admin (users + courses + analytics)
- [ ] jobs (processors + cron)
- [ ] recommendations

### Giai đoạn 3 — Shared Packages
- [ ] shared-types
- [ ] shared-api-client (client.ts QUAN TRỌNG)
- [ ] shared-hooks services (10 quan trọng nhất)
- [ ] shared-hooks query hooks (10 quan trọng nhất)
- [ ] shared-hooks stores (4 files)
- [ ] shared-hooks custom hooks
- [ ] shared-ui components

### Giai đoạn 4 — Frontend Foundation
- [ ] middleware.ts
- [ ] Root layouts + Providers
- [ ] i18n setup
- [ ] Route groups structure

### Giai đoạn 5 — Student Portal Features
- [ ] Auth flow (login/register/refresh)
- [ ] Course browse + detail
- [ ] Ecommerce (cart/checkout/payment)
- [ ] Learning experience (player/progress)
- [ ] Q&A forum
- [ ] AI Tutor
- [ ] Social + Chat

### Giai đoạn 6 — Management Portal
- [ ] Instructor course wizard
- [ ] Curriculum editor
- [ ] Admin panel + analytics

### Giai đoạn 7 — Cross-Layer Flows
- [ ] Trace purchase flow end-to-end
- [ ] Trace video upload flow
- [ ] Trace AI RAG flow
- [ ] Trace real-time notification flow
- [ ] Trace auth refresh flow

---

## Ghi chú cá nhân

> Dùng section này để ghi lại những điều bạn học được khi đọc code:

```
[Date] [Module/File] — Điều thú vị / khó hiểu / cần hỏi lại
```
