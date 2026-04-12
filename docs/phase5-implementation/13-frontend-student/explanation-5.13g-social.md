# Giải thích chi tiết Phase 5.13g — Social Feed

## 1. Tổng quan Social Feed

Phase 5.13g triển khai tính năng **Social Feed** (Bảng tin xã hội) -- hệ thống mạng xã hội cho phép học viên tương tác, chia sẻ kiến thức, và xây dựng cộng đồng học tập. Tương tự News Feed của Facebook/LinkedIn nhưng tập trung vào nội dung học tập.

### Các tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **View Feed** | Xem bảng tin cá nhân (infinite scroll) |
| **Create Post** | Tạo bài viết text, code snippet, hoặc ảnh |
| **Like** | Thích/bỏ thích bài viết (optimistic update) |
| **Bookmark** | Lưu bài viết để xem lại sau |
| **Comment** | Bình luận bài viết |
| **Reply** | Trả lời comment (nested comments) |
| **Share** | Chia sẻ bài viết kèm bình luận |
| **Delete** | Xóa bài viết/comment (soft delete cho post) |

### Kiến trúc 3 tầng (Services -> Hooks -> Components)

```
[Frontend Components]   — UI components (PostCard, PostComposer, CommentSection...)
        |
   [Shared Hooks]       — TanStack Query hooks (useFeed, useToggleLike, useCreatePost...)
        |
  [Shared Services]     — API call functions (socialService.getFeed, toggleLike...)
        |
   [API Client]         — apiClient.get/post/del
        |
  [Backend API]         — NestJS Controllers -> Services -> Prisma -> DB
```

Mô hình này tách biệt rõ ràng:
- **Services** (`packages/shared-hooks/src/services/social.service.ts`): Hàm gọi API thuần túy
- **Hooks** (`packages/shared-hooks/src/queries/use-social.ts`): Bọc service vào TanStack Query, quản lý cache + invalidation
- **Components** (`apps/student-portal/src/components/social/`): Chỉ xử lý UI, nhận data từ hooks

### Database Models liên quan

```
Post (posts)
├── PostImage (post_images)    -- Nhiều ảnh, có thứ tự
├── Like (likes)               -- @@unique([userId, postId])
├── Bookmark (bookmarks)       -- @@unique([userId, postId])
├── Comment (comments)         -- Self-relation cho nested replies
├── FeedItem (feed_items)      -- Fanout table, mỗi user có riêng
└── Post (shared_post)         -- Self-relation cho share
```

---

## 2. Flow chi tiết 8 actions

### 2.1 View Feed — Xem bảng tin

**Mục đích:** Hiển thị bảng tin cá nhân của user, gồm bài viết từ người họ follow và từ nhóm họ tham gia.

**Backend flow:**

```
GET /api/feed?page=1&limit=10
  → FeedController.getFeed()
    → FeedService.getFeed(userId, query)
      → 1. Query FeedItem JOIN Post JOIN Author + Images + SharedPost
      → 2. Batch lookup isLiked/isBookmarked cho tất cả postIds
      → 3. Gắn isLiked, isBookmarked vào từng post
      → 4. Return paginated result { data, meta }
```

**File:** `apps/api/src/modules/social/feed/feed.service.ts`

```typescript
async getFeed(userId: string, query: PaginationDto) {
  // 1. Query feed items + posts
  const [items, total] = await Promise.all([
    this.prisma.feedItem.findMany({
      where: { userId, post: { deletedAt: null } },
      include: {
        post: {
          include: {
            author: { select: AUTHOR_SELECT },
            images: { orderBy: { order: 'asc' }, take: 4 },
            sharedPost: { include: { author: { select: AUTHOR_SELECT } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    }),
    this.prisma.feedItem.count({ ... }),
  ]);

  // 2. Batch lookup isLiked / isBookmarked
  const postIds = items.map((item) => item.post.id);
  const [likes, bookmarks] = await Promise.all([
    this.prisma.like.findMany({ where: { userId, postId: { in: postIds } } }),
    this.prisma.bookmark.findMany({ where: { userId, postId: { in: postIds } } }),
  ]);
  const likedSet = new Set(likes.map((l) => l.postId));
  const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

  // 3. Merge flags
  const posts = items.map((item) => ({
    ...item.post,
    isLiked: likedSet.has(item.post.id),
    isBookmarked: bookmarkedSet.has(item.post.id),
  }));

  return createPaginatedResult(posts, total, query.page, query.limit);
}
```

**Kỹ thuật Batch isLiked/isBookmarked:**
- Thay vì N+1 query (check từng post), FeedService dùng 2 batch queries `findMany({ where: { postId: { in: postIds } } })` rồi build Set để lookup O(1).
- Giúp giảm từ 2N queries xuống còn 2 queries cho N posts.

