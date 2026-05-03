# 04 — Cron Jobs: 9 Scheduled Tasks — Order Expiry, Analytics, Counter Reconciliation

> Giải thích chi tiết CronService — 9 scheduled tasks chạy tự động theo lịch.
> Bao gồm lý thuyết cron expressions, SCAN vs KEYS, analytics snapshot strategy,
> Jaccard similarity cho recommendations, và raw SQL counter reconciliation.

---

## 1. TỔNG QUAN

### 1.1 Cron Expression Syntax

```
┌────────── minute (0–59)
│ ┌──────── hour (0–23)
│ │ ┌────── day of month (1–31)
│ │ │ ┌──── month (1–12)
│ │ │ │ ┌── day of week (0–7, 0=Sun, 7=Sun)
│ │ │ │ │
* * * * *
```

**Ví dụ:**
- `*/1 * * * *` → mỗi 1 phút
- `*/5 * * * *` → mỗi 5 phút
- `0 1 * * *` → 1:00 AM hàng ngày
- `30 2 * * *` → 2:30 AM hàng ngày
- `0 4 * * 0` → 4:00 AM mỗi Chủ nhật

### 1.2 Schedule Overview

```
Timeline (24h):
00:00 ─────── 01:00 ─── 02:00 ── 02:30 ── 03:00 ── 04:00 ─── 05:00 ──→
  │             │        │        │        │        │          │
  │ Every 1min  │        │        │        │        │          │
  │ orderExpiry │        │        │        │        │          │
  │             │        │        │        │        │          │
  │ Every 5min  ▼        ▼        ▼        ▼        ▼          ▼
  │ viewCountSync                                              │
  │           release  cleanup  analytics  tokens  recommend  feedCleanup
  │           earnings uploads  snapshot   cleanup  matrix    counterReconcile
  │                                                (weekly Sun)
```

**Low-traffic window (1AM-5AM):** Heavy jobs chạy khi traffic thấp nhất → không ảnh hưởng user experience.

---

## 2. HIGH-FREQUENCY JOBS (mỗi 1-5 phút)

### 2.1 Job 1: Expire Pending Orders (`*/1 * * * *`)

```typescript
@Cron('*/1 * * * *')
async expirePendingOrders() {
  const result = await this.prisma.order.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
}
```

**Business logic:** Orders có 15 phút để thanh toán (set khi tạo order ở Phase 5.7). Sau 15 phút không có SePay webhook → order expired.

**Tại sao 1 phút?** Order expire time = 15 min. Check mỗi 1 phút → tối đa 1 phút delay. Nếu check 5 phút → order có thể "treo" 5 phút sau khi hết hạn.

**Performance:** `updateMany` là 1 single SQL query, không load records vào memory:
```sql
UPDATE orders SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < NOW()
```

### 2.2 Job 2: Sync View Counts (`*/5 * * * *`)

```typescript
@Cron('*/5 * * * *')
async syncViewCounts() {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await this.redis.scan(
      cursor, 'MATCH', 'course_views:*', 'COUNT', 100,
    );
    cursor = nextCursor;

    for (const key of keys) {
      const courseId = key.replace('course_views:', '');
      const views = parseInt((await this.redis.getdel(key)) || '0', 10);
      if (views > 0) {
        await this.prisma.course.update({
          where: { id: courseId },
          data: { viewCount: { increment: views } },
        });
      }
    }
  } while (cursor !== '0');
}
```

**Architecture:**
```
User views course → Redis INCR course_views:{courseId} (1ms) ← Realtime, no DB write
                                    │
Every 5 min cron                    │
  └── SCAN course_views:*           │
      └── For each key:             ▼
          ├── GETDEL (atomic get + delete)
          └── UPDATE course SET viewCount += N
```

**Tại sao buffer trong Redis?**
- 1000 users view course cùng lúc → 1000 DB writes → database bottleneck
- Buffer trong Redis → 1 DB write mỗi 5 phút (aggregate)
- Redis INCR = O(1), atomic, concurrent-safe

### 2.3 SCAN vs KEYS — Production Safety

