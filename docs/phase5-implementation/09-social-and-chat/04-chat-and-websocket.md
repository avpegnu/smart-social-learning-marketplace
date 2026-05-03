# 04 — Chat & WebSocket: Real-time Messaging, Online Status, và Gateway Pattern

> Giải thích ChatService (conversations, messages, membership verification),
> ChatGateway (Socket.io, JWT auth, rooms, typing indicators), và Redis online tracking.

---

## 1. TỔNG QUAN ARCHITECTURE

### 1.1 Tại sao tách Social + Chat thành 2 modules?

```
SocialModule:                    ChatModule:
  ├── REST only                    ├── REST + WebSocket
  ├── Depends: PrismaService       ├── Depends: Prisma + JWT + Redis
  ├── Sync operations              ├── Async + realtime
  └── 26 endpoints                 ├── 4 REST endpoints
                                   └── 5 WebSocket events
```

**Tách vì:**
1. **Dependencies khác nhau** — Chat cần JwtService (gateway auth) + RedisService (online status)
2. **Protocol khác nhau** — Social = REST only, Chat = REST + WebSocket
3. **Avoid circular deps** — Gateway import ChatService, nếu gom chung sẽ phức tạp hơn

### 1.2 Files

```
src/modules/chat/
├── chat.module.ts
├── chat.service.ts           # Conversations + Messages CRUD
├── chat.controller.ts        # 4 REST endpoints (fallback)
├── chat.gateway.ts           # WebSocket Gateway (primary)
├── chat.service.spec.ts      # 11 tests
└── dto/
    ├── create-conversation.dto.ts
    └── send-message.dto.ts
```

---

## 2. CHAT SERVICE

### 2.1 Conversation — Get or Create Pattern

```typescript
async getOrCreateConversation(userId: string, dto: CreateConversationDto) {
  if (!dto.isGroup) {
    // 1-on-1: tìm existing trước
    const existing = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: dto.participantId } } },
        ],
      },
    });
    if (existing) return existing;  // Idempotent!

    // Không có → tạo mới
    return this.prisma.conversation.create({
      data: {
        members: { create: [{ userId }, { userId: dto.participantId }] },
      },
    });
  }
  // Group conversation...
}
```

**Tại sao "Get or Create"?**
- User A nhắn User B lần đầu → create conversation
- User A nhắn User B lần thứ 2 → return existing conversation
- Frontend không cần track "đã có conversation chưa" — backend handle
- Pattern tương tự `findOrCreate` trong Sequelize, `upsert` trong Prisma

**AND clause explained:**
```typescript
AND: [
  { members: { some: { userId } } },           // Có user A
  { members: { some: { userId: dto.participantId } } },  // VÀ có user B
]
```
- `some` = "at least one member matches"
- Cả 2 conditions → conversation chứa cả 2 users
- `isGroup: false` → chỉ 1-on-1 (loại group conversations)

### 2.2 Online Status — Redis TTL

```typescript
// Gateway handleConnection:
await this.redis.setex(`online:${userId}`, 300, '1');  // 5 min TTL

// Gateway handleDisconnect:
await this.redis.del(`online:${userId}`);

// ChatService getConversations:
const isOnline = !!(await this.redis.get(`online:${otherUser.userId}`));
```

**Tại sao dùng Redis TTL?**
1. **WebSocket disconnect không reliable** — network drop, browser crash → `handleDisconnect` có thể không fire
2. **TTL 300s = auto-expire** — nếu user disconnect mà server không biết → 5 phút sau key tự xóa
3. **Gateway refresh TTL** — mỗi message/action → `setex` lại (extend TTL)

```
Timeline:
  10:00 — User connects → SET online:user1 1 EX 300
  10:02 — User sends message → SETEX online:user1 300 1 (extend)
  10:07 — User idle 5 min → Key expired → Offline
  10:07 — User sends message → SETEX again → Online
```

### 2.3 Unread Count

```typescript
const unreadCount = m.lastReadAt
  ? await this.prisma.message.count({
      where: {
        conversationId: m.conversationId,
        createdAt: { gt: m.lastReadAt },    // After last read
        senderId: { not: userId },           // Not own messages
      },
    })
  : await this.prisma.message.count({
      where: {
        conversationId: m.conversationId,
        senderId: { not: userId },
      },
    });
```

**2 cases:**
1. **Has lastReadAt** → count messages after that timestamp
2. **No lastReadAt** (never read) → count ALL messages from others

**`senderId: { not: userId }`** — own messages don't count as unread

### 2.4 Membership Verification

```typescript
private async verifyMembership(conversationId: string, userId: string) {
  const member = await this.prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!member) throw new ForbiddenException({ code: 'NOT_CONVERSATION_MEMBER' });
  return member;
}

// Public version for gateway
async isMember(conversationId: string, userId: string): Promise<boolean> {
  const member = await this.prisma.conversationMember.findUnique({...});
  return !!member;
}
```

**Tại sao 2 methods?**
- `verifyMembership` — private, throws exception (for service internal use)
- `isMember` — public, returns boolean (for gateway — gateway handles error differently)

---

## 3. WEBSOCKET GATEWAY

