# 01 — Posts Service & Feed: Fanout-on-Write và Social Content

> Giải thích chi tiết PostsService, FeedService — tạo/sửa/xóa posts, fanout-on-write pattern,
> feed enrichment với batch Set lookup, và AUTHOR_SELECT constant.

---

## 1. TỔNG QUAN

### 1.1 Files đã tạo

```
src/modules/social/
├── posts/
│   ├── posts.service.ts          # CRUD + fanout logic
│   ├── posts.controller.ts       # 10 endpoints
│   └── posts.service.spec.ts     # 14 tests
├── feed/
│   ├── feed.service.ts           # Feed read + enrichment
│   ├── feed.controller.ts        # 2 endpoints (feed + bookmarks)
│   └── feed.service.spec.ts      # 4 tests
└── dto/
    ├── create-post.dto.ts        # Content, type, images, codeSnippet
    └── update-post.dto.ts        # Partial update
```

### 1.2 PostsService — 5 public methods

```
PostsService:
  ├── create(authorId, dto)              → Tạo post + fanout
  ├── findById(postId, currentUserId?)   → Detail + isLiked/isBookmarked
  ├── update(postId, userId, dto)        → Owner-only update
  ├── delete(postId, userId)             → Soft delete (deletedAt)
  └── share(userId, postId, content?)    → Share post + increment shareCount

Private:
  └── fanoutToFollowers(authorId, postId, groupId?)
```

---

## 2. AUTHOR_SELECT PATTERN

### 2.1 Vấn đề: Query user info lặp lại khắp nơi

```typescript
// Mỗi query cần include author info → lặp code
include: {
  author: { select: { id: true, fullName: true, avatarUrl: true } }
}
```

### 2.2 Giải pháp: Constant reusable

```typescript
// posts.service.ts — export cho các service khác dùng
const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

export { AUTHOR_SELECT };
```

**Tại sao `as const`?**
- TypeScript infer type là `{ id: true; fullName: true; avatarUrl: true }` (literal types)
- Thay vì `{ id: boolean; fullName: boolean; avatarUrl: boolean }` (widened types)
- Prisma cần literal `true` types để type-safe select

**Ai dùng AUTHOR_SELECT?**
- `CommentsService` — import từ `../posts/posts.service`
- `InteractionsService` — bookmark queries
- `FeedService` — feed post queries
- `GroupsService` — group posts, member queries
- `ChatService` — define riêng (module khác)

---

## 3. FANOUT-ON-WRITE PATTERN

### 3.1 Lý thuyết: Feed Architecture

Có 2 cách thiết kế news feed:

```
Fanout-on-Write (Push model):
  Khi user tạo post → WRITE feed_items cho TẤT CẢ followers
  Ưu: Read feed cực nhanh (chỉ SELECT từ feed_items)
  Nhược: Write nhiều (1000 followers = 1000 INSERT)

Fanout-on-Read (Pull model):
  Khi user đọc feed → QUERY posts từ tất cả người mình follow
  Ưu: Write ít
  Nhược: Read chậm (JOIN nhiều bảng)
```

**SSLM chọn Fanout-on-Write** vì:
- Graduation project → user base nhỏ (~100-1000 followers max)
- Read feed >> Write post (đọc nhiều hơn viết)
- Đơn giản implement, không cần queue phức tạp

### 3.2 Implementation

```typescript
private async fanoutToFollowers(
  authorId: string,
  postId: string,
  groupId?: string,
) {
  if (groupId) {
    // GROUP POST → chỉ fanout cho group members
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    // ...
    return;
  }

  // PUBLIC POST → fanout cho followers + author
  const followers = await this.prisma.follow.findMany({
    where: { followingId: authorId },
    select: { followerId: true },
  });

  const feedData = followers.map((f) => ({
    userId: f.followerId,
    postId,
  }));
  feedData.push({ userId: authorId, postId }); // Author sees own post

  await this.prisma.feedItem.createMany({
    data: feedData,
    skipDuplicates: true, // Prevent crash on race conditions
  });
}
```

**Key decisions:**
1. **`skipDuplicates: true`** — nếu user follow rồi unfollow rồi follow lại trong lúc fanout → không crash
2. **Author's own feed** — `feedData.push({ userId: authorId })` để author thấy post mình trong feed
3. **Group vs Public** — group posts chỉ fanout cho members, không cho followers

### 3.3 Database: FeedItem model

```prisma
model FeedItem {
  id     String @id @default(cuid())
  userId String @map("user_id")
  postId String @map("post_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt(sort: Desc)])  // Query feed sorted by time
  @@index([postId])                         // Cleanup khi delete post
}
```

---

## 4. FEED ENRICHMENT — Batch Set Lookup

### 4.1 Vấn đề: N+1 queries cho isLiked/isBookmarked

```typescript
// ❌ N+1 — 2 queries per post!
for (const post of posts) {
  post.isLiked = await prisma.like.findUnique({...});     // N queries
  post.isBookmarked = await prisma.bookmark.findUnique({...}); // N queries
}
// 20 posts = 40 extra queries 😱
```

### 4.2 Giải pháp: Batch query + Set lookup

