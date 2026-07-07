# Phase 7.8 — BullMQ Queue Integration: Wire Queues vào Business Logic

> Wire 3 BullMQ queues (email, notification, feed) vào business logic.
> Tất cả queue calls là fire-and-forget — không block request, không gây lỗi nếu Redis fail.
> BullMQ sử dụng Redis local (`localhost:6379`), không dùng Upstash cloud.

---

## 1. Hiện trạng trước khi implement

### Infrastructure đã có

| Component | File | Status |
|-----------|------|--------|
| Queue `email` | `jobs.module.ts` | ✅ Đã đăng ký |
| Queue `notification` | `jobs.module.ts` | ✅ Đã đăng ký |
| Queue `feed` | `jobs.module.ts` | ✅ Đã đăng ký |
| EmailProcessor | `processors/email.processor.ts` | ✅ 3 job types: `verification`, `reset-password`, `order-receipt` |
| NotificationProcessor | `processors/notification.processor.ts` | ✅ Generic notification |
| FeedProcessor | `processors/feed.processor.ts` | ✅ `fanout` job với batching 1000 |
| Bull Dashboard | `bull-board.module.ts` | ✅ UI tại `/api/admin/queues` |

### Vấn đề

- Không có service nào gọi `queue.add()` → queues trống
- Email gửi sync (block request 2-5s)
- Notification fire-and-forget bằng `.catch(() => {})` — mất nếu fail
- Feed fanout sync — block request khi nhiều followers

---

## 2. Giải pháp: QueueService wrapper

### Tại sao cần wrapper?

- Notification queue dùng bởi **5 service khác nhau** → tránh lặp `@InjectQueue`
- Typed methods thay vì `queue.add('untyped-name', { untyped-data })`
- Fire-and-forget pattern tập trung — `.catch()` + log warning, không throw
- Dễ mock trong tests — mock 1 service thay vì 3 queues

### QueueService implementation

**File:** `apps/api/src/modules/jobs/queue.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    @InjectQueue('feed') private readonly feedQueue: Queue,
  ) {}

  private enqueue(queue: Queue, name: string, data: Record<string, unknown>) {
    queue.add(name, data).catch((err: Error) => {
      this.logger.warn(`Failed to enqueue ${queue.name}/${name}: ${err.message}`);
    });
  }

  addVerificationEmail(to: string, token: string) {
    this.enqueue(this.emailQueue, 'verification', { to, token });
  }

  addResetPasswordEmail(to: string, token: string) {
    this.enqueue(this.emailQueue, 'reset-password', { to, token });
  }

  addOrderReceiptEmail(to: string, orderId: string, amount: number) {
    this.enqueue(this.emailQueue, 'order-receipt', { to, orderId, amount });
  }

  addNotification(userId: string, type: string, data: Record<string, unknown>) {
    this.enqueue(this.notificationQueue, 'create', { userId, type, data });
  }

  addFeedFanout(postId: string, authorId: string, groupId?: string) {
    this.enqueue(this.feedQueue, 'fanout', { postId, authorId, groupId });
  }
}
```

**Fire-and-forget pattern:**
- Methods không `async`, không return Promise
- `queue.add()` chạy nền, `.catch()` log warning nếu fail
- Callers gọi `this.queue.addXxx()` mà không cần `await` — request không bị block

---

## 3. Thay đổi đã thực hiện

### 3a. JobsModule — export QueueService

**File:** `apps/api/src/modules/jobs/jobs.module.ts`

- Thêm `QueueService` vào `providers`
- Thêm `exports: [QueueService]`

### 3b. Email queue — AuthService (3 calls)

**File:** `apps/api/src/modules/auth/auth.service.ts`

| Line | Method | Trước | Sau |
|------|--------|-------|-----|
| 74 | `register()` | `await this.mail.sendVerificationEmail(email, token)` | `this.queue.addVerificationEmail(email, token)` |
| 215 | `resendVerification()` | `await this.mail.sendVerificationEmail(email, token)` | `this.queue.addVerificationEmail(email, token)` |
| 234 | `forgotPassword()` | `await this.mail.sendResetPasswordEmail(email, token)` | `this.queue.addResetPasswordEmail(email, token)` |

**Module:** `auth.module.ts` — import `JobsModule` thay vì không import gì (MailService trước đó là global)

### 3c. Notification queue — 5 services (7 calls)

| File | Line | Method | Type |
|------|------|--------|------|
| `comments.service.ts` | 61, 80 | `create()` | `POST_COMMENT` |
| `interactions.service.ts` | 52 | `toggleLike()` | `POST_LIKE` |
| `groups.service.ts` | 186, 384 | `join()`, `approveJoinRequest()` | `SYSTEM` |
| `users.service.ts` | 186 | `follow()` | `FOLLOW` |
| `answers.service.ts` | 59 | `create()` | `QUESTION_ANSWERED` |