```
❌ KEYS course_views:*
  → Scans TOÀN BỘ keyspace trong 1 call
  → O(N) where N = total keys in Redis
  → BLOCKS Redis server trong suốt quá trình scan
  → Upstash free tier: 10K commands → 1 KEYS = 1 command nhưng block tất cả

✅ SCAN cursor MATCH course_views:* COUNT 100
  → Scan incremental, trả về 1 batch (~100 keys)
  → Non-blocking, Redis vẫn serve requests khác
  → Cursor-based iteration: cursor = '0' → scan → cursor = 'xxx' → scan → cursor = '0' (done)
  → Nhiều commands hơn nhưng an toàn cho production
```

**`GETDEL`** — atomic get + delete trong 1 command. Tránh race condition:
```
❌ GET → process → DEL
   GET returns 5 → user views in between → actual = 7 → DEL → lost 2 views

✅ GETDEL → returns 5 AND deletes key atomically → new views go to new key
```

---

## 3. DAILY JOBS (1AM-3AM)

### 3.1 Job 3: Release Available Earnings (`0 1 * * *`)

```typescript
@Cron('0 1 * * *')
async releaseAvailableEarnings() {
  const result = await this.prisma.earning.updateMany({
    where: { status: 'PENDING', availableAt: { lte: new Date() } },
    data: { status: 'AVAILABLE' },
  });
}
```

**Business logic:** Earnings có 7-day hold period (refund window). Khi tạo earning trong SePay webhook (Phase 5.7):
```typescript
availableAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
```

Sau 7 ngày, cron job chuyển `PENDING → AVAILABLE` → instructor có thể rút tiền.

**Tại sao dùng `availableAt` thay vì `createdAt + 7 days`?**
```
❌ createdAt + 7 days:
   → WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '7 days'
   → Nếu muốn thay đổi hold period (5 days → 7 days) → ảnh hưởng earnings cũ

✅ availableAt field:
   → WHERE status = 'PENDING' AND available_at <= NOW()
   → Hold period set tại thời điểm tạo → không retroactive
   → Có thể custom per-earning (VIP instructor = 3 days, new = 14 days)
```

### 3.2 Job 4: Cleanup Failed Uploads (`0 2 * * *`)

```typescript
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
await this.prisma.media.updateMany({
  where: { status: 'UPLOADING', createdAt: { lt: cutoff } },
  data: { status: 'FAILED' },
});
```

Media records created with `status: 'UPLOADING'` khi client bắt đầu upload. Nếu upload fail (network error, browser close) → record "treo" ở UPLOADING mãi. Cron cleanup sau 24h.

### 3.3 Job 5: Analytics Snapshot (`30 2 * * *`)

```typescript
// Compute for YESTERDAY (not today)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);
const endOfDay = new Date(yesterday);
endOfDay.setHours(23, 59, 59, 999);
```

**Tại sao YESTERDAY?**
```
❌ Today (2AM):
   → DAILY_USERS = users created from 00:00 to 02:00 → INCOMPLETE (cả ngày là 00:00-23:59)
   → Run lại lúc 23:59 → overwrite with complete data? Phức tạp.

✅ Yesterday:
   → DAILY_USERS = users created from 00:00 to 23:59 yesterday → COMPLETE
   → Run 1 lần, data chính xác, không cần re-run
```

**4 Analytics Types** (matching `AnalyticsType` enum):
```typescript
[
  { type: 'DAILY_USERS', data: { count: users } },
  { type: 'DAILY_REVENUE', data: { amount: revenue._sum.finalAmount || 0 } },
  { type: 'DAILY_ENROLLMENTS', data: { count: enrollments } },
  { type: 'DAILY_COURSES', data: { count: courses } },
]
```

**`upsert` pattern:** Nếu cron chạy lại (manual trigger, server restart) → update existing snapshot thay vì duplicate.

### 3.4 Job 6: Cleanup Expired Tokens (`0 3 * * *`)

```typescript
await this.prisma.refreshToken.deleteMany({
  where: { expiresAt: { lt: new Date() } },
});
```

Refresh tokens expire sau 7 ngày (Phase 5.4). Expired tokens không cần giữ → delete để giảm table size.

---

## 4. NIGHTLY COMPUTATION (`0 4 * * *`)

### 4.1 Job 7: Recommendation Matrix

```typescript
for (let i = 0; i < courses.length; i++) {
  for (let j = i + 1; j < courses.length; j++) {
    const tagsA = new Set(courses[i].courseTags.map(t => t.tagId));
    const tagsB = new Set(courses[j].courseTags.map(t => t.tagId));

    // Jaccard Similarity
    const intersection = [...tagsA].filter(t => tagsB.has(t)).length;
    const union = new Set([...tagsA, ...tagsB]).size;
    const score = union > 0 ? intersection / union : 0;
  }
}
```

