# 02 — Notifications: CRUD, WebSocket Gateway, và Realtime Push Pattern

> Giải thích NotificationsModule — notification CRUD, WebSocket push (server→client),
> unread badge sync, gateway architecture, và integration pattern cho các modules khác.

---

## 1. TỔNG QUAN

### 1.1 Files đã tạo

```
src/modules/notifications/
├── notifications.module.ts             # Module definition
├── notifications.service.ts            # CRUD + auto-push via gateway
├── notifications.service.spec.ts       # 7 tests
├── notifications.controller.ts         # 4 REST endpoints
├── notifications.gateway.ts            # WebSocket (server→client only)
└── dto/
    └── query-notifications.dto.ts      # read filter + pagination
```

### 1.2 Architecture

```
                    ┌──────────────────────┐
                    │  NotificationsModule  │
                    │                      │
                    │  ┌────────────────┐  │
Other modules ────→ │  │ Notifications  │  │
(Social, Orders,    │  │ Service        │──│──→ Database (create notification)
 QnA, etc.)         │  │                │  │
                    │  │  ↓ calls       │  │
                    │  │                │  │
                    │  │ Notifications  │  │
                    │  │ Gateway        │──│──→ WebSocket push to client
                    │  └────────────────┘  │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │ Notifications  │  │
                    │  │ Controller     │──│──→ REST API (list, read, count)
                    │  └────────────────┘  │
                    └──────────────────────┘
```

**Separation of concerns:**
- **Service**: business logic (CRUD + push orchestration)
- **Gateway**: WebSocket transport (push to connected clients)
- **Controller**: REST API (read/manage notifications)

---

## 2. NOTIFICATION MODEL

### 2.1 Prisma Schema

```prisma
model Notification {
  id          String           @id @default(cuid())
  recipientId String           @map("recipient_id")
  type        NotificationType
  data        Json                 # Flexible payload
  isRead      Boolean          @default(false) @map("is_read")
  createdAt   DateTime         @default(now()) @map("created_at")

  @@index([recipientId, isRead])           # Filter read/unread
  @@index([recipientId, createdAt(sort: Desc)])  # Sorted list
}
```

### 2.2 NotificationType Enum — 14 Types

```prisma
enum NotificationType {
  FOLLOW                  # Someone followed you
  POST_LIKE               # Someone liked your post
  POST_COMMENT            # Someone commented on your post
  COURSE_ENROLLED         # Student enrolled in your course (instructor)
  COURSE_APPROVED         # Your course was approved (instructor)
  COURSE_REJECTED         # Your course was rejected (instructor)
  ORDER_COMPLETED         # Payment confirmed
  ORDER_EXPIRED           # Payment expired
  NEW_MESSAGE             # New chat message (offline)
  QUESTION_ANSWERED       # Someone answered your question
  ANSWER_VOTED            # Someone voted on your answer
  WITHDRAWAL_COMPLETED    # Withdrawal processed
  WITHDRAWAL_REJECTED     # Withdrawal rejected
  SYSTEM                  # System announcement
}
```

### 2.3 Data Field — Flexible JSON Payload

```typescript
// Mỗi notification type có payload khác nhau:

// POST_LIKE
{ actorId: "clx...", actorName: "Nguyễn Văn B", actorAvatar: "...", postId: "clx...", postPreview: "Vừa học xong..." }

// ORDER_COMPLETED
{ orderId: "clx...", orderCode: "SSLM-abc123", courseName: "React Mastery" }

// COURSE_APPROVED
{ courseId: "clx...", courseTitle: "React Mastery" }
```

**Tại sao dùng `Json` thay vì nhiều columns?**
- 14 notification types có data structure khác nhau
- Thêm columns cho mỗi type → table rất rộng, hầu hết NULL
- JSON flexible: mỗi type define own shape
- Frontend parse dựa trên `type` field

---

## 3. NOTIFICATIONS GATEWAY — Server-Push Only

### 3.1 Lý thuyết: 2 loại WebSocket Gateway

```
ChatGateway (Phase 5.9):
  ├── Bidirectional: Client ↔ Server
  ├── @SubscribeMessage: join_conversation, send_message, typing, mark_read
  └── Client gửi events → Server xử lý → Broadcast

NotificationsGateway (Phase 5.10b):
  ├── Unidirectional: Server → Client only
  ├── NO @SubscribeMessage handlers
  └── Server push notifications → Client receives
```