**Trước:** `this.notifications.create(...).catch(() => {})`
**Sau:** `this.queue.addNotification(...)`

**Modules:** `social.module.ts`, `users.module.ts`, `qna.module.ts` — import `JobsModule` thay `NotificationsModule`

### 3d. Feed queue — PostsService (2 calls)

**File:** `apps/api/src/modules/social/posts/posts.service.ts`

| Line | Method | Trước | Sau |
|------|--------|-------|-----|
| 41 | `create()` | `await this.fanoutToFollowers(authorId, post.id, dto.groupId)` | `this.queue.addFeedFanout(post.id, authorId, dto.groupId)` |
| 134 | `share()` | `await this.fanoutToFollowers(userId, post.id)` | `this.queue.addFeedFanout(post.id, userId)` |

Method `fanoutToFollowers()` đã xoá (dead code) — FeedProcessor đã implement logic tương tự với batching 1000.

### 3e. BullMQ connection fix

**File:** `apps/api/src/app.module.ts` — trong `BullModule.forRootAsync`:

```typescript
connection: {
  host: parsed.hostname,
  port: parseInt(parsed.port || '6379', 10),
  ...(parsed.password && { password: parsed.password }),
  maxRetriesPerRequest: null,   // BullMQ bắt buộc
  enableReadyCheck: false,      // Tránh crash khi Redis restart
},
defaultJobOptions: {
  removeOnComplete: { age: 86400, count: 200 },  // Giữ 24h hoặc 200 jobs
  removeOnFail: { age: 604800, count: 500 },     // Giữ 7 ngày hoặc 500 jobs
},
```

### 3f. Test specs — 7 files updated

Tất cả spec files thay mock `MailService`/`NotificationsService` bằng mock `QueueService`:

```typescript
// Trước
{ provide: MailService, useValue: { sendVerificationEmail: jest.fn() } }
{ provide: NotificationsService, useValue: { create: jest.fn() } }

// Sau
{ provide: QueueService, useValue: { addVerificationEmail: jest.fn(), addNotification: jest.fn(), addFeedFanout: jest.fn() } }
```

---

## 4. Server configuration

### 4a. Redis: chuyển từ Upstash sang local

**Vấn đề:** Server production dùng Upstash Redis cloud (`REDIS_URL=rediss://...upstash.io`). Upstash free tier (10K cmd/ngày) drop idle connections liên tục → `ECONNRESET` spam trong logs → BullMQ `queue.add()` treo vĩnh viễn (ioredis retry vô hạn với `maxRetriesPerRequest: null`).

**Server đã có Redis local** chạy sẵn (`redis-server` cài qua `apt`, active 3 tuần, `localhost:6379`).

**Fix:** sửa `.env` trên server:

```bash
nano ~/vanh/smart-social-learning-marketplace/apps/api/.env
```

```
# TRƯỚC
REDIS_URL="rediss://default:Ae4R...@leading-herring-60945.upstash.io:6379"

# SAU
REDIS_URL="redis://localhost:6379"
```

Giữ nguyên `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` trong `.env` phòng khi cần.

**Restart:**
```bash
pm2 restart api
```

**Kết quả:**
- `[RedisService] Redis connected` — không còn ECONNRESET
- BullMQ connect thành công tới localhost
- Jobs xuất hiện trong Bull Dashboard

### 4b. Tại sao không dùng Upstash cho BullMQ?

| Aspect | Upstash free tier | Redis local |
|--------|-------------------|-------------|
| **Commands/ngày** | 10,000 | Không giới hạn |
| **Connections** | Drop idle connections | Stable, always alive |
| **Latency** | ~50-100ms (network) | ~0ms (localhost) |
| **BullMQ workers** | ❌ Long-lived connections bị drop | ✅ Stable connections |
| **Cost** | Free (nhưng giới hạn) | Free (tự host) |

BullMQ workers giữ persistent Redis connections để listen cho jobs. Upstash drop idle connections → workers mất kết nối → ECONNRESET → jobs không được xử lý.

---

## 5. Cấu trúc file sau implement

