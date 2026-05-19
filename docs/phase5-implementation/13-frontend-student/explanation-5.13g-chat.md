# Giải thích chi tiết — Chat & Real-time (Phase 5.13g)

## 1. Tổng quan

Phase 5.13g implement tính năng **Chat real-time** cho nền tảng SSLM, bao gồm:

- **Chat 1-on-1** — Nhắn tin trực tiếp giữa 2 người dùng (Messenger-style)
- **Group Chat** — Tạo nhóm chat với nhiều thành viên, đặt tên nhóm
- **WebSocket real-time** — Tin nhắn gửi/nhận tức thì qua Socket.io, không cần reload
- **Typing indicator** — Hiển thị khi đối phương đang gõ, với debounce 2 giây
- **Online status** — Hiển thị trạng thái online/offline qua Redis TTL
- **Unread badge** — Đếm tin nhắn chưa đọc, hiển thị trên navbar
- **Infinite scroll ngược** — Cuộn lên để tải tin nhắn cũ hơn
- **REST API fallback** — API endpoint dự phòng khi WebSocket không khả dụng

### Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Student Portal)                    │
│                                                                  │
│  ChatPage ──┬── ConversationList ──┬── ConversationItem          │
│             │                      ├── UserSearchItem            │
│             │                      └── NewGroupDialog            │
│             └── MessagePanel ──────┬── MessageItem               │
│                                    ├── MessageInput              │
│                                    └── TypingIndicator           │
│                                                                  │
│  SocketProvider ──┬── useChatSocket (namespace: /chat)           │
│                   └── useNotificationSocket (namespace: /notif)  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Socket.io (WebSocket transport)
                           │ REST API (TanStack Query)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (NestJS API)                        │
│                                                                  │
│  ChatGateway (WS /chat) ────┐                                   │
│  ChatController (REST) ─────┤── ChatService ── Prisma ── DB     │
│                              │                                   │
│                              └── RedisService ── Redis (online)  │
└─────────────────────────────────────────────────────────────────┘
```

### Kiến trúc 3 tầng + WebSocket

Khác với các tính năng khác (Q&A, Social) chỉ dùng REST API, Chat sử dụng **dual transport**:

```
[Frontend Components]
        |
   ┌────┴────┐
   |         |
[useChatSocket]   [TanStack Query Hooks]
   |  (WS)        |  (REST)
   |         ┌────┴────┐
   |    [Shared Services] ── apiClient
   |         |
   ▼         ▼
[ChatGateway]  [ChatController]
   |              |
   └──────┬───────┘
          ▼
    [ChatService]
          |
    [Prisma + Redis]
```

- **WebSocket (Socket.io)**: Dùng cho gửi/nhận tin nhắn real-time, typing indicator, mark read, online status
- **REST API (TanStack Query)**: Dùng cho danh sách conversations, load messages (infinite scroll), tạo conversation mới, REST fallback gửi tin nhắn

---

## 2. Kiến trúc WebSocket

### 2.1 Socket.io Gateway (Backend)

**File:** `apps/api/src/modules/chat/chat.gateway.ts`

Gateway là lớp xử lý WebSocket ở backend, tương đương với Controller nhưng cho giao thức WebSocket thay vì HTTP.

#### Namespace `/chat`

```typescript
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: [
      process.env['STUDENT_PORTAL_URL'] || 'http://localhost:3001',
      process.env['MANAGEMENT_PORTAL_URL'] || 'http://localhost:3002',
    ],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
```

**Giải thích:**
- `namespace: '/chat'` — Tách biệt WebSocket cho chat ra namespace riêng. Frontend kết nối đến `ws://api-server/chat` thay vì root `/`. Điều này cho phép nhiều gateway cùng tồn tại mà không xung đột (ví dụ `/chat` và `/notifications`).
- `cors.origin` — Chỉ cho phép 2 portal kết nối, bảo mật tương tự CORS của HTTP.
- `OnGatewayConnection` / `OnGatewayDisconnect` — NestJS lifecycle interfaces, bắt sự kiện client kết nối/ngắt kết nối.

#### Connection Lifecycle

Khi client kết nối, Gateway thực hiện 3 bước:

```typescript
async handleConnection(client: Socket) {
  // 1. Lấy JWT token từ handshake
  const token = client.handshake.auth?.token || client.handshake.query?.['token'];
  if (!token || typeof token !== 'string') {
    client.disconnect();    // Không có token → kick
    return;
  }
  try {
    // 2. Verify JWT (dùng access secret)
    const payload = this.jwtService.verify(token, {
      secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
    });
    const userId = payload.sub as string;

    // 3. Lưu userId vào socket data + join personal room + set online
    client.data.userId = userId;
    client.join(`user_${userId}`);            // Personal room
    await this.redis.setex(`online:${userId}`, 300, '1');  // Online 5 phút
  } catch {
    client.disconnect();    // Token invalid → kick
  }
}
```

**Luồng kết nối:**

```
Client connect
    ↓
Token trong handshake.auth?
    ├── Không → disconnect()
    └── Có → verify JWT
              ├── Fail → disconnect()
              └── OK → client.data.userId = userId
                        client.join(`user_${userId}`)      // Personal room
                        redis.setex(`online:${userId}`, 300)  // TTL 5 phút
```

**Personal room `user_${userId}`**: Mỗi user có 1 room riêng, dùng để gửi notification khi user không ở trong conversation room. Ví dụ: user A gửi tin nhắn cho user B, nhưng B đang ở trang khác (không join `conv_xxx`), thì gateway gửi `new_message_notification` vào `user_B` room.

**Khi ngắt kết nối:**

```typescript
async handleDisconnect(client: Socket) {
  if (client.data.userId) {
    await this.redis.del(`online:${client.data.userId as string}`);
  }
}
```

Xóa key `online:{userId}` khỏi Redis → user trở thành offline.

#### 6 Events của Gateway

| Event (Client gửi) | Server xử lý | Server emit |
|---------------------|---------------|-------------|
| `join_conversation` | Verify membership, client.join room | `{ success: true }` (ack) |
| `send_message` | Tạo message via ChatService | `new_message` (to room), `new_message_notification` (to absent members) |
| `typing` | — | `user_typing` (to room, except sender) |
| `stop_typing` | — | `user_stop_typing` (to room, except sender) |
| `mark_read` | Update lastReadAt via ChatService | `message_read` (to room), `mark_read_confirmed` (to sender) |

### 2.2 Socket Provider (Frontend)

**File:** `apps/student-portal/src/components/providers/socket-provider.tsx`

```typescript
export function SocketProvider() {
  useNotificationSocket();
  useChatSocket();
  return null;    // Render nothing — chỉ activate hooks
}
```

`SocketProvider` là một "invisible component" — nó không render UI, chỉ khởi tạo 2 WebSocket connections. Được đặt trong layout để đảm bảo socket sống suốt session của user.

**Vị trí trong layout tree:**

```
(main)/layout.tsx    → SocketProvider + Navbar + Footer + MobileNav
(fullscreen)/layout.tsx → SocketProvider + Navbar (không Footer)
```

Cả 2 layouts đều có `SocketProvider`, đảm bảo WebSocket luôn active dù user ở route nào.

#### useChatSocket Hook

**File:** `packages/shared-hooks/src/use-chat-socket.ts`

Hook này quản lý toàn bộ lifecycle của chat WebSocket connection:

