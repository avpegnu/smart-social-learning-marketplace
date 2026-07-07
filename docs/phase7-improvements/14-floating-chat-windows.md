# Phase 7.14: Floating Chat Windows (Facebook Messenger Style)

> **Date:** 2026-05-10
> **Status:** ✅ Complete
> **Scope:** Chat popover dropdown trong navbar + floating chat windows ở góc dưới phải, áp dụng cho cả student-portal và management-portal. Tận dụng tối đa hooks/socket có sẵn, không thay đổi backend.

---

## 1. Tổng quan

### Mục tiêu

Mang trải nghiệm chat kiểu Facebook Messenger vào SSLM:

- **ChatPopover** — Dropdown khi click vào icon chat trên navbar (desktop), hiển thị danh sách conversations gần đây, search, badge unread.
- **FloatingChatWindow** — Cửa sổ chat nổi ở góc dưới phải, mở khi click 1 conversation trong popover. Có thể minimize, đóng. Persist qua route changes (vẫn hiển thị khi user navigate giữa các trang).
- **Multi-window** — Tối đa 2 windows mở đồng thời (LRU eviction). Windows xếp ngang từ phải qua trái.
- **Cross-portal** — Cùng UI/UX cho cả student-portal lẫn management-portal. Backend chat module role-agnostic, instructor/admin dùng được ngay.

### Scope thay đổi

| Scope | Loại | File | Risk |
|-------|------|------|------|
| Shared store | Mới | `packages/shared-hooks/src/stores/chat-windows-store.ts` | Thấp |
| Shared UI | Mới (folder) | `packages/shared-ui/src/components/chat/` (7 files) | Thấp |
| Shared UI deps | Sửa | `packages/shared-ui/package.json` (thêm deps) | Thấp |
| Student-portal | Sửa | `navbar.tsx`, `(main)/layout.tsx`, `(fullscreen)/layout.tsx`, `profile/[userId]/page.tsx` | Thấp |
| Student-portal i18n | Sửa | `messages/{vi,en}.json` (thêm keys vào namespace `chat`) | Không |
| Management-portal | Sửa | `header.tsx`, `socket-provider.tsx`, `instructor/layout.tsx`, `admin/layout.tsx` | Thấp |
| Management-portal i18n | Sửa | `messages/{vi,en}.json` (thêm namespace `chat`) | Không |

**Không động đến:** backend chat module (`apps/api/src/modules/chat/`), trang `/chat` cũ ở student-portal, mobile UX (chat icon mobile vẫn link `/chat` như cũ).

---

## 2. Vấn đề & Motivation

### Trước khi implement

- Student-portal: chat icon trong navbar chỉ là 1 link `<Link href="/chat">` → click luôn navigate sang trang chat fullscreen, mất context trang đang xem.
- Management-portal: hoàn toàn không có UI chat. Instructor/admin không thể nhắn tin trực tiếp với student, dù backend đã hỗ trợ.
- Profile page (`/profile/[userId]`): nút "Nhắn tin" cũng navigate đi trang `/chat`, không tận dụng được cảnh user đang xem profile.

### Mục tiêu UX

Mô phỏng Facebook Messenger trên web:
- Click chat icon → popover hiện ngay tại navbar, list conversations.
- Click 1 conversation trong popover → floating window pop ra ở góc dưới phải, không rời trang hiện tại.
- Có thể mở nhiều conversations cùng lúc (max 2), minimize/close độc lập.
- Window tự ẩn trên mobile — mobile fallback về flow `/chat` cũ.

---

## 3. Architecture

### 3.1 Layered design

```
packages/shared-hooks
  └─ stores/chat-windows-store.ts          [NEW]  — Zustand singleton tracking open windows
  └─ use-chat-socket.ts                    [reused]
  └─ queries/use-chat.ts                   [reused] — useConversations, useMessages, useGetOrCreateConversation

packages/shared-ui
  └─ components/chat/                       [NEW folder]
       ├─ types.ts                          — Shared TS types + helpers (normalizeParticipants, ...)
       ├─ chat-popover.tsx                  — Trigger button + dropdown panel
       ├─ chat-popover-item.tsx             — 1 row trong dropdown
       ├─ floating-chat-windows.tsx         — Container, mount ở layout, sở hữu socket + typing state
       ├─ floating-chat-window.tsx          — 1 cửa sổ floating
       ├─ floating-chat-message.tsx         — 1 message bubble
       ├─ floating-chat-input.tsx           — Textarea + send button
       └─ index.ts                          — Re-export

apps/student-portal
  ├─ navigation/navbar.tsx                  REPLACE chat <Link> → <ChatPopover seeAllHref="/chat" />
  ├─ (main)/layout.tsx                      ADD <FloatingChatWindows />
  ├─ (fullscreen)/layout.tsx                ADD <FloatingChatWindows />  (cho /ai-tutor)
  └─ profile/[userId]/page.tsx              "Nhắn tin": desktop → openChatWindow, mobile → router.push(/chat)

apps/management-portal
  ├─ providers/socket-provider.tsx          ADD useChatSocket()
  ├─ navigation/header.tsx                  ADD <ChatPopover /> cạnh NotificationPopover
  ├─ instructor/layout.tsx                  ADD <FloatingChatWindows />
  └─ admin/layout.tsx                       ADD <FloatingChatWindows />
```