**Notifications gateway đơn giản hơn Chat:**
- Client chỉ cần NHẬN notifications, không cần GỬI
- Connection chỉ để join `user_{userId}` room
- Tất cả events là server-initiated

### 3.2 Implementation

```typescript
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: [...] },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // JWT auth — same pattern as ChatGateway
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.['token'];
    if (!token || typeof token !== 'string') { client.disconnect(); return; }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.join(`user_${payload.sub as string}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // No cleanup — no online status tracking for notifications
  }

  // Public methods — called by NotificationsService
  pushToUser(userId: string, notification: Record<string, unknown>) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  pushUnreadCount(userId: string, count: number) {
    this.server.to(`user_${userId}`).emit('unread_count', { count });
  }

  pushOrderStatus(userId: string, orderId: string, status: string) {
    this.server.to(`user_${userId}`).emit('order_status_changed', { orderId, status });
  }
}
```

### 3.3 3 Push Methods

| Method | Event | Use case |
|--------|-------|----------|
| `pushToUser` | `notification` | Toast notification (new like, comment, etc.) |
| `pushUnreadCount` | `unread_count` | Badge number update (🔔 5) |
| `pushOrderStatus` | `order_status_changed` | Payment page polling replacement |

**`pushOrderStatus` flow:**
```
User tạo order → Scan QR → Chuyển khoản
  ↓
SePay webhook → Backend process payment
  ↓
Backend: this.gateway.pushOrderStatus(userId, orderId, 'COMPLETED')
  ↓
Frontend: Payment page receives → Show "Thanh toán thành công!" ✅
```

**Không cần polling!** WebSocket push thay vì `setInterval(() => checkStatus(), 3000)`.

### 3.4 Không có `handleDisconnect` cleanup

```typescript
handleDisconnect(_client: Socket) {
  // No cleanup — no online status tracking for notifications
}
```

**So sánh với ChatGateway:**
- Chat: `handleDisconnect` → `redis.del('online:${userId}')` (online status)
- Notifications: không track online status → no cleanup needed
- `_client` prefix: TypeScript unused parameter convention

---

## 4. NOTIFICATIONS SERVICE — Create + Auto-Push

### 4.1 Create Flow

```typescript
async create(recipientId: string, type: NotificationType, data: Record<string, unknown>) {
  // 1. Save to DB
  const notification = await this.prisma.notification.create({
    data: {
      recipientId,
      type,
      data: data as Prisma.InputJsonValue,  // JSON type cast
    },
  });

  // 2. Push notification to user (if online)
  this.gateway.pushToUser(recipientId, {
    id: notification.id,
    type: notification.type,
    data: notification.data,
    isRead: false,
    createdAt: notification.createdAt,
  });

  // 3. Update badge count
  const unreadCount = await this.getUnreadCount(recipientId);
  this.gateway.pushUnreadCount(recipientId, unreadCount);

  return notification;
}
```

**Key design: Service orchestrates, Gateway transports.**

```
NotificationsService.create()
  ├── prisma.notification.create()        → DB write
  ├── gateway.pushToUser()                → WebSocket push (if online)
  └── gateway.pushUnreadCount()           → Badge update

Nếu user offline:
  ├── DB write succeeds                   → notification saved
  ├── WebSocket push silently fails       → no error (room empty)
  └── User sees notification khi login    → GET /api/notifications
```

**`pushToUser` khi user offline?**
- `server.to('user_123').emit(...)` — nếu room trống (user offline) → silently does nothing
- Không throw error, không cần check online status trước
- Socket.io handles gracefully

### 4.2 Gateway Injection Pattern

```typescript
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsGateway) private readonly gateway: NotificationsGateway,
  ) {}
}
```

**Gateway injected INTO Service (not the other way around):**
- Service = business logic owner → orchestrates when to push
- Gateway = transport layer → just emits events
- Service calls `gateway.pushToUser()` — Service controls logic, Gateway handles delivery

**Alternative (wrong):** Gateway inject Service → Gateway decides when to push → mixes transport + business logic.

### 4.3 Caller Pattern — How Other Modules Create Notifications

```typescript
// In SocialModule — PostsService (future integration)
@Injectable()
export class PostsService {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async toggleLike(userId: string, postId: string) {
    // ... like logic ...