```typescript
export function useChatSocket(callbacks?: ChatSocketCallbacks) {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // 1. Kết nối đến namespace /chat
    const socket = io(`${SOCKET_URL}/chat`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    // 2. Listen server events
    socket.on('new_message', (message) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(message.conversationId) });
    });

    socket.on('user_typing', (data) => {
      callbacksRef.current?.onTyping?.(data);
    });

    socket.on('user_stop_typing', (data) => {
      callbacksRef.current?.onStopTyping?.(data);
    });

    socket.on('message_read', (data) => {
      callbacksRef.current?.onMessageRead?.(data);
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });

    socket.on('mark_read_confirmed', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });

    socket.on('new_message_notification', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [isAuthenticated, accessToken, queryClient]);

  // 3. Expose emit functions
  const joinConversation = useCallback((id: string) => {
    socketRef.current?.emit('join_conversation', { conversationId: id });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    socketRef.current?.emit('send_message', { conversationId, content, type: 'TEXT' });
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('stop_typing', { conversationId });
  }, []);

  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit('mark_read', { conversationId });
  }, []);

  return { socket: socketRef.current, joinConversation, sendMessage, sendTyping, stopTyping, markRead };
}
```

**Điểm đặc biệt:**

1. **`callbacksRef` pattern**: Callbacks được lưu trong `useRef` thay vì truyền trực tiếp vào `useEffect`. Lý do: nếu truyền `callbacks` vào dependency array của `useEffect`, mỗi lần parent re-render sẽ tạo object mới → useEffect chạy lại → disconnect + reconnect socket. Dùng `ref` giúp callbacks luôn up-to-date mà không trigger reconnect.

2. **`queryClient.invalidateQueries`**: Khi nhận tin nhắn mới qua WebSocket, hook không tự quản lý state mà invalidate TanStack Query cache. Điều này khiến TanStack Query tự động refetch data mới từ REST API, đảm bảo consistency giữa WebSocket data và REST data.

3. **`transports: ['websocket']`**: Bỏ qua HTTP long-polling fallback, kết nối thẳng WebSocket. Trong môi trường production (Vercel, Render), WebSocket thường được support tốt.

#### useNotificationSocket Hook

**File:** `packages/shared-hooks/src/use-notification-socket.ts`

Tương tự `useChatSocket` nhưng cho namespace `/notifications`:

```typescript
const socket = io(`${SOCKET_URL}/notifications`, {
  auth: { token: accessToken },
  transports: ['websocket'],
});

socket.on('notification', () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
  toast.info('New notification');
});

socket.on('unread_count', (data: { count: number }) => {
  queryClient.setQueryData(queryKeys.notifications.unreadCount, { data });
});
```

**So sánh 2 hooks:**

| | `useChatSocket` | `useNotificationSocket` |
|---|---|---|
| Namespace | `/chat` | `/notifications` |
| Events listened | 6 (new_message, typing, etc.) | 2 (notification, unread_count) |
| Callbacks | Có (typing, stop_typing, read) | Không |
| Emit functions | 5 (join, send, typing, stop, mark) | Không |
| Reconnection | 5 attempts | Default |

### 2.3 So sánh WebSocket vs REST vs SSE

| Tiêu chí | WebSocket (Socket.io) | REST API | SSE (Server-Sent Events) |
|-----------|----------------------|----------|--------------------------|
| **Hướng giao tiếp** | Bi-directional (2 chiều) | Request-Response (1 chiều) | Server → Client (1 chiều) |
| **Use case trong SSLM** | Chat, typing, online status | CRUD operations, initial data load | AI Tutor streaming |
| **Persistent connection** | Có (luôn mở) | Không (mở-đóng mỗi request) | Có (server push) |
| **Overhead** | Thấp (binary frames) | Cao (HTTP headers mỗi request) | Trung bình (text stream) |
| **Real-time** | Instant | Polling needed | Instant (server → client only) |
| **Ví dụ cụ thể** | `send_message` → `new_message` | `GET /conversations` | AI response streaming |

**Tại sao Chat dùng WebSocket thay vì SSE?**
- Chat cần **2 chiều**: client gửi tin nhắn (`send_message`) VÀ nhận tin nhắn (`new_message`)
- SSE chỉ hỗ trợ server → client, không thể gửi data từ client lên server qua cùng connection
- AI Tutor dùng SSE vì chỉ cần stream response từ server (1 chiều), client gửi prompt qua POST request riêng

---

## 3. Flow chi tiết

### 3.1 Kết nối WebSocket

**Trigger:** User đăng nhập thành công → `isAuthenticated = true`, `accessToken` có giá trị

```
1. SocketProvider mount (trong layout)
2. useChatSocket() chạy useEffect
3. Kiểm tra isAuthenticated && accessToken
4. io('http://localhost:3000/chat', { auth: { token }, transports: ['websocket'] })
5. Server: handleConnection()
   - Verify JWT → extract userId
   - client.join(`user_${userId}`)     ← Personal room
   - redis.setex(`online:${userId}`, 300, '1')  ← Online 5 phút
6. Socket connected ✓
```

**Reconnection flow:**
- Socket.io tự động retry kết nối khi bị ngắt (max 5 lần)
- Khi access token hết hạn (15 phút), frontend refresh token → accessToken thay đổi → useEffect cleanup (disconnect cũ) + tạo connection mới
- `reconnectionAttempts: 5` — sau 5 lần thất bại sẽ dừng retry

### 3.2 Tìm kiếm người dùng (Messenger-style search)

**File:** `apps/student-portal/src/components/chat/conversation-list.tsx`

Khi user gõ vào thanh tìm kiếm, hệ thống thực hiện **dual search** — vừa lọc conversations hiện có, vừa tìm kiếm users mới:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);  // Debounce 300ms

// 1. Lọc conversations theo tên (client-side filter)
const filteredConversations = isSearching
  ? conversations.filter((conv) => {
      if (conv.isGroup && conv.name)
        return conv.name.toLowerCase().includes(query);
      return conv.participants.some(
        (p) => p.id !== currentUser?.id && p.fullName.toLowerCase().includes(query),
      );
    })
  : conversations;

// 2. Tìm user mới (server-side search)
const { data: usersRaw } = useSearchUsers(debouncedQuery);
const searchedUsers = ((usersRaw as { data?: UserResult[] })?.data ?? []) as UserResult[];
```

**UI khi đang search:**

```
┌─────────────────────────────┐
│  🔍 "Nguyễn"               │   ← Search input
├─────────────────────────────┤
│  CONVERSATIONS              │   ← Header nhỏ
│  ┌─────────────────────────┐│
│  │ 🟢 Nguyễn Văn A         ││   ← Conversation đã có, filter client-side
│  │   "Chào bạn!"           ││
│  └─────────────────────────┘│
│  PEOPLE                     │   ← Header nhỏ
│  ┌─────────────────────────┐│
│  │ 👤 Nguyễn Thị B         ││   ← User tìm thấy, click → tạo conversation
│  │              Start chat →││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ 👤 Nguyễn Văn C         ││
│  │              Start chat →││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### 3.3 Tạo conversation (1-on-1 get-or-create)

Khi user click vào một `UserSearchItem`, hệ thống dùng pattern **get-or-create**:

```typescript
// Frontend: conversation-list.tsx
const handleUserClick = useCallback((userId: string) => {
  getOrCreate.mutate(
    { participantId: userId },
    { onSuccess: handleMutateSuccess },
  );
}, [getOrCreate, handleMutateSuccess]);
```

**Backend flow:**

