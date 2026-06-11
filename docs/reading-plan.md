# SSLM Codebase Reading Plan — Chi tiết từng file & từng luồng nghiệp vụ

> Lộ trình đọc hiểu toàn bộ dự án Smart Social Learning Marketplace, phục vụ **bảo vệ đồ án tốt nghiệp**.
> Viết lại ngày 2026-06-11, kiểm chứng trực tiếp trên code (nhánh `bugfix/runtime-audit-critical-fixes`, commit `90cec04`).
> Phạm vi: **645 file nguồn** — API 317 · student-portal 131 · management-portal 85 · packages 112.
> Thời gian ước tính: **40–50 giờ** đọc chủ động (có ghi chú, trace code).

---

## Mục tiêu

Sau khi hoàn thành plan này, bạn sẽ:
- Hiểu từng file code và **tại sao** nó được viết như vậy
- Vẽ được **không cần nhìn code** 11 luồng nghiệp vụ end-to-end (Phần H)
- Trả lời được dạng câu hỏi phản biện "tại sao chọn X mà không phải Y" (Phần I)
- Biết rõ điểm yếu của hệ thống và cách đã/chưa xử lý — chủ động dẫn dắt hội đồng thay vì bị động

## Cách dùng tài liệu này

1. Đọc **Phần A (quy trình đọc)** trước — đây là "cách học", các phần sau là "nội dung học".
2. Đọc tuần tự B → C → D → E → F → G. Mỗi bảng là 1 checklist: đọc xong file nào tick file đó.
3. **Phần H (luồng nghiệp vụ) là quan trọng nhất cho phản biện** — sau khi xong C+D có thể đọc song song H.
4. Cột "Điểm cần nắm" là những gì hội đồng có thể hỏi sâu — nếu đọc xong file mà chưa giải thích được cột này, đọc lại.
5. File đánh dấu ⭐ là file trọng yếu — phải hiểu từng dòng. File không đánh dấu chỉ cần hiểu vai trò + API surface.

---

# PHẦN A — QUY TRÌNH ĐỌC

## A.1 — Quy trình đọc 1 file (5 bước)

1. **Đọc imports trước** — biết file phụ thuộc gì (service nào được inject, package nào được dùng).
2. **Đọc chữ ký public** — tên hàm + tham số + kiểu trả về của mọi method public. Tự đoán hàm làm gì trước khi đọc thân hàm.
3. **Đọc thân hàm theo happy path** — bỏ qua error handling lần đầu, nắm luồng chính.
4. **Đọc lại các nhánh lỗi & edge case** — chỗ nào throw, throw code gì, transaction bắt đầu/kết thúc ở đâu.
5. **Ghi chú 3 dòng**: file làm gì / quyết định kỹ thuật đáng chú ý / 1 câu hỏi hội đồng có thể hỏi.

**Công cụ:** F12 (Go to Definition) khi gặp symbol lạ · Shift+F12 (Find References) xem ai gọi hàm này · mở `schema.prisma` ở panel bên cạnh khi đọc service · đọc file `*.spec.ts` TRƯỚC service (test mô tả edge case rõ hơn comment).

## A.2 — Quy trình đọc 1 module backend (công thức cố định)

```
1. <module>.module.ts     → imports gì, exports gì → vẽ được vị trí module trong dependency graph
2. dto/*.ts               → API nhận input gì, validate ra sao (class-validator)
3. <module>.controller.ts → liệt kê endpoints: method + path + guards + roles
4. <module>.service.ts    → business logic — đọc kỹ nhất, theo quy trình A.1
5. <module>.gateway.ts    → (nếu có) WebSocket events
6. <module>.spec.ts       → edge cases mà tác giả quan tâm
```

Sau mỗi module, trả lời 3 câu: (1) Module này sở hữu bảng DB nào? (2) Nó gọi sang service của module nào khác? (3) Endpoint nào public, endpoint nào cần role gì?

## A.3 — Quy trình trace 1 luồng nghiệp vụ end-to-end (8 bước) ⭐

Đây là kỹ năng quan trọng nhất khi phản biện. Với mỗi luồng trong Phần H, tự trace lại theo trình tự:

1. **Xuất phát từ UI**: tìm page/component nơi user bấm nút (`apps/student-portal/...` hoặc `apps/management-portal/...`). Ghi lại tên component + handler.
2. **Xuống tầng hook**: handler gọi mutation/query hook nào trong `packages/shared-hooks/src/queries/`. Ghi lại query key + invalidation khi onSuccess.
3. **Xuống tầng service FE**: hook gọi hàm nào trong `packages/shared-hooks/src/services/` → method + path của HTTP request.
4. **Qua API client**: request đi qua `packages/shared-api-client/src/client.ts` — header Authorization gắn ở đâu, 401 xử lý thế nào.
5. **Vào backend controller**: tìm controller match path → guard nào chạy trước (JwtAuthGuard → RolesGuard) → DTO validate gì.
6. **Vào service backend**: đọc từng bước business logic. Đánh dấu: **transaction bắt đầu/kết thúc ở đâu**, bảng nào bị ghi, counter nào bị increment, queue job nào được add.
7. **Theo side effects**: queue job → processor nào xử lý → email/notification/socket emit nào bắn ra → frontend nhận qua socket hook nào.
8. **Vẽ sequence diagram tay** (giấy hoặc Excalidraw): UI → hook → API → service → DB → queue → socket → UI. Nếu vẽ được không cần nhìn code = đã thuộc luồng.

**Câu hỏi tự kiểm sau mỗi luồng:** Nếu request này chạy 2 lần đồng thời thì sao (race)? Nếu bước giữa chừng fail thì dữ liệu có nhất quán không (transaction boundary)? Endpoint này ai gọi được (authz)?

**Mẹo:** có thể nhờ Claude Code (đã có knowledge graph của repo) trace caller/callee nhanh, hoặc đóng vai hội đồng quiz lại sau mỗi luồng.

## A.4 — Sổ tay phản biện

Tạo 1 file ghi chú riêng. Sau mỗi module/luồng ghi 3 mục:
- **Sơ đồ**: sequence diagram của luồng chính
- **Q&A dự kiến**: 2–3 câu hội đồng có thể hỏi + ý trả lời
- **Trade-off**: giới hạn của thiết kế + lý do chấp nhận (free tier là lý do hợp lệ: Neon 0.5GB, Groq 30 req/min, Upstash 10K cmd/day)

---

# PHẦN B — GIAI ĐOẠN 0: Bức tranh tổng thể (~3h)

## B.1 — Monorepo & config gốc

| File | Đọc để hiểu gì |
|------|---------------|
| `CLAUDE.md` | Toàn bộ conventions: naming, patterns, anti-patterns |
| `package.json` (root) | npm workspaces, scripts dev/build/test |
| `turbo.json` | Task pipeline — build của api phụ thuộc build của shared-* |
| `docker-compose.yml` | PostgreSQL + Redis local (lưu ý: dev hiện trỏ Neon, chỉ Redis local là bắt buộc) |
| `.husky/` + `commitlint.config.js` | Git hooks: lint-staged + commit convention |

## B.2 — `apps/api/src/prisma/schema.prisma` — BẢN ĐỒ DỮ LIỆU (đọc kỹ nhất giai đoạn này)

1.489 dòng, ~61 models. Đọc theo từng nhóm domain dưới đây, với mỗi model tự trả lời: khóa chính/khóa ngoại là gì, unique constraint nào, field denormalized nào.

### Nhóm Auth & User
| Model | Bảng DB | Vai trò |
|-------|---------|---------|
| ⭐ User | users | Identity trung tâm: email, passwordHash, role (STUDENT/INSTRUCTOR/ADMIN), status (UNVERIFIED/ACTIVE/SUSPENDED), provider; denormalized followerCount/followingCount; notificationPreferences JSON |
| RefreshToken | refresh_tokens | Refresh token lưu DB (UUID, không phải JWT): token unique, expiresAt |
| InstructorProfile | instructor_profiles | Hồ sơ + số liệu giảng viên: totalStudents, totalCourses, totalRevenue, **availableBalance** |
| InstructorApplication | instructor_applications | Đơn xin làm giảng viên: status, expertise[], cvUrl, reviewedBy |

### Nhóm Course content
| Model | Bảng DB | Vai trò |
|-------|---------|---------|
| Category | categories | Phân cấp parentId đệ quy, slug unique |
| Tag / CourseTag | tags / course_tags | Tag kỹ năng + bảng nối, courseCount denormalized |
| ⭐ Course | courses | title/slug, level, price/originalPrice, status (DRAFT→PENDING_REVIEW→PUBLISHED/REJECTED/ARCHIVED), instructorId; denormalized totalStudents/totalLessons/totalDuration/avgRating/reviewCount/viewCount; soft delete |
| Section → Chapter → Lesson | sections/chapters/lessons | Cây nội dung 3 cấp. Chapter có price riêng (mua lẻ chương) + isFreePreview. ⭐ Lesson: type VIDEO/TEXT/QUIZ/FILE, textContent, videoUrl, fileUrl, **fileExtractedText** (cache cho AI), soft delete |
| Media | media | File Cloudinary: status UPLOADING/READY/FAILED, publicId, urls JSON, duration |
| LessonAttachment | lesson_attachments | File đính kèm tải về |
| Quiz → QuizQuestion → QuizOption | quizzes/... | 1 quiz/lesson (lessonId unique), passingScore mặc định 0.7, maxAttempts, timeLimitSeconds |
| QuestionBank (+Tag/Item/Option) | question_banks/... | Ngân hàng câu hỏi tái sử dụng của instructor |

### Nhóm Ecommerce (trọng tâm phản biện)
| Model | Bảng DB | Vai trò |
|-------|---------|---------|
| CartItem | cart_items | (userId, courseId, chapterId) unique, lưu price snapshot |
| ⭐ Order | orders | orderCode unique (`SSLM` + 13 số), totalAmount/discountAmount/finalAmount, status PENDING/COMPLETED/EXPIRED/REFUNDED, paymentRef, **expiresAt** (15 phút) |
| OrderItem | order_items | type COURSE/CHAPTER, price/discount snapshot |
| ⭐ Enrollment | enrollments | (userId, courseId) unique, type FULL/PARTIAL, progress 0–100 |
| ChapterPurchase | chapter_purchases | Quyền sở hữu theo chương |
| Coupon / CouponCourse / CouponUsage | coupons/... | PERCENTAGE hoặc FIXED_AMOUNT, usageLimit + maxUsesPerUser, scope theo course |
| Review | reviews | (userId, courseId) unique, rating 1–5, soft delete |
| Wishlist | wishlists | (userId, courseId) unique |
| ⭐ Earning | earnings | Chia doanh thu: amount, commissionRate, netAmount, status PENDING→AVAILABLE→WITHDRAWN, **availableAt** (hold period) |
| ⭐ Withdrawal | withdrawals | amount, bankInfo JSON, status PENDING/COMPLETED/REJECTED, reviewedBy |

> **Lưu ý phản biện:** tiền dùng kiểu `Float` (VND, không Decimal) — chuẩn bị câu trả lời (xem Phần I.3).

### Nhóm Learning & progress
| Model | Bảng DB | Vai trò |
|-------|---------|---------|
| ⭐ LessonProgress | lesson_progress | (userId, lessonId) PK, lastPosition, **watchedSegments JSON** (mảng [start,end]), watchedPercent, isCompleted |
| QuizAttempt / QuizAnswer | quiz_attempts/quiz_answers | score 0–1, passed; lưu từng đáp án với isCorrect |
| Certificate | certificates | (userId, courseId) unique, verifyCode unique |
| DailyActivity | daily_activities | (userId, activityDate) PK — nền tảng tính streak |
| UserSkill | user_skills | Trình độ theo tag 0–100 |
| PlacementQuestion / PlacementTest | placement_* | Bài test xếp trình độ, scores JSON, recommendedLevel |