### 3.2 Data flow

```
USER CLICKS CHAT ICON (desktop)
  ↓
ChatPopover toggle open
  ↓
useConversations() — TanStack Query, list conversations
  ↓
USER CLICKS 1 CONVERSATION
  ↓
useChatWindowsStore.openWindow(conversationId)
  ↓
Store cập nhật openWindows array (max 2, LRU eviction)
  ↓
<FloatingChatWindows /> (mounted ở layout) re-renders
  ↓
Render <FloatingChatWindow /> mới
  ↓
Window mount → joinConversation() + markRead() qua socket
  ↓
useMessages() fetch lịch sử messages
  ↓
USER GỬI TIN
  ↓
sendMessage qua socket (single shared instance từ container)
  ↓
new_message event → invalidate useMessages → re-render
```

### 3.3 Persist qua route changes

`useChatWindowsStore` là module-level Zustand singleton:
- **Không** dùng `persist` middleware (state chỉ giữ trong memory).
- React component re-mount khi đổi route, nhưng store **không** reset → `openWindows` array vẫn còn.
- `<FloatingChatWindows />` mount ở root của layout (không phải page), nên cũng không unmount khi navigate giữa các route trong cùng layout.

Kết hợp 2 yếu tố trên → user navigate từ `/courses` sang `/social` thì floating windows vẫn còn nguyên.

### 3.4 Chu kỳ socket

- **Container `<FloatingChatWindows />`** gọi `useChatSocket()` một lần để có `sendMessage`, `joinConversation`, `sendTyping`, `stopTyping`, `markRead`. Đồng thời nhận callbacks `onTyping`/`onStopTyping` để update typing-users state.
- Container prop-drill các method xuống mỗi `<FloatingChatWindow />`. Tránh mỗi window tự gọi `useChatSocket()` (sẽ tạo nhiều socket connections).
- `SocketProvider` ở mỗi portal cũng có `useChatSocket()` riêng — nó chỉ làm nhiệm vụ "keep-alive" cho global query invalidation (cập nhật unread badge khi đang ở trang không có chat).

---

## 4. Backend

**Không cần thay đổi.** Chat module đã có sẵn:

- Routes: `GET /conversations`, `POST /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`.
- Gateway namespace `/chat` với events: `join_conversation`, `send_message`, `typing`, `stop_typing`, `mark_read`, `new_message`, `user_typing`, `user_stop_typing`, `mark_read_confirmed`, `new_message_notification`.
- Membership-based access control (`verifyMembership` throws `ForbiddenException` nếu user không thuộc conversation).
- **Không** có role guard — instructor/admin dùng được ngay với cùng API.

---

## 5. Frontend Implementation

### 5.1 Zustand store — `chat-windows-store.ts`

**File:** `packages/shared-hooks/src/stores/chat-windows-store.ts`

```typescript
'use client';
import { create } from 'zustand';

const MAX_OPEN_WINDOWS = 2;

export interface ChatWindow {
  conversationId: string;
  minimized: boolean;
}

interface ChatWindowsState {
  openWindows: ChatWindow[];
  openWindow: (conversationId: string) => void;
  closeWindow: (conversationId: string) => void;
  toggleMinimize: (conversationId: string) => void;
  setMinimized: (conversationId: string, minimized: boolean) => void;
  closeAll: () => void;
}

export const useChatWindowsStore = create<ChatWindowsState>((set) => ({
  openWindows: [],

  openWindow: (conversationId) =>
    set((state) => {
      const existing = state.openWindows.find((w) => w.conversationId === conversationId);
      if (existing) {
        // Bring existing window to front + un-minimize
        const others = state.openWindows.filter((w) => w.conversationId !== conversationId);
        return { openWindows: [{ ...existing, minimized: false }, ...others] };
      }
      const next = [{ conversationId, minimized: false }, ...state.openWindows];
      return { openWindows: next.slice(0, MAX_OPEN_WINDOWS) };  // LRU eviction
    }),

  closeWindow: (conversationId) =>
    set((state) => ({
      openWindows: state.openWindows.filter((w) => w.conversationId !== conversationId),
    })),

  toggleMinimize: (conversationId) =>
    set((state) => ({
      openWindows: state.openWindows.map((w) =>
        w.conversationId === conversationId ? { ...w, minimized: !w.minimized } : w,
      ),
    })),

  setMinimized: (conversationId, minimized) =>
    set((state) => ({
      openWindows: state.openWindows.map((w) =>
        w.conversationId === conversationId ? { ...w, minimized } : w,
      ),
    })),

  closeAll: () => set({ openWindows: [] }),
}));
```

**Logic chính:**