**Frontend flow:**

```
SocialPage → useFeed() → useInfiniteQuery()
  → socialService.getFeed({ page, limit: 10 })
  → Render PostCard[] + IntersectionObserver cho infinite scroll
```

**File:** `apps/student-portal/src/app/[locale]/(main)/social/page.tsx`

```typescript
// useInfiniteQuery tự quản lý pagination
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();

// IntersectionObserver trigger load thêm khi scroll gần cuối
const sentinelRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const observer = new IntersectionObserver(handleIntersect, {
    rootMargin: '200px',  // Load trước 200px trước khi chạm đáy
  });
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [handleIntersect]);
```

---

### 2.2 Create Post — Tạo bài viết

**Mục đích:** User tạo bài viết mới (text, code snippet, ảnh). Bài viết sẽ được fanout tới feed của followers.

**Backend flow:**

```
POST /api/posts
Body: { content, type?, codeSnippet?, linkUrl?, imageUrls?, groupId? }
  → PostsController.create()
    → PostsService.create(authorId, dto)
      → 1. Prisma create Post + PostImages (nếu có)
      → 2. fanoutToFollowers(authorId, postId, groupId?)
      → 3. Return created post
```

**File:** `apps/api/src/modules/social/posts/posts.service.ts`

```typescript
async create(authorId: string, dto: CreatePostDto) {
  const post = await this.prisma.post.create({
    data: {
      authorId,
      type: dto.type ?? 'TEXT',
      content: dto.content,
      codeSnippet: dto.codeSnippet ? (dto.codeSnippet as Prisma.InputJsonValue) : undefined,
      linkUrl: dto.linkUrl,
      groupId: dto.groupId,
      // Nested create PostImages với order index
      images: dto.imageUrls?.length
        ? { create: dto.imageUrls.map((url, i) => ({ url, order: i })) }
        : undefined,
    },
    include: { images: true, author: { select: AUTHOR_SELECT } },
  });

  // Fanout: tạo FeedItem cho tất cả followers (hoặc group members)
  await this.fanoutToFollowers(authorId, post.id, dto.groupId);
  return post;
}
```

**DTO validation:** `CreatePostDto` sử dụng `class-validator`:
- `content`: `@IsString() @MinLength(1) @MaxLength(5000)`
- `type`: `@IsOptional() @IsEnum(PostType)` — TEXT, CODE, LINK, SHARED
- `codeSnippet`: `@ValidateNested() @Type(() => CodeSnippetDto)` — `{ language, code }`
- `imageUrls`: `@IsArray() @IsString({ each: true })` — mảng URL Cloudinary

**Frontend flow:**

**File:** `apps/student-portal/src/components/social/post-composer.tsx`

```
PostComposer
├── Avatar user + Textarea (auto-resize)
├── Code editor toggle (ngôn ngữ selector + textarea mono)
├── Image upload grid (multi-file, Cloudinary)
└── Submit button → useCreatePost().mutate(data)
```

Quy trình upload ảnh:
1. User chọn file(s) qua `<input type="file" multiple accept="image/*">`
2. Mỗi file được upload lên Cloudinary client-side qua `uploadToCloudinary(file, 'image')`
3. Nhận về `{ secure_url, public_id }`, lưu vào state `images[]`
4. Khi submit post, chỉ gửi `imageUrls: images.map(img => img.url)` lên backend
5. Backend tạo `PostImage` records với URL đó

---

### 2.3 Like — Thích/bỏ thích bài viết

**Mục đích:** Toggle like trên bài viết. Sử dụng optimistic update để UI phản hồi ngay lập tức.

**Backend flow:**

```
POST /api/posts/:id/like
  → PostsController.toggleLike()
    → InteractionsService.toggleLike(userId, postId)
      → 1. Check post tồn tại + chưa bị xóa
      → 2. Kiểm tra like hiện có (userId_postId unique)
      → 3a. Nếu đã like → $transaction: delete Like + decrement likeCount
      → 3b. Nếu chưa like → $transaction: create Like + increment likeCount
      → 4. Notify post author nếu khác userId (async, catch error)
      → 5. Return { liked: boolean, likeCount: number }
```

**File:** `apps/api/src/modules/social/interactions/interactions.service.ts`

Điểm đáng chú ý:
- Sử dụng `$transaction` để đảm bảo Like record và counter đồng bộ
- Notification gửi async (`.catch(() => {})`) để không block response
- Self-like không tạo notification

**Frontend Optimistic Update:**

