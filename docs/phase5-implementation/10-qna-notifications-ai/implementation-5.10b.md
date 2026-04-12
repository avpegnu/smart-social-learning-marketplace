# Sub-phase 5.10b — NOTIFICATIONS MODULE

> Notification CRUD + WebSocket Gateway for realtime push.
> Prisma model: Notification (recipientId, type, data, isRead)

---

## Step 1: Module Structure

```
src/modules/notifications/
├── notifications.module.ts
├── notifications.service.ts
├── notifications.service.spec.ts
├── notifications.controller.ts
├── notifications.gateway.ts
├── notifications.gateway.spec.ts
└── dto/
    └── query-notifications.dto.ts
```

---

## Step 2: DTOs

### query-notifications.dto.ts

```typescript
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryNotificationsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  read?: boolean;
}
```

---

## Step 3: NotificationsGateway

```typescript
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: [
      process.env['STUDENT_PORTAL_URL'] || 'http://localhost:3001',
      process.env['MANAGEMENT_PORTAL_URL'] || 'http://localhost:3002',
    ],
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.['token'];
    if (!token || typeof token !== 'string') {
      client.disconnect();
      return;
    }
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
    // No cleanup needed — no online status tracking for notifications
  }

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

**Key points:**
- Same JWT auth pattern as ChatGateway
- No `@SubscribeMessage` — this is server-push only (no client→server events)
- `pushToUser`, `pushUnreadCount`, `pushOrderStatus` — called by NotificationsService

---

## Step 4: NotificationsService

```typescript
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsGateway) private readonly gateway: NotificationsGateway,
  ) {}

  async create(recipientId: string, type: NotificationType, data: Record<string, unknown>) {
    const notification = await this.prisma.notification.create({
      data: { recipientId, type, data },
    });

    // Push realtime
    this.gateway.pushToUser(recipientId, {
      id: notification.id,
      type: notification.type,
      data: notification.data,
      isRead: false,
      createdAt: notification.createdAt,
    });

    // Update badge count
    const unreadCount = await this.getUnreadCount(recipientId);
    this.gateway.pushUnreadCount(recipientId, unreadCount);

    return notification;
  }

  async getNotifications(userId: string, query: QueryNotificationsDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      ...(query.read !== undefined && { isRead: query.read }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return createPaginatedResult(notifications, total, query.page, query.limit);
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    }

    // Update badge
    const unreadCount = await this.getUnreadCount(userId);
    this.gateway.pushUnreadCount(userId, unreadCount);
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    this.gateway.pushUnreadCount(userId, 0);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }
}
```

**Key points:**
- `create` auto-pushes via WebSocket after DB save
- `markAsRead` uses `updateMany` (safe even if not found — but we throw for UX)
- `markAllAsRead` pushes 0 unread count immediately
- `read` filter: `?read=true` → only read, `?read=false` → only unread, omit → all

---

## Step 5: Controller

```typescript
@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly service: NotificationsService,
  ) {}

  @Get()
  async getNotifications(@CurrentUser() user: JwtPayload, @Query() query: QueryNotificationsDto) {
    return this.service.getNotifications(user.sub, query);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.service.getUnreadCount(user.sub);
    return { count };
  }

  @Put(':id/read')
  async markAsRead(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markAsRead(user.sub, id);
  }

  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllAsRead(user.sub);
  }
}
```

**Route order matters:** `read-all` must be before `:id/read` otherwise NestJS matches `read-all` as `:id`.

---

## Step 6: Module & Registration

```typescript
@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

**`exports: [NotificationsService]`** — Other modules (Social, Orders, QnA) will inject NotificationsService to create notifications:
- Like → `NOTIFICATION: POST_LIKE`
- Comment → `NOTIFICATION: POST_COMMENT`
- Order completed → `NOTIFICATION: ORDER_COMPLETED`
- Answer → `NOTIFICATION: QUESTION_ANSWERED`

---

## Step 7: Verify

- [ ] Create notification + auto-push via WebSocket
- [ ] List notifications with read/unread filter
- [ ] Unread count endpoint
- [ ] Mark single as read + update badge
- [ ] Mark all as read + push 0 count
- [ ] Gateway: JWT auth, user room join, disconnect
- [ ] `pushOrderStatus` available for webhook integration
- [ ] Route order: `read-all` before `:id/read`
- [ ] `@Inject()` pattern, no `any`
- [ ] Build 0 errors, Lint 0 errors, Tests pass