- `openWindow`: nếu conversation đã trong list → đưa lên đầu + un-minimize. Nếu chưa → push lên đầu, slice giữ tối đa 2 (LRU — cái cũ nhất bị đẩy ra).
- `closeAll`: reset về rỗng — quan trọng cho việc xử lý logout/account switch (xem §7.2).

**Export:** `packages/shared-hooks/src/index.ts`

```typescript
export { useChatWindowsStore } from './stores/chat-windows-store';
export type { ChatWindow } from './stores/chat-windows-store';
```

### 5.2 Shared types — `types.ts`

**File:** `packages/shared-ui/src/components/chat/types.ts`

Định nghĩa interfaces dùng chung cho tất cả chat components, kèm helper functions:

```typescript
export interface ChatParticipant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  isOnline?: boolean;
}

export interface ChatConversationData {
  id: string;
  isGroup: boolean;
  name: string | null;
  isOnline?: boolean;
  unreadCount: number;
  lastMessage: ChatLastMessage | null;
  participants?: ChatParticipant[];
  members?: Array<{ userId: string; user: { id: string; fullName: string; avatarUrl: string | null } }>;
}

export interface ChatMessageData {
  id: string;
  content: string;
  type: string;
  fileUrl?: string;
  senderId: string;
  sender: { id: string; fullName: string; avatarUrl: string | null };
  createdAt: string;
}

// Backend trả về `members` (raw join), nhưng có chỗ đã transform thành `participants`.
// Helper này normalize để component dùng thống nhất.
export function normalizeParticipants(c: ChatConversationData): ChatParticipant[] { ... }

export function getOtherParticipant(c, currentUserId): ChatParticipant | null { ... }
export function getConversationDisplayName(c, currentUserId, fallback): string { ... }
```

### 5.3 ChatPopover

**File:** `packages/shared-ui/src/components/chat/chat-popover.tsx`

Theo pattern `NotificationPopover` đã có (custom state + outside-click listener, KHÔNG dùng shadcn DropdownMenu vì nó auto-close khi click).

```typescript
interface ChatPopoverProps {
  /** If provided, shows a "See all in Messenger" footer link. */
  seeAllHref?: string;
  /** Wrapper className — controls visibility (e.g. `hidden sm:inline-flex`). */
  className?: string;
}
```

**Behavior chính:**
- Trigger button: icon `MessageCircle` + badge unread (sum của tất cả `unreadCount`).
- Panel: 80px → 96px wide (responsive), max-height 420px, scroll-y.
- Search local: filter bằng tên participants hoặc group name.
- Click 1 item → `useChatWindowsStore.openWindow(id)` + close popover.
- Footer "See all in Messenger" chỉ render nếu `seeAllHref` được truyền (student có, management không) — link này điều hướng **cùng tab** (`<a href>` không `target="_blank"`).
- `if (!isAuthenticated) return null` — guest không thấy popover.

### 5.4 FloatingChatWindows (container)

**File:** `packages/shared-ui/src/components/chat/floating-chat-windows.tsx`

```tsx
export function FloatingChatWindows() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);
  const openWindows = useChatWindowsStore((s) => s.openWindows);
  const closeAllWindows = useChatWindowsStore((s) => s.closeAll);

  // — Account-switch protection (xem §7.2) —
  const lastUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextUserId = isAuthenticated ? (currentUser?.id ?? null) : null;
    if (lastUserIdRef.current !== nextUserId) {
      if (lastUserIdRef.current !== null) closeAllWindows();
      lastUserIdRef.current = nextUserId;
    }
  }, [isAuthenticated, currentUser?.id, closeAllWindows]);

  // Typing state — single source of truth, share giữa các windows
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());

  const { sendMessage, joinConversation, sendTyping, stopTyping, markRead } = useChatSocket({
    onTyping: handleTyping,
    onStopTyping: handleStopTyping,
  });

  // ... resolve typing user IDs → display names per conversation ...

  if (!isAuthenticated || openWindows.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-0 z-40 hidden items-end gap-2 sm:flex">
      {openWindows.map((window) => (
        <FloatingChatWindow
          key={window.conversationId}
          conversationId={window.conversationId}
          minimized={window.minimized}
          typingUserNames={typingNamesByConversation.get(window.conversationId) ?? []}
          sendMessage={sendMessage}
          joinConversation={joinConversation}
          sendTyping={sendTyping}
          stopTyping={stopTyping}
          markRead={markRead}
        />
      ))}
    </div>
  );
}
```

**Quyết định thiết kế:**
- `pointer-events-none` ở wrapper + `pointer-events-auto` trên từng window → wrapper không chặn click vào page content.
- `hidden sm:flex` → mobile (<640px) hoàn toàn không render, tránh chiếm màn hình nhỏ.
- Container sở hữu socket + typing state → mỗi window chỉ là component "view", nhận data qua props. Đảm bảo 1 socket per layout, không tạo nhiều connections.

### 5.5 FloatingChatWindow

**File:** `packages/shared-ui/src/components/chat/floating-chat-window.tsx`