**File:** `apps/student-portal/src/components/social/post-actions.tsx`

```typescript
const [optimisticLiked, setOptimisticLiked] = useState(isLiked);
const [optimisticLikeCount, setOptimisticLikeCount] = useState(likeCount);

function handleLike() {
  // 1. Optimistic: cập nhật UI ngay lập tức
  const wasLiked = optimisticLiked;
  setOptimisticLiked(!wasLiked);
  setOptimisticLikeCount((c) => (wasLiked ? c - 1 : c + 1));

  // 2. Gửi request lên server
  toggleLike.mutate(postId, {
    // 3. Rollback nếu server error
    onError: () => {
      setOptimisticLiked(wasLiked);
      setOptimisticLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    },
  });
}
```

Pattern này cho phép:
- UI phản hồi **tức thì** (0ms delay) khi user nhấn like
- Nếu server trả lỗi, UI tự rollback về trạng thái cũ
- Sau khi mutation thành công, `invalidateQueries(['social', 'feed'])` sync lại data từ server

---

### 2.4 Bookmark — Lưu bài viết

**Mục đích:** Toggle bookmark, lưu bài viết để xem lại sau. Tương tự like nhưng không có counter denormalized.

**Backend flow:**

```
POST /api/posts/:id/bookmark
  → InteractionsService.toggleBookmark(userId, postId)
    → Check post exists
    → Check existing bookmark (userId_postId unique)
    → Toggle: create hoặc delete
    → Return { bookmarked: boolean }
```

Bookmark đơn giản hơn Like:
- Không có `bookmarkCount` denormalized trên Post
- Không gửi notification
- Có endpoint riêng `GET /api/bookmarks` để xem danh sách đã lưu

**Frontend:** Tương tự Like, cũng dùng optimistic update nhưng chỉ toggle icon (không có counter).

```typescript
function handleBookmark() {
  const wasBookmarked = optimisticBookmarked;
  setOptimisticBookmarked(!wasBookmarked);
  toggleBookmark.mutate(postId, {
    onError: () => setOptimisticBookmarked(wasBookmarked),
  });
}
```

Invalidation: `['social', 'feed']` + `['social', 'bookmarks']` (để cập nhật cả danh sách bookmarks nếu user đang xem).

---

### 2.5 Comment — Bình luận bài viết

**Mục đích:** Thêm bình luận vào bài viết. Comment là top-level (parentId = null).

**Backend flow:**

```
POST /api/posts/:id/comments
Body: { content, parentId? }
  → PostsController.addComment()
    → CommentsService.create(authorId, postId, dto)
      → 1. Check post exists + not deleted
      → 2. Nếu có parentId → check parent comment tồn tại + cùng postId
      → 3. $transaction:
           a. Create Comment record
           b. Increment post.commentCount
      → 4. Notify post author (nếu khác user)
      → 5. Nếu là reply → notify parent comment author (nếu khác cả user và post author)
      → Return comment
```

**File:** `apps/api/src/modules/social/comments/comments.service.ts`

Notification logic phức tạp:
- **Comment thường:** Notify post author (skip self-comment)
- **Reply:** Notify post author + parent comment author (skip nếu trùng user, tránh duplicate)

**Frontend flow:**

**File:** `apps/student-portal/src/components/social/comment-section.tsx`

```
CommentSection
├── CommentItem[] (preview 2 comment đầu từ server)
├── "Xem tất cả X bình luận" button → expanded mode
├── Expanded → useComments(postId) query tất cả comments
└── Comment input (Avatar + input + Send button)
    ├── Enter to submit
    ├── Reply indicator (@authorName) + X button
    └── Loading state (Loader2 spin)
```

Trạng thái 2 mode:
1. **Preview mode** (mặc định): Hiển thị 2 comment đầu từ `post.comments[]` được include trong feed response
2. **Expanded mode** (khi nhấn "Xem tất cả"): Gọi `useComments(postId, { page: 1, limit: 50 })` để load tất cả

---

### 2.6 Reply — Trả lời bình luận

**Mục đích:** Reply vào một comment cụ thể, tạo nested comments (1 cấp).

**Điểm khác biệt so với Comment:**
- Gửi `parentId` trong request body
- Backend validate: parent comment phải tồn tại và thuộc cùng postId
- Notification gửi cho cả post author và parent comment author
- UI: reply indent sang phải 8 đơn vị (`ml-8`)

**Frontend flow:**

**File:** `apps/student-portal/src/components/social/comment-item.tsx`

```typescript
// CommentItem nhận onReply callback
function handleReply() {
  // Nếu đang reply vào reply → target parentId gốc (không nest sâu hơn 1 cấp)
  onReply(comment.parentId ? comment.parentId : comment.id, comment.author.fullName);
}
```

