# 05 — Testing: Social & Chat Unit Tests

> Giải thích testing patterns cho Phase 5.9 — mock setup, test organization,
> và cách test transaction-based services, toggle patterns, và enrichment logic.

---

## 1. TỔNG QUAN

### 1.1 Test files — 6 suites, 45 tests

```
src/modules/social/
├── posts/posts.service.spec.ts              14 tests
├── comments/comments.service.spec.ts         7 tests
├── interactions/interactions.service.spec.ts  7 tests
├── feed/feed.service.spec.ts                 4 tests
├── groups/groups.service.spec.ts            12 tests
src/modules/chat/
├── chat.service.spec.ts                     11 tests

Project total: 513 tests (was 468, +45 new)
```

---

## 2. MOCK PATTERN — `const mockPrisma`

### 2.1 Vấn đề: `noUncheckedIndexedAccess`

```typescript
// ❌ Gây TS error — value có thể undefined
let prisma: { [key: string]: { [key: string]: jest.Mock } };
prisma.post.findUnique  // TS: possibly undefined!
```

TypeScript strict mode + `noUncheckedIndexedAccess` → index signature returns `T | undefined`.

### 2.2 Giải pháp: `const` at module scope

```typescript
// ✅ TS biết exact shape — không có undefined
const mockPrisma = {
  post: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  like: { findUnique: jest.fn() },
  // ...
  $transaction: jest.fn(),
};
```

**Tại sao `const` ngoài `describe`?**
- TypeScript infer exact type: `{ post: { create: jest.Mock; findUnique: jest.Mock; ... } }`
- Mỗi property có exact type, không phải `T | undefined`
- `jest.clearAllMocks()` reset mock state nhưng giữ nguyên mock functions

**So sánh 2 approaches trong SSLM:**

```
Phase 5.5 (users.service.spec.ts):
  const mockPrisma = { ... }   ← ✅ module scope const

Phase 5.9 (initial attempt):
  let prisma: Record<...>     ← ❌ TS errors

Phase 5.9 (fixed):
  const mockPrisma = { ... }   ← ✅ same pattern as 5.5
```

---

## 3. TESTING TRANSACTIONS

### 3.1 Array transaction: `$transaction([...])`

```typescript
// Service code:
await this.prisma.$transaction([
  this.prisma.like.create({ data: { userId, postId } }),
  this.prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
]);

// Test mock:
mockPrisma.$transaction.mockResolvedValue([]);
```

**Array transaction trong test:**
- Prisma creates PrismaPromises cho mỗi operation
- `$transaction` nhận array of PrismaPromises
- Mock chỉ cần resolve — individual operations đã tạo promises nhưng $transaction controls execution
- **Quan trọng:** Các individual mock methods (like.create, post.update) vẫn được CALLED để tạo promises

**Bug caught:** InteractionsService test ban đầu thiếu `post.update` trong mockPrisma → `TypeError: this.prisma.post.update is not a function` vì Prisma gọi `.update()` để tạo PrismaPromise trước khi pass vào $transaction.

### 3.2 Interactive transaction: `$transaction(async (tx) => ...)`

```typescript
// Service code:
return this.prisma.$transaction(async (tx) => {
  const comment = await tx.comment.create({ ... });
  await tx.post.update({ ... });
  return comment;
});

// Test mock:
mockPrisma.$transaction.mockImplementation(
  async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
);
```

**Pass `mockPrisma` as transaction client:**
- Callback receives `tx` (transaction client) — same interface as PrismaService
- In test, pass the same mock → callback calls mock methods
- `typeof mockPrisma` ensures type safety

---

## 4. TESTING TOGGLE PATTERN

