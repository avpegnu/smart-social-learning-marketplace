# 08 — Interceptors & Utils: Response Transform, Logging, Timeout, Utilities

> Giải thích Interceptor pattern, RxJS Observable, TransformInterceptor,
> LoggingInterceptor, TimeoutInterceptor, và utility functions.

---

## 1. INTERCEPTOR LÀ GÌ?

### 1.1 Concept

**Interceptor** là layer xử lý **trước VÀ sau** controller method. Khác với Guard (chỉ trước) và Filter (chỉ catch errors), Interceptor can thiệp vào **cả request lẫn response**.

```
Request ──→ Interceptor (BEFORE) ──→ Controller ──→ Interceptor (AFTER) ──→ Response
                │                                         │
                │  Transform request                      │  Transform response
                │  Start timer                            │  Log elapsed time
                │  Add headers                            │  Cache response
                └─────────────────────────────────────────┘
```

### 1.2 Interceptor vs Guard vs Filter vs Pipe

```
┌────────────────────────────────────────────────────────────────────┐
│                    NestJS REQUEST LIFECYCLE                         │
│                                                                    │
│  Middleware → Guard → Interceptor(B) → Pipe → Controller           │
│                                                   │                │
│                                              Interceptor(A)        │
│                                                   │                │
│                                          Exception Filter          │
│                                                   │                │
│                                               Response             │
├────────────────────────────────────────────────────────────────────┤
│ Guard:       Cho phép / từ chối request (auth, roles)              │
│ Pipe:        Validate / transform INPUT data                       │
│ Interceptor: Transform INPUT/OUTPUT, logging, caching, timeout     │
│ Filter:      Catch errors, format error response                   │
└────────────────────────────────────────────────────────────────────┘
```

### 1.3 NestInterceptor Interface

```typescript
interface NestInterceptor<T, R> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<R>;
}

// T = input type (từ controller)
// R = output type (sau transform)
// next.handle() = gọi controller method → trả về Observable
```

---

## 2. RxJS OBSERVABLE — HIỂU CƠ BẢN

### 2.1 Observable là gì?

NestJS dùng **RxJS Observable** cho interceptors — đây là reactive programming pattern:

```typescript
// Observable = "luồng dữ liệu" có thể transform
next.handle()           // Observable chứa response từ controller
  .pipe(                // "Đường ống" xử lý
    map(data => ...),   // Transform data
    tap(() => ...),     // Side effect (logging), không thay đổi data
    timeout(30000),     // Timeout sau 30s
  );
```

### 2.2 RxJS Operators dùng trong SSLM

| Operator    | Chức năng                         | Dùng trong           |
| ----------- | --------------------------------- | -------------------- |
| `map()`     | Transform data (thay đổi giá trị) | TransformInterceptor |
| `tap()`     | Side effect (không thay đổi data) | LoggingInterceptor   |
| `timeout()` | Throw error nếu quá thời gian     | TimeoutInterceptor   |

```
next.handle() → Observable<data>
     │
     ├── map(data => { data })      → Wrap trong { data }
     ├── tap(() => console.log())    → Log, không đổi data
     └── timeout(30000)              → Cancel nếu > 30s
```

---

## 3. TransformInterceptor — CHUẨN HÓA RESPONSE

### 3.1 File `transform.interceptor.ts`

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data; // Paginated response → giữ nguyên
        }
        return { data }; // Wrap trong { data: ... }
      }),
    );
  }
}
```

### 3.2 Tại sao cần wrap response?

**Consistency** — mọi API response đều có cùng format:

```json
// Không có interceptor:
GET /api/courses/123 → { "id": "123", "title": "React" }         // Object thẳng
GET /api/users/me    → { "id": "456", "email": "test@test.com" }  // Object thẳng
GET /api/courses     → [{ ... }, { ... }]                          // Array thẳng

// Có TransformInterceptor:
GET /api/courses/123 → { "data": { "id": "123", "title": "React" } }     // Wrapped
GET /api/users/me    → { "data": { "id": "456", "email": "..." } }       // Wrapped
GET /api/courses     → { "data": [{ ... }], "meta": { "page": 1, ... } } // Paginated
```

**Frontend luôn đọc `response.data`** — không cần check type:

```typescript
// Frontend code — luôn consistent:
const { data } = await api.get('/courses/123');
const course = data; // Luôn lấy từ .data

const { data, meta } = await api.get('/courses');
const courses = data; // Array of courses
const { total } = meta;
```

### 3.3 Smart detection — Paginated vs Single

```typescript
if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
  return data; // ← Đã có format { data, meta } → KHÔNG wrap lại
}
return { data }; // ← Chưa có format → wrap
```

**Tại sao cần kiểm tra?**

```typescript
// Service trả về paginated result:
return {
  data: courses,
  meta: { page: 1, limit: 20, total: 156, totalPages: 8 },
};

