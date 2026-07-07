# 02 — Comments & Interactions: Nested Replies, Toggle Pattern, và Counter Management

> Giải thích CommentsService (nested comments, parent validation, counter sync)
> và InteractionsService (like/bookmark toggle, denormalized counters).

---

## 1. COMMENTS SERVICE

### 1.1 Nested Comments Architecture

```
Comment tree structure:
  Post
  ├── Comment A (parentId: null)     ← top-level
  │   ├── Reply A1 (parentId: A)     ← reply
  │   ├── Reply A2 (parentId: A)
  │   └── Reply A3 (parentId: A)
  ├── Comment B (parentId: null)
  │   └── Reply B1 (parentId: B)
  └── Comment C (parentId: null)
```

**SSLM chọn 2-level nesting** (top-level + replies):
- Không cho reply-to-reply (parentId chỉ reference top-level comments)
- UI đơn giản: hiển thị top-level comments + "View replies" expandable
- Tương tự Facebook/Instagram (không phải Reddit-style deep threading)

### 1.2 Prisma Self-relation

```prisma
model Comment {
  parentId String? @map("parent_id")
  parent   Comment?  @relation("nested_comments", fields: [parentId], references: [id], onDelete: Cascade)
  replies  Comment[] @relation("nested_comments")
}
```

**`onDelete: Cascade`** — xóa parent comment → tự động xóa tất cả replies.

### 1.3 Parent Validation

```typescript
if (dto.parentId) {
  const parent = await this.prisma.comment.findUnique({
    where: { id: dto.parentId },
  });
  // Parent phải TỒN TẠI và CÙNG POST
  if (!parent || parent.postId !== postId) {
    throw new BadRequestException({ code: 'INVALID_PARENT_COMMENT' });
  }
}
```

**Tại sao check `parent.postId !== postId`?**
- Prevent cross-post replies: comment trên post A reply vào comment trên post B
- Nếu không check → data integrity violation
- Prisma không enforce cross-table relationship constraints

### 1.4 Get Comments — Inlined Replies Pattern

```typescript
async getByPost(postId: string, query: PaginationDto) {
  const comments = await this.prisma.comment.findMany({
    where: { postId, parentId: null },  // Chỉ top-level
    include: {
      author: { select: AUTHOR_SELECT },
      replies: {
        take: 3,  // Chỉ lấy 3 replies đầu
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { replies: true } },  // Tổng số replies
    },
  });
}
```

**Frontend UI flow:**
1. Load top-level comments (paginated)
2. Mỗi comment hiển thị 3 replies đầu (inlined)
3. `_count.replies > 3` → hiển thị "View X more replies"
4. Click → call `getReplies(commentId, pagination)` để load thêm

### 1.5 Counter Sync — Comment Create/Delete

```typescript
// CREATE: increment
await tx.post.update({
  where: { id: postId },
  data: { commentCount: { increment: 1 } },
});

// DELETE: decrement
await tx.post.update({
  where: { id: postId },
  data: { commentCount: { decrement: 1 } },
});
```

**Transaction đảm bảo atomicity:**
- Comment record + counter update trong cùng transaction
- Nếu create thành công nhưng counter fail → rollback cả 2

---

## 2. INTERACTIONS SERVICE

### 2.1 Toggle Pattern

```
Toggle = check existing → if yes: delete, if no: create

toggleLike(userId, postId):
  1. Verify post exists + not deleted
  2. Find existing like: Like.findUnique({ userId_postId })
  3a. If exists → delete like + decrement likeCount
  3b. If not → create like + increment likeCount
  4. Return { liked: boolean, likeCount: number }
```

### 2.2 Implementation — Like Toggle

```typescript
async toggleLike(userId: string, postId: string) {
  const post = await this.prisma.post.findUnique({
    where: { id: postId, deletedAt: null },
  });
  if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

  const existing = await this.prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await this.prisma.$transaction([
      this.prisma.like.delete({ where: { id: existing.id } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    return { liked: false, likeCount: post.likeCount - 1 };
  }

  await this.prisma.$transaction([
    this.prisma.like.create({ data: { userId, postId } }),
    this.prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    }),
  ]);
  return { liked: true, likeCount: post.likeCount + 1 };
}
```

**Tại sao `$transaction([...])` (array pattern) thay vì `$transaction(async (tx) => ...)`?**
- Array pattern: Prisma gom tất cả operations vào 1 database transaction
- Interactive pattern: cần sequential logic bên trong
- Ở đây 2 operations independent → array pattern đủ và gọn hơn

### 2.3 Denormalized Counters

```prisma
model Post {
  likeCount    Int @default(0)    // Denormalized
  commentCount Int @default(0)    // Denormalized
  shareCount   Int @default(0)    // Denormalized
}
```

**Trade-off: Denormalization vs COUNT query**

```
Option A — COUNT query mỗi request:
  SELECT COUNT(*) FROM likes WHERE post_id = ?
  Pro: Luôn chính xác
  Con: Chậm khi post có nhiều likes

Option B — Denormalized counter (SSLM chọn):
  Post.likeCount = 42  (stored in post row)
  Pro: Read O(1), không cần JOIN
  Con: Phải sync manually (increment/decrement trong transaction)
```

**SSLM chọn denormalization vì:**
- Feed hiển thị 20 posts → 20 COUNT queries vs 0 extra queries
- Counter sync đảm bảo bằng transaction
- Social platforms (FB, Twitter) đều dùng denormalized counters

### 2.4 Bookmark Toggle — Simpler (No Counter)

```typescript
async toggleBookmark(userId: string, postId: string) {
  // ...verify post...

  if (existing) {
    await this.prisma.bookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };  // No counter
  }

  await this.prisma.bookmark.create({ data: { userId, postId } });
  return { bookmarked: true };
}
```

**Tại sao bookmark không cần counter?**
- `likeCount` hiển thị public (social proof: "42 people liked this")
- `bookmarkCount` là private — không ai cần biết bao nhiêu người bookmark
- Twitter đã bỏ hiển thị bookmark count vì UX research

### 2.5 Get Bookmarks — Unwrap Pattern

```typescript
async getBookmarks(userId: string, query: PaginationDto) {
  const bookmarks = await this.prisma.bookmark.findMany({
    where: { userId },
    include: { post: { include: { author: { select: AUTHOR_SELECT } } } },
  });

  return createPaginatedResult(
    bookmarks.map((b) => b.post),  // Unwrap: Bookmark[] → Post[]
    total,
    query.page,
    query.limit,
  );
}
```

**Frontend expects Post[], not Bookmark[]:**
- Bookmark là join table (userId + postId)
- Frontend cần hiển thị posts, không cần bookmark metadata
- `.map((b) => b.post)` unwrap relation → return flat Post array

---

## 3. COMPOSITE UNIQUE KEYS

### Prisma unique constraints

```prisma
model Like {
  @@unique([userId, postId])    // 1 user = 1 like per post
}

model Bookmark {
  @@unique([userId, postId])    // 1 user = 1 bookmark per post
}
```

### Prisma compound unique query

```typescript
// userId_postId = auto-generated compound unique name
this.prisma.like.findUnique({
  where: { userId_postId: { userId, postId } },
});
```

**Naming convention:**
- `@@unique([fieldA, fieldB])` → query key = `fieldA_fieldB`
- `@@unique([conversationId, userId])` → `conversationId_userId`
- Prisma generates this automatically from field names