Khi user nhấn "Trả lời":
1. `CommentSection` set `replyTo = { parentId, authorName }`
2. Input hiển thị indicator `@authorName` với nút X để hủy
3. Focus vào input
4. Submit gửi `{ content, parentId: replyTo.parentId }`

**Backend query nested comments:**

```typescript
// getByPost: chỉ lấy top-level comments (parentId = null)
// Include 3 replies đầu tiên cho mỗi comment
this.prisma.comment.findMany({
  where: { postId, parentId: null },
  include: {
    author: { select: AUTHOR_SELECT },
    replies: {
      take: 3,
      include: { author: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    },
    _count: { select: { replies: true } },
  },
});
```

---

### 2.7 Share — Chia sẻ bài viết

**Mục đích:** Chia sẻ bài viết của người khác lên feed của mình, kèm bình luận tùy chọn.

**Backend flow:**

```
POST /api/posts/:id/share
Body: { content? }
  → PostsController.share()
    → PostsService.share(userId, postId, content?)
      → 1. Check original post exists + not deleted
      → 2. $transaction:
           a. Create new Post (type: 'SHARED', sharedPostId: originalId)
           b. Increment original post.shareCount
      → 3. fanoutToFollowers(userId, newPostId)
      → Return shared post
```

Khi share:
- Tạo **bài viết mới** với `type = 'SHARED'`, link đến bài gốc qua `sharedPostId`
- Nếu user share bài đã share → share bài gốc (tránh chain: `post.sharedPost?.id ?? post.id`)
- Post mới được fanout tới followers của người share

**Frontend flow:**

**File:** `apps/student-portal/src/components/social/share-dialog.tsx`

```
ShareDialog (ConfirmDialog wrapper)
├── Textarea — nội dung kèm theo (tùy chọn)
└── Preview bài gốc (Card nhỏ: avatar + tên + nội dung rút gọn)
```

Trong `PostCard`, share dialog nhận `post.sharedPost?.id ?? post.id` để luôn share bài gốc:

```typescript
<ShareDialog
  post={{
    id: post.sharedPost?.id ?? post.id,           // Luôn share bài gốc
    content: post.sharedPost?.content ?? post.content,
    author: post.sharedPost?.author ?? post.author,
  }}
/>
```

---

### 2.8 Delete — Xóa bài viết/comment

**Mục đích:** Cho phép chủ bài viết/comment xóa nội dung của mình.

**Delete Post (soft delete):**

```
DELETE /api/posts/:id
  → PostsService.delete(postId, userId)
    → Check post exists + authorId === userId
    → Update post.deletedAt = new Date()
    → Feed vẫn giữ FeedItem nhưng post.deletedAt != null → bị filter bởi feed query
```

Soft delete đảm bảo:
- Dữ liệu không mất vĩnh viễn (có thể recover)
- `FeedService.getFeed` tự filter `{ post: { deletedAt: null } }`
- Các Like/Bookmark/Comment vẫn giữ nguyên

**Delete Comment (hard delete):**

```
DELETE /api/posts/:postId/comments/:commentId
  → CommentsService.delete(commentId, userId, postId)
    → Check comment exists + authorId === userId
    → $transaction:
        a. Delete comment (cascade xóa replies nhờ Prisma onDelete: Cascade)
        b. Decrement post.commentCount
```

**Frontend:** Cả hai đều dùng `ConfirmDialog` để xác nhận trước khi xóa.

```typescript
// PostCard
<ConfirmDialog
  title={t('deletePost')}
  description={t('confirmDelete')}
  variant="destructive"
  isLoading={deletePost.isPending}
  onConfirm={() => deletePost.mutate(post.id)}
/>
```

---

## 3. Thay đổi code chi tiết

### 3.1 Backend — NestJS API

#### Module Structure

**File:** `apps/api/src/modules/social/social.module.ts`

```
SocialModule
├── imports: [NotificationsModule]     — Để gửi notification khi like/comment
├── controllers:
│   ├── PostsController               — CRUD posts, share, like, bookmark, comments
│   ├── FeedController                 — GET /feed, GET /bookmarks
│   └── GroupsController               — Groups management
├── providers:
│   ├── PostsService                   — Business logic: create, update, delete, share, fanout
│   ├── CommentsService                — Comments + nested replies
│   ├── InteractionsService            — toggleLike, toggleBookmark, getBookmarks
│   ├── FeedService                    — Feed query + batch isLiked/isBookmarked
│   └── GroupsService                  — Groups logic
└── exports: [PostsService, GroupsService]
```

#### PostsController — API Endpoints