```typescript
// ChatService.getOrCreateConversation()
async getOrCreateConversation(userId: string, dto: CreateConversationDto) {
  if (!dto.isGroup) {
    // 1. Tìm conversation 1-on-1 đã tồn tại
    const existing = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId } } },           // User hiện tại
          { members: { some: { userId: dto.participantId } } },  // User kia
        ],
      },
      include: {
        members: { include: { user: { select: AUTHOR_SELECT } } },
      },
    });
    if (existing) return existing;  // Đã có → trả về luôn

    // 2. Chưa có → tạo mới
    return this.prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: dto.participantId }],
        },
      },
      include: {
        members: { include: { user: { select: AUTHOR_SELECT } } },
      },
    });
  }
  // ... group logic
}
```

**Tại sao get-or-create?**
- Giống Messenger: click vào avatar bạn bè → mở conversation cũ nếu đã chat, hoặc tạo mới nếu chưa
- Tránh tạo duplicate conversations giữa 2 người
- Prisma query dùng `AND` + `some` để tìm conversation mà **cả hai** đều là member

### 3.4 Tạo group chat

**File:** `apps/student-portal/src/components/chat/new-group-dialog.tsx`

UI Dialog bao gồm:
1. Input nhập tên nhóm
2. Input tìm kiếm user (debounce 300ms)
3. Danh sách search results (click để thêm)
4. Chips hiển thị user đã chọn (click X để xóa)

```typescript
const handleCreate = useCallback(() => {
  if (!groupName.trim() || selectedUsers.length === 0) return;
  onCreate(
    groupName.trim(),
    selectedUsers.map((u) => u.id),
  );
  // Reset state
  setGroupName('');
  setSearchQuery('');
  setSelectedUsers([]);
}, [groupName, selectedUsers, onCreate]);
```

**Backend — Group creation:**

```typescript
// ChatService.getOrCreateConversation() — isGroup = true
const participantIds = [userId, ...(dto.participantIds ?? [])];  // Owner + selected users
return this.prisma.conversation.create({
  data: {
    isGroup: true,
    name: dto.name,          // "Nhóm Lập trình Web"
    members: {
      create: participantIds.map((id) => ({ userId: id })),
    },
  },
  include: {
    members: { include: { user: { select: AUTHOR_SELECT } } },
  },
});
```

**Lưu ý:** Group chat KHÔNG dùng get-or-create. Mỗi lần tạo group luôn tạo conversation mới, vì group có tên và thành phần khác nhau.

### 3.5 Gửi tin nhắn (WebSocket flow)

Đây là flow phức tạp nhất, liên quan cả frontend optimistic update và backend broadcasting.

**Step 1: User gõ tin nhắn và nhấn Enter**

```typescript
// message-input.tsx
const handleSend = useCallback(() => {
  const trimmed = value.trim();
  if (!trimmed) return;
  onSend(trimmed);
  setValue('');
  resetTextareaHeight();
  // Stop typing indicator
  if (isTypingRef.current) {
    isTypingRef.current = false;
    onStopTyping();
  }
}, [value, onSend, onStopTyping, resetTextareaHeight]);
```

**Step 2: MessagePanel tạo optimistic message**

```typescript
// message-panel.tsx
const handleSend = useCallback((content: string) => {
  if (!conversation || !currentUser) return;
  shouldScrollRef.current = true;  // Flag để auto-scroll xuống dưới

  // Optimistic: hiển thị tin nhắn ngay lập tức (không chờ server)
  const optimisticMsg: MessageData = {
    id: `temp-${Date.now()}`,           // ID tạm
    content,
    type: 'TEXT',
    senderId: currentUser.id,
    sender: {
      id: currentUser.id,
      fullName: currentUser.fullName ?? '',
      avatarUrl: currentUser.avatarUrl ?? null,
    },
    createdAt: new Date().toISOString(),  // Timestamp hiện tại
  };
  setLocalMessages((prev) => [...prev, optimisticMsg]);

  onSendMessage(conversation.id, content);  // Gửi qua WebSocket
}, [conversation, currentUser, onSendMessage]);
```

**Step 3: ChatPage gửi qua WebSocket**

```typescript
// chat/page.tsx
const handleSendMessage = useCallback((conversationId: string, content: string) => {
  sendMessage(conversationId, content);  // từ useChatSocket
}, [sendMessage]);
```

```typescript
// use-chat-socket.ts
const sendMessage = useCallback((conversationId: string, content: string) => {
  socketRef.current?.emit('send_message', {
    conversationId,
    content,
    type: 'TEXT',
  });
}, []);
```

**Step 4: Backend xử lý**

```typescript
// chat.gateway.ts
@SubscribeMessage('send_message')
async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() data) {
  const userId = client.data.userId as string;

  // 1. Lưu message vào DB
  const message = await this.chatService.sendMessage(userId, data.conversationId, dto);

  // 2. Broadcast cho tất cả members trong conversation room
  this.server.to(`conv_${data.conversationId}`).emit('new_message', message);

  // 3. Notify members KHÔNG ở trong room
  const members = await this.chatService.getConversationMembers(data.conversationId);
  const roomSockets = await this.server.in(`conv_${data.conversationId}`).fetchSockets();
  const activeUserIds = new Set(roomSockets.map((s) => s.data.userId as string));

  for (const member of members) {
    if (member.userId !== userId && !activeUserIds.has(member.userId)) {
      // User không ở trong conv room → gửi notification qua personal room
      this.server.to(`user_${member.userId}`).emit('new_message_notification', {
        conversationId: data.conversationId,
        senderId: userId,
        content: data.content.slice(0, 100),  // Preview 100 ký tự
      });
    }
  }

  return { success: true, messageId: message.id };
}
```

**Step 5: Frontend nhận `new_message`**

```typescript
// use-chat-socket.ts
socket.on('new_message', (message: { conversationId: string }) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
  queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(message.conversationId) });
});
```

Khi TanStack Query invalidate → refetch messages → `serverMessages` cập nhật → `localMessages` (optimistic) bị clear:

```typescript
// message-panel.tsx
useEffect(() => {
  if (serverMessages.length > 0) setLocalMessages([]);
}, [serverMessages.length]);
```

**Tóm tắt luồng gửi tin nhắn:**

```
User nhấn Enter
    ↓
[MessageInput] → onSend(content)
    ↓
[MessagePanel] → tạo optimistic msg (id: temp-xxx) → setLocalMessages
               → onSendMessage(convId, content)
    ↓
[ChatPage] → sendMessage(convId, content) via useChatSocket
    ↓
[Socket.io emit] → 'send_message' { conversationId, content, type: 'TEXT' }
    ↓ (WebSocket)
[ChatGateway] → chatService.sendMessage() → Prisma → DB
              → server.to(`conv_xxx`).emit('new_message', message)
              → server.to(`user_yyy`).emit('new_message_notification', ...) // absent members
    ↓ (WebSocket)
[useChatSocket] → socket.on('new_message') → invalidateQueries
    ↓
[TanStack Query] → refetch messages → serverMessages cập nhật
    ↓
[MessagePanel] → localMessages = [] (clear optimistic) → render serverMessages
```

### 3.6 Nhận tin nhắn real-time

Khi user B (receiver) đang mở conversation với user A (sender):

1. User B đã `join_conversation` (khi chọn conversation) → socket ở trong room `conv_xxx`
2. Server emit `new_message` → user B nhận được
3. `useChatSocket` invalidate query → TanStack Query refetch → messages render

Khi user B **KHÔNG** ở trong conversation (đang ở trang khác):

1. User B chưa join room `conv_xxx`, nhưng socket vẫn connect (SocketProvider active)
2. Server emit `new_message_notification` vào `user_B` room
3. `useChatSocket` nhận event → invalidate `queryKeys.chat.conversations`
4. Navbar refetch conversations → cập nhật `totalChatUnread` → hiển thị badge

### 3.7 Typing indicator (debounce pattern)

