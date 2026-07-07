# Sub-phase 5.13g — Social, Groups & Chat

> Wire Social Feed (posts, likes, comments, bookmarks, share), Groups (browse, detail, join/leave, requests, member management), and Chat (WebSocket real-time messaging) to real API.
> Dependencies: 5.13a (Auth), 5.13e (Profile — follow system).
> **Includes backend modifications:** GroupJoinRequest model, notification wiring into social/chat/qna modules, user search endpoint, chat gateway enhancements (typing, mark_read, offline notification).

---

## Backend Changes

### 1. GroupJoinRequest Model (Prisma)

**Migration:** `20260324135459_add_group_join_request/migration.sql`

```sql
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "group_join_requests" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "group_join_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_join_requests_group_id_user_id_key"
  ON "group_join_requests"("group_id", "user_id");
CREATE INDEX "group_join_requests_group_id_status_idx"
  ON "group_join_requests"("group_id", "status");
```

**Prisma model:**
```prisma
model GroupJoinRequest {
  id      String            @id @default(cuid())
  groupId String            @map("group_id")
  userId  String            @map("user_id")
  status  JoinRequestStatus @default(PENDING)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([groupId, userId])
  @@index([groupId, status])
  @@map("group_join_requests")
}

enum JoinRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### 2. Groups Service — Enhanced (`groups.service.ts`)

**New endpoints:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/groups/:id/requests` | Owner/Admin | List pending join requests |
| `PUT` | `/groups/:id/requests/:requestId/approve` | Owner/Admin | Approve → add member + increment count |
| `PUT` | `/groups/:id/requests/:requestId/reject` | Owner/Admin | Reject request |

**Modified `join()` logic:**
- PUBLIC group → direct join (existing)
- PRIVATE + courseId → auto-join if enrolled (existing)
- PRIVATE (no courseId) → create/upsert `GroupJoinRequest` with status PENDING
  - If already PENDING → throw `JOIN_REQUEST_PENDING`
  - Notify group owner via `NotificationsService.create()`
  - Returns `{ requested: true }` instead of `{ joined: true }`

**`approveJoinRequest()`:**
- Verify caller is OWNER/ADMIN
- Transaction: update request status → create member → increment memberCount
- Notify requester with `GROUP_JOIN_APPROVED` notification

**`findAll()` batch optimization:**
- Batch-check membership + join request status for all groups in one query
- Returns `isMember`, `currentUserRole`, `joinRequestStatus` per group

**`findById()` enhanced:**
- Returns `isMember`, `currentUserRole`, `joinRequestStatus` for current user

**`getGroupPosts()` enhanced:**
- Private groups require membership check
- Batch-loads `isLiked` and `isBookmarked` for all posts

### 3. Wire Notifications into Social, Chat, QnA, Users Modules

**`interactions.service.ts`** — MODIFIED
- `toggleLike()`: after creating like, creates `POST_LIKE` notification for post author (skip self-like)
- Fetches liker's `fullName` for notification data

**`comments.service.ts`** — MODIFIED
- `create()`: creates `POST_COMMENT` notification for post author (skip self-comment)
- For replies: also notifies parent comment author (skip if same as post author or self)
- Fetches commenter's `fullName` for notification data

**`users.service.ts`** — MODIFIED
- Added `searchUsers(query)` method — searches by `fullName` (contains, case-insensitive), min 2 chars, returns max 20 results with `PUBLIC_USER_SELECT`
- `follow()` notification already existed (from phase 5.9)

**`users.controller.ts`** — MODIFIED
- Added `GET /users/search?q=xxx` endpoint (`@Public()`)

**`chat.gateway.ts`** — MODIFIED (major enhancements)
- Added `typing` event handler — broadcasts `user_typing` to conversation room
- Added `stop_typing` event handler — broadcasts `user_stop_typing`
- Added `mark_read` event handler — calls `chatService.markRead()`, emits `message_read` to room + `mark_read_confirmed` back to sender
- Enhanced `send_message`: after sending, checks which members are NOT in the conversation room and sends `new_message_notification` to their personal `user_{id}` room

