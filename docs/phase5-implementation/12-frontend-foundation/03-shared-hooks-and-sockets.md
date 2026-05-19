# 03 — Shared Hooks & Socket.io: Debounce, Infinite Scroll, Chat/Notification WebSocket

> Giải thích chi tiết shared hooks — useDebounce (timer cleanup), useMediaQuery (SSR-safe),
> useInfiniteScroll (IntersectionObserver pattern), useApiError (error code → i18n),
> useChatSocket + useNotificationSocket (WebSocket lifecycle management).

---

## 1. TỔNG QUAN

### 1.1 Hook Organization

```
packages/shared-hooks/src/
├── stores/                        ← Zustand stores (explained in 02)
│   ├── auth-store.ts
│   ├── cart-store.ts
│   └── ui-store.ts
├── use-debounce.ts                ← Value debouncing
├── use-media-query.ts             ← Responsive breakpoints
├── use-infinite-scroll.ts         ← IntersectionObserver
├── use-api-error.ts               ← Error code → i18n message
├── use-chat-socket.ts             ← Socket.io /chat namespace
├── use-notification-socket.ts     ← Socket.io /notifications namespace
└── index.ts                       ← Re-export all
```

**Tại sao đặt trong `shared-hooks` thay vì per-portal?**
- Cả 2 portals dùng chung: debounce, media-query, api-error, notification socket
- DRY — không duplicate hook code
- `'use client'` directive ở đầu mỗi file → tương thích cả Next.js App Router

---

## 2. useDebounce — Timer Cleanup Pattern

### 2.1 Implementation

```typescript
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);  // Cleanup on value change
  }, [value, delay]);

  return debounced;
}
```

### 2.2 Lý thuyết Debounce

```
Không debounce (search input):
  Keystroke: R → Re → Rea → Reac → React
  API calls: 5 requests (1 per keystroke) → unnecessary load

Với debounce (300ms):
  Keystroke: R → Re → Rea → Reac → React
  Timer:     [300ms]→clear [300ms]→clear [300ms]→clear [300ms]→clear [300ms]→FIRE
  API calls: 1 request (after user stops typing 300ms)
```

**Cleanup pattern:** Mỗi khi `value` thay đổi → `clearTimeout(timer)` cancel timer cũ → set timer mới. Chỉ timer cuối cùng (user ngừng gõ 300ms) thực sự fire.

### 2.3 Usage

```tsx
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

// Query only fires when debouncedSearch changes (after 300ms idle)
const { data } = useQuery({
  queryKey: ['courses', { search: debouncedSearch }],
  queryFn: () => apiClient.get('/courses', { search: debouncedSearch }),
  enabled: debouncedSearch.length > 0,
});
```

---

## 3. useMediaQuery — SSR-Safe Responsive Hook

### 2.1 Implementation

```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

### 3.2 `useState(false)` — SSR Default

```
SSR (server):  matches = false (no window.matchMedia)
Hydration:     useEffect runs → matches = actual value
```

Initial value `false` → SSR renders mobile-first layout → hydration corrects to actual value. Nếu `useState(true)` → SSR renders desktop → hydration flash trên mobile.

### 3.3 `addEventListener('change')` thay vì `addListener`

```typescript
// ❌ Deprecated
media.addListener(handler);

// ✅ Modern (EventTarget API)
media.addEventListener('change', handler);
```

`addListener` deprecated since 2020. `addEventListener` là standard EventTarget API.

### 3.4 Usage

```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)');
const isMobile = useMediaQuery('(max-width: 768px)');

