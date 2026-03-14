# 02 — Redis Module: Caching, Rate Limiting & ioredis

> Giải thích Redis là gì, tại sao cần cache, cách SSLM dùng ioredis,
> và pattern extends class trong RedisService.

---

## 1. REDIS LÀ GÌ?

### 1.1 Tổng quan

**Redis** (Remote Dictionary Server) là **in-memory data store** — lưu trữ dữ liệu trong RAM thay vì ổ cứng.

```
Traditional Database (PostgreSQL):
  Data → Hard Disk (SSD/HDD)
  Read speed: ~1-10ms
  Persistent: ✅ Data còn sau restart

Redis (In-Memory Store):
  Data → RAM
  Read speed: ~0.01-0.1ms (100x nhanh hơn)
  Persistent: ⚠️ Mất khi restart (trừ khi enable persistence)
```

### 1.2 Redis dùng làm gì trong SSLM?

```
┌─────────────────────────────────────────────────┐
│              REDIS USE CASES IN SSLM             │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. CACHING                                      │
│     Cache kết quả query DB để giảm tải           │
│     Ví dụ: Course list, category list            │
│     TTL: 1 phút → 1 giờ tùy loại data           │
│                                                  │
│  2. RATE LIMITING                                │
│     Giới hạn số requests trong khoảng thời gian  │
│     Ví dụ: Login max 5 lần/phút                 │
│                                                  │
│  3. SESSION / TOKEN STORE                        │
│     Lưu OTT (One-Time Token) cho cross-portal    │
│     TTL: 60 giây                                 │
│                                                  │
│  4. JOB QUEUE (BullMQ)                           │
│     BullMQ dùng Redis làm message broker          │
│     Ví dụ: Send email, process video              │
│                                                  │
│  5. REAL-TIME (Socket.IO Adapter)                │
│     Khi scale nhiều server → Redis pub/sub        │
│     Đồng bộ events giữa các instances            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 1.3 Redis Data Structures

Redis không chỉ là key-value store — nó hỗ trợ nhiều data structures:

| Structure      | Command                 | Use Case                   |
| -------------- | ----------------------- | -------------------------- |
| **String**     | `SET key value`         | Cache JSON, tokens         |
| **Hash**       | `HSET key field value`  | User sessions              |
| **List**       | `LPUSH key value`       | Message queues             |
| **Set**        | `SADD key member`       | Unique tags, online users  |
| **Sorted Set** | `ZADD key score member` | Leaderboard, rankings      |
| **Counter**    | `INCR key`              | Rate limiting, view counts |

SSLM chủ yếu dùng **String** (cache) và **Counter** (rate limiting).

---

## 2. ioredis — REDIS CLIENT CHO NODE.js

### 2.1 Tại sao ioredis?

Có 2 Redis client phổ biến cho Node.js:

|                    | node-redis     | ioredis             |
| ------------------ | -------------- | ------------------- |
| Maintainer         | Redis official | Community           |
| TypeScript         | ✅ Built-in    | ✅ Built-in         |
| Cluster support    | ✅             | ✅ (tốt hơn)        |
| Pipelining         | ✅             | ✅ (tốt hơn)        |
| Lua scripting      | ✅             | ✅ (dễ dùng hơn)    |
| Reconnect strategy | Cơ bản         | Linh hoạt hơn       |
| NestJS ecosystem   | —              | BullMQ dùng ioredis |

SSLM chọn **ioredis** vì:

- BullMQ (job queue) sử dụng ioredis internally
- API dễ dùng, reconnect strategy tốt
- Phổ biến trong NestJS ecosystem

### 2.2 Connection String

```
redis://localhost:6379
^^^^^   ^^^^^^^^^  ^^^^
protocol  host     port

# Với authentication (Upstash production):
redis://default:token@xxx.upstash.io:6379
        ^^^^^^^  ^^^^^  ^^^^^^^^^^^^^
        username token   host
```

---

## 3. REDIS SERVICE — PHÂN TÍCH CHI TIẾT

### 3.1 File `redis.service.ts`

```typescript
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const url = configService.get<string>('redis.url');
    super(url || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });

    this.on('connect', () => this.logger.log('Redis connected'));
    this.on('error', (err) => this.logger.error('Redis error', err.message));
  }

  async onModuleDestroy() {
    await this.quit();
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, windowSeconds);
    }
    return current <= limit;
  }

  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const value = await factory();
    await this.setex(key, ttlSeconds, JSON.stringify(value));
    return value;
  }
}
```

### 3.2 Pattern `extends Redis` — Kế thừa class

```typescript
export class RedisService extends Redis implements OnModuleDestroy {
//                          ^^^^^^^^^^^^^^
//                          Kế thừa từ ioredis Redis class
```

**Tại sao extends thay vì composition?**

```typescript
// Option A: Composition (wrap Redis instance)
class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis('redis://localhost:6379');
  }

  // Phải wrap MỌI method:
  async get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string) {
    return this.client.set(key, value);
  }
  async del(key: string) {
    return this.client.del(key);
  }
  // ... 100+ methods cần wrap 😫
}