**`chat.service.ts`** — MODIFIED
- Added `getConversationMembers(conversationId)` — returns `userId` list
- `getConversations()` enhanced: computes `unreadCount` per conversation based on `lastReadAt`
- `getConversations()` enhanced: checks Redis `online:{userId}` for online status of 1-on-1 partner

**`chat.module.ts`** — MODIFIED
- Added `NotificationsModule` import

**`social.module.ts`** — MODIFIED
- Added `NotificationsModule` import

**`users.module.ts`** — MODIFIED
- Added `NotificationsModule` import

**`qna.module.ts`** — MODIFIED
- Added `NotificationsModule` import (already imported)

**`answers.service.ts`** — MODIFIED
- `create()`: creates notification for question author

**`notifications/dto/query-notifications.dto.ts`** — MODIFIED
- Added `read` filter param (`'true' | 'false'`)

### 4. Unit Tests Updated

| File | Tests |
|------|-------|
| `groups.service.spec.ts` | 8 tests: create (3), join (3), leave (3), kickMember (2) |
| `chat.service.spec.ts` | 9 tests: getOrCreateConversation (3), sendMessage (2), getMessages (1), markRead (1), isMember (2) |
| `comments.service.spec.ts` | 4 tests: create (2 + parent validation), getByPost (1), delete (2) |
| `interactions.service.spec.ts` | 5 tests: toggleLike (3), toggleBookmark (2), getBookmarks (1) |
| `users.service.spec.ts` | Extended with notification mock |
| `answers.service.spec.ts` | Extended with notification mock |

---

## Shared Layer

### `packages/shared-hooks/src/services/social.service.ts` — NEW

Methods: `getFeed`, `getBookmarks`, `createPost`, `getPost`, `updatePost`, `deletePost`, `sharePost`, `toggleLike`, `toggleBookmark`, `getComments`, `createComment`, `deleteComment`
Types: `CreatePostData`, `UpdatePostData`, `CreateCommentData`
Uses `apiClient.del()` for DELETE methods.

### `packages/shared-hooks/src/services/group.service.ts` — NEW

Methods: `getGroups`, `createGroup`, `getGroup`, `updateGroup`, `deleteGroup`, `joinGroup`, `leaveGroup`, `getMembers`, `updateMemberRole`, `kickMember`, `getGroupPosts`, `createGroupPost`, `getJoinRequests`, `approveRequest`, `rejectRequest`
Types: `CreateGroupData`, `UpdateGroupData`

### `packages/shared-hooks/src/services/chat.service.ts` — NEW

Methods: `getConversations`, `getOrCreateConversation`, `getMessages`, `sendMessage`
Types: `CreateConversationData`, `SendMessageData`

### `packages/shared-hooks/src/services/user.service.ts` — EXTENDED

Added: `searchUsers(q)` method — `GET /users/search?q=xxx`

### `packages/shared-hooks/src/queries/use-social.ts` — NEW

Hooks:
- **Queries:** `useFeed` (infinite query), `useBookmarks`, `usePost`, `useComments`
- **Mutations:** `useCreatePost`, `useUpdatePost`, `useDeletePost`, `useToggleLike`, `useToggleBookmark`, `useSharePost`, `useCreateComment`, `useDeleteComment`

`useFeed` uses `useInfiniteQuery` with `getNextPageParam` from `meta.page < meta.totalPages`.

### `packages/shared-hooks/src/queries/use-groups.ts` — NEW

Hooks:
- **Queries:** `useGroups`, `useGroup`, `useGroupMembers`, `useGroupPosts`, `useJoinRequests`
- **Mutations:** `useCreateGroup`, `useUpdateGroup`, `useDeleteGroup`, `useJoinGroup`, `useLeaveGroup`, `useCreateGroupPost`, `useUpdateMemberRole`, `useKickMember`, `useApproveRequest`, `useRejectRequest`

All mutations invalidate appropriate query keys. `useApproveRequest` invalidates requests, members, and group detail queries.

### `packages/shared-hooks/src/queries/use-chat.ts` — NEW

