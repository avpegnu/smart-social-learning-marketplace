# 03 — Bull Queues: Email, Notification, Feed Processors

> Giải thích chi tiết BullMQ queue system — 3 queues xử lý background jobs:
> email sending, notification push, feed fanout. Bao gồm lý thuyết message queue,
> worker pattern, retry strategy, và BullModule configuration.

---

## 1. TỔNG QUAN

### 1.1 Tại sao cần Message Queue?

**Vấn đề:** Một số operations tốn thời gian hoặc có side effects không nên block HTTP response:

```
❌ Synchronous (block user):
  POST /api/auth/register
    → Create user (5ms)
    → Send verification email (500ms-2s) ← User phải đợi email gửi xong
    → Return 201

✅ Asynchronous (queue):
  POST /api/auth/register
    → Create user (5ms)
    → Add "send email" job to queue (1ms) ← Gần như instant
    → Return 201
    ──── Background worker processes job ────
    → Send verification email (500ms-2s)
```

**Lợi ích:**
- **Response time**: User không đợi email, notification, feed fanout
- **Retry**: Job fail → tự retry (3 lần, exponential backoff)
- **Decoupling**: HTTP layer không phụ thuộc vào mail server availability
- **Rate limiting**: Gmail SMTP 500 emails/day → queue xử lý tuần tự, không burst

### 1.2 BullMQ Architecture

```
┌──────────────┐      ┌───────┐      ┌──────────────┐
│ Producer     │      │ Redis │      │ Consumer     │
│ (Service)    │─add──│ Queue │──pop─│ (Processor)  │
│              │      │       │      │              │
│ e.g. Auth    │      │ email │      │ EmailProcess │
│   Service    │      │ notif │      │ NotifProcess │
│   Feed Svc   │      │ feed  │      │ FeedProcess  │
└──────────────┘      └───────┘      └──────────────┘
```

**Components:**
- **Producer** — bất kỳ service nào có `@InjectQueue('email') queue: Queue` → `queue.add('job-name', data)`
- **Redis** — stores job data, state, retry count. SSLM dùng Upstash Redis (10K cmd/day free)
- **Consumer (Processor)** — `@Processor('email')` class extends `WorkerHost`, implement `process(job)`

### 1.3 BullModule Configuration

```typescript
// app.module.ts
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.get<string>('redis.url', 'redis://localhost:6379');
    const parsed = new URL(url);
    return {
      connection: {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        ...(parsed.password && { password: parsed.password }),
      },
    };
  },
}),
```

**Tại sao parse URL?** Redis config chỉ lưu `url` (e.g. `redis://default:password@host:6379`). BullMQ cần `{ host, port, password }` riêng biệt. `new URL()` parse ra components.

**`forRootAsync`** — inject `ConfigService` để đọc config từ environment variables (không hardcode localhost).

---

## 2. EMAIL QUEUE

### 2.1 Processor

```typescript
@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(@Inject(MailService) private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'verification':
        await this.mailService.sendVerificationEmail(job.data.to, job.data.token);
        break;
      case 'reset-password':
        await this.mailService.sendResetPasswordEmail(job.data.to, job.data.token);
        break;
      case 'order-receipt':
        await this.mailService.sendOrderReceiptEmail(job.data.to, job.data.orderId, job.data.amount);
        break;
    }
  }
}
```

**Pattern:** 1 queue, nhiều job types (distinguished by `job.name`). Mỗi job type map 1:1 với MailService method.

### 2.2 Producer Example (how services will use)

```typescript
// In AuthService (future refactor):
@InjectQueue('email') private readonly emailQueue: Queue;

async register(dto: RegisterDto) {
  const user = await this.prisma.user.create({ ... });
  const token = crypto.randomUUID();

  // Async — không block response
  await this.emailQueue.add('verification', {
    to: user.email,
    token,
  });

  return user;
}
```

### 2.3 Gmail SMTP Rate Limiting

```
Gmail SMTP: 500 emails/day (free tier)
Queue xử lý tuần tự → 1 email at a time → không burst
Nếu fail → retry sau 2s, 4s, 8s (exponential backoff)
Nếu 3 retries fail → job moved to "failed" state
```

---

## 3. NOTIFICATION QUEUE

### 3.1 Processor

```typescript
@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { userId, type, data } = job.data;
    await this.notifications.create(userId, type, data);
  }
}
```

**Delegates to NotificationsService.create()** (Phase 5.10b) which:
1. Creates notification record in DB
2. Pushes realtime via WebSocket gateway
3. Increments unread count

### 3.2 Producer Example

```typescript
// In AdminCoursesService (future enhancement):
await this.notificationQueue.add('push', {
  userId: course.instructorId,
  type: 'COURSE_APPROVED',
  data: { courseTitle: course.title, courseId: course.id },
});
```

---

## 4. FEED QUEUE

### 4.1 Fanout-on-Write Pattern

```
User A has 5000 followers
User A creates a post
  │
  ├── Sync approach: Insert 5000 FeedItem records in request → 2-5s response time ❌
  │
  └── Queue approach:
        POST /api/posts → Create post → Queue fanout job → Return 201 (50ms) ✅
                                              │
                                    Background worker:
                                    ├── Query 5000 follower IDs
                                    ├── Batch insert 1000 at a time
                                    └── Total: 5 batches × ~100ms = 500ms (background)
```

### 4.2 Processor — Batch Insert

```typescript
private async handleFanout(data: { postId: string; authorId: string; groupId?: string }) {
  const { postId, authorId, groupId } = data;

  let targetIds: string[];
  if (groupId) {
    // Group post → fanout to group members only
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    targetIds = members.map((m) => m.userId);
  } else {
    // Public post → fanout to followers
    const follows = await this.prisma.follow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    });
    targetIds = follows.map((f) => f.followerId);
  }

  // Author sees their own post
  targetIds.push(authorId);

  // Batch insert (1000 at a time)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
    const batch = targetIds.slice(i, i + BATCH_SIZE);
    await this.prisma.feedItem.createMany({
      data: batch.map((userId) => ({ userId, postId })),
      skipDuplicates: true,
    });
  }
}
```

**Key decisions:**
- **`BATCH_SIZE = 1000`** — Prisma `createMany` performance optimal around 1000 records. Quá nhiều → memory spike, quá ít → too many roundtrips.
- **`skipDuplicates: true`** — nếu author cũng là follower của chính mình → không duplicate FeedItem.
- **Group vs Public** — group posts chỉ fanout cho members, không cho followers.

---

## 5. JOBS MODULE

```typescript
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'notification' },
      { name: 'feed' },
    ),
    MailModule,           // EmailProcessor needs MailService
    NotificationsModule,  // NotificationProcessor needs NotificationsService
  ],
  providers: [
    EmailProcessor,
    NotificationProcessor,
    FeedProcessor,
    CronService,          // Cron jobs cũng trong JobsModule
  ],
})
export class JobsModule {}
```

**`BullModule.registerQueue()`** — đăng ký 3 queues. Mỗi queue tạo 1 Redis list. Processors tự động connect và poll jobs.

---

## 6. FILES CREATED

| File | Lines | Mục đích |
|------|-------|----------|
| `jobs.module.ts` | 22 | Module registration + queue imports |
| `processors/email.processor.ts` | 40 | Email job handler (3 types) |
| `processors/notification.processor.ts` | 25 | Notification push handler |
| `processors/feed.processor.ts` | 55 | Feed fanout with batch insert |