**Frontend — MessageInput:**

```typescript
// message-input.tsx
const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const isTypingRef = useRef(false);

const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
  setValue(e.target.value);

  // 1. Bắt đầu typing (chỉ emit 1 lần khi bắt đầu gõ)
  if (!isTypingRef.current) {
    isTypingRef.current = true;
    onTyping();    // emit 'typing' event
  }

  // 2. Reset timeout (mỗi keystroke reset lại 2 giây)
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }
  typingTimeoutRef.current = setTimeout(() => {
    isTypingRef.current = false;
    onStopTyping();    // emit 'stop_typing' event
    typingTimeoutRef.current = null;
  }, 2000);  // 2 giây không gõ → stop typing
}, [onTyping, onStopTyping]);
```

**Logic debounce:**

```
Keystroke 1 → isTyping=false → emit 'typing', set isTyping=true, start timer 2s
Keystroke 2 (0.5s sau) → isTyping=true (skip emit), reset timer 2s
Keystroke 3 (0.3s sau) → isTyping=true (skip emit), reset timer 2s
... (ngừng gõ) ...
2s timeout → emit 'stop_typing', set isTyping=false

Khi gửi tin nhắn:
Enter → emit 'stop_typing' ngay lập tức, clear timer
```

**Backend broadcast:**

```typescript
// chat.gateway.ts
@SubscribeMessage('typing')
handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data) {
  // Gửi cho tất cả members TRONG room, TRỪ sender
  client.to(`conv_${data.conversationId}`).emit('user_typing', {
    userId: client.data.userId,
    conversationId: data.conversationId,
  });
}
```

Lưu ý: `client.to(room).emit()` — dùng `client.to()` thay vì `this.server.to()` để **exclude sender** (sender không cần nhận typing của chính mình).

**Frontend — ChatPage nhận typing:**

```typescript
// chat/page.tsx
const handleTypingEvent = useCallback((data) => {
  if (data.userId === currentUser?.id) return;  // Bỏ qua typing của chính mình
  setTypingUsers((prev) => {
    const next = new Map(prev);
    const users = new Set(next.get(data.conversationId) ?? []);
    users.add(data.userId);
    next.set(data.conversationId, users);
    return next;
  });
}, [currentUser?.id]);
```

**State structure:** `Map<conversationId, Set<userId>>` — mỗi conversation theo dõi nhiều user đang typing (hữu ích cho group chat).

**TypingIndicator component:**

```typescript
// typing-indicator.tsx
export function TypingIndicator({ typingUserNames }: TypingIndicatorProps) {
  if (typingUserNames.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
        <div className="flex items-center gap-2">
          {/* 3 dots animation (staggered bounce) */}
          <div className="flex gap-0.5">
            <div className="... animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="... animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="... animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-muted-foreground text-xs">
            {displayName} {t('typing')}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Hiển thị 3 chấm nhảy (staggered animation delay 0ms → 150ms → 300ms) kèm tên người đang gõ.

### 3.8 Mark as read (unread badge clear)

**Trigger:** User chọn conversation → `handleSelectConversation`

```typescript
// chat/page.tsx
const handleSelectConversation = useCallback((id: string) => {
  setActiveConversationId(id);
  setShowList(false);
  joinConversation(id);    // Join WebSocket room
  markRead(id);            // Mark as read
}, [joinConversation, markRead]);
```

**Backend:**

```typescript
// chat.service.ts
async markRead(conversationId: string, userId: string) {
  await this.prisma.conversationMember.update({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    data: { lastReadAt: new Date() },  // Cập nhật thời điểm đọc cuối
  });
}
```

```typescript
// chat.gateway.ts
@SubscribeMessage('mark_read')
async handleMarkRead(@ConnectedSocket() client, @MessageBody() data) {
  const userId = client.data.userId as string;
  await this.chatService.markRead(data.conversationId, userId);

  // 1. Notify room (other members biết user đã đọc)
  client.to(`conv_${data.conversationId}`).emit('message_read', {
    userId,
    conversationId: data.conversationId,
  });

  // 2. Confirm back to sender (UI update unread count)
  client.emit('mark_read_confirmed', { conversationId: data.conversationId });
}
```

**Unread count tính toán:**

```typescript
// chat.service.ts — getConversations()
const unreadCount = m.lastReadAt
  ? await this.prisma.message.count({
      where: {
        conversationId: m.conversationId,
        createdAt: { gt: m.lastReadAt },    // Tin nhắn SAU lastReadAt
        senderId: { not: userId },          // Không đếm tin nhắn của chính mình
      },
    })
  : await this.prisma.message.count({
      where: {
        conversationId: m.conversationId,
        senderId: { not: userId },          // Chưa đọc lần nào → đếm tất cả
      },
    });
```

### 3.9 Online status (Redis TTL)

**Set online khi connect:**

```typescript
// chat.gateway.ts — handleConnection()
await this.redis.setex(`online:${userId}`, 300, '1');  // TTL = 300 giây = 5 phút
```

**Delete khi disconnect:**

```typescript
// chat.gateway.ts — handleDisconnect()
await this.redis.del(`online:${client.data.userId as string}`);
```

**Check online khi load conversations:**

```typescript
// chat.service.ts — getConversations()
const isOnline =
  otherMembers.length === 1
    ? !!(await this.redis.get(`online:${otherMembers[0]!.userId}`))
    : false;  // Group chat: không hiển thị online status
```

**Frontend hiển thị:**
- `ConversationItem`: Chấm xanh (green dot) ở góc avatar
- `MessagePanel` header: Text "Online" (xanh) hoặc "Offline" (muted)

```typescript
// conversation-item.tsx
{isOnline && (
  <span className="bg-green-500 ring-background absolute -right-0.5 -bottom-0.5
    h-3 w-3 rounded-full ring-2" />
)}
```

**Tại sao dùng Redis TTL 5 phút thay vì xóa ngay khi disconnect?**
- `handleDisconnect` xóa key Redis khi socket ngắt
- TTL 5 phút là backup: nếu server crash hoặc disconnect event không fire, key sẽ tự hết hạn sau 5 phút
- Trong trường hợp bình thường, `handleDisconnect` xóa key ngay → user offline ngay lập tức

### 3.10 Infinite scroll ngược (load older messages)

**File:** `apps/student-portal/src/components/chat/message-panel.tsx`

Chat app có UX đặc biệt: tin nhắn mới nhất ở dưới cùng, cuộn lên để xem tin cũ. Đây là ngược với newsfeed (cuộn xuống = load more).

**TanStack Query — useInfiniteQuery:**

```typescript
// use-chat.ts
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['chat', conversationId, 'messages'],
    queryFn: ({ pageParam = 1 }) =>
      chatService.getMessages(conversationId, { page: pageParam as number, limit: 30 }),
    getNextPageParam: (lastPage) => {
      const page = lastPage as { meta?: { page: number; totalPages: number } };
      if (!page.meta || page.meta.page >= page.meta.totalPages) return undefined;
      return page.meta.page + 1;
    },
    initialPageParam: 1,
    enabled: !!conversationId,
  });
}
```

**Backend trả messages theo thứ tự `desc` (mới nhất trước):**

```typescript
// chat.service.ts
const messages = await this.prisma.message.findMany({
  where: { conversationId },
  orderBy: { createdAt: 'desc' },  // Mới nhất trước
  skip: query.skip,
  take: query.limit,
});
```

**Frontend reverse để hiển thị `asc` (cũ nhất trước, mới nhất dưới):**

```typescript
// message-panel.tsx
const serverMessages = (messagesData?.pages ?? [])
  .flatMap((page) => (page as MessagePage).data ?? [])
  .reverse();  // API trả desc → reverse thành asc