Hooks: `useConversations`, `useMessages` (infinite query, desc→asc reversal), `useGetOrCreateConversation`, `useSendMessage`

`useMessages` uses `useInfiniteQuery` for scroll-up pagination (loads older messages).

### `packages/shared-hooks/src/queries/use-users.ts` — EXTENDED

Added: `useSearchUsers(query)` — enabled when query.length >= 2, staleTime 10s.

### `packages/shared-hooks/src/use-chat-socket.ts` — ENHANCED

- Added `ChatSocketCallbacks` interface: `onTyping`, `onStopTyping`, `onMessageRead`
- Listeners: `user_typing`, `user_stop_typing`, `message_read`, `mark_read_confirmed`, `new_message_notification`
- Returns: `joinConversation`, `sendMessage`, `sendTyping`, `stopTyping`, `markRead`
- Uses `callbacksRef` pattern to avoid stale closure issues

### `packages/shared-hooks/src/use-notification-socket.ts` — UNCHANGED

Already connects to `/notifications` namespace, invalidates queries on `notification` event, updates `unread_count` cache.

### `packages/shared-hooks/src/index.ts` — EXTENDED

Exports all 3 new services, 3 new query hook modules, enhanced `useChatSocket` with `ChatSocketCallbacks` type.

---

## Frontend — File Structure

```
components/
├── social/
│   ├── post-composer.tsx       # Create post (text, code, images via Cloudinary)
│   ├── post-card.tsx           # Post with interactions, shared post, image grid
│   ├── post-actions.tsx        # Like, comment, share, bookmark buttons (optimistic)
│   ├── comment-section.tsx     # Comments list + add comment + reply
│   ├── comment-item.tsx        # Single comment with nested replies
│   ├── share-dialog.tsx        # Share post with optional content
│   ├── group-card.tsx          # Group summary card (join/requested/joined)
│   ├── create-group-dialog.tsx # Dialog form (name, description, privacy)
│   ├── group-header.tsx        # Group detail header with join/leave
│   ├── group-posts-tab.tsx     # Post composer + group posts list
│   ├── group-members-tab.tsx   # Members list with pagination
│   ├── group-requests-tab.tsx  # Join requests with approve/reject
│   ├── group-post-card.tsx     # Post card variant for group context
│   └── member-item.tsx         # Member row with role badge, role select, kick
├── chat/
│   ├── conversation-list.tsx   # Search + conversation list + new group button
│   ├── conversation-item.tsx   # Conversation row (avatar, last msg, unread, online)
│   ├── user-search-item.tsx    # User result in search (click to start chat)
│   ├── message-panel.tsx       # Header + messages + typing + input
│   ├── message-item.tsx        # Message bubble (own right, other left)
│   ├── message-input.tsx       # Textarea + send button + typing debounce
│   ├── typing-indicator.tsx    # Animated "User is typing..." dots
│   └── new-group-dialog.tsx    # Group chat: name + multi-select users
├── providers/
│   └── socket-provider.tsx     # Mounts useNotificationSocket + useChatSocket

app/[locale]/
├── (main)/social/
│   ├── page.tsx                # Social feed (140 lines)
│   └── groups/
│       ├── page.tsx            # Groups list (134 lines)
│       └── [groupId]/page.tsx  # Group detail (125 lines)
├── (fullscreen)/
│   ├── layout.tsx              # Navbar only, no footer, h-screen overflow-hidden
│   └── chat/page.tsx           # Chat (178 lines)
├── (main)/layout.tsx           # Added SocketProvider
```

---

## Frontend Pages

### Social Feed (`/social`) — 140 lines
- `useFeed()` with `useInfiniteQuery` → IntersectionObserver sentinel for infinite scroll
- `PostComposer` at top (authenticated only)
- `PostCard` for each post with actions, comments, shared post preview
- Loading spinner, empty state with icon

### Groups List (`/social/groups`) — 134 lines
- `useGroups({ search, page, limit: 12 })` with debounced search (300ms)
- Responsive grid: 1/2/3 columns
- `GroupCard` with join button states (join/request/pending/joined)
- `CreateGroupDialog` for creating new groups
- Number pagination with 5-page window
- Empty state with Users icon

