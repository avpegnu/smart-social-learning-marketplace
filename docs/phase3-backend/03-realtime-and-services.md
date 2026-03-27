# 3. REALTIME, CRON JOBS, QUEUE & EXTERNAL SERVICES

---

## 3.1 WebSocket Gateway (Socket.io)

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     NestJS WebSocket Layer                            │
│                                                                      │
│  ┌────────────────────────┐    ┌────────────────────────────────┐   │
│  │    ChatGateway          │    │    NotificationGateway          │   │
│  │    namespace: /chat     │    │    namespace: /notifications    │   │
│  │                         │    │                                 │   │
│  │  Events:                │    │  Events:                        │   │
│  │  ├── send_message       │    │  ├── notification (server→client│   │
│  │  ├── typing             │    │  ├── unread_count              │   │
│  │  ├── stop_typing        │    │  └── order_status_changed      │   │
│  │  ├── mark_read          │    │                                 │   │
│  │  ├── join_conversation  │    │  Rooms:                         │   │
│  │  └── leave_conversation │    │  └── user_{userId}             │   │
│  │                         │    │                                 │   │
│  │  Rooms:                 │    │                                 │   │
│  │  └── conv_{convId}      │    │                                 │   │
│  └────────────────────────┘    └────────────────────────────────┘   │
│                                                                      │
│  Adapter: in-memory (default — đủ cho single instance Render.com)   │
│  Auth: JWT token trong handshake query/headers                       │
└──────────────────────────────────────────────────────────────────────┘
```

### ChatGateway — Chi tiết Events

```typescript
@WebSocketGateway({ namespace: '/chat', cors: { origin: [...] } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {

  // === CONNECTION ===

  // Client connect → verify JWT → join user room
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    const user = await this.authService.verifyToken(token);
    if (!user) { client.disconnect(); return; }

    client.data.userId = user.userId;
    client.join(`user_${user.userId}`);

    // Mark user online
    await this.redis.set(`online:${user.userId}`, '1', 'EX', 300); // 5 min TTL
  }

  // Client disconnect → mark offline
  async handleDisconnect(client: Socket) {
    await this.redis.del(`online:${client.data.userId}`);
  }

  // === EVENTS: Client → Server ===

  // 1. Join conversation room
  @SubscribeMessage('join_conversation')
  async onJoinConversation(client: Socket, payload: { conversationId: string }) {
    // Verify: user is member of conversation
    const isMember = await this.chatService.isMember(
      client.data.userId, payload.conversationId
    );
    if (!isMember) return { error: 'Unauthorized' };

    client.join(`conv_${payload.conversationId}`);
    return { success: true };
  }

  // 2. Send message
  @SubscribeMessage('send_message')
  async onSendMessage(client: Socket, payload: {
    conversationId: string;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'CODE' | 'FILE';
  }) {
    // a. Validate
    const userId = client.data.userId;
    const isMember = await this.chatService.isMember(userId, payload.conversationId);
    if (!isMember) return { error: 'Unauthorized' };

    // b. Save to DB
    const message = await this.chatService.createMessage({
      conversationId: payload.conversationId,
      senderId: userId,
      content: payload.content,
      type: payload.type,
    });

    // c. Update conversation
    await this.chatService.updateConversationLastMessage(
      payload.conversationId, message
    );

    // d. Broadcast to room (all members online in conversation)
    this.server
      .to(`conv_${payload.conversationId}`)
      .emit('new_message', {
        message: {
          id: message.id,
          conversationId: payload.conversationId,
          sender: { id: userId, fullName: message.sender.fullName, avatarUrl: message.sender.avatarUrl },
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
        }
      });

    // e. Notify offline members (increment unread)
    const offlineMembers = await this.chatService.getOfflineMembers(
      payload.conversationId, userId
    );
    for (const memberId of offlineMembers) {
      // Push notification via NotificationGateway
      this.server
        .to(`user_${memberId}`)
        .emit('new_message_notification', {
          conversationId: payload.conversationId,
          senderName: message.sender.fullName,
          preview: payload.content.substring(0, 50),
        });
    }

    return { success: true, messageId: message.id };
  }

  // 3. Typing indicator
  @SubscribeMessage('typing')
  async onTyping(client: Socket, payload: { conversationId: string }) {
    client.to(`conv_${payload.conversationId}`).emit('user_typing', {
      userId: client.data.userId,
      conversationId: payload.conversationId,
    });
  }

  @SubscribeMessage('stop_typing')
  async onStopTyping(client: Socket, payload: { conversationId: string }) {
    client.to(`conv_${payload.conversationId}`).emit('user_stop_typing', {
      userId: client.data.userId,
      conversationId: payload.conversationId,
    });
  }

  // 4. Mark messages as read
  @SubscribeMessage('mark_read')
  async onMarkRead(client: Socket, payload: {
    conversationId: string;
    messageId: string;
  }) {
    const userId = client.data.userId;

    // Update last read message
    await this.chatService.markAsRead(userId, payload.conversationId, payload.messageId);

    // Broadcast read receipt to other members
    client.to(`conv_${payload.conversationId}`).emit('message_read', {
      userId,
      conversationId: payload.conversationId,
      lastReadMessageId: payload.messageId,
    });
  }
}
```

### NotificationGateway — Realtime Push

```typescript
@WebSocketGateway({ namespace: '/notifications', cors: { origin: [...] } })
export class NotificationGateway {

  // Server → Client: push notification realtime
  async pushNotification(userId: string, notification: NotificationPayload) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  // Server → Client: update unread count
  async pushUnreadCount(userId: string, count: number) {
    this.server.to(`user_${userId}`).emit('unread_count', { count });
  }

  // Server → Client: order status changed (for payment polling)
  async pushOrderStatus(userId: string, orderId: string, status: string) {
    this.server.to(`user_${userId}`).emit('order_status_changed', {
      orderId, status
    });
  }
}
```

### Client-side Connection Example

```typescript
// Frontend: Socket.io client
import { io } from 'socket.io-client';

// Chat
const chatSocket = io(`${BACKEND_URL}/chat`, {
  auth: { token: accessToken },
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});

chatSocket.on('new_message', (data) => {
  // Update UI with new message
});

chatSocket.on('user_typing', ({ userId }) => {
  // Show typing indicator
});

// Notifications
const notifSocket = io(`${BACKEND_URL}/notifications`, {
  auth: { token: accessToken },
});

notifSocket.on('notification', (data) => {
  // Show toast notification
});

notifSocket.on('unread_count', ({ count }) => {
  // Update badge count
});

notifSocket.on('order_status_changed', ({ orderId, status }) => {
  // Update payment page status
});
```

---

## 3.2 Queue System (Bull + Upstash Redis)

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Bull Queue System                           │
│                  (backed by Upstash Redis)                        │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  email-queue     │  │  notification-   │  │  feed-queue    │  │
│  │                  │  │  queue           │  │                │  │
│  │  Jobs:           │  │  Jobs:           │  │  Jobs:         │  │
│  │  - verification  │  │  - push_notif    │  │  - fanout_post │  │
│  │  - reset_pwd     │  │  - aggregate     │  │  - cleanup     │  │
│  │  - order_receipt │  │                  │  │                │  │
│  │  - course_approve│  │                  │  │                │  │
│  │  - withdrawal    │  │                  │  │                │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                     │                    │           │
│           ▼                     ▼                    ▼           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ EmailProcessor   │  │ NotifProcessor   │  │ FeedProcessor  │  │
│  │                  │  │                  │  │                │  │
│  │ Nodemailer       │  │ DB + WebSocket   │  │ DB batch       │  │
│  │ → send email     │  │ → push to user   │  │ insert         │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Queue Configuration

```typescript
// queue.module.ts
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('UPSTASH_REDIS_HOST'),
          port: 6379,
          password: config.get('UPSTASH_REDIS_TOKEN'),
          tls: {},
        },
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 200, // Keep last 200 failed jobs
          attempts: 3, // Retry 3 lần
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s → 4s → 8s
          },
        },
      }),
    }),
    BullModule.registerQueue({ name: 'email' }, { name: 'notification' }, { name: 'feed' }),
  ],
})
export class QueueModule {}
```

### Email Processor

```typescript
@Processor('email')
export class EmailProcessor {
  constructor(
    private readonly transporter: nodemailer.Transporter,
    private readonly config: ConfigService,
  ) {}