// Option B: Inheritance (extends Redis)
class RedisService extends Redis {
  constructor() {
    super('redis://localhost:6379');
  }
  // Tự động có TẤT CẢ methods: get, set, del, incr, expire, ...
  // Chỉ cần thêm custom methods
}
```

Inheritance ở đây hợp lý vì:

- RedisService **IS-A** Redis client (mối quan hệ "là một")
- Cần toàn bộ Redis API (100+ methods)
- Chỉ thêm vài helper methods riêng

### 3.3 Constructor — ConfigService không lưu thành property

```typescript
constructor(@Inject(ConfigService) configService: ConfigService) {
//                                 ^^^^^^^^^^^^^
//                                 KHÔNG có "private readonly"
//                                 → Chỉ dùng trong constructor, không lưu thành property
  const url = configService.get<string>('redis.url');
  super(url || 'redis://localhost:6379', { ... });
}
```

**Tại sao?**

- `configService` chỉ cần ở constructor để đọc Redis URL
- Sau khi `super()` tạo connection, không cần config nữa
- Lưu thành property → TypeScript `noUnusedLocals` sẽ cảnh báo "property never read"

### 3.4 `super()` call — Khởi tạo Redis connection

```typescript
super(url || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});
```

| Option                 | Giá trị  | Giải thích                                                 |
| ---------------------- | -------- | ---------------------------------------------------------- |
| `maxRetriesPerRequest` | 3        | Mỗi Redis command retry tối đa 3 lần trước khi throw error |
| `retryStrategy(times)` | Function | Tính delay giữa các lần reconnect                          |

**retryStrategy giải thích:**

```
Lần 1: Math.min(1 * 50, 2000) = 50ms    chờ 50ms rồi thử lại
Lần 2: Math.min(2 * 50, 2000) = 100ms   chờ 100ms
Lần 3: Math.min(3 * 50, 2000) = 150ms   chờ 150ms
...
Lần 40: Math.min(40 * 50, 2000) = 2000ms  chờ 2s (max)
Lần 41+: Luôn 2000ms                      cap ở 2s
```

Đây là **exponential backoff** (tăng dần thời gian chờ) — tránh flood Redis server khi nó đang down.

### 3.5 Event listeners

```typescript
this.on('connect', () => this.logger.log('Redis connected'));
this.on('error', (err) => this.logger.error('Redis error', err.message));
```

ioredis emit events khi trạng thái connection thay đổi:

```
connect       → Kết nối thành công
ready         → Sẵn sàng nhận commands
error         → Lỗi connection
close         → Connection đóng
reconnecting  → Đang thử reconnect
```

Log events giúp debug khi Redis gặp vấn đề.

### 3.6 `onModuleDestroy()` — Cleanup

```typescript
async onModuleDestroy() {
  await this.quit();  // Gracefully close Redis connection
}
```

Khi NestJS app shutdown → đóng Redis connection sạch sẽ. `quit()` gửi command QUIT cho Redis server → server acknowledge → close connection.

---

## 4. HELPER METHODS

### 4.1 `checkRateLimit()` — Rate Limiting Pattern

```typescript
async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const current = await this.incr(key);     // Tăng counter lên 1
  if (current === 1) {
    await this.expire(key, windowSeconds);  // Lần đầu → set TTL
  }
  return current <= limit;                  // true = cho phép, false = chặn
}
```

**Flow:**

```
Ví dụ: Login rate limit — max 5 lần/phút

Request 1: INCR "rate:login:192.168.1.1" → 1 (mới tạo, set TTL 60s)  ✅ OK
Request 2: INCR "rate:login:192.168.1.1" → 2                          ✅ OK
Request 3: INCR "rate:login:192.168.1.1" → 3                          ✅ OK
Request 4: INCR "rate:login:192.168.1.1" → 4                          ✅ OK
Request 5: INCR "rate:login:192.168.1.1" → 5                          ✅ OK (limit)
Request 6: INCR "rate:login:192.168.1.1" → 6                          ❌ BLOCKED!

... 60 giây trôi qua, key tự xóa (TTL hết) ...

Request 7: INCR "rate:login:192.168.1.1" → 1 (key mới, reset)        ✅ OK
```

**`INCR` là atomic** — nhiều requests đồng thời không bị race condition:

```
Thread A: INCR key → 1
Thread B: INCR key → 2    ← Redis đảm bảo thứ tự
Thread C: INCR key → 3    ← Không bao giờ 2 thread nhận cùng giá trị
```

### 4.2 `getOrSet()` — Cache-Aside Pattern

```typescript
async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
  const cached = await this.get(key);          // 1. Kiểm tra cache
  if (cached) {
    return JSON.parse(cached) as T;            // 2. Cache hit → trả về ngay
  }
  const value = await factory();               // 3. Cache miss → gọi factory (query DB)
  await this.setex(key, ttlSeconds, JSON.stringify(value));  // 4. Lưu vào cache
  return value;                                // 5. Trả về kết quả
}
```

**Flow diagram:**

```
Request → getOrSet('courses:popular', 300, queryDB)
              │
              ├── Redis GET "courses:popular"
              │       │
              │       ├── HIT (data có trong cache)
              │       │   └── Parse JSON → return data
              │       │       ⏱️ ~0.1ms
              │       │
              │       └── MISS (cache trống hoặc expired)
              │           ├── queryDB() → PostgreSQL query
              │           │   ⏱️ ~10ms
              │           ├── SETEX "courses:popular" 300 "{...}"
              │           │   (lưu cache, TTL 300s = 5 phút)
              │           └── return data
              │
              └── Lần request tiếp theo trong 5 phút → HIT (nhanh 100x)