```typescript
describe('toggleLike', () => {
  it('should create like and return likeCount + 1', async () => {
    // Mock: post exists with likeCount=5, no existing like
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', likeCount: 5 });
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await service.toggleLike('user-1', 'post-1');
    expect(result).toEqual({ liked: true, likeCount: 6 });
  });

  it('should remove like and return likeCount - 1', async () => {
    // Mock: post exists with likeCount=5, HAS existing like
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', likeCount: 5 });
    mockPrisma.like.findUnique.mockResolvedValue({ id: 'like-1' });
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await service.toggleLike('user-1', 'post-1');
    expect(result).toEqual({ liked: false, likeCount: 4 });
  });
});
```

**Toggle test strategy:** Test both states (exists → remove, not exists → create).

---

## 5. TESTING ENRICHMENT

```typescript
it('should return feed with isLiked/isBookmarked enrichment', async () => {
  // Mock feed items
  mockPrisma.feedItem.findMany.mockResolvedValue([
    { post: { id: 'post-1' } },
    { post: { id: 'post-2' } },
  ]);
  mockPrisma.feedItem.count.mockResolvedValue(2);

  // Mock batch lookups
  mockPrisma.like.findMany.mockResolvedValue([{ postId: 'post-1' }]);
  mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-2' }]);

  const result = await service.getFeed('user-1', { page: 1, limit: 20, skip: 0 });

  // Verify enrichment
  expect(result.data[0]).toMatchObject({
    id: 'post-1',
    isLiked: true,      // post-1 in likes
    isBookmarked: false, // post-1 NOT in bookmarks
  });
  expect(result.data[1]).toMatchObject({
    id: 'post-2',
    isLiked: false,      // post-2 NOT in likes
    isBookmarked: true,  // post-2 in bookmarks
  });
});
```

**Key: Mock the batch queries to return specific postIds, then verify the Set lookup produces correct booleans.**

---

## 6. TESTING ROLE-BASED ACCESS

### Groups — mockResolvedValueOnce chain

```typescript
it('should kick a member', async () => {
  mockPrisma.groupMember.findUnique
    .mockResolvedValueOnce({ id: 'admin', role: 'ADMIN' })  // 1st call: verifyGroupRole
    .mockResolvedValueOnce({ id: 'target', role: 'MEMBER' }); // 2nd call: find target
  mockPrisma.$transaction.mockResolvedValue([]);

  await service.kickMember('g1', 'admin-user', 'target-user');
  expect(mockPrisma.$transaction).toHaveBeenCalled();
});

it('should prevent kicking owner', async () => {
  mockPrisma.groupMember.findUnique
    .mockResolvedValueOnce({ id: 'admin', role: 'ADMIN' })
    .mockResolvedValueOnce({ id: 'target', role: 'OWNER' }); // Target is OWNER!

  await expect(
    service.kickMember('g1', 'admin-user', 'owner-user'),
  ).rejects.toThrow(ForbiddenException);
});
```

**`mockResolvedValueOnce` chaining:**
- Same mock function called multiple times in one method
- Each call returns next value in chain
- After chain exhausted → returns `undefined` (or default mock return)

---

## 7. TESTING CHAT — RedisService Mock

```typescript
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

// In module setup:
{ provide: RedisService, useValue: mockRedis }
```

**RedisService extends Redis (ioredis):**
- Only mock methods actually used by ChatService
- `get` — check online status
- `setex` — not called directly by ChatService (gateway only)
- `del` — not called directly by ChatService (gateway only)
- Mock all 3 for completeness

---

## 8. BÀI HỌC TỪ PHASE 5.9

### 8.1 Mock phải match service usage chính xác

**Bug:** InteractionsService dùng `this.prisma.post.update()` bên trong `$transaction([...])` array — array pattern gọi method để tạo PrismaPromise TRƯỚC khi pass vào $transaction. Mock thiếu `post.update` → TypeError.

**Fix:** Đảm bảo mockPrisma có TẤT CẢ methods mà service gọi, kể cả bên trong $transaction arrays.

### 8.2 const vs let cho mock objects

- `const mockPrisma = {...}` → TypeScript knows exact shape → no undefined issues
- `let prisma: Record<string, Record<string, jest.Mock>>` → TS returns `T | undefined` → compile errors
- Always use `const` at module scope for mock objects
