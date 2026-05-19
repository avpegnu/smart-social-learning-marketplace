# Phase 7.12 — Cải Thiện Trang Social Page: Layout Twitter/LinkedIn

## 📋 Tổng Quan

Nâng cấp trang `/social` từ layout 1 cột hẹp (`max-w-2xl`) sang **layout 3 cột kiểu mạng xã hội** (như X/Twitter hay LinkedIn) với:
- **Sidebar phải** hiển thị trending posts, suggested users, groups
- **Feed tab** cho phép lọc: "Dành cho bạn" (authenticated) hoặc "Công khai" (tất cả)
- **Responsive design** ẩn sidebar trên mobile (< 1024px)

Vấn đề hiện tại: trang Social trống trải, không tận dụng không gian màn hình rộng.

---

## 🎯 Mục Tiêu Chi Tiết

### Kết Quả Mong Đợi

1. **Desktop (>= 1024px):**
   - 3 cột: `[1fr | minmax(0, 600px) | 300px]`
   - Cột giữa: PostComposer + Feed tabs
   - Cột phải: TrendingSidebar + SuggestionsSidebar + GroupsSidebar

2. **Mobile (< 1024px):**
   - 1 cột full-width
   - Sidebar ẩn
   - PostComposer + Feed ở giữa

3. **Feed filtering:**
   - Tab "Dành cho bạn": fan-out personal feed (auth required, giữ nguyên useFeed)
   - Tab "Công khai": all public posts, paginated (mọi user)
   - Guest users: chỉ thấy "Công khai" tab, không có PostComposer

4. **Trending sidebar:**
   - Top 5 posts từ 7 ngày qua, sort by like+comment count
   - Hiển thị: truncated content, like/comment count, author name
   - Cache 5 phút
   - Public (không cần auth)

5. **Suggestions sidebar:**
   - Top 5 users có nhiều followers nhất mà current user chưa follow
   - Follow button có optimistic update
   - Khi follow thành công → user biến mất khỏi list
   - Auth required

6. **Groups sidebar:**
   - Top 3 public groups
   - "View all" link → `/social/groups`
   - Public (không cần auth)

---

## 🔨 Triển Khai Chi Tiết

### Phase 1 — Backend (apps/api)

#### 1.1 `feed.service.ts` — Thêm 2 methods

**Vị trí:** Sau method `getFeed`

**Method 1: `getTrending()`**
- Tìm posts từ **7 ngày qua** (`createdAt >= now - 7d`)
- Điều kiện: `deletedAt === null` AND `groupId === null` (chỉ timeline posts)
- Sort: `likeCount DESC, commentCount DESC`
- Lấy top 5
- Return: `{ data: TrendingPost[] }`

**Method 2: `getPublicFeed(userId?: string, query: PaginationDto)`**
- Tìm all posts công khai: `deletedAt === null, groupId === null`
- Sort: `createdAt DESC` (mới nhất trước)
- Paginate theo `query.skip, query.limit`
- Nếu **unauthenticated** (userId undefined) hoặc **no posts**: set `isLiked: false, isBookmarked: false` cho tất cả
- Nếu **authenticated**: batch query `prisma.like` + `prisma.bookmark` để populate `isLiked, isBookmarked`
- Return: `{ data: Post[], meta: { page, limit, total, totalPages } }` (same as getFeed)

**Interface:**
```typescript
interface TrendingPost {
  id: string
  content: string
  likeCount: number
  commentCount: number
  author: { id: string; fullName: string; avatarUrl: string | null }
}
```

#### 1.2 `feed.controller.ts` — Thêm 2 endpoints

**Vị trí:** TRƯỚC `@Get('feed')` để tránh route collision

**Endpoint 1: `GET /feed/trending`**
- Decorator: `@Public()`
- No auth required
- Call: `this.feedService.getTrending()`

**Endpoint 2: `GET /feed/public`**
- Decorator: `@Public()`
- Params: `@Query() query: PaginationDto`
- Optional user: `@CurrentUser() user?: JwtPayload`
- Call: `this.feedService.getPublicFeed(user?.sub, query)`