### Nhóm Social & chat
| Model | Bảng DB | Vai trò |
|-------|---------|---------|
| ⭐ Post | posts | type TEXT/CODE/LINK/SHARED, codeSnippet JSON, groupId?, sharedPostId?; denormalized likeCount/commentCount/shareCount; soft delete |
| PostImage / Like / Comment / Bookmark | ... | Comment có parentId (reply lồng), soft delete |
| Follow | follows | (followerId, followingId) PK |
| Group / GroupMember / GroupJoinRequest | groups/... | Group gắn course (courseId unique), privacy PUBLIC/PRIVATE, role OWNER/ADMIN/MEMBER |
| FeedItem | feed_items | Feed đã fanout sẵn: (userId, postId), index userId+createdAt DESC |
| Conversation / ConversationMember / Message | conversations/... | Chat 1-1 + nhóm; lastReadAt để tính unread |

### Nhóm Q&A, Notification, AI, Admin
| Model | Bảng DB | Vai trò |
|-------|---------|---------|
| Question / Answer / Vote | questions/... | bestAnswerId, vote ±1, denormalized viewCount/answerCount/voteCount |
| ⭐ Notification | notifications | recipientId, type (19 loại), data JSON, isRead; index (recipientId,isRead) |
| AiChatSession / AiChatMessage | ai_chat_* | Hội thoại AI Tutor theo course |
| ⭐ CourseChunk | course_chunks | RAG: content + **embedding vector(384)** (cột thêm bằng raw SQL migration, pgvector) |
| Report | reports | targetType 6 loại, status PENDING/ACTION_TAKEN/DISMISSED |
| CommissionTier | commission_tiers | Bậc hoa hồng theo minRevenue |
| PlatformSetting | platform_settings | KVP cấu hình động: minimum_withdrawal=50000, default_commission_rate=30... |
| AnalyticsSnapshot | analytics_snapshots | Số liệu chốt theo ngày (cron 2:30 AM) |
| CourseSimilarity | course_similarities | Ma trận gợi ý: score theo algorithm CONTENT/COLLABORATIVE |

**Pattern xuyên suốt schema:** CUID làm id · `@@map`/`@map` snake_case · soft delete `deletedAt` (User, Course, Section, Lesson, Post, Comment, Question, Answer, Review) · denormalized counters (reconcile bằng cron Chủ nhật) · `migrations/` ~19 file đọc tên để hiểu evolution · pgvector enable thủ công trên Neon.

## B.3 — Docs thiết kế (đọc lướt, đối chiếu khi cần)

`docs/phase1-analysis/` (use cases, 69 requirements) · `docs/phase2-database/` (ERD) · `docs/phase3-backend/` (~90 endpoints, realtime/cron) · `docs/phase4-frontend/` (design system, wireframes).

---

# PHẦN C — GIAI ĐOẠN 1: Backend Foundation (~4–5h)

> Code chạy ở **mọi request** — phải hiểu trước khi đọc bất kỳ module nào.

## C.1 — Bootstrap

| File | Vai trò | Điểm cần nắm khi đọc |
|------|---------|----------------------|
| ⭐ `apps/api/src/main.ts` | Bootstrap NestJS | ValidationPipe global (whitelist + forbidNonWhitelisted → tự strip/chặn field lạ); CORS cho 2 portal URL với credentials; Basic auth bảo vệ Bull Dashboard `/api/admin/queues`; cookie-parser; Swagger |
| ⭐ `apps/api/src/app.module.ts` | Root module | Đăng ký TẤT CẢ feature modules + 3 Bull queues (email/notification/feed); thứ tự global guards: ThrottlerGuard → JwtAuthGuard; global TransformInterceptor + TimeoutInterceptor 30s |

## C.2 — `apps/api/src/config/` — Configuration

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `config.module.ts` | @Global() load 8 config factory | isGlobal=true → inject ConfigService mọi nơi |
| `app.config.ts` | PORT, NODE_ENV, URL 2 portal | Fallback PORT=3000 |
| `auth.config.ts` | JWT secrets + expiry | access 15m, refresh 7d |
| `database.config.ts` | DATABASE_URL + DIRECT_URL | DIRECT_URL cho migration trên Neon |
| `redis.config.ts` | Redis URL | Mặc định redis://localhost:6379 (production dùng Redis local, KHÔNG Upstash) |
| `mail.config.ts` | SMTP Gmail | port 587 |
| `cloudinary.config.ts` | cloudName, apiKey, apiSecret | apiSecret chỉ ở backend — dùng ký signed upload |
| `sepay.config.ts` | bankId, account, webhookSecret | Verify webhook SePay |
| `groq.config.ts` | GROQ_API_KEY, model | llama-3.3-70b-versatile, maxTokens 2048 |

## C.3 — `apps/api/src/common/` — Hạ tầng dùng chung (ĐỌC KỸ)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `constants/app.constant.ts` | Mọi magic number | BCRYPT_ROUNDS=12, OTT_EXPIRY_SECONDS=60, LESSON_COMPLETE_THRESHOLD=0.8, QUIZ_DEFAULT_PASSING_SCORE=0.7, ORDER_EXPIRY_MINUTES=15, AI_DAILY_LIMIT=10, RAG_TOP_K=5, EMBEDDING_DIMENSIONS=384, MAX_VIDEO_SIZE=500MB |
| ⭐ `guards/jwt-auth.guard.ts` | Guard JWT global | Dual-mode: endpoint @Public() vẫn THỬ đọc token (optional auth — để biết user nếu có), endpoint thường bắt buộc token hợp lệ |
| ⭐ `guards/roles.guard.ts` | RBAC | Đọc metadata ROLES_KEY; không có @Roles() thì cho qua |
| `guards/ws-auth.guard.ts` | Auth WebSocket | Token từ handshake.auth hoặc query; gắn client.data.userId |
| `decorators/current-user.decorator.ts` | @CurrentUser() | Lấy req.user (JwtPayload), hỗ trợ @CurrentUser('sub') |
| `decorators/public.decorator.ts` | @Public() | SetMetadata IS_PUBLIC_KEY |
| `decorators/roles.decorator.ts` | @Roles(...) | SetMetadata ROLES_KEY |
| `decorators/index.ts` | Barrel export | — |
| ⭐ `filters/http-exception.filter.ts` | Chuẩn hóa lỗi | Response lỗi luôn là `{code, message, statusCode, field?}` — backend trả CODE, frontend dịch i18n |
| ⭐ `filters/prisma-exception.filter.ts` | Map lỗi Prisma | P2002→409, P2025→404, P2003→400 |
| ⭐ `interceptors/transform.interceptor.ts` | Bọc response | Bọc `{data: T}`; nếu đã là `{data, meta}` (paginated) thì giữ nguyên |
| `interceptors/logging.interceptor.ts` | Log HTTP | method, URL, thời gian |
| `interceptors/timeout.interceptor.ts` | Timeout 30s | RxJS timeout() |
| `dto/pagination.dto.ts` | Query phân trang | page=1, limit=20 (max 100), getter skip |
| `dto/api-response.dto.ts` | Wrapper types | MetaDto, ApiResponseDto, ApiErrorDto |
| `interfaces/jwt-payload.interface.ts` | JwtPayload | `{sub, role, iat?, exp?}` |
| `interfaces/paginated-result.interface.ts` | PaginatedResult | `{data, meta}` |
| `pipes/parse-cuid.pipe.ts` | Validate CUID param | Regex, throw INVALID_CUID |
| `utils/slug.util.ts` | Slug | slugify hỗ trợ tiếng Việt (đ→d), unique bằng suffix base36 |
| `utils/pagination.util.ts` | createPaginatedResult() | Build {data, meta} chuẩn |
| ⭐ `utils/segments.util.ts` | Tiến độ video | mergeSegments() gộp khoảng [start,end] chồng lấn; calculateWatchedPercent() — nền tảng chống tua để gian lận tiến độ |

## C.4 — Hạ tầng services

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `prisma/prisma.module.ts` + `prisma.service.ts` | DB layer | @Global(); extends PrismaClient, $connect/$disconnect theo lifecycle |
| `prisma/seed.ts` | Seed dev data (~1K dòng) | npx prisma db seed |
| ⭐ `redis/redis.module.ts` + `redis.service.ts` | Cache + rate limit | extends ioredis; `checkRateLimit()` (incr+expire), `getOrSet()` cache-aside; dùng cho view count, OTT, online status, AI quota |
| ⭐ `mail/mail.module.ts` + `mail.service.ts` | Email SMTP | nodemailer; sendVerificationEmail / sendResetPasswordEmail / sendOrderReceiptEmail — chỉ được gọi từ EmailProcessor (async qua queue) |
| `health/health.controller.ts` + `health.module.ts` | Health check | @Public() GET /health: SELECT 1 + Redis PING |
| ⭐ `uploads/uploads.controller.ts` | API upload | POST /uploads/sign → POST /uploads/:mediaId/complete → DELETE — quy trình 3 bước, upload thật đi THẲNG Cloudinary |
| `uploads/uploads.service.ts` | Cloudinary wrapper | api_sign_request tạo signature; deleteFile, getVideoInfo |
| `uploads/uploads.module.ts` | forwardRef(MediaModule) | Tránh circular dependency |

## C.5 — Jobs, Bull Board, Platform Settings

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `modules/bull-board/bull-board.module.ts` | Dashboard queue | Route /admin/queues, basic auth từ main.ts |
| `modules/jobs/jobs.module.ts` | Đăng ký 3 queue + processors + cron | Trung tâm xử lý nền |
| ⭐ `modules/jobs/queue.service.ts` | Facade enqueue | addVerificationEmail / addOrderReceiptEmail / addNotification / addAdminNotification / addFeedFanout — lỗi enqueue chỉ log, KHÔNG throw (fire-and-forget) |
| `modules/jobs/processors/email.processor.ts` | Worker email | Map job.name → MailService |
| ⭐ `modules/jobs/processors/notification.processor.ts` | Worker notification | Check preference user (cache Redis 5 phút `notif_prefs:{userId}`); ALWAYS_DELIVER_TYPES bỏ qua preference |
| `modules/jobs/processors/feed.processor.ts` | Worker fanout feed | createMany FeedItem batch 1000, skipDuplicates |
| ⭐ `modules/jobs/cron.service.ts` (330 dòng) | 10 cron jobs | expirePendingOrders (*/20) · syncViewCounts (*/30, Redis→DB) · releaseAvailableEarnings (*/30) · cleanupFailedUploads (6h) · computeAnalyticsSnapshot (2:30) · cleanupExpiredTokens (6h) · computeRecommendationMatrix (4:00) · cleanupOldFeedItems (CN) · reconcileCounters (CN) · indexCoursesForAiTutor (5:00). Interval đã nới rộng để tiết kiệm compute Neon |
| ⭐ `modules/platform-settings/platform-settings.service.ts` | Config động | @Global(); load DB vào Map in-memory khi boot, reload() khi admin sửa |
| `modules/platform-settings/platform-settings.controller.ts` | GET /platform-settings | @Public() — client đọc minimumWithdrawal, commissionRate... |
| `modules/platform-settings/platform-settings.module.ts` | Module | — |

---

# PHẦN D — GIAI ĐOẠN 2: Backend Modules (~10–12h)

> Đọc theo thứ tự dưới đây (theo dependency). Công thức mỗi module: xem A.2.

## D.1 — `modules/auth/` ⭐ (đọc đầu tiên)

**Vai trò:** đăng ký, đăng nhập, verify email, reset password, refresh token **rotation lưu DB**, OTT cross-portal qua Redis, rate limit.
**Phụ thuộc:** PrismaService, JwtService, RedisService, QueueService.
**Endpoints:** POST /auth/register (throttle 3/10min) · POST /auth/login (5/min) · POST /auth/refresh · POST /auth/logout · POST /auth/verify-email · POST /auth/resend-verification · POST /auth/forgot-password · POST /auth/reset-password · GET /auth/ott · POST /auth/ott/validate.

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `auth.module.ts` | Import Passport + JwtModule | Chỉ export AuthService |
| ⭐ `auth.controller.ts` | 10 endpoints | Cookie tách theo portal: `rt_student` / `rt_management` (httpOnly, sameSite lax, path /api/auth, 7d) — login từ portal nào set cookie portal đó |
| ⭐ `auth.service.ts` | Logic lõi | **Refresh token = UUID lưu bảng refresh_tokens (KHÔNG phải JWT)**; rotation: mỗi lần refresh xóa token cũ + tạo mới; login chặn status SUSPENDED; verify email bằng UUID token có expiry; forgot-password luôn trả success (chống dò email); OTT: Redis `ott:{uuid}` TTL 60s, xóa ngay sau validate (one-time) |
| `strategies/jwt.strategy.ts` | Validate Bearer token | Decode payload {sub, role} |
| `dto/` (7 file: login, register, verify-email, resend-verification, forgot-password, reset-password, validate-ott) | Validate input | Password regex: ≥8 ký tự, 1 hoa, 1 số |