  @Process('verification')
  async sendVerificationEmail(job: Job<{ email: string; fullName: string; token: string }>) {
    const { email, fullName, token } = job.data;
    const verifyUrl = `${this.config.get('STUDENT_PORTAL_URL')}/auth/verify?token=${token}`;

    await this.transporter.sendMail({
      from: `SSLM <${this.config.get('mail.fromEmail')}>`,
      to: email,
      subject: 'Xác nhận tài khoản — Smart Social Learning',
      html: verificationTemplate({ fullName, verifyUrl }),
    });
  }

  @Process('reset-password')
  async sendResetPasswordEmail(job: Job<{ email: string; fullName: string; token: string }>) {
    // ... similar
  }

  @Process('order-completed')
  async sendOrderReceipt(
    job: Job<{
      email: string;
      fullName: string;
      orderCode: string;
      items: Array<{ title: string; price: number }>;
      total: number;
    }>,
  ) {
    // ... send receipt email
  }

  @Process('course-approved')
  async sendCourseApprovedEmail(
    job: Job<{
      email: string;
      fullName: string;
      courseTitle: string;
    }>,
  ) {
    // ... notify instructor
  }

  @Process('withdrawal-completed')
  async sendWithdrawalEmail(
    job: Job<{
      email: string;
      fullName: string;
      amount: number;
    }>,
  ) {
    // ... notify instructor
  }
}
```

### Notification Processor

```typescript
@Processor('notification')
export class NotificationProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifGateway: NotificationGateway,
    private readonly emailQueue: InjectQueue('email'),
  ) {}

  @Process('push')
  async pushNotification(job: Job<{
    recipientId: string;
    type: NotificationType;
    data: Record<string, any>;
  }>) {
    const { recipientId, type, data } = job.data;

    // 1. Check user notification preferences
    const user = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { notificationPreferences: true, email: true, fullName: true },
    });

    const prefs = user.notificationPreferences?.[type] || { inApp: true, email: false };

    // 2. In-App notification (always save to DB)
    if (prefs.inApp) {
      const notification = await this.prisma.notification.create({
        data: { userId: recipientId, type, data },
      });

      // Push via WebSocket if user online
      await this.notifGateway.pushNotification(recipientId, notification);

      // Update unread count
      const count = await this.prisma.notification.count({
        where: { userId: recipientId, read: false },
      });
      await this.notifGateway.pushUnreadCount(recipientId, count);
    }

    // 3. Email notification (for important events)
    if (prefs.email) {
      const emailType = this.mapNotifTypeToEmailType(type);
      if (emailType) {
        await this.emailQueue.add(emailType, {
          email: user.email,
          fullName: user.fullName,
          ...data,
        });
      }
    }
  }

  // Aggregate notifications: "X, Y và 3 người khác đã thích bài viết"
  @Process('aggregate')
  async aggregateNotifications(job: Job<{
    recipientId: string;
    type: NotificationType;
    targetId: string;
  }>) {
    const { recipientId, type, targetId } = job.data;

    // Tìm notification cùng type + target trong 5 phút gần nhất
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: recipientId,
        type,
        data: { path: ['targetId'], equals: targetId },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    if (existing) {
      // Gom vào notification hiện có → update data.actors[]
      const actors = existing.data.actors || [existing.data.actorName];
      actors.push(job.data.actorName);
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: { data: { ...existing.data, actors, count: actors.length }, read: false },
      });
    } else {
      // Tạo notification mới
      await this.prisma.notification.create({
        data: { userId: recipientId, type, data: job.data },
      });
    }
  }
}
```

### Feed Processor (Fanout-on-Write)

```typescript
@Processor('feed')
export class FeedProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process('fanout')
  async fanoutPost(job: Job<{ postId: string; authorId: string; groupId?: string }>) {
    const { postId, authorId, groupId } = job.data;

    let recipientIds: string[];

    if (groupId) {
      // Group post → fanout to group members only
      const members = await this.prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });
      recipientIds = members.map((m) => m.userId);
    } else {
      // Public/followers post → fanout to followers
      const followers = await this.prisma.follow.findMany({
        where: { followingId: authorId },
        select: { followerId: true },
      });
      recipientIds = followers.map((f) => f.followerId);
    }

    // Also add to author's own feed
    recipientIds.push(authorId);

    // Batch insert feed items (1000 per batch)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
      const batch = recipientIds.slice(i, i + BATCH_SIZE);
      await this.prisma.feedItem.createMany({
        data: batch.map((userId) => ({
          userId,
          postId,
          createdAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }
  }
}
```

### Tối ưu Queue cho Upstash (10K cmd/day)

```
Mỗi Bull job ≈ 5-10 Redis commands (add, process, complete, cleanup)

Ước tính daily usage:
  - Email jobs: ~50/day × 8 = 400 cmd
  - Notification jobs: ~200/day × 8 = 1,600 cmd
  - Feed fanout: ~20 posts/day × 10 = 200 cmd
  - Rate limiting: ~500 cmd/day
  - Cache: ~1,000 cmd/day
  ─────────────────────────────────
  Total: ~3,700 cmd/day (trong giới hạn 10K)

Nếu cần tiết kiệm hơn:
  - Dùng in-process queue (không Redis) cho email/notification
  - Chỉ dùng Redis cho rate limiting + cache
  - Trade-off: mất jobs khi server restart (chấp nhận cho đồ án)
```

---

## 3.3 Cron Jobs (@nestjs/schedule)

```typescript
@Injectable()
export class CronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly recommendationService: RecommendationService,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 1: Expire pending orders (mỗi phút)
  // Order hết hạn 15 phút chưa thanh toán → EXPIRED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('*/1 * * * *')
  async expirePendingOrders() {
    const result = await this.prisma.order.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { not: null, lt: new Date() },
      },
      data: { status: 'EXPIRED', updatedAt: new Date() },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} pending orders`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 2: Cleanup expired refresh tokens (daily 3AM)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 3 * * *')
  async cleanupExpiredTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`Cleaned up ${result.count} expired tokens`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 3: Release available earnings (daily 1AM)
  // Earnings sau 7 ngày → AVAILABLE (hết refund period)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 1 * * *')
  async releaseAvailableEarnings() {
    const result = await this.prisma.earning.updateMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      data: { status: 'AVAILABLE' },
    });
    this.logger.log(`Released ${result.count} earnings to AVAILABLE`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 4: Cleanup old feed items (weekly Sunday 4AM)
  // Giữ tối đa 1000 feed items per user
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 4 * * 0')
  async cleanupOldFeedItems() {
    await this.prisma.$executeRaw`
      DELETE FROM feed_items WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "userId" ORDER BY "createdAt" DESC
          ) AS rn FROM feed_items
        ) ranked WHERE rn > 1000
      )
    `;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 5: Cleanup failed uploads (daily 2AM)
  // Uploads stuck ở UPLOADING > 24h → mark FAILED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 2 * * *')
  async cleanupFailedUploads() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.media.updateMany({
      where: {
        status: 'UPLOADING',
        createdAt: { lt: cutoff },
      },
      data: { status: 'FAILED', updatedAt: new Date() },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 6: Batch update view counts from Redis → DB (mỗi 5 phút)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('*/5 * * * *')
  async syncViewCounts() {
    // Lấy tất cả course view counters từ Redis
    const keys = await this.redis.keys('views:*');
    for (const key of keys) {
      const courseId = key.replace('views:', '');
      const count = await this.redis.getdel(key); // Get + Delete atomic
      if (count && parseInt(count) > 0) {
        await this.prisma.course.update({
          where: { id: courseId },
          data: { viewCount: { increment: parseInt(count) } },
        });
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 7: Pre-compute analytics snapshot (daily 2AM)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 2 * * *')
  async computeAnalyticsSnapshot() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalCourses, totalOrders, totalRevenue, newUsersToday, ordersToday] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.course.count({ where: { status: 'APPROVED' } }),
        this.prisma.order.count({ where: { status: 'COMPLETED' } }),
        this.prisma.earning.aggregate({
          _sum: { amount: true, commissionAmount: true },
          where: { status: { not: 'PENDING' } },
        }),
        this.prisma.user.count({ where: { createdAt: { gte: today } } }),
        this.prisma.order.count({
          where: { status: 'COMPLETED', paidAt: { gte: today } },
        }),
      ]);

    await this.prisma.analyticsSnapshot.create({
      data: {
        date: today,
        totalUsers,
        totalCourses,
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.amount || 0),
        totalCommission: Number(totalRevenue._sum.commissionAmount || 0),
        newUsersToday,
        ordersToday,
        data: {}, // Extra JSON data nếu cần
      },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 8: Pre-compute recommendation similarity matrix (nightly 3AM)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 3 * * *')
  async computeRecommendationMatrix() {
    await this.recommendationService.computeSimilarityMatrix();
    // Chi tiết xem section 3.4
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JOB 9: Reconcile denormalized counters (weekly Sunday 5AM)
  // Safety check: fix counters bị lệch
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Cron('0 5 * * 0')
  async reconcileCounters() {
    // Fix course.reviewCount
    await this.prisma.$executeRaw`
      UPDATE courses c SET "reviewCount" = (
        SELECT COUNT(*) FROM reviews r WHERE r."courseId" = c.id
      )`;

    // Fix course.totalStudents
    await this.prisma.$executeRaw`
      UPDATE courses c SET "totalStudents" = (
        SELECT COUNT(*) FROM enrollments e WHERE e."courseId" = c.id
      )`;

    // Fix post.likeCount
    await this.prisma.$executeRaw`
      UPDATE posts p SET "likeCount" = (
        SELECT COUNT(*) FROM likes l WHERE l."postId" = p.id
      )`;

    // Fix post.commentCount
    await this.prisma.$executeRaw`
      UPDATE posts p SET "commentCount" = (
        SELECT COUNT(*) FROM comments cm WHERE cm."postId" = p.id
      )`;

    // Fix user.followerCount
    await this.prisma.$executeRaw`
      UPDATE users u SET "followerCount" = (
        SELECT COUNT(*) FROM follows f WHERE f."followingId" = u.id
      )`;

    // Fix user.followingCount
    await this.prisma.$executeRaw`
      UPDATE users u SET "followingCount" = (
        SELECT COUNT(*) FROM follows f WHERE f."followerId" = u.id
      )`;

    // Fix group.memberCount
    await this.prisma.$executeRaw`
      UPDATE groups g SET "memberCount" = (
        SELECT COUNT(*) FROM group_members gm WHERE gm."groupId" = g.id
      )`;

    // Fix answer.voteCount
    await this.prisma.$executeRaw`
      UPDATE answers a SET "voteCount" = (
        SELECT COALESCE(SUM(value), 0) FROM votes v WHERE v."answerId" = a.id
      )`;

    // Fix question.answerCount
    await this.prisma.$executeRaw`
      UPDATE questions q SET "answerCount" = (
        SELECT COUNT(*) FROM answers a WHERE a."questionId" = q.id
      )`;

    // Fix tag.courseCount
    await this.prisma.$executeRaw`
      UPDATE tags t SET "courseCount" = (
        SELECT COUNT(*) FROM course_tags ct WHERE ct."tagId" = t.id
      )`;

    // Fix coupon.usageCount
    await this.prisma.$executeRaw`
      UPDATE coupons c SET "usageCount" = (
        SELECT COUNT(*) FROM coupon_usages cu WHERE cu."couponId" = c.id
      )`;

    this.logger.log('Reconciled all denormalized counters');
  }
}
```