```

**`SETEX` = SET + EXPIRE** trong 1 atomic command:

```
SETEX "key" 300 "value"
// Tương đương:
SET "key" "value"
EXPIRE "key" 300
// Nhưng SETEX an toàn hơn (atomic — không bị race condition)
```

**Generic type `<T>`** — factory function trả về type gì, getOrSet trả về type đó:

```typescript
// T = Course[]
const courses = await redis.getOrSet<Course[]>('courses:popular', CACHE_TTL_MEDIUM, () =>
  prisma.course.findMany({ take: 10 }),
);
// courses: Course[] — TypeScript biết chính xác type
```

---

## 5. REDIS MODULE

### 5.1 File `redis.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

### 5.2 `@Global()` — Tại sao?

Redis được dùng ở **nhiều modules**: Auth (rate limiting), Courses (caching), Chat (pub/sub), ... Nếu không global, mỗi module phải import `RedisModule`:

```typescript
// ❌ Không global — phải import ở mỗi module
@Module({ imports: [RedisModule] })
export class AuthModule {}
@Module({ imports: [RedisModule] })
export class CoursesModule {}
@Module({ imports: [RedisModule] })
export class ChatModule {}

// ✅ Global — chỉ import 1 lần ở AppModule
@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
// → RedisService available ở MỌI module tự động
```

---

## 6. CACHING STRATEGIES

### 6.1 Cache-Aside (Read-Through) — Pattern SSLM dùng

```
Application ──── Cache (Redis) ──── Database (PostgreSQL)

Read flow:
  1. Check cache
  2. Cache hit → return
  3. Cache miss → query DB → store in cache → return

Write flow:
  1. Update DB
  2. Invalidate cache (delete key)
  3. Next read → cache miss → repopulate
```

### 6.2 TTL Strategy trong SSLM

```typescript
// constants/app.constant.ts
export const CACHE_TTL_SHORT = 60; // 1 phút — data thay đổi thường xuyên
export const CACHE_TTL_MEDIUM = 300; // 5 phút — data bán static
export const CACHE_TTL_LONG = 3600; // 1 giờ  — data ít thay đổi
```

| Data                      | TTL            | Lý do                                     |
| ------------------------- | -------------- | ----------------------------------------- |
| Course list (browse page) | MEDIUM (5 min) | Courses ít thay đổi, refresh 5 phút       |
| Category list             | LONG (1 hour)  | Categories gần như static                 |
| User profile              | SHORT (1 min)  | User có thể update profile bất kỳ lúc nào |
| Search results            | SHORT (1 min)  | Cần fresh data                            |
| Homepage featured         | MEDIUM (5 min) | Semi-static content                       |

### 6.3 Cache Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things."
> — Phil Karlton

```typescript
// Khi instructor update course:
async updateCourse(courseId: string, dto: UpdateCourseDto) {
  await this.prisma.course.update({ ... });

  // Invalidate cache
  await this.redis.del(`course:${courseId}`);       // Specific course
  await this.redis.del('courses:popular');           // Popular list
  await this.redis.del(`courses:category:${catId}`); // Category list
}
```

---

## 7. DOCKER REDIS (LOCAL DEVELOPMENT)

### 7.1 docker-compose.yml (đã có từ Phase 5.1)

```yaml
redis:
  image: redis:7-alpine
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data
```

### 7.2 Kiểm tra Redis hoạt động

```bash
# Từ terminal
docker exec -it sslm-redis redis-cli
> PING
PONG         # ← Redis đang chạy

> SET test "hello"
OK
> GET test
"hello"
> DEL test
(integer) 1
```

---

## 8. TÓM TẮT

```
Redis trong SSLM:
    │
    ├── Cache (getOrSet) — Giảm DB queries, tăng tốc response
    │   └── TTL: 1 min / 5 min / 1 hour tùy loại data
    │
    ├── Rate Limiting (checkRateLimit) — Chống brute force
    │   └── INCR + EXPIRE atomic pattern
    │
    ├── Token Store — OTT, email verification tokens
    │
    └── Job Queue Backend — BullMQ dùng Redis

RedisService:
    extends Redis (ioredis) — kế thừa 100+ methods
    @Global() — available everywhere
    @Inject(ConfigService) — SWC-compatible DI
    retryStrategy — exponential backoff
    onModuleDestroy → graceful shutdown
```