### Group Detail (`/social/groups/[groupId]`) — 125 lines
- `useGroup(groupId)` for header data
- `GroupHeader` with gradient banner, avatar, join/leave/request button
- Tabs: Posts | Members (count) | Requests (owner/admin only) | About
- Posts tab: inline composer + paginated posts
- Members tab: list with role badges, role select + kick (owner/admin)
- Requests tab: approve/reject with user avatars
- About tab: description + created date

### Chat (`/chat`) — 178 lines (fullscreen layout)
- Moved from `(main)/chat/` to `(fullscreen)/chat/` for h-screen no-footer layout
- Two-column: `ConversationList` (sm:w-80) + `MessagePanel` (flex-1)
- Mobile: toggle between list and panel views via `showList` state
- Typing state: `Map<conversationId, Set<userId>>` with name resolution
- Socket callbacks: `onTyping`, `onStopTyping` via `useChatSocket()`
- URL param support: `?id=xxx` opens specific conversation on mount

---

## Key Technical Decisions

### 1. Fanout-on-Write Feed Pattern
- `PostsService.create()` calls `fanoutToFollowers()` — inserts `FeedItem` for each follower
- Group posts fan out to group members instead of followers
- `FeedService.getFeed()` queries pre-computed `feed_items` table (no expensive joins at read time)
- Batch-loads `isLiked` and `isBookmarked` for all posts in one query

### 2. Optimistic Updates for Like/Bookmark
- `PostActions` maintains `optimisticLiked` and `optimisticLikeCount` state
- Toggles immediately on click, rolls back `onError`
- Same pattern for bookmark toggle
- Follow uses TanStack Query `onMutate` → `cancelQueries` → `setQueryData` → `onError` rollback

### 3. Infinite Scroll via IntersectionObserver
- Feed page uses `useRef<HTMLDivElement>` sentinel at bottom
- Observer with `rootMargin: '200px'` triggers `fetchNextPage()` before reaching bottom
- Chat messages use scroll-up detection: `container.scrollTop < 60` triggers `fetchNextPage()`
- Preserves scroll position after loading older messages via `prevScrollHeightRef`

### 4. WebSocket Room Architecture
- Each connected user joins personal room `user_{userId}`
- On conversation select: client emits `join_conversation` → joins `conv_{conversationId}`
- `send_message` broadcasts `new_message` to `conv_{id}` room
- Gateway checks which members are NOT in room → sends `new_message_notification` to `user_{id}` rooms
- Online status: Redis `online:{userId}` with 5-min TTL, set on connect, deleted on disconnect

### 5. Typing Indicator with Debounce
- `MessageInput` uses `isTypingRef` + `typingTimeoutRef` pattern
- On first keystroke: emit `typing` → start 2-second timeout
- On each keystroke: reset timeout
- After 2 seconds idle: emit `stop_typing`
- On send: immediately `stop_typing` and clear timeout
- Chat page aggregates typing state: `Map<conversationId, Set<userId>>`
- Resolves user IDs to names from conversation participants

### 6. Fullscreen Chat Layout
- Chat moved to `(fullscreen)` route group — no footer, no mobile nav, `h-screen overflow-hidden`
- `SocketProvider` component mounts both `useNotificationSocket()` and `useChatSocket()` in both `(main)` and `(fullscreen)` layouts
- Ensures real-time events (notifications, chat badges) work across all pages

### 7. Private Group Join Request Flow
- Public groups → direct join
- Private + courseId → auto-join if enrolled, else `ENROLLMENT_REQUIRED`
- Private (no courseId) → creates `GroupJoinRequest` with PENDING status
- Owner notified via `SYSTEM` notification with `GROUP_JOIN_REQUEST` type
- Owner/Admin approve → transaction: update request + create member + increment count + notify requester
- Frontend: `joinRequestStatus` field drives button state (join/request/pending)