// Management portal — desktop-only guard
if (!isDesktop) return <DesktopOnlyMessage />;
```

---

## 4. useInfiniteScroll — IntersectionObserver Pattern

### 4.1 Implementation

```typescript
export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { threshold: 0.1 },
    );
    observerRef.current.observe(node);
  }, [onLoadMore, hasMore]);

  return sentinelRef;
}
```

### 4.2 Lý thuyết IntersectionObserver

```
┌──────────────────────────┐
│  Viewport (visible area)  │
│  ┌────────────────────┐  │
│  │  Post 1             │  │
│  │  Post 2             │  │
│  │  Post 3             │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  Post 4             │  │
│  │  Post 5             │  │
│  │  ═══ sentinel ═══  │←─── isIntersecting = true → onLoadMore()
│  └────────────────────┘  │
└──────────────────────────┘
```

**Sentinel element:** Invisible `<div ref={sentinelRef} />` ở cuối list. Khi scroll đến sentinel → observer fires → load next page.

**`threshold: 0.1`** — trigger khi 10% của sentinel visible. Không cần 100% visible trước khi load → smoother UX.

### 4.3 Callback Ref Pattern

```typescript
const sentinelRef = useCallback((node: HTMLElement | null) => {
  if (observerRef.current) observerRef.current.disconnect();  // Cleanup old
  if (!node || !hasMore) return;                                // No more data
  observerRef.current = new IntersectionObserver(...);          // Create new
  observerRef.current.observe(node);                            // Start observing
}, [onLoadMore, hasMore]);
```

**Tại sao `useCallback` ref thay vì `useRef`?**
- `useRef` + `useEffect` → observer created/destroyed on EVERY render
- `useCallback` ref → only re-creates when `onLoadMore` or `hasMore` changes
- React calls callback ref with `null` when element unmounts → natural cleanup

### 4.4 Usage

```tsx
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({...});
const sentinelRef = useInfiniteScroll(() => fetchNextPage(), hasNextPage ?? false);

return (
  <div>
    {data?.pages.map(page => page.data.map(post => <PostCard key={post.id} post={post} />))}
    <div ref={sentinelRef} /> {/* Invisible sentinel */}
  </div>
);
```

---

## 5. useApiError — Error Code → i18n Message

```typescript
export function useApiError() {
  const t = useTranslations();

  return (error: unknown): string => {
    if (isApiError(error)) {
      const key = `apiErrors.${error.code}`;
      return t.has(key) ? t(key) : error.code;
    }
    return t('common.unknownError');
  };
}
```

**Flow:**
```
Backend throws: { code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 }
    ↓
Frontend catches error
    ↓
useApiError() → t.has('apiErrors.EMAIL_ALREADY_EXISTS')
    ↓ YES
messages/vi.json: "apiErrors.EMAIL_ALREADY_EXISTS": "Email đã được sử dụng"
    ↓
UI shows: "Email đã được sử dụng"
```

**Fallback:** Nếu error code chưa có trong i18n → hiển thị raw code (`EMAIL_ALREADY_EXISTS`). Developer thấy ngay cần thêm translation.

---

## 6. SOCKET.IO HOOKS

### 6.1 useChatSocket

```typescript
useEffect(() => {
  if (!isAuthenticated || !accessToken) return;

  const socket = io(`${SOCKET_URL}/chat`, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
  });

  socket.on('new_message', (message) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(message.conversationId) });
  });

  socketRef.current = socket;
  return () => { socket.disconnect(); };
}, [isAuthenticated, accessToken, queryClient]);
```

**Key patterns:**
- **Guard:** Only connect when authenticated (no anon socket connections)
- **`auth: { token }`** — backend `WsAuthGuard` verifies JWT from handshake
- **`transports: ['websocket']`** — skip long-polling, direct WebSocket (faster)
- **Cache invalidation on events** — new message → invalidate conversation list + messages → UI auto-updates via TanStack Query
- **Cleanup:** `return () => socket.disconnect()` → disconnect on unmount or auth change

### 6.2 useNotificationSocket

```typescript
socket.on('notification', (notification) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
  toast.info(notification.data?.title || 'New notification');
});

socket.on('unread_count', (count) => {
  queryClient.setQueryData(queryKeys.notifications.unreadCount, { data: count });
});
```

**`setQueryData` vs `invalidateQueries`:**
- `invalidateQueries` → mark cache stale → TanStack Query refetches in background
- `setQueryData` → directly update cache → instant UI update, no network request

`unread_count` dùng `setQueryData` vì server đã gửi exact value → không cần refetch. `notification` dùng `invalidateQueries` vì cần fetch full notification list.

### 6.3 Toast Integration

```typescript
import { toast } from 'sonner';