Một cửa sổ floating đầy đủ chức năng. Width 328px. Hai trạng thái:

| State | Height | Content |
|-------|--------|---------|
| Expanded | ~28rem | Header + messages list + typing indicator + input |
| Minimized | 11 (44px) | Chỉ header — click vào header để expand lại |

**Cấu trúc nội bộ:**

```
┌──────────────────────────────────┐
│ [avatar] Tên           [-] [×]  │  ← Header (always rendered)
├──────────────────────────────────┤
│  Bubble messages                 │
│  ...                             │  ← Body (chỉ khi !minimized)
│  [typing...]                     │
├──────────────────────────────────┤
│ [textarea]            [send]    │  ← Input (chỉ khi !minimized)
└──────────────────────────────────┘
```

**Lifecycle khi expand:**

```typescript
useEffect(() => {
  if (minimized) return;
  joinConversation(conversationId);
  markRead(conversationId);
}, [conversationId, minimized, joinConversation, markRead]);
```

→ Mỗi lần window expanded (hoặc đổi conversation): join socket room + mark read.

**Optimistic message**:

```typescript
const handleSend = (content: string) => {
  const optimistic: ChatMessageData = {
    id: `temp-${Date.now()}`, content, type: 'TEXT',
    senderId: currentUser.id, sender: { ... },
    createdAt: new Date().toISOString(),
  };
  setLocalMessages((prev) => [...prev, optimistic]);
  sendMessage(conversationId, content, { type: 'TEXT' });
};
```

→ Local state push optimistic message ngay. Sau khi socket echo back `new_message` event → `useMessages` invalidate → server message thay thế optimistic (filter trùng bằng cặp `senderId + content`).

**Auto-scroll:**
- `shouldScrollRef = true` khi user gửi tin → effect sau render scroll xuống đáy.
- Effect khác fetch older messages khi scroll lên đầu (`scrollTop < 60`).

**Lazy load messages khi minimized:**

```typescript
const { data: messagesData, ... } = useMessages(minimized ? '' : conversationId);
```

→ Truyền `''` cho `useMessages` khi minimized → query disabled (bên trong `useMessages` có `enabled: !!conversationId`). Tiết kiệm network khi user minimize nhiều windows.

### 5.6 FloatingChatMessage + FloatingChatInput

Hai component nhỏ tách ra để dễ maintain:

- **`floating-chat-message.tsx`** — render bubble: support TEXT + IMAGE (link click mở fullsize), avatar + tên người gửi cho group chat (chỉ khi đổi sender), relative time.
- **`floating-chat-input.tsx`** — textarea auto-grow (max 96px = 4 dòng), Enter để send, Shift+Enter xuống dòng. Debounce typing event 2s. Send button disabled khi empty.

### 5.7 Index re-exports

**File:** `packages/shared-ui/src/components/chat/index.ts`

```typescript
export { ChatPopover } from './chat-popover';
export { FloatingChatWindows } from './floating-chat-windows';
export type { ChatConversationData, ChatLastMessage, ChatMessageData, ChatParticipant } from './types';
```

**File:** `packages/shared-ui/src/index.ts` (thêm vào cuối)

```typescript
// Chat (Facebook/Messenger-style popover + floating windows)
export { ChatPopover, FloatingChatWindows } from './components/chat';
export type {
  ChatConversationData, ChatLastMessage, ChatMessageData, ChatParticipant,
} from './components/chat';
```

### 5.8 shared-ui dependencies

**File:** `packages/shared-ui/package.json`

```diff
   "dependencies": {
+    "@shared/hooks": "*",
+    "@shared/utils": "*",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "tailwind-merge": "^3.5.0"
   },
   "peerDependencies": {
     "react": ">=19.0.0",
     "react-dom": ">=19.0.0",
     "lucide-react": ">=0.400.0",
-    "next-themes": ">=0.4.0"
+    "next-themes": ">=0.4.0",
+    "next-intl": ">=4.0.0"
   }
```

Trước đó shared-ui là package "primitives only", không phụ thuộc shared-hooks/utils. Lần này phải break nguyên tắc đó vì:
- Chat components cần `useTranslations` (next-intl), `useChatSocket` (shared-hooks), `formatRelativeTime` (shared-utils).
- Không có circular deps: shared-hooks và shared-utils không import gì từ shared-ui (đã verify bằng grep).

### 5.9 Student-portal integration

#### a) Navbar — Replace chat link

**File:** `apps/student-portal/src/components/navigation/navbar.tsx`

```diff
- import { MessageCircle, ... } from 'lucide-react';
- import { ..., useConversations } from '@shared/hooks';
+ import { ChatPopover, ... } from '@shared/ui';

- // Chat unread count
- const { data: conversationsRaw } = useConversations();
- const totalChatUnread = ((conversationsRaw...) ?? []).reduce(...);

- {/* Chat */}
- <Link href="/chat" className="hidden sm:inline-flex">
-   <Button variant="ghost" size="icon" className="relative" title={t('chat')}>
-     <MessageCircle className="h-5 w-5" />
-     {totalChatUnread > 0 && (...)}
-   </Button>
- </Link>
+ {/* Chat — popover with floating windows on desktop, mobile menu links to /chat */}
+ <ChatPopover className="hidden sm:inline-flex" seeAllHref="/chat" />
```