### 8. Batch Membership & Request Checks
- `findAll()` batches membership and request status checks for all groups in response
- Single `groupMember.findMany` + `groupJoinRequest.findMany` with `{ in: groupIds }`
- Maps results to `isMember`, `currentUserRole`, `joinRequestStatus` per group
- Avoids N+1 queries on group list page

---

## npm Dependencies Added

None — all features use existing dependencies (socket.io-client, @tanstack/react-query, next-intl, lucide-react, sonner).

---

## i18n Keys Updated

**`social`** (22 keys): `myLearning`, `feed`, `messages`, `groups`, `composerPlaceholder`, `photo`, `post`, `loadMore`, `trending`, `posts`, `suggestions`, `follow`, `createPost`, `postPlaceholder`, `addImage`, `addCode`, `like`, `comment`, `share`, `bookmark`, `viewAllComments`, `commentPlaceholder`, `deletePost`, `deleteComment`, `confirmDelete`, `noFeed`, `shareDialog`, `shareContent`, `sharedPost`, `liked`, `saved`, `reply`, `uploading`, `social`

**`groups`** (30 keys): `title`, `createGroup`, `searchPlaceholder`, `members`, `public`, `private`, `join`, `leave`, `joined`, `requestToJoin`, `requestSent`, `posts`, `about`, `name`, `description`, `privacy`, `owner`, `admin`, `member`, `requests`, `approve`, `reject`, `noRequests`, `changeRole`, `kickMember`, `confirmKick`, `deleteGroup`, `confirmDeleteGroup`, `noGroups`, `noPosts`, `backToGroups`, `editGroup`, `createdAt`, `composerPlaceholder`, `previous`, `next`, `viewProfile`, `nameMin`, `nameMax`, `descMax`, `creating`

**`chat`** (21 keys): `title`, `newGroup`, `groupName`, `selectMembers`, `createGroup`, `membersCount`, `directMessage`, `searchPlaceholder`, `searchUsers`, `conversations`, `messagePlaceholder`, `online`, `offline`, `typing`, `noConversations`, `noMessages`, `selectConversation`, `send`, `startChat`, `cancel`

---

## Layout Changes

### `(main)/layout.tsx`
- Added `SocketProvider` component (mounts `useNotificationSocket` + `useChatSocket` globally)

### `(fullscreen)/layout.tsx`
- New layout: Navbar only, no footer, no mobile nav
- `h-screen flex flex-col`, `overflow-hidden` on main
- Also mounts `SocketProvider`

### Chat route moved
- Deleted: `apps/student-portal/src/app/[locale]/(main)/chat/page.tsx`
- Created: `apps/student-portal/src/app/[locale]/(fullscreen)/chat/page.tsx`

### Navbar
- Added MessageCircle (chat) and Users (groups) icons for authenticated users
- Chat link points to `/chat` (fullscreen route)

---

## Quality Checklist

- [x] All user-facing strings via `useTranslations()` (vi + en)
- [x] No hardcoded colors — design tokens only (`bg-card`, `text-muted-foreground`, etc.)
- [x] Dark mode correct (all components use semantic tokens)
- [x] Mobile responsive (chat list/panel toggle, group grid 1-3 cols)
- [x] Loading states (Loader2 spinner on all data fetches)
- [x] Empty states (no feed, no groups, no conversations, no messages, no requests)
- [x] Optimistic updates for like/bookmark (with rollback on error)
- [x] Real-time typing indicator (3 animated dots + user name)
- [x] Auto-scroll on send (`shouldScrollRef` pattern)
- [x] Scroll preservation on older message load (`prevScrollHeightRef`)
- [x] Confirm dialog for delete actions (posts, comments, kick member)
- [x] Auth checks (composer hidden for unauthenticated, comment input hidden)
- [x] WebSocket reconnection (5 attempts, websocket transport)
- [x] No `any` types (uses `unknown` + type assertions where needed)
- [x] Named exports (except Next.js page `export default`)
- [x] Components split — no page > 180 lines
- [x] Infinite scroll (feed) + scroll-up pagination (chat messages)
- [x] Online status indicator (green dot on conversation item + message panel header)
- [x] Unread badge on conversation items
- [x] Group join request flow (request → pending → approve/reject)