**File:** `apps/api/src/modules/social/posts/posts.controller.ts`

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| `POST` | `/posts` | Required | Tạo bài viết mới |
| `GET` | `/posts/:id` | Public | Xem chi tiết bài viết |
| `PUT` | `/posts/:id` | Required | Cập nhật bài viết (chủ sở hữu) |
| `DELETE` | `/posts/:id` | Required | Soft delete bài viết |
| `POST` | `/posts/:id/share` | Required | Chia sẻ bài viết |
| `POST` | `/posts/:id/like` | Required | Toggle like |
| `POST` | `/posts/:id/bookmark` | Required | Toggle bookmark |
| `GET` | `/posts/:id/comments` | Public | Danh sách comments |
| `POST` | `/posts/:id/comments` | Required | Tạo comment |
| `DELETE` | `/posts/:postId/comments/:commentId` | Required | Xóa comment |

#### FeedController — Feed Endpoints

**File:** `apps/api/src/modules/social/feed/feed.controller.ts`

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| `GET` | `/feed` | Required | Bảng tin cá nhân |
| `GET` | `/bookmarks` | Required | Danh sách bài đã lưu |

#### DTOs

**`CreatePostDto`** (`apps/api/src/modules/social/dto/create-post.dto.ts`):
- `content`: string, 1-5000 chars
- `type`: optional PostType enum (TEXT, CODE, LINK)
- `codeSnippet`: optional nested `{ language: string, code: string }`
- `linkUrl`: optional string
- `imageUrls`: optional string[]
- `groupId`: optional string

**`CreateCommentDto`** (`apps/api/src/modules/social/dto/create-comment.dto.ts`):
- `content`: string, 1-2000 chars
- `parentId`: optional string (for replies)

### 3.2 Shared Layer — Services & Hooks

#### Social Service

**File:** `packages/shared-hooks/src/services/social.service.ts`

Định nghĩa tất cả API calls cho Social module:

```typescript
export const socialService = {
  // Feed
  getFeed: (params?) => apiClient.get('/feed', toQuery(params)),
  getBookmarks: (params?) => apiClient.get('/bookmarks', toQuery(params)),

  // Posts CRUD
  createPost: (data) => apiClient.post('/posts', data),
  getPost: (id) => apiClient.get(`/posts/${id}`),
  updatePost: (id, data) => apiClient.put(`/posts/${id}`, data),
  deletePost: (id) => apiClient.del(`/posts/${id}`),
  sharePost: (id, content?) => apiClient.post(`/posts/${id}/share`, ...),

  // Interactions
  toggleLike: (postId) => apiClient.post(`/posts/${postId}/like`),
  toggleBookmark: (postId) => apiClient.post(`/posts/${postId}/bookmark`),

  // Comments
  getComments: (postId, params?) => apiClient.get(`/posts/${postId}/comments`, ...),
  createComment: (postId, data) => apiClient.post(`/posts/${postId}/comments`, data),
  deleteComment: (postId, commentId) => apiClient.del(`/posts/${postId}/comments/${commentId}`),
};
```

Helper `toQuery()` chuyển đổi params object thành `Record<string, string>`, filter bỏ null/undefined/empty.

#### Social Hooks

**File:** `packages/shared-hooks/src/queries/use-social.ts`

| Hook | Query/Mutation | Query Key | Invalidation |
|------|---------------|-----------|-------------|
| `useFeed()` | `useInfiniteQuery` | `['social', 'feed']` | - |
| `useBookmarks()` | `useQuery` | `['social', 'bookmarks', params]` | - |
| `usePost(id)` | `useQuery` | `['social', 'posts', id]` | - |
| `useComments(postId)` | `useQuery` | `['social', 'posts', postId, 'comments', params]` | - |
| `useCreatePost()` | `useMutation` | - | `['social', 'feed']` |
| `useUpdatePost()` | `useMutation` | - | `['social', 'posts', id]` + `['social', 'feed']` |
| `useDeletePost()` | `useMutation` | - | `['social', 'feed']` |
| `useToggleLike()` | `useMutation` | - | `['social', 'feed']` |
| `useToggleBookmark()` | `useMutation` | - | `['social', 'feed']` + `['social', 'bookmarks']` |
| `useSharePost()` | `useMutation` | - | `['social', 'feed']` |
| `useCreateComment()` | `useMutation` | - | `['social', 'posts', postId, 'comments']` + `['social', 'feed']` |
| `useDeleteComment()` | `useMutation` | - | `['social', 'posts', postId, 'comments']` + `['social', 'feed']` |

Query key design: hierarchical arrays `['social', 'posts', postId, 'comments']` cho phép invalidate chính xác theo level.