**Câu hỏi tự kiểm:** Tại sao refresh token lưu DB thay vì stateless JWT? (→ revoke được, rotation phát hiện token bị trộm). Tại sao cookie tách 2 portal? (→ đăng nhập 2 vai trò song song không đè nhau).

## D.2 — `modules/users/`

**Endpoints:** GET/PATCH /users/me · PUT /users/me/notification-preferences · PATCH /users/me/password · GET /users/suggestions · GET /users/search · GET /users/:id · POST/DELETE /users/:id/follow · GET /users/:id/followers, /following.

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `users.module.ts` | Export UsersService | — |
| ⭐ `users.controller.ts` | 11 endpoints | search + public profile là @Public() |
| ⭐ `users.service.ts` | Profile + social graph | **Follow = transaction**: create Follow + increment followerCount + followingCount; notification qua queue; enrichWithFollowStatus batch 1 query thay vì N |
| `dto/update-profile.dto.ts`, `dto/change-password.dto.ts`, `dto/update-notification-preferences.dto.ts` | Input | Đổi preference → invalidate cache Redis notif_prefs |

## D.3 — `modules/categories/` (đơn giản — đọc nhanh)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `categories.module.ts` / `categories.controller.ts` / `categories.service.ts` | 3 endpoint public: GET /categories (cây parent/children), GET /categories/:slug, GET /tags | _count chỉ đếm course PUBLISHED chưa xóa |

## D.4 — `modules/media/`

**Vai trò:** điều phối upload Cloudinary (ký → upload thẳng → confirm), recalculate duration dây chuyền.

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `media.module.ts` | forwardRef(UploadsModule) | — |
| ⭐ `media.service.ts` | signAndCreatePending / completeUpload / deleteMedia | Tạo Media status UPLOADING trước, complete mới READY + sync metadata; verifyLessonOwnership chống upload vào lesson người khác; **recalculateCounters cascade: lesson → chapter → course duration** |
| `dto/sign-upload.dto.ts`, `dto/complete-upload.dto.ts` | Input | cloudinaryResult nested DTO |

## D.5 — `modules/instructor/`

**Endpoints:** POST /instructor/applications (STUDENT) · GET /instructor/applications/me · GET/PATCH /instructor/profile · GET /instructor/dashboard.

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `instructor.module.ts` / `instructor.controller.ts` | 5 endpoints | Role guard STUDENT cho apply, INSTRUCTOR cho còn lại |
| ⭐ `instructor.service.ts` | Apply + dashboard | Chặn nộp đơn khi đã có đơn PENDING; dashboard = 4 query song song (profile stats, recent earnings, top courses) |
| `dto/create-application.dto.ts`, `dto/update-instructor-profile.dto.ts` | Input | experience tối thiểu 50 ký tự |

## D.6 — `modules/courses/` ⭐ (lớn nhất — 39 file, 7 submodule)

**Cây nội dung:** Course → Section → Chapter → Lesson. **Phụ thuộc:** Prisma, Redis, Queue, PlatformSettings, GroupsService.

### browse/ (public)
| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `browse/courses.controller.ts` | GET /courses, GET /courses/:slug | @Public() nhưng vẫn đọc user nếu có token (hiện trạng thái enrolled) |
| ⭐ `browse/courses.service.ts` (335 dòng) | Filter + paginate + detail | buildWhereFilter (search/category/level/price/rating), buildSortOrder (NEWEST/POPULAR/HIGHEST_RATED/PRICE_*); chỉ trả PUBLISHED + deletedAt null; detail include cây section→chapter→lesson |

### management/ (instructor)
| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `management/course-management.controller.ts` | CRUD + submit + students | @Roles(INSTRUCTOR); mọi thao tác verifyOwnership |
| ⭐ `management/course-management.service.ts` (420+ dòng) | Create/update/submit/delete | generateSlug + tag upsert; **chặn edit khi status=PENDING_REVIEW**; submit → status PENDING_REVIEW + notify admin; soft delete |

### sections/ chapters/ lessons/ (CRUD lồng 3 cấp)
| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `sections/sections.controller.ts` + `sections.service.ts` | CRUD + PUT reorder | Route `/instructor/courses/:courseId/sections`; reorder theo field order |
| `chapters/chapters.controller.ts` + `chapters.service.ts` | CRUD + reorder | Route lồng `.../sections/:sectionId/chapters`; counter cascade chapter→section→course |
| `lessons/lessons.controller.ts` + `lessons.service.ts` | CRUD + reorder | Route lồng 3 cấp; đổi nội dung file → reset fileExtractedText (để AI re-index); duration đổi → cascade counters |

### quizzes/ reviews/
| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `quizzes/quizzes.controller.ts` + `quizzes.service.ts` | PUT upsert quiz | 1 quiz/lesson; upsert = xóa cũ tạo mới trong transaction; validate mỗi câu đúng 1 đáp án đúng |
| `reviews/reviews.controller.ts` + ⭐ `reviews.service.ts` | CRUD review | **Gate: phải enrolled + progress ≥ 30% mới được review**; transaction: ghi review + recalc avgRating + reviewCount |

### dto/ (7 file)
`query-courses.dto.ts` (filter+sort enum) · `create-course.dto.ts` (tags nhận cả names lẫn tagIds) · `create-section.dto.ts` · `create-chapter.dto.ts` (price riêng + isFreePreview) · `create-lesson.dto.ts` (type + URL theo loại) · `create-quiz.dto.ts` (nested questions/options) · `create-review.dto.ts` (rating 1–5).

## D.7 — `modules/enrollments/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `enrollments.module.ts` | Import Jobs + Social | Export EnrollmentsService |
| `enrollments.controller.ts` | GET /enrollments/check/:courseId · GET /enrollments/my-learning · POST /enrollments/free/:courseId | — |
| ⭐ `enrollments.service.ts` | checkEnrollment + enrollFree | check trả cả FULL + PARTIAL + danh sách chapter đã mua; **chặn instructor tự enroll khóa của mình**; enroll free → join group khóa học |

## D.8 — `modules/cart/`

**Endpoints:** GET/DELETE /cart · POST /cart/items · DELETE /cart/items/:id · POST /cart/merge · POST /cart/apply-coupon · GET/POST/DELETE /wishlists.

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `cart.module.ts` | Import CouponsModule | — |
| `cart.controller.ts` + `wishlist.controller.ts` | 9 endpoints | — |
| ⭐ `cart.service.ts` | Thêm/xóa/merge | **Giá lấy từ DB, không tin frontend**; chặn add khóa của chính mình / đã enrolled; add full course → tự xóa các chapter lẻ của course đó trong giỏ; merge localStorage cart sau login |
| `dto/` (add-cart-item, merge-cart, apply-coupon) | Input | chapterId optional = mua lẻ chương |

## D.9 — `modules/orders/` ⭐ (trọng tâm phản biện #1)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `orders.module.ts` | Import Coupons + Jobs + Social | — |
| `orders.controller.ts` | POST /orders · GET /orders · GET /orders/:id · GET /orders/:id/status | /status cho polling |
| ⭐ `orders.service.ts` (180+ dòng) | Tạo đơn | Transaction: validate cart → validateAndCalculateDiscount (coupon) → **distributeDiscount chia giảm giá theo tỉ lệ từng item** → create Order + OrderItems + CouponUsage → xóa cart. orderCode format SSLM+timestamp. expiresAt = now + 15 phút. **finalAmount=0 → fulfillOrder ngay, bỏ qua QR** |
| ⭐ `order-fulfillment.service.ts` (200+ dòng) | Fulfillment idempotent (commit 37b2398) | **`updateMany WHERE id=? AND status='PENDING'` → count=0 nghĩa là đã xử lý → return sớm** (chống webhook đúp/concurrent); sau đó: upsert Enrollment + increment totalStudents + tạo Earning (commissionRate theo CommissionTier, netAmount, status PENDING, availableAt=now+hold) + increment InstructorProfile + notification 2 chiều + addMemberByCourseId (group) |
| ⭐ `webhooks.controller.ts` + `webhooks.service.ts` | POST /webhooks/sepay (@Public) | Verify header `Authorization: Apikey <key>`; extract orderCode bằng regex `/SSLM\d{13}/i` từ content chuyển khoản; check transferAmount ≥ finalAmount; gọi fulfillOrder |
| `dto/create-order.dto.ts`, `dto/sepay-webhook.dto.ts` | Input | transferAmount transform string→float |

## D.10 — `modules/coupons/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `coupons.module.ts` / `coupons.controller.ts` | CRUD coupon @Roles(INSTRUCTOR) | Deactivate thay vì hard delete |
| ⭐ `coupons.service.ts` (200+ dòng) | validateAndCalculateDiscount | **6 cổng kiểm tra:** tồn tại+isActive → trong [startDate,endDate] → usageCount<usageLimit → đếm CouponUsage per-user < maxUsesPerUser → minOrderAmount → cap maxDiscount (PERCENTAGE) / cap tổng (FIXED) |
| `dto/` (create, update, apply) | Input | PERCENTAGE value 1–100 |

## D.11 — `modules/withdrawals/` ⭐ (trọng tâm phản biện #2)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `withdrawals.module.ts` / `withdrawals.controller.ts` | POST + GET /instructor/withdrawals | @Roles(INSTRUCTOR) |
| ⭐ `withdrawals.service.ts` (75 dòng) | requestWithdrawal (commit 05018a4) | Check minimum từ PlatformSettings (50.000đ); **transaction: (1) chặn nếu còn đơn PENDING → (2) `updateMany WHERE availableBalance >= amount` decrement → count=0 nghĩa là không đủ tiền → throw INSUFFICIENT_BALANCE → (3) create Withdrawal**. Row lock của Postgres serialize 2 request đồng thời → không thể rút âm |
| `dto/create-withdrawal.dto.ts` | amount + bankInfo nested | — |

## D.12 — `modules/learning/` (6 submodule)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `learning.module.ts` | Gom 6 submodule | — |
| ⭐ `course-player/course-player.service.ts` (143 dòng) + controller | GET /courses/:courseId/learn/:lessonId | **Access control 3 cấp: isFreePreview → FULL enrollment → ChapterPurchase (PARTIAL)**; trả lesson + quiz (KHÔNG kèm isCorrect) + progress + curriculum sidebar batch completion |
| ⭐ `progress/progress.service.ts` (188 dòng) + controller + `dto/update-progress.dto.ts` | PUT /learning/progress/:lessonId · POST /learning/lessons/:lessonId/complete · GET /learning/progress/:courseId | mergeSegments chống tua; isCompleted khi watchedPercent ≥ 0.8; **"never un-complete"** (`finalCompleted = isCompleted OR existing.isCompleted`); recalculateEnrollmentProgress = completed/accessible lessons (PARTIAL chỉ đếm chapter đã mua); 100% + FULL → generateCertificate |
| ⭐ `quiz-attempts/quiz-attempts.service.ts` (125 dòng) + controller + `dto/submit-quiz.dto.ts` | POST .../quiz/submit · GET .../quiz/attempts | **Chấm server-side** (so selectedOptionId với option isCorrect); score=correct/total; normalize passingScore >1 thì /100; check maxAttempts; passed → mark lesson complete → recalc progress → track activity; trả kèm explanation từng câu |
| `certificates/certificates.service.ts` (70 dòng) + controller | GET /certificates/my · GET /certificates/verify/:code (@Public) | Idempotent theo (userId,courseId) unique; verifyCode UUID 8 ký tự |
| ⭐ `streaks/streaks.service.ts` (171 dòng) + controller | GET /learning/streak · GET /learning/dashboard | trackDailyActivity upsert theo (userId, ngày); current streak tính từ hôm nay hoặc hôm qua, đếm ngày liên tiếp; dashboard trả active/completed courses + next lesson |
| `placement-tests/placement-tests.service.ts` (160 dòng) + controller + 2 dto | POST /placement-tests/start (@Public) · POST /placement-tests/submit | 15 câu = 5/level, shuffle; determineLevel: ADVANCED ≥0.7 → INTERMEDIATE ≥0.7 → BEGINNER; kết quả upsert 1 bản ghi/user |
| 6 file `*.service.spec.ts` | Test | Đọc để nắm edge case từng service |