socket.on('notification', (notification) => {
  toast.info(notification.data?.title || 'New notification');
});
```

Sonner toast hiển thị push notification dạng toast trên UI — ngay khi WebSocket event arrive. User thấy notification mà không cần reload page.

---

## 7. SHARED TYPES — Full Expansion (18 interfaces, 22 enums)

`packages/shared-types/src/index.ts` expanded from ~37 lines → **~300 lines** to match ALL backend models:

**Interfaces:** User, Course, Section, Chapter, Lesson, Review, CartItem, Order, Post, Comment, Conversation, Message, Question, Answer, Notification, Category, Tag, Group, LessonProgress, Certificate, InstructorProfile

**Enums (matching ALL 22 Prisma enums):** Role, UserStatus, CourseLevel, CourseStatus, LessonType, OrderStatus, EnrollmentType, PostType, MessageType, NotificationType, GroupPrivacy, GroupRole, ApplicationStatus, CouponType, WithdrawalStatus, EarningStatus, MediaType, MediaStatus, ReportTargetType, ReportStatus

**Tại sao mirror Prisma enums?** Frontend cần type-safe comparisons:
```typescript
// ❌ String comparison (typo-prone)
if (course.status === 'PUBISHED') { ... }  // Typo → no error

// ✅ Enum comparison (compile-time check)
if (course.status === CourseStatus.PUBLISHED) { ... }  // Typo → TS error
```

---

## 8. SHARED I18N — 102 Error Codes

`packages/shared-i18n/src/index.ts` expanded from 5 → **102 error codes**, organized by backend module:

```
Auth (10): INVALID_CREDENTIALS, EMAIL_ALREADY_EXISTS, ...
Users (4): USER_NOT_FOUND, CANNOT_FOLLOW_SELF, ...
Instructor (5): ALREADY_INSTRUCTOR, APPLICATION_ALREADY_PENDING, ...
Courses (11): COURSE_NOT_FOUND, COURSE_NOT_EDITABLE, ...
Curriculum (7): SECTION_NOT_FOUND, CHAPTER_NOT_FOUND, ...
Reviews (3): REVIEW_NOT_FOUND, ALREADY_REVIEWED, ...
Cart (6): CART_EMPTY, ALREADY_IN_CART, ...
Coupons (7): COUPON_NOT_FOUND, COUPON_EXPIRED, ...
Enrollments (4): ALREADY_ENROLLED, NOT_ENROLLED, ...
Withdrawals (4): WITHDRAWAL_NOT_FOUND, INSUFFICIENT_BALANCE, ...
Learning (3): LESSON_ACCESS_DENIED, MAX_ATTEMPTS_REACHED, ...
Social (4): POST_NOT_FOUND, NOT_POST_OWNER, ...
Groups (8): GROUP_NOT_FOUND, ALREADY_MEMBER, ...
Q&A (7): QUESTION_NOT_FOUND, CANNOT_VOTE_OWN_ANSWER, ...
AI (2): AI_DAILY_LIMIT_REACHED, NOT_SESSION_OWNER
Media (2): MEDIA_NOT_FOUND, MEDIA_NOT_UPLOADING
Admin (5): CANNOT_MODIFY_ADMIN, CATEGORY_HAS_COURSES, ...
Reports (3): REPORT_NOT_FOUND, REPORT_ALREADY_EXISTS, ...
```

**Type-safe export:**
```typescript
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
// → Union type of all 102 error code strings
```

**Frontend usage:**
```typescript
import { API_ERROR_CODES } from '@shared/i18n';

// Type-safe error code reference
if (error.code === API_ERROR_CODES.EMAIL_ALREADY_EXISTS) {
  // Show specific UI feedback
}
```

---

## 9. FILES CREATED

| File | Lines | Mục đích |
|------|-------|----------|
| `shared-hooks/src/use-debounce.ts` | 14 | Value debouncing |
| `shared-hooks/src/use-media-query.ts` | 16 | Responsive breakpoints |
| `shared-hooks/src/use-infinite-scroll.ts` | 25 | IntersectionObserver infinite loading |
| `shared-hooks/src/use-api-error.ts` | 22 | Error code → i18n |
| `shared-hooks/src/use-chat-socket.ts` | 60 | Chat WebSocket lifecycle |
| `shared-hooks/src/use-notification-socket.ts` | 45 | Notification WebSocket + toast |
| `shared-utils/src/index.ts` | +25 | isApiError, getErrorMessageKey, formatDuration |
| `shared-types/src/index.ts` | ~300 | 18 interfaces + 22 enums (full backend mirror) |
| `shared-i18n/src/index.ts` | ~160 | 102 error codes + ApiErrorCode type |