### 3.3 Frontend — Components

#### Component Tree

```
SocialPage (page.tsx)
├── PostComposer
│   ├── Avatar + auto-resize Textarea
│   ├── Code snippet editor (toggle)
│   │   ├── Language Select dropdown
│   │   └── Code Textarea (mono font)
│   ├── Image upload grid
│   │   ├── <input type="file" multiple>
│   │   ├── uploadToCloudinary() per file
│   │   └── Preview grid với remove button
│   └── Action buttons (Add Image, Add Code, Post)
│
├── PostCard[] (infinite scroll via IntersectionObserver)
│   ├── Author row (Avatar, Name link, relative time, delete icon)
│   ├── Content text (whitespace-pre-wrap)
│   ├── CodeBlock (nếu post.codeSnippet)
│   ├── ImageGrid (1 ảnh: full width, 2-4 ảnh: grid 2x2, +N overlay)
│   ├── SharedPostPreview (nếu post.type === SHARED)
│   ├── PostActions
│   │   ├── Like button (Heart, optimistic red fill + count)
│   │   ├── Comment button (MessageCircle + count)
│   │   ├── Share button (Share2 → open ShareDialog)
│   │   └── Bookmark button (Bookmark, optimistic fill, ml-auto)
│   ├── CommentSection
│   │   ├── CommentItem[] (preview 2 hoặc full list)
│   │   │   ├── Avatar + Name + Content (bg-muted bubble)
│   │   │   ├── Time + Reply button + Delete icon
│   │   │   └── CommentItem[] (nested replies, ml-8)
│   │   ├── "Xem tất cả X bình luận" expand button
│   │   └── Comment input (Avatar + input + Send)
│   │       └── Reply indicator (@name + cancel)
│   └── ConfirmDialog (delete post)
│       ShareDialog (share post)
│
└── Sentinel div (h-1, IntersectionObserver target)
```

### 3.4 i18n — Translation keys

**File:** `apps/student-portal/messages/vi.json` (section `social`)

| Key | Vi | Mục đích |
|-----|-----|---------|
| `postPlaceholder` | "Chia sẻ kiến thức của bạn..." | Placeholder post composer |
| `addImage` | "Thêm ảnh" | Button thêm ảnh |
| `addCode` | "Thêm code" | Button thêm code snippet |
| `post` | "Đăng" | Submit button |
| `like` | "Thích" | Like tooltip |
| `comment` | "Bình luận" | Comment tooltip |
| `share` | "Chia sẻ" | Share button |
| `bookmark` | "Lưu" | Bookmark tooltip |
| `viewAllComments` | "Xem tất cả {count} bình luận" | Expand comments (ICU format) |
| `commentPlaceholder` | "Viết bình luận..." | Comment input placeholder |
| `deletePost` | "Xóa bài viết" | Delete confirmation title |
| `deleteComment` | "Xóa bình luận" | Delete confirmation title |
| `confirmDelete` | "Bạn có chắc chắn muốn xóa?" | Delete confirmation body |
| `noFeed` | "Chưa có bài viết..." | Empty feed state |
| `shareDialog` | "Chia sẻ bài viết" | Share dialog title |
| `shareContent` | "Thêm bình luận (không bắt buộc)" | Share dialog placeholder |
| `sharedPost` | "đã chia sẻ bài viết" | Shared post indicator |
| `reply` | "Trả lời" | Reply button |
| `uploading` | "Đang tải lên..." | Upload progress |

---

## 4. Kỹ thuật đặc biệt

### 4.1 Fanout-on-Write

**Vấn đề:** Khi user A tạo bài viết, làm sao để bài viết xuất hiện trong feed của tất cả followers?

**Giải pháp: Fanout-on-Write** (Push model) — Khi tạo post, **ngay lập tức** tạo FeedItem cho tất cả followers.

**File:** `apps/api/src/modules/social/posts/posts.service.ts`

```typescript
private async fanoutToFollowers(authorId: string, postId: string, groupId?: string) {
  // Case 1: Group post → fanout tới tất cả group members
  if (groupId) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    await this.prisma.feedItem.createMany({
      data: members.map((m) => ({ userId: m.userId, postId })),
      skipDuplicates: true,
    });
    return;
  }

  // Case 2: Personal post → fanout tới tất cả followers + chính mình
  const followers = await this.prisma.follow.findMany({
    where: { followingId: authorId },
    select: { followerId: true },
  });
  const feedData = followers.map((f) => ({ userId: f.followerId, postId }));
  feedData.push({ userId: authorId, postId }); // Tự thấy bài của mình

  await this.prisma.feedItem.createMany({
    data: feedData,
    skipDuplicates: true,
  });
}
```