### Cron Schedule Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                      CRON SCHEDULE                                │
├──────────────┬─────────────────┬─────────────────────────────────┤
│ Schedule     │ Job              │ Mô tả                          │
├──────────────┼─────────────────┼─────────────────────────────────┤
│ */1 * * * *  │ expireOrders     │ Expire orders > 15 phút        │
│ */5 * * * *  │ syncViewCounts   │ Redis view counts → DB         │
│ 0 1 * * *    │ releaseEarnings  │ PENDING → AVAILABLE (7 ngày)   │
│ 0 2 * * *    │ cleanupUploads   │ UPLOADING > 24h → FAILED       │
│ 0 2 * * *    │ analyticsSnapshot│ Pre-compute daily analytics    │
│ 0 3 * * *    │ cleanupTokens    │ Delete expired refresh tokens  │
│ 0 3 * * *    │ recommendations  │ Pre-compute similarity matrix  │
│ 0 4 * * 0    │ cleanupFeed      │ Keep max 1000 feed items/user  │
│ 0 5 * * 0    │ reconcileCounters│ Fix all denormalized counters  │
└──────────────┴─────────────────┴─────────────────────────────────┘
```

---

## 3.4 External Service Integration

### Cloudinary Service

```typescript
@Injectable()
export class CloudinaryService {
  private cloudinary = require('cloudinary').v2;