```
apps/api/src/
├── main.ts                                    # Basic Auth cho Bull Dashboard
├── app.module.ts                              # BullModule config + BullBoardModule
└── modules/
    ├── jobs/
    │   ├── jobs.module.ts                     # Register queues + export QueueService
    │   ├── queue.service.ts                   # ★ MỚI — fire-and-forget wrapper
    │   ├── processors/
    │   │   ├── email.processor.ts             # Không thay đổi
    │   │   ├── notification.processor.ts      # Không thay đổi
    │   │   └── feed.processor.ts              # Không thay đổi
    │   └── cron/
    │       └── cron.service.ts                # Không thay đổi
    ├── bull-board/
    │   └── bull-board.module.ts               # Dashboard UI
    ├── auth/
    │   ├── auth.module.ts                     # ★ Import JobsModule
    │   └── auth.service.ts                    # ★ queue.addVerificationEmail/addResetPasswordEmail
    ├── social/
    │   ├── social.module.ts                   # ★ Import JobsModule (thay NotificationsModule)
    │   ├── posts/posts.service.ts             # ★ queue.addFeedFanout (xoá fanoutToFollowers)
    │   ├── comments/comments.service.ts       # ★ queue.addNotification
    │   ├── interactions/interactions.service.ts # ★ queue.addNotification
    │   └── groups/groups.service.ts           # ★ queue.addNotification
    ├── users/
    │   ├── users.module.ts                    # ★ Import JobsModule (thay NotificationsModule)
    │   └── users.service.ts                   # ★ queue.addNotification
    └── qna/
        ├── qna.module.ts                      # ★ Import JobsModule (thay NotificationsModule)
        └── answers/answers.service.ts         # ★ queue.addNotification
```

---

## 6. Lợi ích

| Aspect | Trước (sync/direct) | Sau (queue/fire-and-forget) |
|--------|--------------------|-----------------------------|
| **Email response time** | Block 2-5s chờ SMTP | Return ngay, email gửi nền |
| **Email retry** | Mất nếu SMTP fail | BullMQ auto retry 3 lần |
| **Notification delivery** | Fire-and-forget, mất nếu fail | Queue retry, guaranteed delivery |
| **Feed fanout** | Sync block request | Async batching 1000, không block |
| **Request resilience** | Fail nếu Redis/SMTP down | Luôn thành công, queue best-effort |
| **Monitoring** | Chỉ PM2 logs | Bull Dashboard: payload, error, retry |

---

## 7. Commits

```
# Commit 1
feat(api): wire bullmq queues into email, notification and feed services

  - Tạo QueueService wrapper (queue.service.ts)
  - Update jobs.module.ts — export QueueService
  - Wire email queue: auth.service.ts (3 calls)
  - Wire notification queue: comments, interactions, groups, users, answers (7 calls)
  - Wire feed queue: posts.service.ts (2 calls), xoá fanoutToFollowers()
  - Update 7 spec files — mock QueueService
  - 20 files changed

# Commit 2
fix(api): make queue calls fire-and-forget to prevent request blocking on redis failure

  - QueueService: methods không async, dùng enqueue() helper với .catch() log
  - Bỏ await ở tất cả 12 callers
  - 8 files changed
```

---

## 8. Server deployment notes

```bash
# 1. Sửa .env — đổi REDIS_URL sang localhost
nano ~/vanh/smart-social-learning-marketplace/apps/api/.env
# REDIS_URL="redis://localhost:6379"

# 2. Restart
pm2 restart api

# 3. Verify
pm2 logs api --lines 20
# Phải thấy: [RedisService] Redis connected
# Không còn: ECONNRESET

# 4. Test
# Register account mới → check Bull Dashboard /api/admin/queues
# Tab Completed → thấy job email/verification

# 5. Check Redis keys
redis-cli keys "bull:email:*" | head -5
# Phải thấy data
```

---

## 9. Checklist

- [x] `queue.service.ts` — fire-and-forget wrapper với Logger
- [x] `jobs.module.ts` — providers + exports QueueService
- [x] `auth.module.ts` — import JobsModule
- [x] `auth.service.ts` — 3 email calls migrated
- [x] `social.module.ts` — import JobsModule thay NotificationsModule
- [x] `comments.service.ts` — 2 notification calls migrated
- [x] `interactions.service.ts` — 1 notification call migrated
- [x] `groups.service.ts` — 2 notification calls migrated
- [x] `users.module.ts` — import JobsModule thay NotificationsModule
- [x] `users.service.ts` — 1 notification call migrated
- [x] `qna.module.ts` — import JobsModule thay NotificationsModule
- [x] `answers.service.ts` — 1 notification call migrated
- [x] `posts.service.ts` — 2 feed calls migrated, `fanoutToFollowers()` removed
- [x] 7 spec files updated — mock QueueService
- [x] `app.module.ts` — `maxRetriesPerRequest: null` + `defaultJobOptions`
- [x] TypeScript clean
- [x] Server `.env` — `REDIS_URL=redis://localhost:6379`
- [x] ECONNRESET resolved
- [x] Jobs visible in Bull Dashboard