```

**Scroll handler — phát hiện cuộn lên:**

```typescript
const handleScroll = useCallback(() => {
  const container = containerRef.current;
  if (!container || isFetchingNextPage || !hasNextPage) return;
  if (container.scrollTop < 60) {  // Gần top → load more
    prevScrollHeightRef.current = container.scrollHeight;  // Lưu scrollHeight trước khi load
    fetchNextPage();
  }
}, [fetchNextPage, hasNextPage, isFetchingNextPage]);
```

**Preserve scroll position sau khi load:**

```typescript
useEffect(() => {
  if (prevScrollHeightRef.current > 0 && containerRef.current) {
    const newScrollHeight = containerRef.current.scrollHeight;
    // Scroll xuống đúng vị trí cũ (offset = newHeight - oldHeight)
    containerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
    prevScrollHeightRef.current = 0;
  }
}, [messagesData?.pages.length]);
```

**Giải thích scroll preservation:**

```
Trước load:
┌──────────────────┐ ← scrollTop = 0 (đang ở top)
│ Message 31       │    scrollHeight = 2000px
│ Message 32       │
│ ...              │
│ Message 60       │
└──────────────────┘

Sau load (30 messages mới thêm vào đầu):
┌──────────────────┐ ← scrollTop = newHeight - oldHeight = 3800 - 2000 = 1800
│ Message 1 (mới)  │    scrollHeight = 3800px
│ Message 2 (mới)  │
│ ...              │
│ Message 30 (mới) │
│ Message 31       │ ← User đang xem vị trí này (giữ nguyên)
│ ...              │
│ Message 60       │
└──────────────────┘
```

Không có scroll preservation, khi thêm messages vào đầu list, viewport sẽ nhảy lên top (hiển thị message cũ nhất) thay vì giữ vị trí đang đọc.

---

## 4. Thay đổi code chi tiết

### 4.1 Backend

#### Database Models (Prisma Schema)

**File:** `apps/api/src/prisma/schema.prisma`

```prisma
enum MessageType {
  TEXT
  IMAGE
  CODE
  FILE
}

model Conversation {
  id        String  @id @default(cuid())
  isGroup   Boolean @default(false) @map("is_group")
  name      String?
  avatarUrl String? @map("avatar_url")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  members  ConversationMember[]
  messages Message[]

  @@map("conversations")
}

model ConversationMember {
  id             String    @id @default(cuid())
  conversationId String    @map("conversation_id")
  userId         String    @map("user_id")
  lastReadAt     DateTime? @map("last_read_at")

  createdAt DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(...)
  user         User         @relation(...)

  @@unique([conversationId, userId])    // Composite unique
  @@index([userId])
  @@map("conversation_members")
}