  constructor(private config: ConfigService) {
    this.cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
  }

  // Generate signed upload params (cho direct upload từ client)
  generateSignedUploadParams(folder: string, type: 'video' | 'image') {
    const timestamp = Math.round(Date.now() / 1000);
    const params: Record<string, any> = { timestamp, folder };

    if (type === 'video') {
      params.eager = 'c_scale,w_854,h_480|c_scale,w_1280,h_720';
      params.eager_async = true;
    }
    if (type === 'image') {
      params.transformation = 'w_800,h_600,c_limit,q_auto,f_auto';
    }

    const signature = this.cloudinary.utils.api_sign_request(
      params,
      this.config.get('CLOUDINARY_API_SECRET'),
    );

    return {
      signature,
      timestamp,
      apiKey: this.config.get('CLOUDINARY_API_KEY'),
      cloudName: this.config.get('CLOUDINARY_CLOUD_NAME'),
      folder,
      ...params,
    };
  }

  // Upload image từ server (cho avatar, nhỏ)
  async uploadImage(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  // Delete asset
  async delete(publicId: string, resourceType: string = 'image') {
    await this.cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}
```

### Mail Service (Gmail SMTP)

```typescript
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('mail.smtpHost'),
      port: config.get('mail.smtpPort'),
      secure: false,
      auth: {
        user: config.get('mail.smtpUser'),
        pass: config.get('mail.smtpPass'),
      },
    });
  }

  async send(to: string, subject: string, html: string) {
    await this.transporter.sendMail({
      from: `SSLM <${this.config.get('mail.fromEmail')}>`,
      to,
      subject,
      html,
    });
  }
}