// Nếu KHÔNG kiểm tra → double wrap:
// { data: { data: courses, meta: { ... } } }  ← SAI!

// Có kiểm tra → giữ nguyên:
// { data: courses, meta: { ... } }             ← ĐÚNG!
```

### 3.4 `_context` — Unused parameter

```typescript
intercept(_context: ExecutionContext, next: CallHandler)
//        ^^^^^^^^ Prefix _ = "intentionally unused"
```

TypeScript `noUnusedParameters: true` sẽ error nếu parameter không dùng. Prefix `_` = convention nói "tôi biết param này không dùng, đó là intentional".

---

## 4. LoggingInterceptor — HTTP REQUEST LOGGING

### 4.1 File `logging.interceptor.ts`

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method as string;
    const url = request.url as string;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - now;
        this.logger.log(`${method} ${url} — ${elapsed}ms`);
      }),
    );
  }
}
```

### 4.2 Flow

```
Request arrives
  │
  ├── BEFORE handler: record start time (Date.now())
  │
  ├── Controller handles request
  │
  └── AFTER handler (tap): calculate elapsed time, log

Output:
  [HTTP] GET /api/courses — 45ms
  [HTTP] POST /api/auth/login — 230ms
  [HTTP] GET /api/users/me — 12ms
```

### 4.3 `tap()` vs `map()`

```typescript
// tap() — side effect, KHÔNG thay đổi data
tap(() => this.logger.log('...'));
// Data đi qua tap() → data KHÔNG THAY ĐỔI

// map() — transform data, THAY ĐỔI output
map((data) => ({ data }));
// Data đi qua map() → data THAY ĐỔI (wrapped)
```

### 4.4 NestJS Logger vs console.log

```typescript
// ❌ console.log
console.log('GET /api/courses — 45ms');
// Output: GET /api/courses — 45ms

// ✅ NestJS Logger
this.logger.log('GET /api/courses — 45ms');
// Output: [Nest] 12345  - 03/13/2026, 10:30:00 AM  [HTTP] GET /api/courses — 45ms
//         ^^^^^  ^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^    ^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^
//         Prefix PID      Timestamp                  Context  Message
```

NestJS Logger:

- Tự thêm timestamp, PID (process ID), context
- Có thể disable theo environment (production: chỉ log errors)
- Có thể redirect (file, external service)
- Có log levels: `.log()`, `.warn()`, `.error()`, `.debug()`, `.verbose()`

---

## 5. TimeoutInterceptor — REQUEST TIMEOUT

### 5.1 File `timeout.interceptor.ts`

```typescript
const DEFAULT_TIMEOUT = 30_000; // 30 seconds

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(timeout(DEFAULT_TIMEOUT));
  }
}
```

### 5.2 Tại sao cần timeout?

```
Scenario: Query database bị stuck (deadlock, long query, DB down)

Không có timeout:
  Client chờ mãi → browser timeout (thường 2 phút)
  Server resource bị hold → memory leak
  User experience: loading spinner vô hạn

Có timeout (30s):
  30s trôi qua → TimeoutError thrown → 408 Request Timeout
  Server free resource ngay
  User nhận error → có thể retry
```

### 5.3 `30_000` — Numeric Separator

```typescript
const DEFAULT_TIMEOUT = 30_000;
//                      ^^^^^^ = 30000 (30 giây × 1000 ms)

// Underscore _ là numeric separator (ES2021)
// Giúp đọc số lớn dễ hơn:
1_000_000; // 1 triệu
1_234_567; // Dễ đọc hơn 1234567
```

### 5.4 RxJS `timeout()` operator

```typescript
next.handle().pipe(
  timeout(30_000),
  // Nếu Observable không emit value trong 30s
  // → throw TimeoutError
  // → NestJS catch → 408 Request Timeout response
);
```

---

## 6. UTILITY FUNCTIONS

### 6.1 `slug.util.ts` — URL-Friendly Slugs

```typescript
import slugify from 'slugify';

export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true, // Lowercase
    strict: true, // Strip special characters
    locale: 'vi', // Vietnamese support
  });
}

export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}
```

**Slug là gì?**

```
"Khóa học React và TypeScript nâng cao"
         ↓ generateSlug()
"khoa-hoc-react-va-typescript-nang-cao"
```

URL-friendly: không dấu, không space, lowercase, dùng hyphen.

**Vietnamese support (`locale: 'vi'`):**

```
Không có locale: "đ" → "" (bị xóa)
Có locale vi:    "đ" → "d" (chuyển đúng)
                 "ă" → "a"
                 "ơ" → "o"
```

**`generateUniqueSlug()`** — thêm timestamp suffix tránh trùng:

```
"React Basics"
  ↓ generateSlug()
"react-basics"
  ↓ + Date.now().toString(36)
"react-basics-lq2abc"
//              ^^^^^^ timestamp encoded base-36 (compact)
```

`toString(36)` — convert số sang base-36 (0-9 + a-z), compact hơn base-10:

```
Date.now() = 1710000000000
  .toString(10) → "1710000000000" (13 chars)
  .toString(36) → "lq2abc"        (6 chars)
```

### 6.2 `segments.util.ts` — Video Progress Tracking

**Bối cảnh:** Khi student xem video bài học, frontend gửi "watched segments" — những khoảng thời gian đã xem:

```
Video: [0s ─────────────────────────────────────── 900s]
Xem:   [0s ──── 240s]    [200s ──── 480s]    [600s ── 900s]
```

**`mergeSegments()`** — Gộp overlapping segments:

```typescript
export function mergeSegments(segments: [number, number][]): [number, number][] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const first = sorted[0]!;
  const merged: [number, number][] = [first];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const current = sorted[i]!;
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
}
```

**Algorithm (Merge Intervals — classic LeetCode problem):**

```
Input:  [[0, 240], [200, 480], [600, 900]]

Step 1: Sort by start time (đã sort)

Step 2: Iterate:
  merged = [[0, 240]]

  [200, 480]: 200 <= 240 (overlap!) → merge → [0, max(240, 480)] = [0, 480]
  merged = [[0, 480]]

  [600, 900]: 600 > 480 (no overlap) → push mới
  merged = [[0, 480], [600, 900]]

Output: [[0, 480], [600, 900]]
```

**Non-null assertions (`!`):**

```typescript
const first = sorted[0]!;
//                     ^ Non-null assertion

// TypeScript noUncheckedIndexedAccess:
// sorted[0] has type [number, number] | undefined
// Nhưng ta đã check segments.length === 0 ở trên → sorted[0] chắc chắn tồn tại
// ! nói TypeScript: "trust me, giá trị này không phải undefined"
```

**`calculateWatchedDuration()`:**

```typescript
export function calculateWatchedDuration(segments: [number, number][]): number {
  return segments.reduce((total, [start, end]) => total + (end - start), 0);
}

// [[0, 480], [600, 900]]
// (480-0) + (900-600) = 480 + 300 = 780 giây
```

**`calculateWatchedPercent()`:**

```typescript
export function calculateWatchedPercent(
  segments: [number, number][],
  totalDuration: number,
): number {
  if (totalDuration === 0) return 0;
  const watched = calculateWatchedDuration(segments);
  return Math.min(watched / totalDuration, 1);
}

// watched = 780, totalDuration = 900
// 780 / 900 = 0.8667 = 86.67%
// Math.min(..., 1) → cap ở 100% (nếu segments overlap tính sai)
```

**Dùng với LESSON_COMPLETE_THRESHOLD:**

```typescript
const percent = calculateWatchedPercent(mergedSegments, lesson.duration);
if (percent >= LESSON_COMPLETE_THRESHOLD) {
  // 0.8 = 80%
  // Mark lesson as completed!
}
```

### 6.3 `pagination.util.ts` — Paginated Result Helper

```typescript
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

**Dùng trong service:**

```typescript
// courses.service.ts
async findAll(dto: QueryCoursesDto): Promise<PaginatedResult<Course>> {
  const [courses, total] = await Promise.all([
    this.prisma.course.findMany({
      skip: dto.skip,
      take: dto.limit,
      where: { ... },
    }),
    this.prisma.course.count({ where: { ... } }),
  ]);

  return createPaginatedResult(courses, total, dto.page, dto.limit);
  // { data: courses, meta: { page, limit, total, totalPages } }
}
```

**`Math.ceil(total / limit)`:**

```
total = 156, limit = 20
156 / 20 = 7.8
Math.ceil(7.8) = 8  → 8 trang (trang cuối có 16 items)
```

---

## 7. TÓM TẮT

```
Interceptors (RxJS-based, before + after controller):

TransformInterceptor:
  ├── map() — Wrap response trong { data }
  ├── Smart detection — skip nếu đã paginated
  └── Consistent API response format

LoggingInterceptor:
  ├── tap() — Log HTTP method, URL, elapsed time
  ├── NestJS Logger (timestamp, context, levels)
  └── Debug-friendly: "GET /api/courses — 45ms"

TimeoutInterceptor:
  ├── timeout(30_000) — 30 second timeout
  ├── Prevent stuck requests
  └── Free server resources

Utils:
  slug.util      — Vietnamese-friendly URL slugs
  segments.util  — Video progress tracking (merge intervals algorithm)
  pagination.util — Consistent paginated response helper
```