#### 1.3 `users.service.ts` — Thêm `getSuggestions()`

**Vị trí:** Sau `searchUsers()`

**Logic:**
1. Query `prisma.follow.findMany` với `where: { followerId: currentUserId }`
2. Build `excluded = [ ...followingIds, currentUserId ]` (user không muốn gợi ý chính mình)
3. Query `prisma.user.findMany`:
   - `where: { id: { notIn: excluded }, status: 'ACTIVE', deletedAt: null }`
   - `orderBy: { followerCount: 'desc' }`
   - `take: 5`
4. Map result: `{ ...user, isFollowing: false }` → all suggestions have `isFollowing: false`
5. Return: `{ data: SuggestedUser[] }`

**Interface:**
```typescript
interface SuggestedUser {
  id: string
  fullName: string
  avatarUrl: string | null
  followerCount: number
  isFollowing: boolean
}
```

#### 1.4 `users.controller.ts` — Thêm `/suggestions` endpoint

**Vị trí:** TRƯỚC `@Get(':id')` route (important: literal routes trước param routes)

**Endpoint: `GET /users/suggestions`**
- Decorator: `@ApiBearerAuth()` (auth required)
- Call: `this.usersService.getSuggestions(user.sub)`

---

### Phase 2 — Shared Hooks (packages/shared-hooks)

#### 2.1 `services/social.service.ts`

**Thêm interface:**
```typescript
export interface TrendingPost {
  id: string
  content: string
  likeCount: number
  commentCount: number
  author: { id: string; fullName: string; avatarUrl: string | null }
}
```

**Thêm 2 methods vào `socialService` object:**
```typescript
getTrending: () => apiClient.get<{ data: TrendingPost[] }>('/feed/trending'),
getPublicFeed: (params?: { page?: number; limit?: number }) =>
  apiClient.get('/feed/public', toQuery(params)),
```

#### 2.2 `services/user.service.ts`

**Thêm interface:**
```typescript
export interface SuggestedUser {
  id: string
  fullName: string
  avatarUrl: string | null
  followerCount: number
  isFollowing: boolean
}
```

**Thêm method vào `userService` object:**
```typescript
getSuggestions: () => apiClient.get<{ data: SuggestedUser[] }>('/users/suggestions'),
```

#### 2.3 `queries/use-social.ts`

**Thêm 2 hooks sau `useBookmarks`:**

```typescript
export function useTrending() {
  return useQuery({
    queryKey: ['social', 'trending'],
    queryFn: () => socialService.getTrending(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });
}

export function usePublicFeed() {
  return useInfiniteQuery({
    queryKey: ['social', 'public-feed'],
    queryFn: ({ pageParam = 1 }) =>
      socialService.getPublicFeed({ page: pageParam as number, limit: 10 }),
    getNextPageParam: (lastPage: unknown) => {
      const page = lastPage as { meta?: { page: number; totalPages: number } };
      if (!page.meta || page.meta.page >= page.meta.totalPages) return undefined;
      return page.meta.page + 1;
    },
    initialPageParam: 1,
  });
}
```

**Giải thích:**
- `useTrending`: Query đơn giản, cache 5 phút
- `usePublicFeed`: Infinite query, tương tự `useFeed` để support infinite scroll

#### 2.4 `queries/use-users.ts`

**Thêm hook sau `useSearchUsers`:**

```typescript
export function useSuggestedUsers(enabled = true) {
  return useQuery({
    queryKey: ['users', 'suggestions'],
    queryFn: () => userService.getSuggestions(),
    staleTime: 5 * 60 * 1000,
    enabled, // Allow caller to disable while loading
  });
}
```

**Cập nhật `useFollowUser`:**

Tìm function `useFollowUser` và locate `onSettled` callback. Thêm line:
```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['users', userId] });
  queryClient.invalidateQueries({ queryKey: ['users', 'suggestions'] }); // ← ADD THIS LINE
}
```

Mục đích: sau khi follow user thành công, invalidate suggestions list để user vừa follow biến mất.