// Email chỉ gửi cho events QUAN TRỌNG (500/day limit):
// 1. Xác nhận đăng ký
// 2. Reset password
// 3. Thanh toán thành công
// 4. Instructor application approved/rejected
// 5. Course approved/rejected
// 6. Withdrawal completed
// Estimate: 20-50 emails/day
```

### Groq Service (AI)

```typescript
@Injectable()
export class GroqService {
  private groq: Groq;

  constructor(private config: ConfigService) {
    this.groq = new Groq({ apiKey: config.get('GROQ_API_KEY') });
  }

  async streamChat(messages: ChatMessage[]): Promise<AsyncIterable<ChatCompletionChunk>> {
    return this.groq.chat.completions.create({
      model: this.config.get('GROQ_MODEL'), // llama-3.3-70b-versatile
      messages,
      stream: true,
      max_tokens: 1024,
      temperature: 0.3,
    });
  }
}
```

### Embeddings Service (Transformers.js — Local)

```typescript
@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private embedder: any;

  async onModuleInit() {
    // Load model khi server start (~5 giây, 80MB)
    const { pipeline } = await import('@xenova/transformers');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embeddings model loaded');
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(result.data); // Vector 384 dimensions
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
```

### Redis Service (Upstash)

```typescript
@Injectable()
export class RedisService {
  private client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis({
      url: config.get('UPSTASH_REDIS_URL'),
      token: config.get('UPSTASH_REDIS_TOKEN'),
    });
  }

  // Cache
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }
  async del(key: string) {
    await this.client.del(key);
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return current <= limit;
  }

  // Counter
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
}
```

---

## 3.5 Recommendation Service (Pre-compute)

```typescript
@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  // Nightly cron → pre-compute similarity matrix
  async computeSimilarityMatrix() {
    const courses = await this.prisma.course.findMany({
      where: { status: 'APPROVED', deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      select: { userId: true, courseId: true },
    });

    // 1. Content-Based: Cosine Similarity on tag vectors
    const allTags = [...new Set(courses.flatMap((c) => c.tags.map((t) => t.tag.name)))];
    const similarities: Array<{
      sourceId: string;
      targetId: string;
      cbScore: number;
      cfScore: number;
    }> = [];

    for (let i = 0; i < courses.length; i++) {
      const vecA = this.buildTagVector(courses[i], allTags);
      for (let j = i + 1; j < courses.length; j++) {
        const vecB = this.buildTagVector(courses[j], allTags);
        const cbScore = this.cosineSimilarity(vecA, vecB);

        // 2. Collaborative: Jaccard Similarity on enrollment sets
        const buyersA = new Set(
          enrollments.filter((e) => e.courseId === courses[i].id).map((e) => e.userId),
        );
        const buyersB = new Set(
          enrollments.filter((e) => e.courseId === courses[j].id).map((e) => e.userId),
        );
        const cfScore = this.jaccardSimilarity(buyersA, buyersB);

        if (cbScore > 0.1 || cfScore > 0.1) {
          similarities.push({
            sourceId: courses[i].id,
            targetId: courses[j].id,
            cbScore,
            cfScore,
          });
        }
      }
    }

    // 3. Upsert vào course_similarities table
    // Delete old → insert new (trong transaction)
    await this.prisma.$transaction([
      this.prisma.courseSimilarity.deleteMany({}),
      ...similarities.flatMap((s) => [
        this.prisma.courseSimilarity.create({
          data: {
            sourceCourseId: s.sourceId,
            similarCourseId: s.targetId,
            similarityScore: 0.5 * s.cbScore + 0.5 * s.cfScore,
            algorithm: 'HYBRID',
          },
        }),
        this.prisma.courseSimilarity.create({
          data: {
            sourceCourseId: s.targetId,
            similarCourseId: s.sourceId,
            similarityScore: 0.5 * s.cbScore + 0.5 * s.cfScore,
            algorithm: 'HYBRID',
          },
        }),
      ]),
    ]);
  }

  private buildTagVector(course: any, allTags: string[]): number[] {
    const courseTags = new Set(course.tags.map((t) => t.tag.name));
    return allTags.map((tag) => (courseTags.has(tag) ? 1 : 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return magA === 0 || magB === 0 ? 0 : dot / (magA * magB);
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  // Runtime: get recommendations for user
  async getRecommendations(userId: string | null, context: string, limit: number) {
    if (!userId) {
      // Guest → Popularity only
      return this.getPopularCourses(limit);
    }

    const userCourses = await this.prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });

    if (userCourses.length === 0) {
      return this.getPopularCourses(limit);
    }

    const courseIds = userCourses.map((e) => e.courseId);

    // Đọc pre-computed similarities
    const similarities = await this.prisma.courseSimilarity.findMany({
      where: {
        sourceCourseId: { in: courseIds },
        similarCourseId: { notIn: courseIds }, // Chưa mua
      },
      orderBy: { similarityScore: 'desc' },
      take: limit,
      include: { similarCourse: true },
    });

    return similarities.map((s) => ({
      course: s.similarCourse,
      score: s.similarityScore,
      reason: `Dựa trên khóa học bạn đã mua`,
    }));
  }

  private async getPopularCourses(limit: number) {
    // Wilson Score + Time Decay
    return this.prisma.course.findMany({
      where: { status: 'APPROVED', deletedAt: null },
      orderBy: [{ totalStudents: 'desc' }, { avgRating: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
    });
  }
}
```

---

## 3.6 Embedding Pipeline (Course content → pgvector)

```
Trigger: Khi course status → APPROVED

┌──────────────────────────────────────────────────────────┐
│               EMBEDDING PIPELINE                          │
│                                                          │
│  1. Lấy tất cả lessons có text content (TEXT lessons)    │
│     + video transcripts (nếu có)                         │
│                                                          │
│  2. Chunk mỗi lesson thành đoạn ~500 tokens             │
│     Overlap: 50 tokens (để context không bị cắt)         │
│                                                          │
│  3. Embed từng chunk bằng Transformers.js                │
│     Model: all-MiniLM-L6-v2 → vector 384 dimensions     │
│                                                          │
│  4. INSERT vào course_chunks:                            │
│     (courseId, lessonId, content, chunkIndex, embedding)  │
│                                                          │
│  Performance:                                            │
│  - 50 chunks × 10ms/embed = 500ms per course            │
│  - Chạy async (không block response)                     │
│  - Re-run khi instructor update lesson content           │
└──────────────────────────────────────────────────────────┘
```

```typescript
@Injectable()
export class CourseEmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async embedCourse(courseId: string) {
    // 1. Get all text content from lessons
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId, type: 'TEXT', textContent: { not: null } },
      select: { id: true, textContent: true },
    });

    // 2. Delete old chunks
    await this.prisma.courseChunk.deleteMany({ where: { courseId } });

    // 3. Chunk + Embed + Insert
    for (const lesson of lessons) {
      const chunks = this.chunkText(lesson.textContent, 500, 50);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.embeddings.embed(chunks[i]);

        await this.prisma.$executeRaw`
          INSERT INTO course_chunks ("id", "courseId", "lessonId", "content", "chunkIndex", "embedding", "createdAt")
          VALUES (${cuid()}, ${courseId}, ${lesson.id}, ${chunks[i]}, ${i}, ${embedding}::vector, NOW())
        `;
      }
    }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    // Strip HTML tags
    const plainText = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = plainText.split(' ');
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.length > 20) chunks.push(chunk); // Skip too-short chunks
    }

    return chunks;
  }
}
```

---

## 3.7 Tổng kết Integration Points

```
┌──────────────────┬─────────────────────────────┬──────────────────────┐
│ External Service │ Dùng cho                     │ Free Tier Limit      │
├──────────────────┼─────────────────────────────┼──────────────────────┤
│ Neon.tech (PG)   │ Primary database             │ 0.5GB, auto-suspend  │
│ Upstash (Redis)  │ Cache, rate limit, queue     │ 10K cmd/day, 256MB   │
│ Cloudinary       │ Video/image upload + CDN     │ 25GB storage, 25GB BW│
│ Groq API         │ AI Tutor (Llama 3.3 70B)    │ 30 req/min           │
│ Transformers.js  │ Local embeddings (384d)      │ Free (local, no API) │
│ Gmail SMTP       │ Transactional emails         │ 500/day              │
│ SePay            │ Payment QR + webhook         │ Unlimited, free      │
│ VietQR           │ Generate QR code URL         │ Unlimited, free      │
│ Sentry           │ Error tracking               │ 5K errors/month      │
│ cron-job.org     │ Keep-alive ping (Render)     │ Free                 │
└──────────────────┴─────────────────────────────┴──────────────────────┘
```