**Ưu điểm:**
- Read (xem feed) cực nhanh — chỉ query `FeedItem` table với index `[userId, createdAt DESC]`
- Không cần join phức tạp khi đọc feed
- `skipDuplicates: true` tránh lỗi khi có trùng lặp

**Nhược điểm (chấp nhận được ở quy mô thesis):**
- Write chậm hơn (tạo nhiều FeedItem rows)
- Celebrity problem: user có nhiều followers → nhiều rows
- Giải pháp production: dùng message queue (Bull) để async fanout

**Database index hỗ trợ:**

```prisma
model FeedItem {
  @@index([userId, createdAt(sort: Desc)])  // Feed query nhanh
  @@index([postId])                          // Join với Post
}
```

### 4.2 Optimistic Updates

**Vấn đề:** Like/Bookmark cần phản hồi ngay khi click, không thể đợi API response (200-500ms delay).

**Giải pháp:** Cập nhật UI state **trước** khi gửi request, rollback nếu lỗi.

**File:** `apps/student-portal/src/components/social/post-actions.tsx`

Pattern sử dụng `useState` local thay vì TanStack Query optimistic update vì:
1. Đơn giản hơn — không cần `onMutate` + `getQueryData` + `setQueryData` + `onSettled`
2. Mỗi PostCard độc lập — state không chia sẻ
3. Khi mutation thành công → `invalidateQueries(['social', 'feed'])` sẽ sync lại data thật

```
User click Like
  → [Immediately] setState(liked=true, count+1)
  → [Async] POST /api/posts/:id/like
    → Success → invalidateQueries → refetch (data thật replace state)
    → Error → setState(liked=false, count-1) [rollback]
```

### 4.3 Batch isLiked/isBookmarked

**Vấn đề:** Feed có N posts. Kiểm tra từng post xem user đã like/bookmark chưa → N*2 queries (N+1 problem).

**Giải pháp:** Batch lookup — 1 query lấy tất cả likes, 1 query lấy tất cả bookmarks, rồi build Set để O(1) lookup.

**File:** `apps/api/src/modules/social/feed/feed.service.ts`

```typescript
// Chỉ 2 queries thay vì 2*N queries
const postIds = items.map((item) => item.post.id);
const [likes, bookmarks] = await Promise.all([
  this.prisma.like.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  }),
  this.prisma.bookmark.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  }),
]);

// Build Set cho O(1) lookup
const likedSet = new Set(likes.map((l) => l.postId));
const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

// Merge vào mỗi post
const posts = items.map((item) => ({
  ...item.post,
  isLiked: likedSet.has(item.post.id),
  isBookmarked: bookmarkedSet.has(item.post.id),
}));
```

Complexity: O(N) thay vì O(N*2). Với feed 10 posts/page → từ 22 queries xuống 4 queries.

### 4.4 Cloudinary Upload (Client-side)

**Vấn đề:** Upload ảnh cho bài viết. Backend không xử lý file, chỉ nhận URL.

**Giải pháp:** Upload trực tiếp từ browser lên Cloudinary, rồi gửi URL cho backend.

**File:** `apps/student-portal/src/lib/cloudinary.ts`

```typescript
export function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video' | 'raw',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  // Dùng XMLHttpRequest để track upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { /* progress callback */ };
    xhr.onload = () => resolve(JSON.parse(xhr.responseText));
    xhr.open('POST', url);
    xhr.send(formData);
  });
}
```

Flow upload trong PostComposer:
1. `<input type="file" accept="image/*" multiple>` — chọn nhiều file
2. `Promise.all(files.map(f => uploadToCloudinary(f, 'image')))` — upload song song
3. Thu thập `secure_url` vào state `images[]`
4. Hiển thị preview grid (có nút X để xóa)
5. Submit → gửi `imageUrls: images.map(img => img.url)` cho API
6. Backend tạo `PostImage` records với URL đã có

### 4.5 Infinite Scroll (IntersectionObserver)

**Vấn đề:** Feed có nhiều bài viết, cần load dần khi scroll.

**Giải pháp:** `useInfiniteQuery` + `IntersectionObserver` native API.

**File:** `apps/student-portal/src/app/[locale]/(main)/social/page.tsx`