## D.13 — `modules/qna/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `questions/questions.service.ts` (249 dòng) + controller | CRUD + search + similar + best answer | Filter courseId/tagId/answered-unanswered; view count tăng fire-and-forget qua Redis nếu viewer mới; mark best answer: chỉ owner câu hỏi hoặc instructor của course |
| ⭐ `answers/answers.service.ts` (173 dòng) + controller | Trả lời + vote | **Vote logic: cùng giá trị → gỡ (remove), khác giá trị → đổi (increment value*2), mới → +value**; không vote câu trả lời của mình; notify khi upvote |
| `dto/` (6 file: create-question, update-question, query-questions, create-answer, mark-best-answer, vote) | Input | codeSnippet JSON {language, code} |
| `qna.module.ts` | Gom 2 submodule | — |

## D.14 — `modules/question-banks/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `question-banks.service.ts` (282 dòng) | Bank + question + tag CRUD, batch import | Verify ownership mọi thao tác; validateOneCorrectOption; batch trong transaction; update tag bằng raw SQL array_remove |
| `question-banks.controller.ts` (166 dòng) | ~12 endpoints /instructor/question-banks | @Roles(INSTRUCTOR, ADMIN) |
| `dto/` (create-question-bank, create-bank-question, bank-tag) + spec + module | — | — |