Mobile menu drawer (lines 367-401) **giữ nguyên** `<Link href="/chat" />` — mobile vẫn dùng flow cũ.

#### b) Layouts — Mount FloatingChatWindows

**File:** `apps/student-portal/src/app/[locale]/(main)/layout.tsx`

```tsx
import { FloatingChatWindows } from '@shared/ui';

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SocketProvider />
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
      <FloatingChatWindows />   {/* ← thêm */}
    </div>
  );
}
```

**File:** `apps/student-portal/src/app/[locale]/(fullscreen)/layout.tsx`

```tsx
import { FloatingChatWindows } from '@shared/ui';

export default function FullscreenLayout({ children }) {
  return (
    <div className="flex h-screen flex-col">
      <SocketProvider />
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
      <FloatingChatWindows />   {/* ← thêm để ChatPopover hoạt động ở /ai-tutor */}
    </div>
  );
}
```

**Lý do mount cả 2 layouts:** ChatPopover nằm trong Navbar — Navbar render ở cả `(main)` và `(fullscreen)`. Nếu chỉ mount `FloatingChatWindows` ở `(main)`, user trên `/ai-tutor` click conversation trong popover → store update nhưng không có container render → window "vô hình".

Trên trang `/chat` (cũng là `(fullscreen)`), floating windows có thể overlap với panel chat hai pane. Chấp nhận trade-off này vì user trên `/chat` thường không cần mở floating window song song.

#### c) Profile page — "Nhắn tin" button

**File:** `apps/student-portal/src/app/[locale]/(main)/profile/[userId]/page.tsx`

```diff
- import { ... useGetOrCreateConversation } from '@shared/hooks';
+ import { ... useGetOrCreateConversation, useChatWindowsStore, useMediaQuery } from '@shared/hooks';

  export default function ProfilePage(...) {
+   const openChatWindow = useChatWindowsStore((s) => s.openWindow);
+   // Floating chat windows are desktop-only (sm+); mobile falls back to /chat route
+   const isDesktopChat = useMediaQuery('(min-width: 640px)');
    ...
    <Button onClick={() =>
      getOrCreate.mutate(
        { participantId: userId },
        { onSuccess: (res) => {
            const conv = (res as { data?: { id: string } })?.data;
-           if (conv?.id) router.push(`/chat?id=${conv.id}`);
+           if (!conv?.id) return;
+           if (isDesktopChat) {
+             openChatWindow(conv.id);
+           } else {
+             router.push(`/chat?id=${conv.id}`);
+           }
          },
        },
      )
    }>
```

→ Desktop: floating window mở **ngay tại trang profile**, user không rời trang. Mobile: vẫn navigate `/chat` như cũ.

### 5.10 Management-portal integration

#### a) SocketProvider — thêm useChatSocket

**File:** `apps/management-portal/src/components/providers/socket-provider.tsx`

```diff
- import { useNotificationSocket } from '@shared/hooks';
+ import { useChatSocket, useNotificationSocket } from '@shared/hooks';

  export function SocketProvider() {
    useNotificationSocket();
+   useChatSocket();
    return null;
  }
```

→ Đảm bảo unread badge cập nhật realtime khi instructor/admin đang ở các trang không có chat UI.

#### b) Header — thêm ChatPopover

**File:** `apps/management-portal/src/components/navigation/header.tsx`

```diff
  import {
    ...
+   ChatPopover,
    DropdownMenu, ...
  } from '@shared/ui';

+ {/* Chat — popover with floating windows; hidden on mobile */}
+ <ChatPopover className="hidden md:inline-flex" />
+
  {/* Notifications */}
  <NotificationPopover />
```

**Lưu ý:**
- `seeAllHref` không truyền → không có nút "See all in Messenger" (đúng với requirement: management-portal không có route `/chat`).
- Breakpoint là `md:` (≥768px) thay vì `sm:` — management-portal layout có sidebar, header chật hơn, nên ẩn icon chat dưới 768px.

#### c) Layouts — Mount FloatingChatWindows

**File:** `apps/management-portal/src/app/[locale]/instructor/layout.tsx` và `admin/layout.tsx`

```diff
+ import { FloatingChatWindows } from '@shared/ui';

  return (
    <div className="bg-background min-h-screen">
      <SocketProvider />
      ...
      <main>...</main>
+     <FloatingChatWindows />
    </div>
  );
```

---

## 6. i18n Keys

### 6.1 Student-portal — `messages/{en,vi}.json` namespace `chat`

Thêm vào namespace `chat` đã tồn tại:

```json
{
  "chat": {
    ...existing keys...,
    "popoverTitle": "Chats" / "Đoạn chat",
    "seeAllInMessenger": "See all in Messenger" / "Xem tất cả trong Messenger",
    "you": "You" / "Bạn",
    "minimize": "Minimize" / "Thu nhỏ",
    "close": "Close" / "Đóng"
  }
}
```

### 6.2 Management-portal — `messages/{en,vi}.json` namespace `chat` (mới)

Trước đây management-portal không có namespace `chat`. Thêm mới:

```json
{
  "chat": {
    "popoverTitle": "Chats" / "Đoạn chat",
    "directMessage": "Direct message" / "Nhắn riêng",
    "searchPlaceholder": "Search..." / "Tìm kiếm...",
    "messagePlaceholder": "Type a message..." / "Nhập tin nhắn...",
    "online": "Online" / "Trực tuyến",
    "offline": "Offline" / "Ngoại tuyến",
    "typing": "is typing..." / "đang nhập...",
    "noConversations": "No conversations yet" / "Chưa có cuộc trò chuyện",
    "noMessages": "Send a message to start the conversation" / "Gửi tin nhắn để bắt đầu",
    "send": "Send" / "Gửi",
    "you": "You" / "Bạn",
    "minimize": "Minimize" / "Thu nhỏ",
    "close": "Close" / "Đóng"
  }
}
```

Không cần `seeAllInMessenger` vì management-portal không có route `/chat`.

---

## 7. Edge Cases & Bugs Fixed

### 7.1 Account switch leak (critical bug)

**Triệu chứng (user báo):** Đăng xuất tài khoản A, đăng nhập tài khoản B trong cùng tab → floating window từ A vẫn hiển thị nhưng nội dung trống, tên hiển thị `...`, status "Ngoại tuyến".

**Nguyên nhân:** `useChatWindowsStore` là module-level singleton, **không** persist nhưng cũng **không** reset khi auth state đổi. Tài khoản B không có quyền truy cập conversation của A → API trả 403 → window render rỗng.

**Fix:** Effect trong `<FloatingChatWindows />` track user id qua `useRef`, gọi `closeAll()` khi id đổi.

```typescript
const lastUserIdRef = useRef<string | null>(null);
useEffect(() => {
  const nextUserId = isAuthenticated ? (currentUser?.id ?? null) : null;
  if (lastUserIdRef.current !== nextUserId) {
    if (lastUserIdRef.current !== null) {
      closeAllWindows();  // chỉ close khi đã có user trước đó (skip first mount)
    }
    lastUserIdRef.current = nextUserId;
  }
}, [isAuthenticated, currentUser?.id, closeAllWindows]);
```

**Trace logic:**

| Sự kiện | `lastUserIdRef.current` | `nextUserId` | Hành động |
|---------|-------------------------|--------------|-----------|
| Initial render (chưa hydrate) | `null` | `null` | Skip |
| Hydration done — login user A | `null` | `A` | Set ref = A, không close |
| Logout | `A` | `null` | `closeAll()` + set ref = null |
| Login user B | `null` | `B` | Set ref = B, không close (đã close lúc logout) |
| A → B trực tiếp (không logout) | `A` | `B` | `closeAll()` + set ref = B |

### 7.2 New tab logout (intentional, not a bug)

**Triệu chứng:** Click "See all in Messenger" với `target="_blank"` → tab mới ở `/chat` nhưng đã đăng xuất.

**Nguyên nhân:** Auth store dùng `sessionStorage` (per-tab). Tab mới có sessionStorage rỗng. AuthProvider có cơ chế refresh-token cookie nhưng chỉ chạy khi sessionStorage có user data trước đó (optimization "skip refresh for pure guests"). Tab mới = pure guest → skip → đăng xuất.

**Decision:** Bỏ `target="_blank"`, navigate cùng tab. Mất đặc điểm "tab mới" của Messenger thật, nhưng đồng nhất với UX của các link khác trong app.

```diff
- <a href={seeAllHref} target="_blank" rel="noopener noreferrer" ...>
+ <a href={seeAllHref} ...>
```

### 7.3 ChatPopover trên (fullscreen) layout

Như đã đề cập ở §5.9b, `<FloatingChatWindows />` mount ở cả `(main)` lẫn `(fullscreen)` để click conversation trên `/ai-tutor` (hoặc bất kỳ trang fullscreen nào có Navbar) vẫn hoạt động.

### 7.4 Optimistic messages duplicate

`FloatingChatWindow` filter optimistic local messages khỏi server messages bằng cặp `senderId + content`. Edge case: 2 message cùng nội dung gần nhau → có thể bị skip. Chấp nhận vì xác suất thấp; cải tiến thêm `sentAt` matching trong tương lai.

### 7.5 Mobile fallback

- ChatPopover trigger button: `hidden sm:inline-flex` (student) / `hidden md:inline-flex` (management) → mobile không thấy icon chat trên navbar desktop.
- FloatingChatWindows wrapper: `hidden sm:flex` → mobile không render container, tránh chiếm màn hình.
- Profile page "Nhắn tin": dùng `useMediaQuery('(min-width: 640px)')` để detect, mobile fallback `router.push('/chat?id=...')`.
- Student-portal mobile menu drawer giữ nguyên `<Link href="/chat" />`.