```typescript
// 1. TanStack Query useInfiniteQuery quản lý pages
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();

// 2. IntersectionObserver detect khi sentinel div visible
const sentinelRef = useRef<HTMLDivElement>(null);
const handleIntersect = useCallback((entries) => {
  const [entry] = entries;
  if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

useEffect(() => {
  const observer = new IntersectionObserver(handleIntersect, {
    rootMargin: '200px',  // Pre-load 200px trước khi chạm đáy
  });
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [handleIntersect]);

// 3. Flatten pages thành flat array
const posts = pages.flatMap((page) => page.data ?? []);

// 4. Render
<div className="space-y-4">
  {posts.map((post) => <PostCard key={post.id} post={post} />)}
</div>
<div ref={sentinelRef} className="h-1" /> {/* Invisible sentinel */}
```

Hook `useFeed()` config:
- `getNextPageParam`: Trả `page + 1` nếu `page < totalPages`, else `undefined` (dừng)
- `initialPageParam: 1`: Bắt đầu từ page 1
- `limit: 10`: 10 posts mỗi lần load

### 4.6 Nested Comments (Self-Relation)

**Vấn đề:** Comments cần hỗ trợ replies (trả lời comment).

**Giải pháp:** Self-relation trong Prisma + giới hạn 1 cấp nested.

**Schema:**

```prisma
model Comment {
  parentId String? @map("parent_id")
  parent   Comment?  @relation("nested_comments", fields: [parentId], references: [id], onDelete: Cascade)
  replies  Comment[] @relation("nested_comments")
}
```

**Backend query strategy:**
- `getByPost()`: Chỉ lấy top-level (`parentId: null`) + include 3 replies đầu
- `getReplies()`: Lấy tất cả replies của 1 comment (pagination riêng)

**Frontend rendering:**
- `CommentItem` component đệ quy: render comment + `comment.replies?.map(reply => <CommentItem isNested />)`
- `isNested` prop → thêm `ml-8` class (indent sang phải)
- Reply button: nếu đang ở nested level → target `parentId` gốc (không nest sâu hơn 1 cấp)

### 4.7 Denormalized Counters

Post model có 3 counter denormalized:
- `likeCount` — increment/decrement trong `$transaction` cùng Like create/delete
- `commentCount` — increment khi create comment, decrement khi delete
- `shareCount` — increment khi share

Ưu điểm: Hiển thị count không cần `COUNT(*)` query. Feed query chỉ cần read field, không JOIN aggregate.

### 4.8 Shared Post Preview

Khi post có `type = 'SHARED'`, PostCard hiển thị:
1. Author row bình thường + text "(người dùng) đã chia sẻ bài viết"
2. Content của người share (nếu có)
3. `SharedPostPreview` component — Card nhỏ chứa:
   - Avatar + tên tác giả gốc
   - Nội dung gốc (line-clamp-3)
   - Code snippet gốc (nếu có)
   - Ảnh đầu tiên (thumbnail nhỏ)

`ImageGrid` component xử lý responsive:
- 1 ảnh: Full width, max-height 384px
- 2-4 ảnh: Grid 2x2, aspect-square
- 4+ ảnh: Grid 2x2, ảnh thứ 4 có overlay "+N" (remaining count)

---

## 5. Tóm tắt files đã thay đổi

### Backend
| File | Vai trò |
|------|---------|
| `social.module.ts` | Module definition, import NotificationsModule |
| `posts/posts.controller.ts` | HTTP endpoints cho posts, comments, interactions |
| `posts/posts.service.ts` | CRUD posts, share, fanout-on-write |
| `feed/feed.controller.ts` | GET /feed, GET /bookmarks |
| `feed/feed.service.ts` | Feed query + batch isLiked/isBookmarked |
| `interactions/interactions.service.ts` | toggleLike, toggleBookmark, getBookmarks |
| `comments/comments.service.ts` | CRUD comments, nested replies, notification |
| `dto/create-post.dto.ts` | DTO validation cho post creation |
| `dto/create-comment.dto.ts` | DTO validation cho comment creation |

### Shared
| File | Vai trò |
|------|---------|
| `services/social.service.ts` | API call definitions |
| `queries/use-social.ts` | TanStack Query hooks (12 hooks) |

### Frontend
| File | Vai trò |
|------|---------|
| `social/page.tsx` | Social feed page (infinite scroll) |
| `components/social/post-composer.tsx` | Tạo bài viết (text, code, images) |
| `components/social/post-card.tsx` | Hiển thị bài viết + image grid + shared preview |
| `components/social/post-actions.tsx` | Like, comment, share, bookmark buttons |
| `components/social/comment-section.tsx` | Comment list + input + reply |
| `components/social/comment-item.tsx` | Single comment (recursive for replies) |
| `components/social/share-dialog.tsx` | Share post dialog |
| `lib/cloudinary.ts` | Cloudinary upload utility |
| `messages/vi.json` | Vietnamese translations (social section) |
| `messages/en.json` | English translations (social section) |