    // Notify post author
    await this.notifications.create(
      post.authorId,
      'POST_LIKE',
      {
        actorId: userId,
        actorName: user.fullName,
        postId,
        postPreview: post.content?.slice(0, 50),
      },
    );
  }
}
```

**`exports: [NotificationsService]` trong NotificationsModule** — cho phép các modules khác inject và gọi `create()`.

---

## 5. REST API — Read + Manage

### 5.1 Route Order Matters

```typescript
@Controller('notifications')
export class NotificationsController {
  @Get()                    // GET /api/notifications
  @Get('unread-count')      // GET /api/notifications/unread-count
  @Put('read-all')          // PUT /api/notifications/read-all      ← TRƯỚC :id
  @Put(':id/read')          // PUT /api/notifications/:id/read      ← SAU read-all
}
```

**`read-all` phải trước `:id/read`:**
- NestJS matches routes top-to-bottom
- Nếu `:id/read` trước: `PUT /api/notifications/read-all/read` → `:id = "read-all"` → ParseCuidPipe fail
- Đặt static routes (`read-all`) trước dynamic routes (`:id/read`)

### 5.2 Read Filter

```typescript
async getNotifications(userId: string, query: QueryNotificationsDto) {
  const where: Prisma.NotificationWhereInput = {
    recipientId: userId,
    ...(query.read !== undefined && { isRead: query.read }),
  };
}
```

**QueryNotificationsDto transform:**
```typescript
@Transform(({ value }) =>
  value === 'true' ? true : value === 'false' ? false : undefined,
)
read?: boolean;
```

- Query string `?read=false` → `value = "false"` (string)
- Transform: `"false"` → `false` (boolean)
- Omit `?read` → `undefined` → no filter (show all)

### 5.3 markAsRead — `updateMany` not `update`

```typescript
async markAsRead(userId: string, notificationId: string) {
  const result = await this.prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId },  // Both conditions!
    data: { isRead: true },
  });
  if (result.count === 0) {
    throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
  }
}
```

**Tại sao `updateMany` + check count?**
- `update` requires unique field(s) only → can't filter by `recipientId`
- `updateMany` accepts any where clause → ensures `recipientId = userId` (ownership check)
- `result.count === 0` means: notification not found OR not owned by user → 404

**Security: prevents marking other users' notifications as read.**

---

## 6. TESTING

### 6.1 Mock Gateway

```typescript
const mockGateway = {
  pushToUser: jest.fn(),
  pushUnreadCount: jest.fn(),
  pushOrderStatus: jest.fn(),
};

// In module setup:
{ provide: NotificationsGateway, useValue: mockGateway }
```

**Gateway mocked — not the full WebSocket server:**
- Service tests only verify that `pushToUser` and `pushUnreadCount` are CALLED correctly
- Actual WebSocket transport is Gateway's responsibility (tested separately if needed)

### 6.2 Key Test Cases

```
create:
  ✓ Creates notification in DB
  ✓ Calls gateway.pushToUser with correct payload
  ✓ Calls gateway.pushUnreadCount with current count

getNotifications:
  ✓ Returns paginated notifications
  ✓ Filters by read status

markAsRead:
  ✓ Updates isRead + pushes new badge count
  ✓ Throws NotFoundException if not found/not owned

markAllAsRead:
  ✓ Updates all unread + pushes count=0

getUnreadCount:
  ✓ Returns correct count
```

---

## 7. TYPE IMPORT — `NotificationType`

```typescript
// ✅ Correct — import type (only used as parameter type annotation)
import type { Prisma, NotificationType } from '@prisma/client';
```

**Ban đầu:**
```typescript
// ❌ ESLint error — value import but only used as type
import type { Prisma } from '@prisma/client';
import { NotificationType } from '@prisma/client';
```

**Fix:** Gom vào 1 `import type` statement vì cả `Prisma` và `NotificationType` đều chỉ dùng trong type positions (parameter type annotations, not runtime values).

**Khi nào cần value import?**
- `instanceof Prisma.PrismaClientKnownRequestError` — runtime check
- `NotificationType.POST_LIKE` — runtime enum value
- Ở đây: `type: NotificationType` chỉ là type annotation → `import type` đủ