## D.15 — `modules/ai-tutor/` ⭐ (trọng tâm phản biện #3)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `ai-tutor.service.ts` (294 dòng) | RAG + streaming + sessions | Rate limit Redis 10 câu/ngày/user; check enrollment trước khi trả lời; retrieveContext: embed câu hỏi → pgvector `ORDER BY embedding <=> $vec LIMIT 5`, similarity = `1 - distance`; prompt = system + 10 message gần nhất + context; **Groq llama-3.3-70b-versatile stream:true**; AsyncGenerator yield StreamEvent (start/token/done/error) |
| ⭐ `embeddings/embeddings.service.ts` (330 dòng) | Indexing | **Embedding chạy LOCAL trên server NestJS: @xenova/transformers model Xenova/all-MiniLM-L6-v2 → vector 384 chiều (KHÔNG gọi API ngoài — Groq không có embedding API)**; indexCourseContent đọc cả cây course; chunkText 500 ký tự overlap 50; INSERT raw SQL `::vector` |
| `text-extraction/text-extraction.service.ts` (55 dòng) | Extract text file | docx/doc (mammoth), txt/md; kết quả cache vào lesson.fileExtractedText |
| ⭐ `ai-tutor.controller.ts` (126 dòng) | 8 endpoints /ai/tutor/* | ask-stream: **SSE** — setHeader text/event-stream, `res.write('data: {...}\n\n')`, req.setTimeout(0); index endpoints @Roles(ADMIN) |
| `dto/ask-question.dto.ts`, `dto/bulk-index.dto.ts` + spec ×2 + module | — | — |

## D.16 — `modules/recommendations/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `recommendations.service.ts` (219 dòng) | Hybrid orchestrator | Router theo context: guest→popularity, course_detail→content-based, post_purchase→collaborative, homepage→hybrid (content×0.5 + collab×0.5); dedupe lấy score cao nhất |
| `algorithms/content-based.service.ts` (80 dòng) | Content-based | One-hot vector theo tag, cosine similarity, threshold 0.1 |
| `algorithms/collaborative.service.ts` (77 dòng) | Collaborative | **Jaccard similarity** trên tập user enrolled giữa từng cặp course |
| ⭐ `algorithms/popularity.service.ts` (57 dòng) | Popularity | **Wilson score lower bound** (z=1.96) + time decay; final = wilson×0.7 + time×0.3 — câu trả lời đẹp khi bị hỏi "sao không sort theo avgRating?" |
| `recommendations.controller.ts` + `dto/query-recommendations.dto.ts` + spec ×4 + module | GET /recommendations | Ma trận tính trước bằng cron 4:00 AM, lưu CourseSimilarity |

## D.17 — `modules/social/` (5 submodule)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `posts/posts.service.ts` (157 dòng) + controller + 3 dto | CRUD post + share | **Commit 90cec04: check group membership trước khi tạo post trong group PRIVATE**; tạo post → addFeedFanout vào queue; share tạo post type SHARED trỏ sharedPostId |
| ⭐ `groups/groups.service.ts` (511 dòng) + controller + 4 dto | Group + member + join request | Join phân nhánh: PUBLIC→vào thẳng; PRIVATE gắn course→check enrollment; PRIVATE thường→tạo JoinRequest; verifyGroupMember/verifyGroupRole chống IDOR; role hierarchy OWNER>ADMIN>MEMBER; **ensureForCourse() idempotent — admin duyệt khóa học là có group** |
| `feed/feed.service.ts` + controller | GET /feed, /feed/trending, /feed/public | Feed cá nhân đọc từ FeedItem (đã fanout); trending = top 5 post 7 ngày sort likeCount→commentCount |
| `comments/comments.service.ts` | Comment lồng | parentId reply, load 3 reply gần nhất; notify post author + parent author; increment/decrement commentCount |
| `interactions/interactions.service.ts` | Like/bookmark toggle | Like = transaction (create/delete + counter); bookmark không notify |
| `social.module.ts` | Gom submodule, export GroupsService | GroupsService được orders/enrollments/admin dùng |

## D.18 — `modules/chat/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `chat.service.ts` (202 dòng) | Conversations + messages | getOrCreateConversation idempotent cho 1-1; unreadCount = đếm message sau lastReadAt của người khác gửi; online status từ Redis `online:{userId}` TTL 300s |
| ⭐ `chat.gateway.ts` | WebSocket namespace `/chat` | handleConnection verify JWT → join `user_{userId}` + set online Redis; events nhận: join_conversation (verify membership) / send_message / typing / stop_typing / mark_read; events phát: new_message (room conv_*) / new_message_notification (cho member không mở room) / user_typing / message_read |
| `chat.controller.ts` | REST fallback: GET /conversations, GET+POST messages | Load lịch sử qua REST, realtime qua socket |
| `dto/create-conversation.dto.ts`, `dto/send-message.dto.ts` + module | Input | type TEXT/IMAGE/CODE/FILE |

## D.19 — `modules/notifications/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `notifications.service.ts` | create + list + mark read | create() ghi DB rồi **push socket ngay** (pushToUser + pushUnreadCount); markAsRead verify recipientId |
| ⭐ `notifications.gateway.ts` | WebSocket namespace `/notifications` | Join room `user_{userId}`; emit 'notification', 'unread_count', 'order_status_changed' |
| ⭐ `notification-preferences.map.ts` | Map 19 loại notification | PREFERENCE_TYPE_MAP nhóm 6 key preference; ALWAYS_DELIVER_TYPES (SYSTEM, REPORT_RESOLVED, các loại admin) không tắt được |
| `notifications.controller.ts` + `dto/query-notifications.dto.ts` + module | GET /notifications · GET /unread-count · PUT /read-all · PUT /:id/read | — |

## D.20 — `modules/reports/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `reports.service.ts` (315 dòng) | Submit + review + enrich | Chặn report trùng (đã có PENDING cùng target); review: DELETE_CONTENT→soft delete qua AdminModerationService, SUSPEND_USER→đổi status; **auto-resolve: sau action, mọi report PENDING cùng target → ACTION_TAKEN**; enrichWithPreviews batch build preview 6 loại target |
| `reports.controller.ts` | POST /reports (throttle 10/h) | User thường |
| `admin-reports.controller.ts` | GET + PATCH /admin/reports | @Roles(ADMIN) |
| `dto/create-report.dto.ts`, `dto/query-reports.dto.ts` + module | Input | targetType 6 loại |

## D.21 — `modules/admin/` (7 submodule)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `admin.module.ts` | Gom submodule | Tất cả controller @Roles(ADMIN) |
| `users/admin-users.controller.ts` + `admin-users.service.ts` | List + suspend user | Không sửa được tài khoản ADMIN khác |
| ⭐ `applications/admin-applications.controller.ts` + `admin-applications.service.ts` | Duyệt đơn instructor | Transaction: update application + đổi role user → INSTRUCTOR + upsert InstructorProfile |
| ⭐ `courses/admin-courses.controller.ts` + `admin-courses.service.ts` | Duyệt khóa học | Approve → status PUBLISHED + **ensureForCourse tạo group** + **indexCourseContent cho AI (fire-and-forget)** + notification |
| `content/admin-content.controller.ts` + `admin-content.service.ts` | CRUD category/tag/commission tier/setting/placement question | Sửa setting → PlatformSettingsService.reload(); không xóa được category còn course |
| ⭐ `withdrawals/admin-withdrawals.controller.ts` + `admin-withdrawals.service.ts` | Duyệt rút tiền | Transaction: COMPLETED → mark Earning AVAILABLE→WITHDRAWN (loop oldest-first đến đủ amount); REJECTED → **hoàn availableBalance** |
| ⭐ `analytics/admin-analytics.controller.ts` + `admin-analytics.service.ts` | Dashboard + time series | Dashboard = 10 query song song; analytics đọc AnalyticsSnapshot, bucket daily/weekly/monthly theo range |
| `moderation/admin-moderation.controller.ts` + `admin-moderation.service.ts` | Soft delete nội dung | Xóa comment → decrement postCommentCount; xóa answer → clear bestAnswerId |
| `dto/` (10 file: query-admin-users, update-user-status, review-application, review-course, review-withdrawal, create-category, create-tag, create-commission-tier, update-setting, create-placement-question) | Input | — |

---

# PHẦN E — GIAI ĐOẠN 3: Shared Packages (~4–5h)

> Thứ tự đọc: types → i18n → api-client → hooks (providers→stores→queries→services→hooks lẻ) → ui → utils.

## E.1 — `packages/shared-types/src/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `index.ts` (425 dòng) | ~15 domain interfaces + enums | ApiResponse{data, meta}; các kiểu Pick<> rút gọn cho list view |

## E.2 — `packages/shared-i18n/src/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `index.ts` (162 dòng) | SUPPORTED_LOCALES ['vi','en'], API_ERROR_CODES 160+ mã | Backend trả code → frontend `t('apiErrors.' + code)` |

## E.3 — `packages/shared-api-client/src/` ⭐

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `client.ts` (205 dòng) | ApiClient singleton | **Đọc từng dòng.** accessToken giữ trong memory; mọi request gắn Bearer; 401 → tryRefresh(): cờ `isRefreshing` + `refreshPromise` để N request 401 đồng thời chỉ gọi /auth/refresh đúng 1 lần, các request khác await chung promise rồi retry; refresh fail → handleLogout() → redirect /login; portal scoping (?portal=student/management); streamFetch() cho SSE |
| `query-keys.ts` (85 dòng) | Query key factory | Mảng phân cấp ['courses', id, 'reviews'] — nền tảng invalidation |
| `index.ts` | Re-export | — |

## E.4 — `packages/shared-hooks/src/providers/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `auth-provider.tsx` (73 dòng) | Khôi phục session khi mount | useRef chống chạy 2 lần; có user trong sessionStorage nhưng thiếu accessToken → gọi /auth/refresh (cookie httpOnly tự gửi); wire apiClient.onRefresh/onLogout; guest thuần → bỏ qua |

## E.5 — `packages/shared-hooks/src/stores/` (Zustand)

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `auth-store.ts` (72 dòng) | user + accessToken | **Persist sessionStorage key 'sslm-auth' (tab-scoped — mở tab mới là chưa đăng nhập, by design)**; setAuth đồng bộ token sang apiClient |
| `cart-store.ts` (101 dòng) | Giỏ local | Persist localStorage 'sslm-cart'; dedup theo courseId+chapterId; listener 'storage' sync giữa các tab; merge lên server sau login |
| `chat-windows-store.ts` (55 dòng) | Cửa sổ chat nổi | Memory-only; MAX_OPEN_WINDOWS=2; **reset khi đổi user (chống leak giữa account)** |
| `sidebar-store.ts` (32 dòng) | Sidebar collapsed | Persist localStorage 'sslm-sidebar' |
| `ui-store.ts` (29 dòng) | UI flags | Memory-only |

## E.6 — `packages/shared-hooks/src/services/` (32 file — Layer gọi API thuần)

Pattern chung: hàm thuần gọi `apiClient.get/post/patch/delete`, trả `Promise<ApiResponse<T>>`, không dính React. Đọc kỹ 5 file đầu, còn lại lướt biết surface:

| File | Surface chính |
|------|--------------|
| ⭐ `auth.service.ts` | login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, logout |
| ⭐ `course.service.ts` | browse, getBySlug, reviews CRUD, instructor course CRUD, submitForReview |
| ⭐ `learning.service.ts` | getLesson, updateProgress, completeLesson, getCourseProgress, submitQuiz, getStreak, getDashboard |
| ⭐ `order.service.ts` | createOrder, getOrders, getOrderDetail, getOrderStatus |
| ⭐ `ai-tutor.service.ts` | getQuota, getSessions, getSessionMessages, **askStream (SSE)**, indexCourse |
| `admin.service.ts` (113 dòng) | Lớn nhất: dashboard, users, applications, courses, withdrawals, categories, tags, commissions, reports |
| `user.service.ts` · `instructor.service.ts` · `cart.service.ts` · `wishlist.service.ts` · `enrollment.service.ts` · `section.service.ts` · `chapter.service.ts` · `lesson.service.ts` · `quiz.service.ts` · `notification.service.ts` · `social.service.ts` · `group.service.ts` · `qna.service.ts` · `chat.service.ts` · `coupon.service.ts` · `withdrawal.service.ts` · `certificate.service.ts` · `recommendation.service.ts` · `placement.service.ts` · `question-bank.service.ts` · `upload.service.ts` · `category.service.ts` · `tag.service.ts` · `report.service.ts` · `platform-settings.service.ts` · `index.ts` | Mỗi file 1 domain, đối chiếu 1-1 với controller backend tương ứng |

## E.7 — `packages/shared-hooks/src/queries/` (30 file, 2.662 dòng — TanStack Query)

Pattern: useQuery (queryKey từ factory) + useMutation (onSuccess → invalidateQueries). Đọc kỹ 6 file đầu:

| File | Điểm cần nắm |
|------|--------------|
| ⭐ `use-auth.ts` | useLogin onSuccess → setAuth(user, token) vào store |
| ⭐ `use-learning.ts` | useUpdateProgress fire-and-forget (KHÔNG invalidate — tránh re-render player); useLesson không retry khi LESSON_ACCESS_DENIED |
| ⭐ `use-cart.ts` | useServerCart chỉ chạy khi đã auth; useMergeCart sync local→server |
| ⭐ `use-orders.ts` | useOrderStatus polling: refetchInterval trả 5000 khi PENDING, false khi kết thúc |
| ⭐ `use-chat.ts` | useMessages = useInfiniteQuery (limit 30, getNextPageParam check totalPages) |
| ⭐ `use-notifications.ts` | useInfiniteNotifications + mark read mutations |
| `use-courses.ts` · `use-admin.ts` (30+ mutations) · `use-instructor.ts` · `use-enrollments.ts` · `use-sections.ts` · `use-chapters.ts` · `use-lessons.ts` · `use-quiz.ts` · `use-wishlist.ts` · `use-coupons.ts` · `use-withdrawals.ts` · `use-qna.ts` · `use-ai-tutor.ts` · `use-social.ts` · `use-groups.ts` · `use-users.ts` · `use-categories.ts` · `use-tags.ts` · `use-question-banks.ts` · `use-recommendations.ts` · `use-platform-settings.ts` · `use-placement.ts` · `use-certificates.ts` · `use-reports.ts` | Mỗi domain 1 file; chú ý chuỗi invalidation của mutation |

## E.8 — `packages/shared-hooks/src/` hooks lẻ

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `use-chat-socket.ts` (120 dòng) | Socket.IO /chat | io(url, {auth:{token}}); emit send_message/typing/mark_read; on new_message → invalidate conversations+messages |
| ⭐ `use-notification-socket.ts` (48 dòng) | Socket.IO /notifications | on 'notification' → invalidate + toast; on 'unread_count' → setQueryData badge |
| ⭐ `use-ai-tutor-chat.ts` (225 dòng) | SSE chat loop | askStream → reader+TextDecoder → parse từng dòng `data:` → switch start/token/done/error; optimistic user message; giữ activeSessionId; đổi courseId → reset |
| `use-auth-hydrated.ts` (17 dòng) | Chờ Zustand hydrate | useSyncExternalStore — tránh flash logout |
| `use-api-error.ts` (46 dòng) | Map lỗi → i18n key | apiErrors.{CODE} |
| `use-debounce.ts` · `use-media-query.ts` · `use-infinite-scroll.ts` (IntersectionObserver) · `use-file-proxy.ts` (proxy file qua backend → blob URL) | Tiện ích | — |
| `index.ts` (350 dòng) | Master export 3 layer | Entry point @shared/hooks |

## E.9 — `packages/shared-ui/src/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| 16 primitives: `avatar/badge/button/card/dialog/dropdown-menu/input/label/progress/select/separator/sheet/skeleton/table/tabs/textarea.tsx` | shadcn/ui trên Radix | Đọc lướt — wrapper mỏng |
| ⭐ `theme-toggle.tsx` | Đổi light/dark/system | requestAnimationFrame tắt transition khi đổi theme |
| ⭐ `file-viewer.tsx` | Xem PDF/ảnh/text/Google Docs | resolveViewerType(); Google Docs Viewer iframe cho docx; mode inline/modal |
| `chat/types.ts` | Kiểu + helper | normalizeParticipants, getConversationDisplayName |
| ⭐ `chat/chat-popover.tsx` (167 dòng) | Popover danh sách hội thoại | Badge unread; click → openWindow |
| ⭐ `chat/floating-chat-window.tsx` (366 dòng) | 1 cửa sổ chat nổi | Infinite scroll lên trên (giữ scrollHeight); optimistic append; mark read khi focus |
| ⭐ `chat/floating-chat-windows.tsx` | Container N cửa sổ | useChatSocket tập trung; typingUsers Map; **reset openWindows khi đổi user** |
| `chat/chat-popover-item.tsx` · `chat/floating-chat-input.tsx` (debounce typing 150ms) · `chat/floating-chat-message.tsx` · `chat/index.ts` | Phần tử con | — |
| `lib/utils.ts` | cn() = clsx + twMerge | — |
| `index.ts` (76 dòng) | Master export | — |

## E.10 — `packages/shared-utils/src/`

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `index.ts` (81 dòng) | formatPrice (VND Intl), formatDate, formatDuration, formatRelativeTime, isApiError, getErrorMessageKey | Dùng Intl thay vì toLocaleString thô |

---

# PHẦN F — GIAI ĐOẠN 4: Student Portal (~6–7h)

## F.1 — Foundation

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| ⭐ `apps/student-portal/src/middleware.ts` | next-intl middleware | localePrefix 'as-needed': /courses = vi, /en/courses = en |
| `src/i18n/routing.ts` / `request.ts` / `navigation.ts` | Cấu hình i18n | defineRouting; lazy-load messages/{locale}.json; Link/useRouter locale-aware |
| `src/app/layout.tsx` (Server) | Root layout | Fonts Inter + JetBrains Mono, suppressHydrationWarning |
| ⭐ `src/app/[locale]/layout.tsx` (Server) | Provider stack | NextIntlClientProvider → QueryProvider → AuthProvider → ThemeProvider → Toaster; validate locale → notFound() |
| `src/app/[locale]/error.tsx` / `loading.tsx` / `not-found.tsx` | Error boundary + skeleton + 404 | — |
| `src/providers/query-provider.tsx` | QueryClient | staleTime 60s, gcTime 300s, retry 1 |
| `src/providers/auth-provider.tsx` | Re-export @shared/hooks | — |
| `src/components/providers/socket-provider.tsx` | Bật notification + chat socket | Component rỗng, chỉ gọi hooks |
| `src/lib/cloudinary.ts` | XHR upload + progress | Trả secure_url |
| `src/lib/utils.ts` | Re-export cn | — |
| `src/lib/validations/auth.ts` | Zod schemas auth | Khớp regex backend |
| `src/lib/mock-data.ts` (1.119 dòng) | Mock + type cũ | Chỉ đọc lướt — legacy |
| `messages/vi.json` + `en.json` (1.009 dòng mỗi file) | ~50 namespace | Cấu trúc mirror nhau |

> **Phát hiện khi audit:** có thư mục rác `src/app/[locale]/\(main\)/` (tên chứa backslash) chỉ chứa thư mục `social/` rỗng — nên xóa, không ảnh hưởng runtime.

## F.2 — Routes theo route group

### (auth) — public
| URL | File | Điểm cần nắm |
|-----|------|--------------|
| /login | ⭐ `(auth)/login/page.tsx` | RHF + Zod; **xử lý ?ott= → POST /auth/ott/validate → auto login** |
| /register | `(auth)/register/page.tsx` | Password strength meter 4 mức |
| /forgot-password, /reset-password, /verify-email | 3 page.tsx | verify-email có countdown resend 60s |
| /google/callback | `(auth)/google/callback/page.tsx` | Trang chờ xử lý OAuth |
| — | ⭐ `(auth)/layout.tsx` | Đã đăng nhập → redirect /; check hydration trước |

### (main) — navbar + footer
| URL | File | Điểm cần nắm |
|-----|------|--------------|
| / | ⭐ `(main)/page.tsx` (270 dòng) | Hero + categories marquee + popular/new + recommendations (chỉ khi auth) |
| /courses | ⭐ `(main)/courses/page.tsx` (228 dòng) | Filter sidebar (mobile = Sheet) + sort + pagination, **đồng bộ URL query** |
| /courses/[slug] | ⭐ `(main)/courses/[slug]/page.tsx` | Hero + curriculum + reviews + purchase card; addToCart dual local/server; ReportDialog |
| /cart | `(main)/cart/page.tsx` | Server cart (auth) fallback local store; apply coupon |
| /placement-test | `(main)/placement-test/page.tsx` | State machine: chọn category → làm bài → kết quả |
| /profile/[userId] | `(main)/profile/[userId]/page.tsx` | Follow + nhắn tin (getOrCreateConversation) |
| /qna, /qna/[questionId] | 2 page.tsx | Tab recent/unanswered; vote + best answer |
| /social | ⭐ `(main)/social/page.tsx` | Feed For You / Following, infinite scroll, 4 sidebar widgets |
| /social/groups, /social/groups/[groupId], /social/posts/[postId] | 3 page.tsx | Group detail có tab members/requests theo role |

### (main)/(protected) — bọc AuthGuard
| URL | File | Điểm cần nắm |
|-----|------|--------------|
| /my-learning | ⭐ `page.tsx` | Dashboard: active/completed + streak + next lesson |
| /my-learning/certificates | `page.tsx` | Gallery + verify link |
| /profile/edit | `page.tsx` | Avatar upload Cloudinary XHR |
| /wishlist | `page.tsx` | — |
| /checkout | ⭐ `page.tsx` | Coupon từ sessionStorage; useCreateOrder → lưu payment info sessionStorage → redirect /payment/:id |
| /orders, /orders/[orderId] | 2 page.tsx | STATUS_VARIANT badge |
| /payment/[orderId] | ⭐ `page.tsx` (200+ dòng) | **QR SePay + useCountdown 15 phút + useOrderStatus polling 5s**; 3 trạng thái pending/success/expired |
| /qna/ask | `page.tsx` | Similar questions gợi ý realtime (debounce) |
| /notifications | `page.tsx` | Infinite scroll + filter unread |
| /settings | `page.tsx` | 3 tab: password / notification prefs / theme+locale |
| /become-instructor | `page.tsx` | Form nộp đơn instructor |

### (learning) + (fullscreen)
| URL | File | Điểm cần nắm |
|-----|------|--------------|
| — | `(learning)/layout.tsx` | AuthGuard + header tối giản + portal slot #learning-header-slot |
| /courses/[slug]/lessons/[lessonId] | ⭐ `page.tsx` (472 dòng — file FE phức tạp nhất) | Điều phối 4 loại player theo lesson.type; flatten curriculum để prev/next; mobile sidebar overlay; AiTutorLauncher |
| /ai-tutor | ⭐ `(fullscreen)/ai-tutor/page.tsx` | Chọn course → session → chat streaming + quota |
| /chat | ⭐ `(fullscreen)/chat/page.tsx` | ConversationList + MessagePanel; ?id= mở thẳng hội thoại |

## F.3 — Components (77 file)

| Nhóm | Files | Điểm cần nắm |
|------|-------|--------------|
| ⭐ `components/learning/` (8) | `video-player.tsx` (track watchedSegments, **flush server mỗi 10s**, resume lastPosition) · `quiz-player.tsx` (state machine READY→TAKING→SUBMITTED→HISTORY) · `text-viewer.tsx` (nút mark complete) · `file-lesson-viewer.tsx` · `curriculum-sidebar.tsx` (cây 3 cấp + checkmark) · `lesson-nav.tsx` · `ai-tutor-launcher.tsx` · `ai-tutor-widget.tsx` (widget inline, commit 85a8738) | Trọng tâm: cách video progress chống tua + quiz không lộ đáp án |
| ⭐ `components/ai-tutor/` (6) | `chat-panel.tsx` · `ai-tutor-messages.tsx` · `chat-message.tsx` · `markdown-renderer.tsx` (react-markdown) · `session-sidebar.tsx` (quota bar) · `streaming-indicator.tsx` | Render token streaming tăng dần |
| `components/chat/` (8) | `message-panel.tsx` · `conversation-list.tsx` · `message-item.tsx` · `message-input.tsx` · `conversation-item.tsx` · `typing-indicator.tsx` · `new-group-dialog.tsx` · `user-search-item.tsx` | Realtime + optimistic |
| `components/course/` (12) | `course-card.tsx` · `course-grid.tsx` · `course-filters.tsx` · `pagination.tsx` · `price-display.tsx` · `recommendation-section.tsx` · `detail/course-hero.tsx` · `detail/course-curriculum.tsx` · `detail/course-reviews.tsx` · `detail/purchase-card.tsx` (nút đổi theo trạng thái enroll) · `detail/course-detail-skeleton.tsx` · `detail/types.ts` | — |
| `components/social/` (19) | `post-card.tsx` · `post-composer.tsx` · `post-actions.tsx` · `comment-section.tsx` · `comment-item.tsx` · `post-detail-modal.tsx` · `share-dialog.tsx` · `group-card.tsx` · `group-header.tsx` · `group-posts-tab.tsx` · `group-members-tab.tsx` · `group-requests-tab.tsx` · `group-settings-modal.tsx` · `create-group-dialog.tsx` · `groups-sidebar.tsx` · `trending-sidebar.tsx` · `suggestions-sidebar.tsx` · `quick-links-sidebar.tsx` + index | Group tabs hiện theo role |
| `components/navigation/` (6) | ⭐ `navbar.tsx` · `sidebar.tsx` · `mobile-nav.tsx` · `footer.tsx` · `search-dialog.tsx` (Cmd+K) · `locale-switcher.tsx` | — |
| `components/qna/` (5) | `question-card.tsx` · `answer-card.tsx` · `answer-form.tsx` · `vote-buttons.tsx` · `code-block.tsx` | — |
| `components/placement/` (3) | `category-select.tsx` · `quiz-taking.tsx` · `test-result.tsx` | — |
| `components/notifications/` (2) | `notification-popover.tsx` · `notification-item.tsx` | Badge realtime |
| `components/feedback/` (4) | `empty-state.tsx` · `loading-overlay.tsx` · `confirm-dialog.tsx` · `report-dialog.tsx` | — |
| `components/auth/auth-guard.tsx` ⭐ | Chờ hydrate rồi mới redirect /login | Tránh false-redirect |
| `components/scroll-reveal.tsx` | Animation khi scroll | — |

---

# PHẦN G — GIAI ĐOẠN 5: Management Portal (~4–5h)

> Cấu trúc giống student-portal — đọc nhanh hơn, tập trung phần KHÁC: role check + course wizard.

## G.1 — Foundation & phân quyền

| File | Vai trò | Điểm cần nắm |
|------|---------|--------------|
| `src/middleware.ts` + `src/i18n/` (3 file) | i18n routing | Giống student-portal |
| `src/app/layout.tsx` + ⭐ `src/app/[locale]/layout.tsx` | Provider stack | — |
| `src/app/[locale]/page.tsx` | Root redirect theo role | ADMIN→/admin/dashboard, INSTRUCTOR→/instructor/dashboard |
| ⭐ `src/app/[locale]/(auth)/layout.tsx` | Đã login → redirect theo role | — |
| ⭐ `src/app/[locale]/(auth)/login/page.tsx` (350+ dòng) | Login + nhận OTT | Chỉ cho INSTRUCTOR/ADMIN; student bị từ chối |
| ⭐ `src/app/[locale]/admin/layout.tsx` | **Role gate phía client: role !== ADMIN → /unauthorized** | Sidebar variant admin + SocketProvider |
| ⭐ `src/app/[locale]/instructor/layout.tsx` | Role gate: INSTRUCTOR hoặc ADMIN | — |
| `src/app/[locale]/unauthorized/page.tsx` | Trang 403 + logout | — |
| `src/providers/` (2 file) + `src/components/providers/socket-provider.tsx` | Query + Auth + Socket | — |
| `src/lib/validations/course.ts` ⭐ (80 dòng) | Zod: courseBasicsSchema, quizSchema... | Refine: đúng 1 đáp án đúng/câu — khớp validate backend |
| `src/lib/validations/auth.ts` · `src/lib/cloudinary.ts` · `src/lib/utils.ts` | — | — |

> **Câu hỏi phản biện:** role check ở layout là client-side — bypass được UI nhưng KHÔNG bypass được data (mọi endpoint admin đều có @Roles(ADMIN) ở backend). Phải trả lời được ý này.

## G.2 — Instructor routes (14 trang)

| URL | File page.tsx | Điểm cần nắm |
|-----|---------------|--------------|
| /instructor/dashboard | `instructor/dashboard/` | Stats + recent earnings |
| /instructor/courses | `instructor/courses/` | Filter status, submit/delete |
| /instructor/courses/new | `instructor/courses/new/` | CourseWizard mode create |
| /instructor/courses/[courseId] | `instructor/courses/[courseId]/` | Tab overview/students |
| /instructor/courses/[courseId]/edit | `.../edit/` | CourseWizard mode edit |
| /instructor/courses/[courseId]/students | `.../students/` | Redirect ?tab=students |
| /instructor/question-banks | `instructor/question-banks/` | CRUD banks |
| /instructor/question-banks/[bankId] | ⭐ `.../[bankId]/` (750+ dòng) | Quản lý câu hỏi + tags + import text |
| /instructor/qna | `instructor/qna/` | Câu hỏi học viên + reply |
| /instructor/revenue | `instructor/revenue/` | Earnings table + per-course revenue |
| /instructor/withdrawals | ⭐ `instructor/withdrawals/` (300+ dòng) | Form rút tiền + bankInfo + history |
| /instructor/coupons, /instructor/coupons/new | 2 page | Tạo coupon scope courses |
| /instructor/settings | `instructor/settings/` | Profile + notification prefs |

## G.3 — Admin routes (15 trang)

| URL | File page.tsx | Điểm cần nắm |
|-----|---------------|--------------|
| /admin/dashboard | ⭐ `admin/dashboard/` | KPI + pending + top courses |
| /admin/approvals | `admin/approvals/` | Hub 4 loại duyệt |
| /admin/approvals/instructors | ⭐ | Approve → user thành INSTRUCTOR |
| /admin/approvals/courses | ⭐ | Approve → PUBLISHED + group + AI index |
| /admin/courses, /admin/courses/[courseId] | 2 page | Xem mọi course không cần ownership |
| /admin/categories · /admin/tags · /admin/placement-questions | 3 page | CRUD nội dung nền |
| /admin/users | `admin/users/` | Suspend/activate |
| /admin/withdrawals | ⭐ | Duyệt rút tiền |
| /admin/reports | ⭐ | Review report + preview nội dung bị báo cáo |
| /admin/analytics | `admin/analytics/` | Chart 7/30/90/365 ngày |
| /admin/ai-indexing | `admin/ai-indexing/` | Trạng thái index + bulk index |
| /admin/settings | `admin/settings/` | Platform settings + commission tiers |

## G.4 — Components

| Nhóm | Files | Điểm cần nắm |
|------|-------|--------------|
| ⭐ `components/courses/wizard/` (10) | `course-wizard.tsx` (310 dòng — orchestrator 4 bước: Basics→Curriculum→Pricing→Review, state LocalSection[]) · `step-basics.tsx` · `step-curriculum.tsx` (cây CRUD section/chapter/lesson) · `step-pricing.tsx` (giá course + giá chương + free preview) · `step-review.tsx` (checklist validate → submit) · `lesson-dialog.tsx` (tab VIDEO/TEXT/FILE/QUIZ) · `quiz-builder.tsx` · `tag-selector.tsx` · `import-quiz-dialog.tsx` · `import-from-bank-dialog.tsx` | Luồng tạo khóa học hoàn chỉnh — hội đồng hay yêu cầu demo |
| `components/courses/detail/` (5) | `course-curriculum.tsx` · `course-info-card.tsx` · `course-stats.tsx` · ⭐ `course-students-tab.tsx` (mode instructor/admin → query khác nhau) · `lesson-detail-dialog.tsx` | — |
| `components/courses/` (4) | `video-upload.tsx` (max 500MB, progress) · `image-upload.tsx` · `file-upload.tsx` · `rich-text-editor.tsx` (Tiptap) | — |
| `components/data-display/` (4) | ⭐ `data-table.tsx` (server/client mode) · `stat-card.tsx` · `status-badge.tsx` · `chart-widget.tsx` (Recharts) | — |
| `components/navigation/` (4) | ⭐ `sidebar.tsx` (2 nav tree instructor/admin) · `header.tsx` · `breadcrumb.tsx` · `locale-switcher.tsx` | — |
| Còn lại | `feedback/confirm-dialog.tsx` · `notifications/` (2) · `placement/import-text-dialog.tsx` · `question-banks/import-bank-text-dialog.tsx` · `auth/desktop-guard.tsx` · `theme-toggle.tsx` | — |

---

# PHẦN H — GIAI ĐOẠN 6: 11 LUỒNG NGHIỆP VỤ END-TO-END (~8–10h) ⭐⭐⭐

> Phần quan trọng nhất cho phản biện. Với mỗi luồng: tự trace lại theo quy trình A.3, vẽ sequence diagram, học thuộc "Điểm phản biện".

## H.1 — Mua khóa học (paid + free)

```
 1. [FE]  (main)/courses/[slug]/page.tsx — nút mua → useAddCartItem → POST /cart/items (giá lấy lại từ DB)
 2. [FE]  (protected)/checkout/page.tsx — useCreateOrder (couponCode từ sessionStorage)
 3. [API] OrdersController.createOrder → OrdersService.createOrder
 4. [API]   CouponsService.validateAndCalculateDiscount (6 cổng) → distributeDiscount chia theo từng item
 5. [DB]    $transaction: create Order (orderCode SSLM+ts, expiresAt=now+15') + OrderItems + CouponUsage + xóa CartItems
 6. [API]   finalAmount = 0 → fulfillOrder NGAY (free flow, bỏ QR) / > 0 → trả payment info (VietQR từ bankId+account+amount+orderCode)
 7. [FE]  redirect /payment/[orderId] — hiện QR + useCountdown 15' + useOrderStatus polling 5s
 8. [EXT] User chuyển khoản → SePay bắn webhook
 9. [API] WebhooksController POST /webhooks/sepay (@Public) — verify 'Authorization: Apikey <key>' → regex /SSLM\d{13}/ lấy orderCode → check transferAmount ≥ finalAmount
10. [API] OrderFulfillmentService.fulfillOrder — $transaction:
      updateMany WHERE id=? AND status='PENDING' → COMPLETED (count=0 → return sớm, IDEMPOTENT — commit 37b2398)
      upsert Enrollment (FULL/PARTIAL) + increment Course.totalStudents
      tạo Earning/item (commissionRate theo CommissionTier, netAmount, status PENDING, availableAt=now+hold)
      increment InstructorProfile.totalRevenue
      queue: ORDER_COMPLETED (buyer) + COURSE_ENROLLED (instructor) + email receipt
      GroupsService.addMemberByCourseId — tự vào group khóa học
11. [FE]  polling thấy COMPLETED → success card → /my-learning
```
**Bảng DB:** Order, OrderItem, CartItem, Coupon, CouponUsage, Enrollment, Earning, InstructorProfile, Notification.

**Điểm phản biện:**
- *Webhook bắn 2 lần thì sao?* → guarded `updateMany ... status='PENDING'`, lần 2 count=0 → return sớm, không double-enroll/double-earning.
- *Webhook và cron expire chạy đua?* → cả 2 đều guard theo status PENDING; chỉ 1 bên thắng. Nếu cron expire trước khi tiền tới: webhook không tìm thấy order PENDING → bỏ qua im lặng (hạn chế đã biết — xem I.3).
- *Sao tin được webhook?* → verify API key header; check số tiền ≥ finalAmount; orderCode unique từ nội dung CK.
- *Giá có tin frontend không?* → không; cart và order đều re-validate giá từ DB.
- *Free order (coupon 100%)?* → fulfillOrder gọi NGOÀI transaction tạo order; nếu fulfill fail thì order kẹt PENDING (hạn chế đã biết — xem I.3).

## H.2 — Order hết hạn (cron)

```
1. [Cron] CronService.expirePendingOrders @Cron('*/20 * * * *')
2. [DB]   findMany WHERE status='PENDING' AND expiresAt < now
3. [DB]   updateMany (guard status='PENDING') → EXPIRED
4. [Queue] addNotification ORDER_EXPIRED cho từng user
5. [FE]   polling /orders/:id/status thấy EXPIRED (hoặc countdown local về 0) → hiện expired card
```
**Điểm phản biện:** vì sao 20 phút/lần thay vì 1 phút (→ tiết kiệm compute Neon, đơn có thể trễ tối đa ~20' mới flip — chấp nhận được vì FE đã có countdown local 15'); notification có thể gửi trùng nếu cron chạy đè (hạn chế nhỏ — I.3).

## H.3 — Instructor rút tiền

```
1. [FE-mgmt] /instructor/withdrawals — form amount + bankInfo → useRequestWithdrawal
2. [API] WithdrawalsService.requestWithdrawal — check minimum (PlatformSettings 50.000đ)
3. [DB]  $transaction:
     (a) có Withdrawal PENDING → ConflictException
     (b) updateMany InstructorProfile WHERE userId=? AND availableBalance >= amount → decrement (commit 05018a4)
     (c) count=0 → INSUFFICIENT_BALANCE
     (d) create Withdrawal PENDING