### 3.1 NestJS WebSocket Concepts

```typescript
@WebSocketGateway({
  namespace: '/chat',           // Socket.io namespace
  cors: { origin: [...] },      // CORS cho browser connections
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;              // Socket.io Server instance
}
```

**NestJS gateway lifecycle:**
1. Client connects → `handleConnection(client: Socket)` called
2. Client sends event → `@SubscribeMessage('event_name')` handler called
3. Client disconnects → `handleDisconnect(client: Socket)` called

### 3.2 JWT Authentication on Connect

```typescript
async handleConnection(client: Socket) {
  // 1. Extract token from handshake
  const token = client.handshake.auth?.token || client.handshake.query?.['token'];
  if (!token || typeof token !== 'string') {
    client.disconnect();
    return;
  }

  try {
    // 2. Verify JWT (same secret as HTTP auth)
    const payload = this.jwtService.verify(token, {
      secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
    });

    // 3. Store userId on socket for future events
    const userId = payload.sub as string;
    client.data.userId = userId;

    // 4. Join personal room (for notifications)
    client.join(`user_${userId}`);

    // 5. Mark online in Redis
    await this.redis.setex(`online:${userId}`, 300, '1');
  } catch {
    client.disconnect();  // Invalid token → kick
  }
}
```

**`client.data.userId`** — Socket.io `data` property persists across events for this connection.

**`client.join('user_${userId}')`** — Personal room for sending direct notifications.

### 3.3 Room Pattern

```
Rooms:
  user_{userId}    — Personal room (1 user)
  conv_{convId}    — Conversation room (all online members)

Flow:
  1. User connects → auto-join user_123
  2. User opens chat → emit 'join_conversation' { conversationId }
     → Verify membership → join conv_abc
  3. User sends message → emit to conv_abc (all members see it)
  4. Typing indicator → emit to conv_abc (exclude sender)
```

### 3.4 Events

```typescript
// Client → Server
@SubscribeMessage('join_conversation')     // Join conversation room
@SubscribeMessage('send_message')          // Send message + broadcast
@SubscribeMessage('typing')                // Typing indicator
@SubscribeMessage('stop_typing')           // Stop typing
@SubscribeMessage('mark_read')             // Mark messages as read

// Server → Client (emitted)
'new_message'         // New message in conversation
'user_typing'         // Someone is typing
'user_stop_typing'    // Someone stopped typing
'message_read'        // Read receipt
```

### 3.5 Send Message — Full Flow

```typescript
@SubscribeMessage('send_message')
async handleSendMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string; content: string; type?: MessageType },
) {
  const userId = client.data.userId as string;

  // 1. Create SendMessageDto (typed, no `any`)
  const dto: SendMessageDto = Object.assign(new SendMessageDto(), {
    content: data.content,
    type: data.type,
  });

  // 2. Save to DB via service (verifies membership + creates message)
  const message = await this.chatService.sendMessage(userId, data.conversationId, dto);

  // 3. Broadcast to ALL members in conversation room (including sender)
  this.server.to(`conv_${data.conversationId}`).emit('new_message', message);

  return { success: true, messageId: message.id };
}
```

**`Object.assign(new SendMessageDto(), {...})`** thay vì `{...} as SendMessageDto`:
- Creates actual class instance (not just shaped object)
- Matches NestJS ValidationPipe expectations
- Avoids `any` type cast

### 3.6 Typing Indicator — client.to() vs server.to()

```typescript
@SubscribeMessage('typing')
handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: {...}) {
  // client.to() = broadcast to room EXCLUDING sender
  client.to(`conv_${data.conversationId}`).emit('user_typing', {
    userId: client.data.userId,
    conversationId: data.conversationId,
  });
}
```

**`client.to()` vs `this.server.to()`:**
- `client.to(room).emit(...)` — sends to all in room EXCEPT the sender socket
- `this.server.to(room).emit(...)` — sends to ALL in room INCLUDING sender

**Typing indicator dùng `client.to()`** — user không cần thấy "You are typing..."

**New message dùng `this.server.to()`** — sender cũng cần nhận message object (confirmation + UI update)

---

## 4. REST CONTROLLER — Fallback

```typescript
@Controller('conversations')
@ApiTags('Chat')
@ApiBearerAuth()
export class ChatController {
  @Get()              // GET /api/conversations
  @Post()             // POST /api/conversations (get or create)
  @Get(':id/messages') // GET /api/conversations/:id/messages
  @Post(':id/messages') // POST /api/conversations/:id/messages (REST fallback)
}
```

**Tại sao cần REST fallback cho messages?**
- WebSocket có thể disconnect (network issues)
- Server-side rendering (SSR) không có WebSocket
- API testing qua Swagger dễ hơn WebSocket
- Mobile apps có thể prefer REST cho background sync

---

## 5. MODULE — ChatModule

```typescript
@Module({
  imports: [JwtModule.register({})],  // For gateway JWT verification
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
```

**`JwtModule.register({})`** — empty options vì:
- Gateway dùng `jwtService.verify(token, { secret })` với explicit secret
- Không cần default secret/signOptions
- Secret lấy từ ConfigService at runtime