#### 2.5 `index.ts`

**Thêm exports trong social section:**
```typescript
export { useTrending, usePublicFeed } from './queries/use-social';
export type { TrendingPost } from './services/social.service';
```

**Thêm exports trong users section:**
```typescript
export { useSuggestedUsers } from './queries/use-users';
export type { SuggestedUser } from './services/user.service';
```

---

### Phase 3 — Frontend Components (apps/student-portal)

#### 3.1 `components/social/trending-sidebar.tsx` (NEW)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@shared/ui';
import { useTrending } from '@shared/hooks';

export function TrendingSidebar() {
  const t = useTranslations('social');
  const { data, isLoading } = useTrending();
  const posts = data?.data ?? [];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="text-primary h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('trending')}</h2>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        )}

        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="border-border border-b pb-3 last:border-0 last:pb-0">
              <p className="text-foreground line-clamp-2 text-xs">
                {post.content}
              </p>
              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {post.likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {post.commentCount}
                </span>
                <span className="truncate">{post.author.fullName}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**Thiết kế:**
- Card container
- Header với TrendingUp icon
- Loading skeleton 3 dòng
- List posts: content `line-clamp-2` (max 2 dòng), stats row dưới
- Border separator giữa items, item cuối không có border

#### 3.2 `components/social/suggestions-sidebar.tsx` (NEW)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Loader2 } from 'lucide-react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '@shared/ui';
import { useSuggestedUsers, useFollowUser, useUnfollowUser } from '@shared/hooks';
import { Link } from '@/i18n/navigation';

export function SuggestionsSidebar() {
  const t = useTranslations('social');
  const { data, isLoading } = useSuggestedUsers();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const suggestions = data?.data ?? [];

  if (!isLoading && suggestions.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="text-primary h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('suggestions')}</h2>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        )}

        <ul className="space-y-3">
          {suggestions.map((user) => {
            const initials = user.fullName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const isPending = followUser.isPending || unfollowUser.isPending;

            return (
              <li key={user.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Link href={`/profile/${user.id}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/profile/${user.id}`}
                      className="block truncate text-xs font-medium hover:underline"
                    >
                      {user.fullName}
                    </Link>
                    <p className="text-muted-foreground text-[10px]">
                      {user.followerCount.toLocaleString()} followers
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={user.isFollowing ? 'outline' : 'default'}
                  className="h-7 shrink-0 px-3 text-xs"
                  disabled={isPending}
                  onClick={() =>
                    user.isFollowing
                      ? unfollowUser.mutate(user.id)
                      : followUser.mutate(user.id)
                  }
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    t('follow')
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**Thiết kế:**
- Render null nếu không loading và list trống
- Avatar clickable link → `/profile/:id`
- User name + follower count dưới avatar
- Follow button: variant phụ thuộc vào `isFollowing`
- Disabled state khi pending
- Spinner icon khi pending

#### 3.3 `components/social/groups-sidebar.tsx` (NEW)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@shared/ui';
import { useGroups } from '@shared/hooks';
import { Link } from '@/i18n/navigation';

export function GroupsSidebar() {
  const t = useTranslations('social');
  const tGroups = useTranslations('groups');
  const { data, isLoading } = useGroups({ limit: 3 } as Record<string, unknown>);
  const groups = (data as { data?: { id: string; name: string; memberCount: number }[] })
    ?.data ?? [];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-primary h-4 w-4" />
            <h2 className="text-sm font-semibold">{t('groups')}</h2>
          </div>
          <Link href="/social/groups" className="text-primary text-xs hover:underline">
            {tGroups('viewAll')}
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        )}

        <ul className="space-y-1">
          {groups.map((group) => {
            const initials = group.name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <li key={group.id}>
                <Link
                  href={`/social/groups/${group.id}`}
                  className="hover:bg-accent flex items-center gap-2 rounded-md p-1.5 transition-colors"
                >
                  <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{group.name}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {group.memberCount.toLocaleString()} {tGroups('members')}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**Thiết kế:**
- Header với Groups icon + "View all" link
- Avatar initials trong box `bg-primary/10 text-primary`
- Group name (truncate) + member count
- Hover bg-accent
- Compact spacing

---

### Phase 4 — i18n Keys

#### 4.1 `apps/student-portal/messages/vi.json`

Tìm section `"social"` và thêm:
```json
"forYou": "Dành cho bạn",
"publicFeed": "Công khai"
```

Tìm section `"groups"` và thêm:
```json
"viewAll": "Xem tất cả"
```

#### 4.2 `apps/student-portal/messages/en.json`

Tìm section `"social"` và thêm:
```json
"forYou": "For You",
"publicFeed": "Public"
```

Tìm section `"groups"` và thêm:
```json
"viewAll": "View all"
```

---

### Phase 5 — Social Page Refactor

#### 5.1 `apps/student-portal/src/app/[locale]/(main)/social/page.tsx`

**Full rewrite:**

```typescript
'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui';
import { useAuthStore, useFeed, usePublicFeed } from '@shared/hooks';
import { PostComposer } from '@/components/social/post-composer';
import { PostCard } from '@/components/social/post-card';
import { TrendingSidebar } from '@/components/social/trending-sidebar';
import { SuggestionsSidebar } from '@/components/social/suggestions-sidebar';
import { GroupsSidebar } from '@/components/social/groups-sidebar';

// ── Type definitions (keep from original page.tsx) ──

interface PostAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface CodeSnippet {
  language: string;
  code: string;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  parentId?: string | null;
  replies?: CommentData[];
}

interface PostImage {
  url: string;
  order: number;
}

interface SharedPost {
  id: string;
  content: string;
  author: PostAuthor;
  images?: PostImage[];
  codeSnippet?: CodeSnippet | null;
}

interface Post {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  author: PostAuthor;
  codeSnippet?: CodeSnippet | null;
  images?: PostImage[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  sharedPost?: SharedPost | null;
  comments?: CommentData[];
}

interface FeedPage {
  data?: Post[];
  meta?: { page: number; totalPages: number };
}

// ── Main Page Component ──

export default function SocialPage() {
  const t = useTranslations('social');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,600px)_300px]">
        {/* Left spacer (hidden on mobile) */}
        <div className="hidden lg:block" />

        {/* Center: Feed */}
        <div className="min-w-0">
          {/* Post composer (auth only) */}
          {isAuthenticated && (
            <div className="mb-6">
              <PostComposer />
            </div>
          )}

          {/* Feed tabs or public feed */}
          {isAuthenticated ? (
            <Tabs defaultValue="for-you">
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="for-you" className="flex-1">
                  {t('forYou')}
                </TabsTrigger>
                <TabsTrigger value="public" className="flex-1">
                  {t('publicFeed')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="for-you">
                <ForYouFeed />
              </TabsContent>
              <TabsContent value="public">
                <PublicFeed />
              </TabsContent>
            </Tabs>
          ) : (
            <PublicFeed />
          )}
        </div>

        {/* Right sidebar (hidden on mobile) */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <TrendingSidebar />
          {isAuthenticated && <SuggestionsSidebar />}
          <GroupsSidebar />
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ──

function ForYouFeed() {
  const t = useTranslations('social');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const posts = ((data?.pages ?? []) as FeedPage[]).flatMap((page) => page.data ?? []);

  return (
    <>
      {isLoading && <FeedSpinner />}
      {!isLoading && posts.length === 0 && <EmptyFeed message={t('noFeed')} />}
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {isFetchingNextPage && <FeedSpinner />}
      <div ref={sentinelRef} className="h-1" />
    </>
  );
}

function PublicFeed() {
  const t = useTranslations('social');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePublicFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const posts = ((data?.pages ?? []) as FeedPage[]).flatMap((page) => page.data ?? []);

  return (
    <>
      {isLoading && <FeedSpinner />}
      {!isLoading && posts.length === 0 && <EmptyFeed message={t('noFeed')} />}
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {isFetchingNextPage && <FeedSpinner />}
      <div ref={sentinelRef} className="h-1" />
    </>
  );
}

// ── Helper components ──

function FeedSpinner() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
    </div>
  );
}

function EmptyFeed({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
```

**Giải thích:**
- Layout grid: `lg:grid-cols-[1fr_minmax(0,600px)_300px]`
  - Cột 1: hidden spacer (future: user profile card)
  - Cột 2: `minmax(0, 600px)` → feed center không vượt 600px nhưng fluid
  - Cột 3: fixed 300px right sidebar
- Authenticated: Tabs "Dành cho bạn" + "Công khai"
- Guest: chỉ PublicFeed
- 2 sub-components `ForYouFeed` + `PublicFeed` share giống nhau layout, khác hook
- Helper functions `FeedSpinner` + `EmptyFeed` tái sử dụng

---

## 📌 Implementation Adjustments & Fixes

### Issue 1: Comment Not Displaying on Zero-Comment Posts (RESOLVED)

**Problem:** When adding a comment to a post with `commentCount === 0` (especially from trending sidebar modal), the comment doesn't display until page reload.

**Root Cause:** `useCreateComment` mutation's `onMutate` callback tried updating cache with key `['social', 'posts', postId, 'comments']`, but `useComments` hook includes pagination params in the key: `['social', 'posts', postId, 'comments', { page: 1, limit: 50 }]`. The optimistic update didn't match the actual query key.

**Solution (3 fixes combined):**

1. **useCreateComment optimistic update** — Use `queryClient.getQueriesData()` with `exact: false` to find ALL comments queries for that post (regardless of pagination params) and update each one:
```typescript
onMutate: async ({ postId, data }) => {
  await queryClient.cancelQueries({
    queryKey: ['social', 'posts', postId, 'comments'],
    exact: false,
  });

  const queries = queryClient.getQueriesData({
    queryKey: ['social', 'posts', postId, 'comments'],
    exact: false,
  });
  const prevComments = queries.length > 0 ? queries[0][1] : null;

  const tempCommentId = `temp-${Date.now()}`;
  const optimisticComment = { /* ... */ };

  queries.forEach(([key]) => {
    queryClient.setQueryData(key, (oldData: unknown) => {
      const d = oldData as { data?: unknown[] } | undefined;
      if (d?.data && Array.isArray(d.data)) {
        return { ...d, data: [...d.data, optimisticComment] };
      }
      return oldData;
    });
  });

  return { prevComments };
}
```

2. **CommentSection logic** — Force use `serverComments` when `commentCount === 0`:
```typescript
const allComments = expanded || commentCount === 0 ? serverComments : previewComments;
```
This ensures zero-comment posts always show real-time updates from the optimistic add + server refetch.

3. **Invalidation with exact: false** — Broad-match all query keys:
```typescript
onSuccess: (_data, vars) => {
  queryClient.invalidateQueries({
    queryKey: ['social', 'posts', vars.postId, 'comments'],
    exact: false,
  });
  queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
}
```

**Files Modified:**
- `packages/shared-hooks/src/queries/use-social.ts` → `useCreateComment` mutation
- `apps/student-portal/src/components/social/comment-section.tsx` → allComments selection logic

---

### Issue 2: Follow Button Loading State (RESOLVED)

**Problem:** Clicking follow on user A disabled ALL follow buttons globally.

**Root Cause:** Button used global `disabled={followUser.isPending || unfollowUser.isPending}` which applied to all users.

**Solution:** Track which user ID is being actioned with `pendingUserId` state:
```typescript
const [pendingUserId, setPendingUserId] = useState<string | null>(null);
// ... in button:
disabled={pendingUserId === user.id}
onClick={() => {
  setPendingUserId(user.id);
  user.isFollowing ? unfollowUser.mutate(user.id) : followUser.mutate(user.id);
}}
```

**Files Modified:**
- `apps/student-portal/src/components/social/suggestions-sidebar.tsx`

---

### Issue 3: Trending Sidebar Post Click (RESOLVED)

**Problem:** Clicking trending post link returned 404 (route `/posts/{id}` doesn't exist).

**Solution:** Replace Link with modal dialog:
- Add `useState` for selected post
- `handlePostClick` sets the post and opens modal
- `<PostDetailModal>` component displays post in dialog
- No navigation needed

**Files Modified:**
- `apps/student-portal/src/components/social/trending-sidebar.tsx`
- `apps/student-portal/src/components/social/post-detail-modal.tsx` (NEW)

---

### Issue 4: Backend Response Type Wrapping (RESOLVED)

**Problem:** Services returning `{ data: T }` but apiClient.get<T>() also wrapping in ApiResponse, causing double-wrapping.

**Solution:** Change service return types to return bare `T`:
- `getTrending(): Promise<TrendingPost[]>` (not `Promise<{ data: TrendingPost[] }>`)
- `getPublicFeed(): Promise<Post[]>` (not `Promise<{ data: Post[] }>`)
- `getSuggestions(): Promise<SuggestedUser[]>` (not `Promise<{ data: SuggestedUser[] }>`)

apiClient.get<T>() automatically wraps to `ApiResponse<T>`.

**Files Modified:**
- `apps/api/src/modules/social/feed/feed.service.ts`
- `apps/api/src/modules/users/users.service.ts`

---

### Issue 5: QuickLinks Sidebar Broken Routes (RESOLVED)

**Problem:** Links to `/bookmarks` (404) and `/social` (redundant) broke navigation.

**Solution:** Replace with actual implemented routes:
- Home → `/`
- Q&A → `/qna`
- Notifications → `/notifications`
- Settings → `/settings`

Removed Bookmarks and Social (already on social page).

**Files Modified:**
- `apps/student-portal/src/components/social/quick-links-sidebar.tsx`

---

### Implementation Notes: Query Key Matching

**Critical:** When using TanStack Query with params in keys, optimistic updates must match the exact query key structure:

❌ **Wrong:**
```typescript
// Hook key: ['social', 'posts', id, 'comments', { page: 1 }]
queryClient.setQueryData(['social', 'posts', id, 'comments'], data) // Doesn't match!
```

✅ **Correct:**
```typescript
// Find all matching queries and update each
const queries = queryClient.getQueriesData({
  queryKey: ['social', 'posts', id, 'comments'],
  exact: false, // Matches even with different params
});
queries.forEach(([key]) => queryClient.setQueryData(key, data));
```

Use `getQueriesData()` + `forEach()` when params vary, or always pass params to `setQueryData()`.

---

## ✅ Testing Checklist

### Backend Unit Tests

**File: `apps/api/src/modules/social/feed/feed.service.spec.ts`**

- [ ] `getTrending` returns array of 5 posts sorted by likeCount DESC
- [ ] `getTrending` filters out deleted posts (`deletedAt === null`)
- [ ] `getTrending` filters out group posts (`groupId === null`)
- [ ] `getTrending` filters posts from last 7 days only
- [ ] `getPublicFeed` (unauthenticated) returns posts with `isLiked: false, isBookmarked: false`
- [ ] `getPublicFeed` (authenticated) batch enriches with actual like/bookmark status
- [ ] Pagination metadata correct: `page, limit, total, totalPages`

**File: `apps/api/src/modules/users/users.service.spec.ts`**

- [ ] `getSuggestions` excludes current user
- [ ] `getSuggestions` excludes already-following users
- [ ] `getSuggestions` returns max 5 users sorted by `followerCount DESC`
- [ ] All returned items have `isFollowing: false`

### Frontend Smoke Tests (Manual)

**Layout Responsiveness:**
- [ ] Desktop (1024px+): 3-column grid renders
- [ ] Mobile (< 1024px): 1-column, sidebar hidden
- [ ] Feed center never exceeds ~600px width

**Authentication Flow:**
- [ ] Authenticated user: PostComposer visible, Tabs "Dành cho bạn" + "Công khai", SuggestionsSidebar visible
- [ ] Guest user: no PostComposer, no tabs (PublicFeed only), no SuggestionsSidebar
- [ ] TrendingSidebar visible to all (public)
- [ ] GroupsSidebar visible to all (public)

**Tab Functionality:**
- [ ] "Dành cho bạn" tab: shows personal feed (từ useFeed)
- [ ] "Công khai" tab: shows all public posts (từ usePublicFeed)
- [ ] Switching tabs smooth, scroll position maintained per tab
- [ ] Infinite scroll works independently in both tabs

**Sidebar Widgets:**
- [ ] TrendingSidebar: loads top 5 posts, shows like/comment counts, author name
- [ ] SuggestionsSidebar:
  - [ ] Loads top 5 suggested users
  - [ ] User avatar clickable → `/profile/:id`
  - [ ] Follow button click → follow mutation fires
  - [ ] After follow: user removes from list (cache invalidation)
- [ ] GroupsSidebar: shows top 3 groups, "View all" link → `/social/groups`

**i18n Verification:**
- [ ] Tab labels translate correctly (vi/en)
- [ ] All sidebar headers translate (trending, suggestions, groups)
- [ ] No hardcoded English strings in new components
- [ ] `useTranslations('social')` + `useTranslations('groups')` work

**TypeScript:**
- [ ] Run: `cd apps/student-portal && npm run type-check` → 0 errors
- [ ] Run: `cd apps/api && npm run build` → 0 errors
- [ ] No `any` types in new code

### Performance

- [ ] Trending cache: staleTime 5 phút verified
- [ ] Suggestions cache: staleTime 5 phút verified
- [ ] Infinite scroll: no excessive re-renders on page down
- [ ] Avatar images lazy-load (inherit from shadcn Avatar)

---

## 📝 Implementation Notes

### Common Pitfalls to Avoid

1. **Route ordering in controller:** Literal routes MUST come before param routes. `GET /feed/trending` must be BEFORE `GET /feed/:id` (if exists). Same for `GET /users/suggestions` BEFORE `GET /users/:id`.

2. **@Public() decorator:** Must import `Public` decorator. Check it exists in `@/common/decorators`.

3. **Cache invalidation:** After follow in suggestions sidebar, MUST invalidate `['users', 'suggestions']` query key OR suggestions won't disappear.

4. **CSS grid:** Use `minmax(0, 600px)` for middle column to prevent overflow on long post titles.

5. **Sidebar conditional render:** SuggestionsSidebar must return `null` early if no loading and empty list to avoid empty card.

6. **Responsive hidden:** Use `hidden lg:block` + `hidden lg:flex` correctly. `min-w-0` on center column prevents grid blowout.

7. **Types:** Keep strict TypeScript. Sidebar components receive untyped data (useGroups), so cast `data as { data?: Group[] }` with fallback `?? []`.

### File Checklist Before Commit

```
✓ Backend files modified (feed service/controller, users service/controller)
✓ Shared hooks (services, queries, index exports)
✓ i18n keys (vi.json + en.json, social + groups sections)
✓ 3 new sidebar components created
✓ Social page refactored (layout, tabs, imports)
✓ TypeScript strict mode: npm run type-check (0 errors)
✓ No hardcoded strings or hardcoded colors
✓ All imports using design tokens (text-primary, bg-accent, etc.)
✓ Test files added/updated
✓ Git: commit with scope "feat(social)" per conventional commits
```

---

## 🚀 Rollout Strategy

1. **Phase 1 backend** → deploy API
2. **Phase 2 hooks** → publish `@shared/hooks` package
3. **Phase 3-5 frontend** → deploy student-portal
4. **Instant no breaking change** (new endpoints public, old feed still works)
5. **Cleanup later:** Can soft-delete old single-column CSS when confident

---

## 📊 Success Metrics

- [ ] Social page loads trending posts on first visit
- [ ] Users can filter "For You" vs "Public" feed
- [ ] Suggested users appear in sidebar for authenticated users
- [ ] Follow button in suggestions removes user from list
- [ ] Layout responsive on mobile (sidebar hidden)
- [ ] No console errors or TypeScript warnings
- [ ] Lighthouse perf: > 80