4. [Queue] addAdminNotification WITHDRAWAL_PENDING
5. [FE-mgmt] /admin/withdrawals — admin duyệt → PATCH
6. [API] AdminWithdrawalsService.processWithdrawal — $transaction:
     COMPLETED → loop Earning AVAILABLE oldest-first, mark WITHDRAWN đến đủ amount
     REJECTED  → hoàn lại availableBalance
7. [Queue] WITHDRAWAL_COMPLETED / WITHDRAWAL_REJECTED → instructor
```
**Liên quan:** Earning sinh từ H.1 với status PENDING + availableAt; cron releaseAvailableEarnings (*/30) chuyển PENDING→AVAILABLE — **hold period chống rút tiền từ đơn vừa thanh toán (phòng refund)**.

**Điểm phản biện:** 2 request rút đồng thời → row lock + điều kiện `availableBalance >= amount` trong UPDATE → không thể âm; trước commit 05018a4 là check-then-write (TOCTOU) — kể được câu chuyện bug→fix này rất ăn điểm.

## H.4 — Hoàn thành bài học → certificate

```
1. [FE] video-player.tsx — gom watchedSegments, flush 10s/lần → useUpdateProgress (fire-and-forget)
2. [API] ProgressService.updateLessonProgress — mergeSegments (gộp khoảng chồng lấn, chống tua) → watchedPercent
3. [API] watchedPercent ≥ 0.8 (LESSON_COMPLETE_THRESHOLD) → isCompleted=true (never un-complete)
4. [API] recalculateEnrollmentProgress: completed/accessible (PARTIAL chỉ đếm chapter đã mua) → Enrollment.progress
5. [API] progress=100% AND type=FULL → CertificatesService.generateCertificate (idempotent, verifyCode unique)
6. [API] trackDailyActivity → streak
7. [FE] /my-learning/certificates — xem; GET /certificates/verify/:code (@Public) — ai cũng verify được
```
**Điểm phản biện:** chống gian lận tua video bằng watchedSegments thay vì chỉ currentTime; TEXT lesson = nút complete thủ công; PARTIAL không bao giờ có certificate.

## H.5 — Làm quiz

```
1. [FE] quiz-player.tsx — quiz data KHÔNG chứa isCorrect (server lọc ở course-player) → user chọn đáp án → useSubmitQuiz
2. [API] QuizAttemptsService.submitQuiz: verify enrollment → check maxAttempts → CHẤM SERVER-SIDE (so selectedOptionId với option đúng)
3. [API] score = correct/total; passed = score ≥ passingScore (normalize >1 thì /100)
4. [DB]  create QuizAttempt + QuizAnswer[] chi tiết
5. [API] passed → mark lesson complete → recalc progress (→ có thể trigger certificate H.4)
6. [FE]  hiện kết quả từng câu + explanation + nút retake (nếu còn lượt)
```
**Điểm phản biện:** client không bao giờ thấy đáp án đúng trước khi nộp; timeLimitSeconds hiện chỉ enforce ở FE (hạn chế — I.3).

## H.6 — Login + refresh token + auto-refresh 401

```
1. [FE] login/page.tsx → useLogin → POST /auth/login (credentials include)
2. [API] AuthService.login: bcrypt.compare → chặn SUSPENDED → accessToken JWT 15' + refreshToken UUID lưu DB 7d
3. [API] Set-Cookie rt_student (httpOnly, sameSite lax, path /api/auth)
4. [FE] setAuth → user+accessToken vào Zustand (persist sessionStorage); token cũng giữ trong ApiClient memory
5. ... request bình thường gắn Bearer ...
6. [FE] response 401 → ApiClient.tryRefresh: cờ isRefreshing + refreshPromise → N request 401 chỉ refresh 1 LẦN, còn lại await chung
7. [API] AuthController.refresh: đọc cookie → validate token DB chưa hết hạn → XÓA token cũ + tạo mới (ROTATION) → set cookie mới
8. [FE] retry các request đã queue với token mới; refresh fail → logout + redirect /login
9. [FE] AuthProvider mount: có user trong sessionStorage mà thiếu token → tự gọi refresh khôi phục session
```
**Điểm phản biện:** vì sao access token KHÔNG để localStorage (XSS đọc được; sessionStorage cũng đọc được nhưng tab-scoped + TTL 15' giảm thiệt hại; refresh token mới là chìa khóa dài hạn thì httpOnly — XSS không đọc được); vì sao rotation (token bị trộm dùng lại sẽ thất bại / phát hiện được); trade-off "mở tab mới phải đăng nhập lại" là chủ đích (session per tab).

## H.7 — OTT cross-portal

```
1. [FE-A] user bấm "sang portal kia" → GET /auth/ott (cần JWT) → {ott: uuid}
2. [API] Redis SET ott:{uuid} = userId, TTL 60 GIÂY
3. [FE-A] window.location = portalB + '/login?ott=...'
4. [FE-B] login page useEffect thấy ?ott → POST /auth/ott/validate?portal=B (public)
5. [API] Redis GET + DEL ngay (one-time) → cấp accessToken + refreshToken mới + cookie rt_B
6. [FE-B] setAuth → redirect trang chính
```
**Điểm phản biện:** vì sao không share cookie giữa 2 portal (khác origin/port → cookie không share được; OTT là cầu nối an toàn); chống replay = TTL 60s + xóa ngay sau dùng; entropy UUID v4 đủ chống brute-force trong 60s.

## H.8 — AI Tutor (indexing + RAG chat streaming)

```
INDEXING (admin duyệt khóa / cron 5:00 / admin bấm tay):
1. [API] EmbeddingsService.indexCourseContent — đọc cả cây course (title/desc/outcomes/textContent/quiz/file)
2. [API] FILE lesson: TextExtractionService.extract (mammoth cho docx, utf-8 cho txt/md) → cache lesson.fileExtractedText
3. [API] stripHtml → chunkText(500 ký tự, overlap 50)
4. [API] generateEmbedding TỪNG CHUNK — model LOCAL @xenova/transformers 'Xenova/all-MiniLM-L6-v2' → vector 384 chiều
5. [DB]  INSERT course_chunks (content, embedding::vector) — raw SQL pgvector