**Jaccard Similarity Formula:**

```
J(A, B) = |A ∩ B| / |A ∪ B|

Ví dụ:
  Course A tags: {React, TypeScript, Next.js}
  Course B tags: {React, TypeScript, Vue}
  Course C tags: {Python, Django, PostgreSQL}

  J(A, B) = |{React, TypeScript}| / |{React, TypeScript, Next.js, Vue}|
           = 2/4 = 0.5   ← Khá tương đồng

  J(A, C) = |{}| / |{React, TypeScript, Next.js, Python, Django, PostgreSQL}|
           = 0/6 = 0     ← Không liên quan
```

**Complexity:** O(n²) where n = number of published courses. Với 100 courses = 4,950 pairs. 1000 courses = 499,500 pairs. Chạy nightly khi traffic thấp.

**`courseSimilarity.upsert`** — chỉ lưu pairs có score > 0. Unique constraint `[courseId, similarCourseId, algorithm]` ngăn duplicate.

---

## 5. WEEKLY JOBS (Chủ nhật 4-5AM)

### 5.1 Job 8: Cleanup Old Feed Items (`0 4 * * 0`)

```sql
DELETE FROM feed_items
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id ORDER BY created_at DESC
    ) as rn FROM feed_items
  ) ranked WHERE rn > 1000
)
```

**Window function `ROW_NUMBER()`:**
- `PARTITION BY user_id` → group by user
- `ORDER BY created_at DESC` → newest first
- `rn > 1000` → delete everything after 1000th item

**Ví dụ:** User có 1500 feed items → giữ 1000 mới nhất, xóa 500 cũ nhất.

**Tại sao raw SQL?** Prisma không support window functions. `$executeRaw` cho phép viết SQL trực tiếp. Database thực hiện operation hiệu quả hơn application-level logic (không load records vào memory).

### 5.2 Job 9: Reconcile Counters (`0 5 * * 0`)

```sql
-- Posts: recalculate likeCount + commentCount
UPDATE posts SET
  like_count = (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id),
  comment_count = (SELECT COUNT(*) FROM comments
                   WHERE comments.post_id = posts.id
                   AND comments.deleted_at IS NULL)
WHERE deleted_at IS NULL;

-- Users: recalculate followerCount + followingCount
UPDATE users SET
  follower_count = (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id),
  following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id)
WHERE deleted_at IS NULL;

-- Tags: recalculate courseCount
UPDATE tags SET
  course_count = (SELECT COUNT(*) FROM course_tags WHERE course_tags.tag_id = tags.id);
```

**Tại sao cần reconcile?**

SSLM dùng **denormalized counters** — `post.likeCount` lưu trực tiếp thay vì `COUNT(*)` mỗi lần query. Pattern:

```
User likes post → post.likeCount += 1 (increment)
User unlikes    → post.likeCount -= 1 (decrement)
```

**Vấn đề:** Counter drift over time:
```
Race condition:     2 users like simultaneously → 1 increment lost
Bug in code:        unlike logic forgot to decrement
Data migration:     import data without updating counters
Manual DB edit:     admin deletes likes directly in DB
```

**Solution:** Weekly reconciliation recounts from source-of-truth (actual records) → fixes any drift.

**Tại sao raw SQL thay vì application-level?**

```
❌ Application level:
  const posts = await prisma.post.findMany();  // Load ALL posts into memory
  for (const post of posts) {                  // N queries for likes
    const likes = await prisma.like.count();    // N queries for comments
    const comments = await prisma.comment.count();
    await prisma.post.update();                // N update queries
  }
  // 1000 posts = 4000 queries + memory for 1000 objects

✅ Raw SQL:
  UPDATE posts SET
    like_count = (SELECT COUNT(*) FROM likes WHERE ...)
  // 1 query, database does everything server-side
  // No data transfer to application, no memory usage
```

---

## 6. FILES CREATED

| File | Lines | Mục đích |
|------|-------|----------|
| `cron/cron.service.ts` | 200 | 9 cron jobs |
| `cron/cron.service.spec.ts` | 130 | 9 unit tests |