model Message {
  id             String      @id @default(cuid())
  conversationId String      @map("conversation_id")
  senderId       String      @map("sender_id")
  type           MessageType @default(TEXT)
  content        String
  fileUrl        String?     @map("file_url")
  fileName       String?     @map("file_name")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  conversation Conversation @relation(...)
  sender       User         @relation(...)

  @@index([conversationId, createdAt])    // Index cho query messages
  @@map("messages")
}
```

**Thiết kế quan trọng:**
- `ConversationMember.@@unique([conversationId, userId])` — Đảm bảo 1 user chỉ xuất hiện 1 lần trong conversation. Prisma tự tạo composite unique index, cho phép query bằng `findUnique({ where: { conversationId_userId: { ... } } })`.
- `ConversationMember.lastReadAt` — Nullable DateTime. `null` = chưa đọc bao giờ → đếm tất cả messages. Có giá trị → đếm messages sau thời điểm đó.
- `Message.@@index([conversationId, createdAt])` — Composite index tối ưu query messages theo conversation + sắp xếp thời gian.

#### ChatService

**File:** `apps/api/src/modules/chat/chat.service.ts`

Service chứa toàn bộ business logic, controller và gateway chỉ delegate xuống:

| Method | Mô tả |
|--------|--------|
| `getConversations(userId)` | Lấy tất cả conversations của user, kèm last message, unread count, online status |
| `getOrCreateConversation(userId, dto)` | 1-on-1: tìm hoặc tạo mới. Group: luôn tạo mới |
| `sendMessage(senderId, conversationId, dto)` | Verify membership → tạo message → update conversation.updatedAt |
| `getMessages(conversationId, userId, query)` | Verify membership → paginated messages (desc order) |
| `markRead(conversationId, userId)` | Update lastReadAt = now() |
| `isMember(conversationId, userId)` | Check membership (dùng bởi Gateway) |
| `getConversationMembers(conversationId)` | Lấy danh sách userId (dùng bởi Gateway để notify) |
| `verifyMembership(conversationId, userId)` | Private, throw ForbiddenException nếu không phải member |

**AUTHOR_SELECT constant:**

```typescript
const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;
```

Dùng ở mọi nơi cần include user info, đảm bảo chỉ select 3 fields cần thiết (tránh leak password, email...).

#### ChatController (REST fallback)

**File:** `apps/api/src/modules/chat/chat.controller.ts`

4 endpoints:

| Method | Route | Mô tả |
|--------|-------|--------|
| `GET` | `/conversations` | Danh sách conversations |
| `POST` | `/conversations` | Get or create conversation |
| `GET` | `/conversations/:id/messages` | Paginated messages |
| `POST` | `/conversations/:id/messages` | Send message (REST fallback) |

REST fallback cho `send_message` hữu ích khi WebSocket không kết nối được (network issues, firewall block WS).

#### ChatModule

**File:** `apps/api/src/modules/chat/chat.module.ts`

```typescript
@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
```

- `JwtModule.register({})` — Gateway cần `JwtService` để verify token trong `handleConnection`
- `NotificationsModule` — Import để có thể gửi notification (hiện tại chat notifications chỉ qua WebSocket, không tạo DB notification)

#### DTOs

**CreateConversationDto:**

```typescript
export class CreateConversationDto {
  @IsString()
  participantId!: string;            // Bắt buộc (dùng cho 1-on-1)

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];         // Optional (dùng cho group)

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;                 // Default: false (1-on-1)

  @IsOptional()
  @IsString()
  name?: string;                     // Tên group (optional)
}
```

**SendMessageDto:**

```typescript
export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;                  // Nội dung tin nhắn (1-5000 ký tự)

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;                // TEXT | IMAGE | CODE | FILE (default: TEXT)

  @IsOptional()
  @IsString()
  fileUrl?: string;                  // URL file đính kèm

  @IsOptional()
  @IsString()
  fileName?: string;                 // Tên file
}
```

### 4.2 Shared layer (services, hooks, socket)

#### Chat Service (API calls)

**File:** `packages/shared-hooks/src/services/chat.service.ts`

```typescript
export const chatService = {
  getConversations: () => apiClient.get('/conversations'),

  getOrCreateConversation: (data: CreateConversationData) =>
    apiClient.post('/conversations', data),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/conversations/${conversationId}/messages`, toQuery(params)),

  sendMessage: (conversationId: string, data: SendMessageData) =>
    apiClient.post(`/conversations/${conversationId}/messages`, data),
};
```

Helper `toQuery()` chuyển object `{ page: 1, limit: 30 }` thành `{ page: '1', limit: '30' }` (string values cho URL query params), loại bỏ `null`/`undefined`/`''`.

#### TanStack Query Hooks

**File:** `packages/shared-hooks/src/queries/use-chat.ts`

| Hook | Query/Mutation | Query Key |
|------|---------------|-----------|
| `useConversations()` | `useQuery` | `['chat', 'conversations']` |
| `useMessages(convId)` | `useInfiniteQuery` | `['chat', convId, 'messages']` |
| `useGetOrCreateConversation()` | `useMutation` | invalidates `['chat', 'conversations']` |
| `useSendMessage()` | `useMutation` | invalidates messages + conversations |

**`useMessages` với `useInfiniteQuery`:**

```typescript
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['chat', conversationId, 'messages'],
    queryFn: ({ pageParam = 1 }) =>
      chatService.getMessages(conversationId, { page: pageParam as number, limit: 30 }),
    getNextPageParam: (lastPage) => {
      const page = lastPage as { meta?: { page: number; totalPages: number } };
      if (!page.meta || page.meta.page >= page.meta.totalPages) return undefined;
      return page.meta.page + 1;
    },
    initialPageParam: 1,
    enabled: !!conversationId,  // Chỉ fetch khi có conversationId
  });
}
```

- `pageParam` tự động tăng qua `getNextPageParam`
- `enabled: !!conversationId` — Không fetch khi chưa chọn conversation
- `limit: 30` — Mỗi lần load 30 messages

#### Query Keys

**File:** `packages/shared-api-client/src/query-keys.ts`

```typescript
chat: {
  conversations: ['chat', 'conversations'] as const,
  messages: (id: string) => ['chat', id, 'messages'] as const,
},
```

Dùng `as const` để TypeScript infer exact tuple type, đảm bảo type safety khi invalidate.

### 4.3 Frontend components

#### ChatPage (trang chính)

**File:** `apps/student-portal/src/app/[locale]/(fullscreen)/chat/page.tsx`

Đây là trang gốc điều phối toàn bộ chat, quản lý:
- `activeConversationId` — ID conversation đang mở
- `showList` — Mobile: hiển thị list hoặc panel (toggle)
- `typingUsers` — Map<conversationId, Set<userId>> theo dõi ai đang gõ

**Responsive layout:**

```tsx
<div className="flex h-full">
  <div className="bg-background flex w-full overflow-hidden">
    {/* Conversation List — ẩn trên mobile khi đang xem messages */}
    <div className={cn(
      'border-border flex w-full shrink-0 flex-col border-r sm:w-80',
      !showList ? 'hidden sm:flex' : 'flex',
    )}>
      <ConversationList ... />
    </div>

    {/* Message Panel — ẩn trên mobile khi đang xem list */}
    <div className={cn('flex min-h-0 flex-1 flex-col', showList ? 'hidden sm:flex' : 'flex')}>
      <MessagePanel ... />
    </div>
  </div>
</div>
```

Trên desktop (sm+): Cả 2 panel hiển thị side-by-side (list 320px + messages flex-1).
Trên mobile: Chỉ 1 panel hiển thị tại một thời điểm, toggle qua `showList` state.

**URL param support:**

```typescript
const searchParams = useSearchParams();
const [activeConversationId, setActiveConversationId] = useState<string | null>(
  searchParams.get('id'),  // Mở conversation từ URL: /chat?id=xxx
);

useEffect(() => {
  const paramId = searchParams.get('id');
  if (paramId) {
    joinConversation(paramId);
    markRead(paramId);
  }
}, []);
```

Cho phép link trực tiếp đến conversation: `/chat?id=clxyz123` (ví dụ từ notification click).

#### ConversationList

**File:** `apps/student-portal/src/components/chat/conversation-list.tsx`

Danh sách conversations, bao gồm:
1. Header: tiêu đề "Chat" + nút tạo group (icon Users)
2. Search input (debounce 300ms)
3. Khi KHÔNG search: hiển thị tất cả conversations
4. Khi CÓ search: 2 sections — "Conversations" (filter client-side) + "People" (API search)

**Data transformation — members → participants:**

Backend trả về `members` array (join table), frontend cần `participants` (user info). Transformation:

```typescript
const conversations: ConversationData[] = rawConversations.map((conv) => ({
  id: conv.id,
  isGroup: conv.isGroup,
  name: conv.name,
  lastMessage: conv.lastMessage,
  unreadCount: conv.unreadCount,
  participants: conv.participants ?? (conv.members ?? []).map((m) => ({
    id: m.user.id,
    fullName: m.user.fullName,
    avatarUrl: m.user.avatarUrl,
    isOnline: conv.isOnline,
  })),
}));
```

#### ConversationItem

**File:** `apps/student-portal/src/components/chat/conversation-item.tsx`

Mỗi item hiển thị:
- Avatar (hoặc Users icon cho group)
- Tên (1-on-1: tên người kia, group: tên group)
- Online indicator (green dot)
- Last message preview (group: có prefix "SenderName: ")
- Thời gian tương đối (dùng `formatRelativeTime`)
- Unread badge (số tin nhắn chưa đọc)

```typescript
// 1-on-1: tìm participant KHÁC mình
const otherParticipant = isGroup || !participants
  ? null
  : participants.find((p) => p.id !== currentUserId) ?? participants[0];

// Group: prefix sender name
if (isGroup) {
  const senderName =
    lastMessage.senderId === currentUserId ? 'You' : lastMessage.sender.fullName;
  lastMessagePreview = `${senderName}: ${lastMessage.content}`;
} else {
  lastMessagePreview = lastMessage.content;
}
```

#### UserSearchItem

**File:** `apps/student-portal/src/components/chat/user-search-item.tsx`

Component đơn giản: avatar + tên + "Start chat" hover text. Click → `getOrCreate` mutation.

```tsx
<button onClick={() => onClick(user.id)} className="hover:bg-accent/50 group ...">
  <Avatar className="h-9 w-9">...</Avatar>
  <span className="...">{user.fullName}</span>
  <span className="... opacity-0 group-hover:opacity-100">
    {t('startChat')}
  </span>
</button>
```

`group-hover:opacity-100` — Tailwind group pattern: text "Start chat" chỉ hiện khi hover vào button (group container).

#### MessagePanel

**File:** `apps/student-portal/src/components/chat/message-panel.tsx`

Component chính hiển thị messages, bao gồm:

1. **Header** — Avatar + tên + online status + nút Back (mobile)
2. **Messages area** — Scrollable, infinite scroll ngược
3. **TypingIndicator** — Hiển thị khi có người đang gõ
4. **MessageInput** — Textarea + Send button

**Optimistic messages pattern:**

```typescript
// Local state cho optimistic messages
const [localMessages, setLocalMessages] = useState<MessageData[]>([]);

// Clear khi server data cập nhật
useEffect(() => {
  if (serverMessages.length > 0) setLocalMessages([]);
}, [serverMessages.length]);

// Clear khi đổi conversation
useEffect(() => {
  setLocalMessages([]);
}, [conversation?.id]);

// Kết hợp server + local messages
const messages = [...serverMessages, ...localMessages];
```

**Flow:**
1. User gửi → tạo optimistic msg (id: `temp-xxx`) → `localMessages` = [optimisticMsg]
2. `messages` = [...serverMessages, optimisticMsg] → render ngay lập tức
3. WebSocket broadcast → `new_message` event → TanStack Query refetch
4. `serverMessages.length` thay đổi → `setLocalMessages([])` → clear optimistic
5. `messages` = [...serverMessages(updated)] → render real data

**Group chat sender info:**

```typescript
const showSenderInfo =
  conversation.isGroup && !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId);
```

Trong group chat, hiển thị avatar + tên sender chỉ khi:
- Conversation là group (`isGroup`)
- Tin nhắn không phải của mình (`!isOwn`)
- Tin nhắn trước đó từ người KHÁC (`prevMsg.senderId !== msg.senderId`) hoặc là tin đầu tiên

Điều này gom các tin nhắn liên tiếp từ cùng 1 người thành 1 block (giống Messenger).

#### MessageItem

**File:** `apps/student-portal/src/components/chat/message-item.tsx`

Mỗi tin nhắn render dạng "bubble":
- **Own messages** — Align phải, màu primary (xanh), bo góc dưới phải
- **Other messages** — Align trái, màu muted (xám), bo góc dưới trái

```typescript
<div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
  <div className={cn('flex max-w-[75%] gap-2', isOwn && 'flex-row-reverse')}>
    {/* Avatar (chỉ group, chỉ tin người khác) */}
    {isGroup && !isOwn && (
      <div className="mt-auto flex-shrink-0">
        {showSenderInfo ? <Avatar ... /> : <div className="w-6" />}
      </div>
    )}

    <div className="min-w-0">
      {/* Sender name (chỉ group, chỉ tin đầu tiên trong block) */}
      {isGroup && !isOwn && showSenderInfo && (
        <p className="text-[11px]">{message.sender.fullName}</p>
      )}

      {/* Bubble */}
      <div className={cn(
        'rounded-2xl px-3 py-2',
        isOwn
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-muted rounded-bl-md',
      )}>
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        <p className="text-[10px]">{formatRelativeTime(message.createdAt, locale)}</p>
      </div>
    </div>
  </div>
</div>
```

`max-w-[75%]` — Bubble tối đa chiếm 75% chiều rộng container, tránh tin nhắn ngắn bị giãn quá rộng.

`whitespace-pre-wrap` — Giữ nguyên line breaks và spaces trong tin nhắn (Shift+Enter = new line).

`flex-row-reverse` — Cho own messages: avatar ở bên phải thay vì trái (trong group chat).

#### MessageInput

**File:** `apps/student-portal/src/components/chat/message-input.tsx`

Textarea tự động resize + nút Send + typing indicator logic.

**Auto-resize textarea:**

```typescript
const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
  setValue(e.target.value);
  // Auto-resize
  const textarea = e.target;
  textarea.style.height = 'auto';                               // Reset
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;  // Fit content, max 120px
  // ... typing logic
}, [onTyping, onStopTyping]);
```

Mỗi lần nội dung thay đổi:
1. Set `height = auto` → textarea co lại (để scrollHeight tính đúng)
2. Set `height = min(scrollHeight, 120)` → expand vừa nội dung, tối đa 120px (khoảng 5 dòng)

**Enter = Send, Shift+Enter = New line:**

```typescript
const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}, [handleSend]);
```

#### NewGroupDialog

**File:** `apps/student-portal/src/components/chat/new-group-dialog.tsx`

Dialog tạo nhóm chat mới với UX:

1. Input tên nhóm
2. Input tìm kiếm user (debounce 300ms)
3. Click user → thêm vào chips list
4. Chips hiển thị dưới tên nhóm, mỗi chip có nút X để xóa
5. Click "Create" → gọi `getOrCreate` mutation với `isGroup: true`

**Filter logic — loại user đã chọn:**

```typescript
const filteredResults = searchResults.filter(
  (u) => !selectedUsers.some((s) => s.id === u.id),
);
```

Khi user đã chọn, không hiển thị lại trong search results.

### 4.4 Layout (fullscreen route group)

#### Fullscreen Layout

**File:** `apps/student-portal/src/app/[locale]/(fullscreen)/layout.tsx`

```typescript
export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <SocketProvider />
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

**So sánh 2 layouts:**

| | Main Layout | Fullscreen Layout |
|---|---|---|
| Height | `min-h-screen` (scrollable) | `h-screen` (fixed viewport) |
| Footer | Có (`<Footer />`) | Không |
| MobileNav | Có (`<MobileNav />`) | Không |
| Main overflow | Default (visible, scrollable) | `overflow-hidden` |
| Main padding | `pb-16 md:pb-0` | Không |
| Use case | Pages cần scroll (courses, profile) | Chat (fixed height, internal scroll) |

Chat cần fullscreen layout vì:
- Messages area cần scroll riêng (internal scroll trong container, không phải page scroll)
- Footer chiếm không gian quý giá → loại bỏ
- `h-screen` + `overflow-hidden` đảm bảo layout không bao giờ scroll, chỉ messages area scroll

---

## 5. Kỹ thuật đặc biệt

### 5.1 Fullscreen layout (no footer)

Next.js App Router route groups `(fullscreen)` cho phép dùng layout khác mà không ảnh hưởng URL:

```
app/[locale]/(main)/...          → /courses, /profile, /social
app/[locale]/(fullscreen)/chat   → /chat (fullscreen layout)
```

URL `/chat` dùng `(fullscreen)/layout.tsx` thay vì `(main)/layout.tsx`. Route group `(fullscreen)` không xuất hiện trong URL.

Trước đó, chat page nằm trong `(main)/chat/page.tsx` và bị Footer + MobileNav chiếm không gian. Di chuyển sang `(fullscreen)/chat/page.tsx` giải quyết vấn đề này.

### 5.2 shouldScrollRef pattern

```typescript
const shouldScrollRef = useRef(false);

// Khi gửi tin nhắn → flag = true
const handleSend = useCallback((content: string) => {
  shouldScrollRef.current = true;
  // ... optimistic msg + send via socket
}, [...]);

// Khi messages thay đổi → scroll nếu flag = true
useEffect(() => {
  if (shouldScrollRef.current && containerRef.current) {
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    shouldScrollRef.current = false;
  }
}, [messages.length]);
```

**Tại sao dùng ref thay vì state?**
- Nếu dùng `useState(false)` → set `true` gây re-render → set `false` gây re-render nữa → 2 renders thừa
- `useRef` thay đổi giá trị mà KHÔNG gây re-render
- Flag chỉ cần đọc 1 lần trong useEffect, không cần trigger render

**Tại sao không scroll mọi lúc có message mới?**
- User có thể đang cuộn lên xem tin cũ → không nên tự scroll xuống
- Chỉ scroll khi **chính user gửi tin** (`shouldScrollRef = true` chỉ set trong `handleSend`)
- Tin nhắn nhận từ người khác → `messages.length` thay đổi nhưng `shouldScrollRef = false` → không scroll

### 5.3 Typing debounce (2s timeout)

```
Gõ ký tự → emit 'typing' (1 lần) → start timer 2s
Gõ tiếp → reset timer 2s (không emit lại)
Gõ tiếp → reset timer 2s
...
Ngừng gõ → 2s hết → emit 'stop_typing'

Hoặc: Nhấn Enter → emit 'stop_typing' ngay lập tức
```

Đây là pattern chuẩn của các ứng dụng chat (Telegram, Messenger). `2000ms` là thời gian đủ để phân biệt "đang gõ" với "ngừng gõ tạm thời" (ví dụ nghĩ 1 giây rồi gõ tiếp).

### 5.4 Infinite scroll ngược (scroll up = load more)

Khác biệt so với infinite scroll thông thường (scroll DOWN = load more):

| | Feed/List (scroll down) | Chat (scroll up) |
|---|---|---|
| Direction | `container.scrollHeight - container.scrollTop - container.clientHeight < threshold` | `container.scrollTop < threshold` |
| Order from API | ASC (cũ trước) | DESC (mới trước) |
| Render order | ASC (cũ trước) | Reverse → ASC (cũ ở trên) |
| New items position | Append cuối | Prepend đầu |
| Scroll preservation | Không cần (items thêm ở cuối, không shift viewport) | CẦN (items thêm ở đầu, shift viewport xuống) |

**Scroll preservation algorithm:**

```
1. User cuộn lên → scrollTop < 60px → trigger fetchNextPage
2. Lưu prevScrollHeight = container.scrollHeight (trước khi load)
3. API trả data → TanStack Query update → React render thêm items ở đầu
4. container.scrollHeight tăng (thêm items)
5. Set scrollTop = newScrollHeight - prevScrollHeight
   → Giữ nguyên vị trí đang xem
```

### 5.5 Online status via Redis SET/GET with TTL

```
Connect → redis.setex('online:userId', 300, '1')
                                        ↑ TTL 5 phút

Disconnect → redis.del('online:userId')

Check → redis.get('online:userId')
         → '1' = online
         → null = offline
```

**Tại sao Redis thay vì DB?**
- Redis là in-memory store → read/write cực nhanh (< 1ms)
- Online status là ephemeral data (tạm thời) → không cần persist vào DB
- TTL tự động cleanup → không cần cron job dọn dẹp
- Mỗi conversation cần check online status → phải nhanh (N requests cho N conversations)

**Tại sao chỉ check online cho 1-on-1?**

```typescript
const isOnline =
  otherMembers.length === 1
    ? !!(await this.redis.get(`online:${otherMembers[0]!.userId}`))
    : false;  // Group: luôn false
```

Group chat có nhiều members → check online cho tất cả tốn tài nguyên. Thay vào đó, hiển thị "N members" thay vì online status.

### 5.6 Room-based broadcasting

Socket.io rooms là cơ chế grouping connections:

```
user_abc123        ← Personal room (luôn join khi connect)
conv_xyz789        ← Conversation room (join khi chọn conversation)
```

**Broadcasting patterns:**

```typescript
// 1. Gửi cho TẤT CẢ trong room (bao gồm sender)
this.server.to('conv_xyz').emit('new_message', message);

// 2. Gửi cho TẤT CẢ NGOẠI TRỪ sender
client.to('conv_xyz').emit('user_typing', data);

// 3. Gửi cho 1 user cụ thể (personal room)
this.server.to('user_abc').emit('new_message_notification', data);
```

**Difference: `this.server.to()` vs `client.to()`:**
- `this.server.to(room).emit()` — Server gửi cho **tất cả** sockets trong room
- `client.to(room).emit()` — Client (sender) gửi cho **tất cả ngoại trừ chính mình**

### 5.7 Unread count trên navbar

**File:** `apps/student-portal/src/components/navigation/navbar.tsx`

```typescript
// Fetch conversations data
const { data: conversationsRaw } = useConversations();

// Sum unread counts
const totalChatUnread = (
  (conversationsRaw as { data?: Array<{ unreadCount?: number }> })?.data ??
  (Array.isArray(conversationsRaw) ? conversationsRaw : [])
).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
```

```tsx
{/* Chat icon với badge */}
<Link href="/chat" className="hidden sm:inline-flex">
  <Button variant="ghost" size="icon" className="relative" title={t('chat')}>
    <MessageCircle className="h-5 w-5" />
    {totalChatUnread > 0 && (
      <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1
        flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
        {totalChatUnread > 9 ? '9+' : totalChatUnread}
      </span>
    )}
  </Button>
</Link>
```

**Real-time update flow:**

```
User B (sender) gửi tin nhắn
    ↓
Backend: new_message_notification → user_A room
    ↓
useChatSocket: invalidateQueries(['chat', 'conversations'])
    ↓
TanStack Query refetch /conversations (REST)
    ↓
useConversations() data cập nhật → unreadCount tăng
    ↓
Navbar re-render → totalChatUnread tăng → badge hiển thị
```

**Lưu ý badge styling:**
- Chat unread dùng `bg-destructive` (đỏ) thay vì `bg-primary` (xanh) — khác biệt với cart/wishlist badge
- `text-[10px]` — Font size rất nhỏ để vừa trong circle 16px
- `> 9 ? '9+' : count` — Cap ở "9+" cho gọn

**Notification popover unread count** cũng được cải thiện trong phase này:

```typescript
// notification-popover.tsx
const { data: countRaw } = useUnreadNotificationCount(isAuthenticated);
const unreadCount =
  (countRaw as { data?: { count?: number }; count?: number })?.data?.count ??
  (countRaw as { count?: number })?.count ??
  0;
```

Xử lý 2 format response: `{ data: { count: N } }` (REST API) và `{ count: N }` (WebSocket push via `setQueryData`). Fallback chain `?.data?.count ?? ?.count ?? 0` đảm bảo luôn lấy được số.

---

## 6. Tổng kết

### Files đã thay đổi/tạo mới

**Backend (4 files modified, 0 new):**
- `apps/api/src/modules/chat/chat.gateway.ts` — WebSocket gateway
- `apps/api/src/modules/chat/chat.service.ts` — Business logic
- `apps/api/src/modules/chat/chat.module.ts` — Module config
- `apps/api/src/modules/chat/chat.service.spec.ts` — Unit tests

**Shared (3 files new):**
- `packages/shared-hooks/src/services/chat.service.ts` — API call functions
- `packages/shared-hooks/src/queries/use-chat.ts` — TanStack Query hooks
- `packages/shared-hooks/src/use-chat-socket.ts` — WebSocket hook

**Frontend (11 files new, 3 modified):**
- `apps/student-portal/src/app/[locale]/(fullscreen)/chat/page.tsx` — Chat page (NEW)
- `apps/student-portal/src/app/[locale]/(fullscreen)/layout.tsx` — Fullscreen layout (NEW)
- `apps/student-portal/src/components/chat/conversation-list.tsx` — List component (NEW)
- `apps/student-portal/src/components/chat/conversation-item.tsx` — Item component (NEW)
- `apps/student-portal/src/components/chat/user-search-item.tsx` — Search result item (NEW)
- `apps/student-portal/src/components/chat/message-panel.tsx` — Messages panel (NEW)
- `apps/student-portal/src/components/chat/message-item.tsx` — Single message (NEW)
- `apps/student-portal/src/components/chat/message-input.tsx` — Input with typing (NEW)
- `apps/student-portal/src/components/chat/typing-indicator.tsx` — Typing dots (NEW)
- `apps/student-portal/src/components/chat/new-group-dialog.tsx` — Group creation (NEW)
- `apps/student-portal/src/components/providers/socket-provider.tsx` — Socket init (NEW)
- `apps/student-portal/src/components/navigation/navbar.tsx` — Chat unread badge (MODIFIED)
- `apps/student-portal/src/components/notifications/notification-popover.tsx` — Unread fix (MODIFIED)
- `apps/student-portal/src/app/[locale]/(main)/layout.tsx` — SocketProvider (MODIFIED)

### Pattern tổng hợp

| Pattern | Vị trí | Mục đích |
|---------|--------|----------|
| Get-or-create | ChatService | Tránh duplicate 1-on-1 conversations |
| Optimistic updates | MessagePanel | Tin nhắn hiển thị ngay, không chờ server |
| shouldScrollRef | MessagePanel | Scroll xuống chỉ khi user gửi tin |
| callbacksRef | useChatSocket | Callbacks update không trigger reconnect |
| Scroll preservation | MessagePanel | Giữ vị trí khi load tin cũ |
| Typing debounce | MessageInput | Emit typing 1 lần, stop sau 2s idle |
| Dual search | ConversationList | Filter conversations + search users |
| Room-based broadcast | ChatGateway | Gửi tin cho members trong/ngoài room |
| Redis TTL online | ChatGateway | Online status tự hết hạn |
| Fullscreen layout | Route group | Chat chiếm toàn bộ viewport |