```typescript
// ✅ Chỉ 2 queries total (không phụ thuộc số posts)
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

const likedSet = new Set(likes.map((l) => l.postId));       // O(N) build
const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

const posts = items.map((item) => ({
  ...item.post,
  isLiked: likedSet.has(item.post.id),       // O(1) lookup
  isBookmarked: bookmarkedSet.has(item.post.id),
}));
```

**Performance:**
- 2 queries + 2 Set builds + N lookups = O(N) total
- Thay vì 2N queries = O(N) queries nhưng mỗi query có network latency

**Pattern này lặp lại trong SSLM:**
- Phase 5.5: `enrichWithFollowStatus` — isFollowing per user
- Phase 5.9: Feed enrichment — isLiked/isBookmarked per post

---

## 5. POST DETAIL — Enrichment cho Single Post

```typescript
async findById(postId: string, currentUserId?: string) {
  const post = await this.prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
    include: {
      author: { select: AUTHOR_SELECT },
      images: { orderBy: { order: 'asc' } },
      sharedPost: {
        include: { author: { select: AUTHOR_SELECT } },
      },
    },
  });

  if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

  // Single post → 2 parallel queries (không cần Set)
  let isLiked = false;
  let isBookmarked = false;

  if (currentUserId) {
    const [like, bookmark] = await Promise.all([
      this.prisma.like.findUnique({
        where: { userId_postId: { userId: currentUserId, postId } },
      }),
      this.prisma.bookmark.findUnique({
        where: { userId_postId: { userId: currentUserId, postId } },
      }),
    ]);
    isLiked = !!like;
    isBookmarked = !!bookmark;
  }

  return { ...post, isLiked, isBookmarked };
}
```

**Key points:**
- `currentUserId` optional → public endpoint, nhưng nếu có auth → enrich
- `Promise.all` — 2 queries song song thay vì tuần tự
- `deletedAt: null` in where → filter soft-deleted posts at query level

---

## 6. SOFT DELETE vs HARD DELETE

### Post dùng Soft Delete

```typescript
async delete(postId: string, userId: string) {
  // ...ownership check...
  return this.prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },  // Soft delete
  });
}
```

**Tại sao soft delete cho Post?**
- Post có thể đã được share → shared posts reference original qua `sharedPostId`
- Hard delete sẽ cascade xóa FeedItems, Likes, Comments → mất data
- Admin có thể cần review reported posts
- Recovery possible nếu user xóa nhầm

**Hard delete dùng cho:**
- Like, Bookmark — toggle off = xóa thật (không cần recovery)
- GroupMember — leave/kick = xóa thật

---

## 7. JSON FIELD — CodeSnippet

### Prisma schema

```prisma
model Post {
  codeSnippet Json? @map("code_snippet")
}
```

### DTO với nested validation

```typescript
export class CodeSnippetDto {
  @IsString()
  language!: string;

  @IsString()
  @MaxLength(5000)
  code!: string;
}

export class CreatePostDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;
}
```

### Casting khi lưu

```typescript
codeSnippet: dto.codeSnippet
  ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
  : undefined,
```

**Tại sao cast `as unknown as Prisma.InputJsonValue`?**
- TypeScript thấy `CodeSnippetDto` và `Prisma.InputJsonValue` là khác type
- `CodeSnippetDto` có `language: string; code: string`
- `InputJsonValue` expect `string | number | boolean | object | array | null`
- Need double cast: DTO → unknown → InputJsonValue

---

## 8. CONTROLLER — PostsController

### Route table

```
@Controller('posts')

POST   /api/posts                    → create(user, dto)
GET    /api/posts/:id                → findById(id, user?)     @Public()
PUT    /api/posts/:id                → update(id, user, dto)
DELETE /api/posts/:id                → delete(id, user)
POST   /api/posts/:id/share          → share(id, user, content)
POST   /api/posts/:id/like           → toggleLike(user, id)
POST   /api/posts/:id/bookmark       → toggleBookmark(user, id)
GET    /api/posts/:id/comments       → getComments(id, query)  @Public()
POST   /api/posts/:id/comments       → addComment(id, user, dto)
DELETE /api/posts/:postId/comments/:commentId → deleteComment(...)
```

### Multi-service injection

```typescript
export class PostsController {
  constructor(
    @Inject(PostsService) private readonly postsService: PostsService,
    @Inject(CommentsService) private readonly commentsService: CommentsService,
    @Inject(InteractionsService) private readonly interactionsService: InteractionsService,
  ) {}
}
```

**Tại sao 3 services trong 1 controller?**
- Tất cả routes đều nested under `/api/posts/:id/...`
- Like, bookmark, comments đều thuộc context của post
- Tách controller riêng cho like/bookmark sẽ tạo routes không tự nhiên

---

## 9. FEED CONTROLLER

```typescript
@Controller()  // No prefix — routes are at root level
export class FeedController {
  @Get('feed')       // GET /api/feed
  @Get('bookmarks')  // GET /api/bookmarks
}
```

**Tại sao `@Controller()` không có prefix?**
- `feed` và `bookmarks` là top-level routes, không nằm under `/posts`
- Nếu dùng `@Controller('feed')` thì bookmarks phải ở controller khác
- Gom vào 1 controller vì cả 2 đều là "personalized content lists"