---

## 8. Component Patterns & Best Practices

### 8.1 Type Safety
✅ **Không `any`** — Mọi data đều có interface (`ChatConversationData`, `ChatMessageData`, ...).
✅ **Helper functions** thay vì inline duplication: `normalizeParticipants`, `getOtherParticipant`, `getConversationDisplayName`.

### 8.2 Single source of truth
✅ **Socket lifecycle**: Container `<FloatingChatWindows />` sở hữu socket — windows nhận methods qua props, không tự gọi `useChatSocket()`.
✅ **Typing state**: Centralized trong container, share xuống windows qua prop.

### 8.3 Performance
✅ **Lazy messages**: `useMessages(minimized ? '' : conversationId)` → window minimized không fetch messages.
✅ **Memoization**: `useMemo` cho conversations, filtered list, typing names.
✅ **TanStack Query cache**: messages cache theo `['chat', id, 'messages']` — đóng/mở lại window vẫn còn cache.

### 8.4 Theme & A11y
✅ **Design tokens**: `bg-popover`, `bg-muted`, `text-foreground`, `border` — không hardcode color.
✅ **Aria labels** cho icon-only buttons (`aria-label={t('minimize')}`).
✅ **Keyboard navigation**: header buttons hỗ trợ Enter/Space.

### 8.5 Error/Empty states
✅ **Loading skeleton** với `Loader2` icon.
✅ **Empty state**: "No conversations yet" / "Send a message to start the conversation".
✅ **Auth guard**: render `null` khi `!isAuthenticated`.

### 8.6 Architecture
✅ **Reuse over duplicate**: shared-ui chứa components, shared-hooks chứa logic — 2 portals dùng chung.
✅ **Backend untouched**: Tận dụng API + socket có sẵn.

---

## 9. Testing Checklist

### 9.1 Student-portal — Desktop
- [x] Click chat icon → popover hiện ra với list conversations + search + nút "See all in Messenger".
- [x] Search popover filter conversations theo tên người/group.
- [x] Click 1 conversation → popover đóng, floating window mở ở góc dưới phải.
- [x] Send message từ window → optimistic render ngay → server echo thay thế.
- [x] Mở conversation thứ 2 → 2 windows xếp ngang.
- [x] Mở conversation thứ 3 → window cũ nhất bị đóng (LRU).
- [x] Click minimize → window thu thành header bar (44px).
- [x] Click vào header khi minimized → expand lại.
- [x] Click X → window đóng.
- [x] Navigate sang `/courses` → floating windows vẫn còn.
- [x] Click "See all in Messenger" → cùng tab navigate `/chat`.
- [x] Navigate vào `/chat` từ menu → trang chat fullscreen hoạt động bình thường.

### 9.2 Student-portal — Profile page
- [x] Vào profile user khác trên desktop, click icon "Nhắn tin" → floating window mở **ngay tại trang profile**, không rời trang.
- [x] Cùng vậy nhưng resize xuống mobile (<640px) → click "Nhắn tin" → navigate `/chat?id=xxx`.

### 9.3 Student-portal — Mobile (<640px)
- [x] Navbar không có chat icon (popover ẩn).
- [x] Floating windows không render.
- [x] Mobile menu drawer vẫn có link `/chat`.

### 9.4 Account switch
- [x] Mở 1-2 floating windows ở user A.
- [x] Logout → windows tự đóng.
- [x] Login user B → windows không leak từ A.
- [x] Switch account A → B trực tiếp (qua /login mà không logout) → windows reset.

### 9.5 Management-portal
- [x] Login instructor → header có icon chat cạnh notification.
- [x] Click → popover hiện list conversations (cùng API như student).
- [x] Click conversation → floating window mở.
- [x] Send message → student-portal nhận realtime.
- [x] **Không** có nút "See all in Messenger" trong popover.
- [x] Navigate `/chat` direct → 404 (không có route này trong management-portal).
- [x] Resize <768px → chat icon ẩn, floating windows ẩn.
- [x] Login admin → cùng UX như instructor.

### 9.6 Cross-portal realtime
- [x] Tab 1: student-portal, mở floating window conversation X.
- [x] Tab 2: management-portal (instructor), send message tới conversation X → tab 1 nhận realtime.
- [x] Tab 1 send → tab 2 popover unread badge update.

### 9.7 Theme & Locale
- [x] Toggle dark mode → tất cả components đúng theme (popover, window, message bubble).
- [x] Switch vi ↔ en → text update đúng (`popoverTitle`, `seeAllInMessenger`, `online`/`offline`, `typing`, ...).

### 9.8 Build & Typecheck
- [x] `tsc --noEmit` ở student-portal — pass.
- [x] `tsc --noEmit` ở management-portal — pass.

---

## 10. Files Created / Modified