CHAT:
1. [FE] ai-tutor page / ai-tutor-widget (inline trong learning) → useAiTutorChat.send → aiTutorService.askStream
2. [FE] ApiClient.streamFetch — POST /ai/tutor/ask-stream (SSE)
3. [API] AiTutorService.askQuestionStream (AsyncGenerator):
     rate limit Redis 10 câu/ngày → check ENROLLMENT → get/create AiChatSession
     yield {type:'start', sessionId}
     embed câu hỏi → SELECT content, 1-(embedding <=> $vec) AS similarity FROM course_chunks WHERE course_id=? ORDER BY embedding <=> $vec LIMIT 5
     prompt = system + context 5 chunks + 10 message gần nhất + câu hỏi
     Groq llama-3.3-70b-versatile stream:true → yield {type:'token', content} từng chunk
     lưu AiChatMessage USER + ASSISTANT → yield {type:'done'}
4. [FE] reader + TextDecoder parse từng dòng 'data:' → append streamingContent → markdown render tăng dần
```
**Điểm phản biện:** vì sao embedding chạy local thay vì gọi API (Groq KHÔNG có embedding API; local = miễn phí, không rate limit, 384 chiều đủ cho ngữ nghĩa đoạn ngắn); vì sao chunk 500/overlap 50 (chunk nhỏ → kết quả truy hồi sát câu hỏi, overlap tránh cắt giữa câu); vì sao SSE thay vì WebSocket cho AI (một chiều server→client, HTTP thuần, đơn giản hơn; chat người-người mới cần 2 chiều → socket); RAG giúp trả lời theo ĐÚNG nội dung khóa học thay vì kiến thức chung của LLM.

## H.9 — Realtime notification

```
1. [API] Bất kỳ service nào → queue.addNotification(userId, type, data)  (fire-and-forget)
2. [Queue] BullMQ 'notification' → NotificationProcessor: check preference (Redis cache 5') / ALWAYS_DELIVER bỏ qua check
3. [API] NotificationsService.create → INSERT notifications
4. [WS]  NotificationsGateway: server.to('user_'+userId).emit('notification', ...) + emit('unread_count', ...)
5. [FE]  useNotificationSocket: on 'notification' → invalidate + toast Sonner; on 'unread_count' → setQueryData badge
```
**Điểm phản biện:** vì sao qua queue thay vì gửi trực tiếp (không block request chính, retry được, hấp thụ burst); socket auth bằng JWT lúc handshake, mỗi user 1 room → không nhận notification người khác; user offline vẫn có bản ghi DB, mở app đọc lại sau.

## H.10 — Chat 1-1

```
1. [FE] profile/[userId] → "Nhắn tin" → useGetOrCreateConversation (idempotent với 1-1)
2. [FE] mở (fullscreen)/chat hoặc floating window — load lịch sử REST GET /chat/conversations/:id/messages (infinite, 30/trang)
3. [WS] useChatSocket connect /chat (auth token) → server join user_{id} + Redis online:{id} TTL 300s
4. [WS] emit join_conversation (server verify membership) → join room conv_{id}
5. [WS] emit send_message → ChatService.sendMessage (verify membership, INSERT, touch conversation.updatedAt)
6. [WS] server emit new_message → room conv_{id}; emit new_message_notification → user_{id} của member không mở room
7. [WS] typing/stop_typing broadcast; mark_read → update lastReadAt → emit message_read
8. [FE] on new_message → invalidate messages+conversations; unread = đếm message sau lastReadAt
```
**Điểm phản biện:** REST cho lịch sử + socket cho realtime (phân vai rõ); online status TTL 300s nghĩa là crash sau tối đa 5' mới hiện offline (trade-off); floating chat windows reset khi đổi user (chống leak state giữa account).

## H.11 — Upload video lesson

```
1. [FE-mgmt] lesson-dialog → video-upload.tsx — chọn file (≤500MB)
2. [FE] POST /uploads/sign {type:VIDEO, lessonId} → server verify QUYỀN SỞ HỮU lesson
3. [API] MediaService.signAndCreatePending: create Media status=UPLOADING + Cloudinary api_sign_request → {timestamp, signature, folder, apiKey}
4. [FE] upload THẲNG lên Cloudinary bằng signed params (KHÔNG đi qua backend — tiết kiệm băng thông server)
5. [EXT] Cloudinary xử lý → trả {publicId, secureUrl, duration, bytes, format}
6. [FE] POST /uploads/:mediaId/complete {cloudinaryResult}
7. [API] MediaService.completeUpload: Media → READY + lesson.estimatedDuration = duration + recalculate cascade lesson→chapter→course
8. [FE-student] player đọc lesson.videoUrl ?? media[type=VIDEO].url — HTML5 video stream từ Cloudinary
```
**Điểm phản biện:** vì sao signed upload thay vì upload qua backend (file 500MB sẽ nghẽn Render free tier; signature ký bằng apiSecret chỉ backend có → client không tự ý upload bừa); media kẹt UPLOADING quá 24h bị cron cleanupFailedUploads dọn.

---

# PHẦN I — GIAI ĐOẠN 7: Chuẩn bị phản biện (~3–4h)

## I.1 — Câu hỏi "tại sao X mà không phải Y" (chuẩn bị sẵn câu trả lời)

| Câu hỏi | Ý trả lời |
|---------|-----------|
| Tại sao monorepo Turborepo? | 2 portal + API share types/hooks/ui → đổi 1 type compile-check cả 3 app; build cache |
| Tại sao 2 portal thay vì 1 app? | Tách concern student vs instructor/admin; deploy/scale độc lập; bundle nhỏ hơn |
| Tại sao NestJS? | Module/DI rõ ràng, guard/interceptor/pipe chuẩn hóa cross-cutting concerns, hợp codebase lớn |
| Tại sao Prisma? | Type-safe tới tận query, migration history, đổi schema là FE/BE cùng biết qua generated types |
| Tại sao access token memory + refresh httpOnly cookie? | Xem H.6 — cân bằng XSS vs CSRF |
| Tại sao refresh token lưu DB không phải JWT? | Revoke được, rotation, phát hiện token bị trộm |
| Tại sao backend trả error CODE không trả message? | i18n ở frontend; backend không biết locale của user |
| Tại sao TanStack Query + Zustand tách bạch? | Server state có vòng đời riêng (stale/refetch/invalidate); Zustand chỉ giữ UI state + token |
| Tại sao feed fanout-on-write (FeedItem) thay vì query-on-read? | Đọc feed = 1 query theo index (userId, createdAt); trả giá bằng ghi nhiều khi post — hợp read-heavy |
| Tại sao denormalized counters? | Tránh COUNT(*) mỗi request trên free tier; sai lệch được cron reconcile hàng tuần |
| Tại sao embedding local 384-dim thay vì OpenAI/API? | Miễn phí, không rate limit, đủ chất lượng cho retrieval đoạn ngắn (xem H.8) |
| Tại sao SSE cho AI mà socket cho chat? | Xem H.8 |
| Tại sao signed direct upload Cloudinary? | Xem H.11 |
| Tại sao soft delete? | Khôi phục được, giữ toàn vẹn tham chiếu (order item trỏ course đã "xóa"), audit |
| Tại sao cron interval thưa (20'/30')? | Neon tính compute theo thời gian thức; đã giảm ~110 CU → ~8-10 CU/tháng |
| Tại sao db push thay vì migrate? | Quy trình dev nhanh trên Neon; trade-off: mất migration history chuẩn (thành thật nếu bị hỏi) |

## I.2 — Điểm yếu ĐÃ fix (kể được câu chuyện bug → fix là điểm cộng lớn)

| Commit | Bug cũ | Cách fix |
|--------|--------|----------|
| `05018a4` | Rút tiền check-then-write: 2 request đồng thời cùng đọc balance đủ → cả 2 trừ → âm tiền | Debit bằng `updateMany WHERE availableBalance >= amount` TRONG transaction — row lock serialize |
| `37b2398` | Webhook SePay bắn trùng → fulfill 2 lần (double enrollment + double earning) | Guarded status transition `WHERE status='PENDING'`, count=0 → return sớm |
| `90cec04` | IDOR: ai cũng POST được bài vào group PRIVATE | Check GroupMember trước khi tạo post trong group |

Đọc diff 3 commit này: `git show 05018a4`, `git show 37b2398`, `git show 90cec04`.

## I.3 — Hạn chế còn tồn tại (chuẩn bị câu trả lời chủ động, đừng để bị "bắt bài")

| Hạn chế | Câu trả lời gợi ý |
|---------|-------------------|
| Tiền dùng Float thay vì Decimal | VND không có phần thập phân trong thực tế sử dụng; mọi phép tính làm tròn Math.round; hướng cải tiến: Prisma Decimal |
| Tiền chuyển khoản đến SAU khi order đã EXPIRED → webhook bỏ qua im lặng | Đã giới hạn rủi ro bằng countdown 15' trên FE; hướng cải tiến: webhook xử lý case EXPIRED → tự re-complete hoặc tạo ticket hoàn tiền |
| Free order: fulfillOrder ngoài transaction tạo order — fail thì kẹt PENDING | Xác suất thấp (không có external call); hướng cải tiến: retry job |
| Refresh KHÔNG check SUSPENDED → user bị khóa vẫn refresh được đến khi access token hết | Cửa sổ tối đa 15'; hướng cải tiến: check status trong AuthService.refresh |
| Coupon usageLimit có race nhỏ (2 request validate đồng thời cùng pass) | Hệ quả chỉ là vượt limit 1 lần, không mất tiền; hướng cải tiến: SELECT FOR UPDATE |
| Quiz timeLimitSeconds chỉ enforce phía FE | Hướng cải tiến: server so endedAt - startedAt |
| Notification ORDER_EXPIRED có thể gửi trùng nếu cron chạy đè | Vô hại về dữ liệu; hướng cải tiến: gửi theo kết quả updateMany |
| Role gate ở management-portal là client-side | Mọi endpoint đều có @Roles ở backend — UI chỉ là tiện dụng, data luôn được bảo vệ |
| AI quota check chưa atomic tuyệt đối | checkRateLimit dùng INCR Redis là atomic; lệch tối đa 1 câu trong race hiếm |

## I.4 — Bộ luồng phải vẽ được lên bảng không nhìn tài liệu

Tối thiểu 6: **H.1 mua khóa học**, **H.3 rút tiền**, **H.6 auth/refresh**, **H.8 AI Tutor RAG**, **H.9 notification realtime**, **H.4 progress→certificate**. Luyện: vẽ → tự thuyết minh 3 phút/luồng → nhờ người khác (hoặc Claude) hỏi vặn.

---

# CHECKLIST HOÀN THÀNH

### Giai đoạn 0 — Tổng thể
- [ ] CLAUDE.md + turbo.json + docker-compose
- [ ] schema.prisma: kể tên được các model theo 8 nhóm domain + pattern chung
- [ ] Docs phase 1–4 (đọc lướt)

### Giai đoạn 1 — Backend foundation
- [ ] main.ts + app.module.ts (thứ tự guard/interceptor global)
- [ ] config/ (9 file) + constants
- [ ] guards (3) + decorators (4) + filters (2) + interceptors (3) + pipes (1) + utils (3) + dto/interfaces (4)
- [ ] prisma/ + redis/ + mail/ + health/ + uploads/
- [ ] jobs: queue.service + 3 processors + cron.service (kể được 10 cron jobs)
- [ ] bull-board + platform-settings

### Giai đoạn 2 — Backend modules (21 module)
- [ ] auth (cơ chế refresh DB rotation + OTT + cookie 2 portal)
- [ ] users (follow transaction) · categories · media (3 bước upload) · instructor
- [ ] courses: browse + management + sections + chapters + lessons + quizzes + reviews
- [ ] enrollments · cart · orders (+fulfillment +webhooks) · coupons (6 cổng) · withdrawals (race fix)
- [ ] learning: course-player (access 3 cấp) + progress (segments) + quiz-attempts + certificates + streaks + placement-tests
- [ ] qna · question-banks
- [ ] ai-tutor (embedding local 384 + pgvector + SSE) · recommendations (Wilson score)
- [ ] social (posts + groups 511 dòng + feed + comments + interactions) · chat (service + gateway) · notifications (19 loại) · reports (auto-resolve)
- [ ] admin (7 submodule)

### Giai đoạn 3 — Shared packages
- [ ] shared-types · shared-i18n (160+ error codes)
- [ ] shared-api-client/client.ts — giải thích được cơ chế 401 dedup từng dòng
- [ ] shared-hooks: auth-provider + 5 stores + 6 query hooks trọng tâm + 5 services trọng tâm + 4 hooks socket/SSE
- [ ] shared-ui: chat components (4 file chính) + file-viewer + theme-toggle
- [ ] shared-utils

### Giai đoạn 4 — Student portal
- [ ] Foundation: middleware + layouts + providers + i18n
- [ ] (auth) 6 trang · (main) 12 trang · (protected) 12 trang · (learning) + (fullscreen) 3 trang
- [ ] Components trọng tâm: video-player, quiz-player, curriculum-sidebar, ai-tutor (6), chat (8), auth-guard

### Giai đoạn 5 — Management portal
- [ ] Role gates (2 layouts) + login OTT
- [ ] Instructor 14 trang · Admin 15 trang
- [ ] Course wizard 10 file + data-table + sidebar

### Giai đoạn 6 — Luồng nghiệp vụ
- [ ] H.1 → H.11: trace + vẽ sequence diagram từng luồng
- [ ] Thuộc 6 luồng bắt buộc (I.4) mức vẽ bảng không nhìn tài liệu

### Giai đoạn 7 — Phản biện
- [ ] Trả lời trôi chảy 16 câu "tại sao" (I.1)
- [ ] Kể được 3 câu chuyện bug→fix (I.2)
- [ ] Chủ động trình bày hạn chế + hướng cải tiến (I.3)

---

## Ghi chú cá nhân

> Ghi lại trong khi đọc theo format:
```
[Ngày] [Module/File] — Điều thú vị / khó hiểu / câu hỏi cần tự trả lời
```