### Created
| File | Purpose |
|------|---------|
| `packages/shared-hooks/src/stores/chat-windows-store.ts` | Zustand store cho floating windows state |
| `packages/shared-ui/src/components/chat/types.ts` | Shared TS types + helper functions |
| `packages/shared-ui/src/components/chat/chat-popover.tsx` | Dropdown panel + trigger button |
| `packages/shared-ui/src/components/chat/chat-popover-item.tsx` | 1 row trong dropdown |
| `packages/shared-ui/src/components/chat/floating-chat-windows.tsx` | Container, sở hữu socket + typing state |
| `packages/shared-ui/src/components/chat/floating-chat-window.tsx` | 1 floating window |
| `packages/shared-ui/src/components/chat/floating-chat-message.tsx` | Message bubble |
| `packages/shared-ui/src/components/chat/floating-chat-input.tsx` | Textarea + send button |
| `packages/shared-ui/src/components/chat/index.ts` | Re-export |

### Modified
| File | Thay đổi |
|------|----------|
| `packages/shared-hooks/src/index.ts` | Export `useChatWindowsStore`, type `ChatWindow` |
| `packages/shared-ui/src/index.ts` | Export `ChatPopover`, `FloatingChatWindows`, các types |
| `packages/shared-ui/package.json` | Thêm `@shared/hooks`, `@shared/utils` deps; thêm `next-intl` peerDep |
| `apps/student-portal/src/components/navigation/navbar.tsx` | Replace chat link với `<ChatPopover seeAllHref="/chat" />`, remove `useConversations`, `MessageCircle` |
| `apps/student-portal/src/app/[locale]/(main)/layout.tsx` | Mount `<FloatingChatWindows />` |
| `apps/student-portal/src/app/[locale]/(fullscreen)/layout.tsx` | Mount `<FloatingChatWindows />` |
| `apps/student-portal/src/app/[locale]/(main)/profile/[userId]/page.tsx` | Click "Nhắn tin": desktop → `openChatWindow`, mobile → `router.push` |
| `apps/student-portal/messages/{en,vi}.json` | Thêm 5 keys vào `chat` namespace |
| `apps/management-portal/src/components/providers/socket-provider.tsx` | Thêm `useChatSocket()` |
| `apps/management-portal/src/components/navigation/header.tsx` | Thêm `<ChatPopover className="hidden md:inline-flex" />` |
| `apps/management-portal/src/app/[locale]/instructor/layout.tsx` | Mount `<FloatingChatWindows />` |
| `apps/management-portal/src/app/[locale]/admin/layout.tsx` | Mount `<FloatingChatWindows />` |
| `apps/management-portal/messages/{en,vi}.json` | Thêm namespace `chat` mới (13 keys) |

---

## 11. Migration Notes

### Cho người dev khác kéo branch về

1. **Cần `npm install` ở root** vì `packages/shared-ui/package.json` đổi deps.
2. **Không cần migrate DB** — không có thay đổi schema.
3. **Không cần redeploy backend** — chat module API + gateway giữ nguyên.
4. **Cần restart Next.js dev server** sau khi pull (do Next.js cache module resolution của workspace deps).

### Cho production deploy

- Build cả 2 portals (`turbo build`).
- Không có biến môi trường mới.
- Verify `NEXT_PUBLIC_WS_URL` đã trỏ đúng API server (đã có sẵn).

---

## 12. Summary

✅ **Floating UI** — Click chat icon → popover; click conversation → floating window ở góc phải, persist qua route changes.
✅ **Reuse-first** — Tận dụng `useChatSocket`, `useConversations`, `useMessages` có sẵn. Backend không đổi.
✅ **Cross-portal** — Cùng UX cho student + management. Instructor/admin chat trực tiếp với student.
✅ **Mobile-aware** — Mobile fallback về `/chat` route, tránh floating UI nhỏ trên màn hình hẹp.
✅ **Multi-window LRU** — Tối đa 2 windows, eviction tự động.
✅ **Account-switch safe** — Auto-close all windows khi user id đổi → tránh leak conversation giữa accounts.
✅ **Type-safe + i18n + dark mode** — Đúng convention CLAUDE.md.

Feature sẵn sàng cho user test và polish UI nếu cần.

---

## 13. Future Enhancements (out of scope)

- [ ] Image/file upload trong floating window (hiện chỉ TEXT, /chat page có image upload đầy đủ).
- [ ] Voice/video call integration.
- [ ] Active windows persist qua page refresh (sessionStorage / localStorage).
- [ ] Avatar minimized mode (giống FB y hệt — thu thành avatar tròn cạnh phải màn hình).
- [ ] Group chat creation từ popover (hiện chỉ làm ở /chat page).
- [ ] Reply/quote message, emoji reactions, message editing.
- [ ] Unread message indicator riêng cho từng window khi minimized (hiện đã có badge nhỏ trên header).
- [ ] OTT-based "open in new tab" nếu cần khôi phục target="_blank" cho "See all in Messenger".
