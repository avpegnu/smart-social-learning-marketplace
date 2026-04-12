# 09 — AppModule Wiring: Global Providers & Request Lifecycle

> Giải thích cách AppModule gom tất cả lại, APP_FILTER, APP_INTERCEPTOR, APP_GUARD,
> ThrottlerModule, ScheduleModule, và full request lifecycle.

---

## 1. AppModule — ROOT MODULE

### 1.1 Vai trò

`AppModule` là **root module** — điểm bắt đầu của NestJS application. Mọi module, provider, filter, interceptor đều được khai báo hoặc import tại đây.

```
AppModule (Root)
├── imports:    Modules (config, database, cache, ...)
├── providers:  Global providers (filters, interceptors, guards)
└── Tất cả feature modules sẽ được thêm từ Phase 5.4+
```

### 1.2 File `app.module.ts` sau Phase 5.3

```typescript
@Module({
  imports: [
    AppConfigModule,       // Config (8 namespaces)
    PrismaModule,          // Database (PostgreSQL)
    RedisModule,           // Cache (Redis)
    MailModule,            // Email (Gmail SMTP)

    ThrottlerModule.forRoot([...]),  // Rate limiting
    ScheduleModule.forRoot(),        // Cron jobs
  ],
  providers: [
    // Global filters
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
```

---

## 2. MODULE IMPORTS — INFRASTRUCTURE

### 2.1 Global Infrastructure Modules

```
┌─────────────────────────────────────────────────────────┐
│                    AppModule imports                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  AppConfigModule (@Global)                               │
│  └── ConfigService available everywhere                  │
│      └── configService.get('auth.jwtAccessSecret')       │
│                                                          │
│  PrismaModule (@Global)                                  │
│  └── PrismaService available everywhere                  │
│      └── prisma.user.findMany()                          │
│                                                          │
│  RedisModule (@Global)                                   │
│  └── RedisService available everywhere                   │
│      └── redis.getOrSet(), redis.checkRateLimit()        │
│                                                          │
│  MailModule (@Global)                                    │
│  └── MailService available everywhere                    │
│      └── mail.sendVerificationEmail()                    │
│                                                          │
│  ThrottlerModule (Rate Limiting)                         │
│  └── 3 tiers: short, medium, long                        │
│                                                          │
│  ScheduleModule (Cron Jobs)                              │
│  └── Enable @Cron() decorators trong services            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 ThrottlerModule — Rate Limiting

```typescript
ThrottlerModule.forRoot([
  { name: 'short',  ttl: 1000,   limit: 3 },    // 3 requests / 1 giây
  { name: 'medium', ttl: 10000,  limit: 20 },   // 20 requests / 10 giây
  { name: 'long',   ttl: 60000,  limit: 100 },  // 100 requests / 1 phút
]),
```

**Throttling là gì?**

```
Throttling (Rate Limiting):
  Giới hạn số requests trong khoảng thời gian
  Chống: DDoS, brute force, spam

Ví dụ tier "short" (3 req/s):
  Request 1 (t=0.0s)  → ✅ OK   (count: 1/3)
  Request 2 (t=0.3s)  → ✅ OK   (count: 2/3)
  Request 3 (t=0.5s)  → ✅ OK   (count: 3/3)
  Request 4 (t=0.8s)  → ❌ 429  (Too Many Requests)
  Request 5 (t=1.1s)  → ✅ OK   (window reset, count: 1/3)
```

**3 tiers cho các use cases khác nhau:**

| Tier     | Giới hạn    | Use Case                             |
| -------- | ----------- | ------------------------------------ |
| `short`  | 3 req/s     | Sensitive endpoints (login, payment) |
| `medium` | 20 req/10s  | Normal API calls                     |
| `long`   | 100 req/min | Catch-all protection                 |

**Dùng trong controller:**

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Throttle({ short: { ttl: 1000, limit: 3 } })  // Override tier
@Post('login')
login() {}

@SkipThrottle()  // Bỏ qua throttle cho endpoint này
@Get('health')
health() {}
```

> **Lưu ý:** ThrottlerGuard chưa register global trong Phase 5.3. Sẽ register cùng JwtAuthGuard ở Phase 5.4.

### 2.3 ScheduleModule — Cron Jobs

```typescript
ScheduleModule.forRoot();
```

Enable `@Cron()` và `@Interval()` decorators. Dùng ở Phase 5.11 (Admin & Jobs):

```typescript
// Ví dụ tương lai:
@Injectable()
export class CleanupService {
  @Cron('0 3 * * *') // Chạy lúc 3:00 AM mỗi ngày
  async cleanExpiredTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  @Cron('*/5 * * * *') // Chạy mỗi 5 phút
  async processExpiredOrders() {
    // Cancel orders quá 15 phút chưa thanh toán
  }
}
```

**Cron expression:**

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, 0 and 7 = Sunday)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)

"0 3 * * *"     = 3:00 AM daily
"*/5 * * * *"   = Every 5 minutes
"0 0 * * 0"     = Midnight every Sunday
```

---

## 3. GLOBAL PROVIDERS — APP_FILTER & APP_INTERCEPTOR

### 3.1 Global vs Per-Route Registration

NestJS có 2 cách register filters, interceptors, guards:

```typescript
// Cách 1: Per-route (chỉ áp dụng cho 1 controller/method)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(LoggingInterceptor)
@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {}

// Cách 2: Global (áp dụng cho TẤT CẢ routes)
@Module({
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

### 3.2 `APP_FILTER`, `APP_INTERCEPTOR`, `APP_GUARD` — Injection Tokens

```typescript
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
```

Đây là **injection tokens** đặc biệt — NestJS nhận diện và tự động register global:

```typescript
{ provide: APP_FILTER, useClass: PrismaExceptionFilter }
//         ^^^^^^^^^^  ^^^^^^^^^
//         Token       Class to instantiate

// NestJS:
// 1. Thấy APP_FILTER token
// 2. Instantiate PrismaExceptionFilter (với DI — inject dependencies)
// 3. Register làm GLOBAL exception filter
// 4. Mọi exception đều đi qua filter này
```

### 3.3 Tại sao dùng provider pattern thay vì `app.useGlobalFilters()`?

```typescript
// Cách A: trong main.ts (KHÔNG dùng)
const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new HttpExceptionFilter());
//                    ^^^^^^^^^^^^^^^^^^^^^^^^ Tạo instance thủ công
//                    ❌ Không có DI — không inject dependencies

// Cách B: trong AppModule providers (SSLM dùng)
{ provide: APP_FILTER, useClass: HttpExceptionFilter }
//                     ^^^^^^^^^ NestJS tạo instance
//                     ✅ Có DI — tự động inject dependencies
```

**Lý do chọn Cách B:**

- Filters/Interceptors có thể inject `ConfigService`, `PrismaService`, etc.
- DI container quản lý lifecycle (singleton, dispose on shutdown)
- Testable — dễ mock trong unit tests

### 3.4 Multiple Providers với cùng Token

```typescript
providers: [
  { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  { provide: APP_FILTER, useClass: HttpExceptionFilter },
  //         ^^^^^^^^^^  Cùng token → NestJS register CẢ HAI
];
```

NestJS cho phép **multiple providers** với cùng token cho APP_FILTER, APP_INTERCEPTOR, APP_GUARD. Tất cả đều được register global.

### 3.5 Thứ tự execution

**Filters — Specific trước, General sau:**

```
Exception thrown
    │
    ├── PrismaExceptionFilter: catch PrismaClientKnownRequestError
    │   Nếu là Prisma error → handle tại đây, KHÔNG propagate
    │
    └── HttpExceptionFilter: catch HttpException
        Nếu là HTTP error → handle tại đây

Thứ tự trong providers array QUAN TRỌNG:
  Prisma filter đặt TRƯỚC Http filter
  → Prisma errors được catch đúng filter
```

**Interceptors — Theo thứ tự khai báo:**

```
Request → TransformInterceptor(B) → LoggingInterceptor(B) → TimeoutInterceptor(B) → Controller
                                                                                        │
Response ← TransformInterceptor(A) ← LoggingInterceptor(A) ← TimeoutInterceptor(A) ←──┘

B = Before handler (wrap Observable)
A = After handler (pipe operators execute)
```

---

## 4. GUARDS — TẠI SAO CHƯA REGISTER GLOBAL?

### 4.1 Vấn đề

```typescript
// Phase 5.3 KHÔNG làm:
{ provide: APP_GUARD, useClass: JwtAuthGuard }

// Tại sao?
// JwtAuthGuard extends AuthGuard('jwt')
//                      ^^^^^^^^^^^^^^^
//                      Cần JWT Strategy (passport-jwt)
//                      Strategy chưa tạo → Phase 5.4 sẽ tạo

// Nếu register trước:
// 1. App start → register JwtAuthGuard global
// 2. Client gửi ANY request
// 3. JwtAuthGuard gọi passport.authenticate('jwt')
// 4. Passport tìm strategy 'jwt' → KHÔNG TÌM THẤY
// 5. APP CRASH!
```

### 4.2 Phase 5.4 sẽ làm gì?

```typescript
// Phase 5.4:
// 1. Tạo JWT Strategy (passport-jwt)
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('auth.jwtAccessSecret'),
    });
  }
  validate(payload: JwtPayload) { return payload; }
}

// 2. Register guards global
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

---

## 5. FULL REQUEST LIFECYCLE TRONG SSLM

### 5.1 Complete Flow (sau Phase 5.3)

```
Client Request: POST /api/courses
Authorization: Bearer eyJhbGci...
Body: { "title": "React", "price": 150000 }
│
│  ┌──────────────────────────────────────────────────────┐
│  │                    MIDDLEWARE                          │
│  │  Express: CORS, Cookie Parser, Body Parser            │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │                    GUARDS (Phase 5.4)                  │
│  │  1. ThrottlerGuard: Rate limit check                  │
│  │  2. JwtAuthGuard: Verify JWT → request.user           │
│  │  3. RolesGuard: Check @Roles() metadata               │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │               INTERCEPTORS (Before)                    │
│  │  1. TransformInterceptor: start pipe                  │
│  │  2. LoggingInterceptor: record start time             │
│  │  3. TimeoutInterceptor: set 30s timeout               │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │                      PIPES                             │
│  │  1. ValidationPipe (global): Validate CreateCourseDto │
│  │  2. ParseCuidPipe (per-param): Validate :id params    │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │                   CONTROLLER                           │
│  │  @Post() create(@Body() dto, @CurrentUser() user)     │
│  │  → Delegate to CoursesService                         │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │                    SERVICE                             │
│  │  Business logic: validate, query DB, return result    │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │               INTERCEPTORS (After)                     │
│  │  3. TimeoutInterceptor: check timeout                 │
│  │  2. LoggingInterceptor: log elapsed time              │
│  │  1. TransformInterceptor: wrap in { data }            │
│  └──────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────┐
│  │            EXCEPTION FILTERS (if error)                │
│  │  1. PrismaExceptionFilter: P2002, P2025, P2003       │
│  │  2. HttpExceptionFilter: 400, 401, 403, 404, 409     │
│  └──────────────────────────────────────────────────────┘
│
▼
Response: { "data": { "id": "clx1...", "title": "React", ... } }
```

### 5.2 Error Flow

```
Service: throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS' })
    │
    ├── PrismaExceptionFilter: Không phải Prisma error → SKIP
    │
    └── HttpExceptionFilter: ConflictException IS HttpException → CATCH
        └── Response: { code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 }

Service: await prisma.user.create({ data: { email: duplicate } })
    │
    └── PrismaExceptionFilter: PrismaClientKnownRequestError P2002 → CATCH
        └── Response: { code: 'UNIQUE_CONSTRAINT_VIOLATION', statusCode: 409 }
```

---

## 6. SO SÁNH TRƯỚC VÀ SAU PHASE 5.3

### 6.1 AppModule Evolution

```typescript
// Phase 5.1 — bare minimum
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class AppModule {}

// Phase 5.3 — full infrastructure
@Module({
  imports: [
    AppConfigModule, // 8 namespaced configs
    PrismaModule, // Database
    RedisModule, // Cache + rate limit
    MailModule, // Email
    ThrottlerModule, // Rate limiting
    ScheduleModule, // Cron jobs
  ],
  providers: [
    // 2 global filters
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // 3 global interceptors
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
```

### 6.2 Tổng files tạo trong Phase 5.3

```
src/config/         9 files  → Configuration management
src/redis/          2 files  → Cache & rate limiting
src/mail/           2 files  → Email service
src/uploads/        2 files  → Media uploads
src/common/
  constants/        1 file   → Named constants
  interfaces/       2 files  → Type definitions
  dto/              2 files  → Data validation
  decorators/       4 files  → Custom decorators + barrel
  guards/           4 files  → Auth & authorization + barrel
  pipes/            1 file   → CUID validation
  filters/          2 files  → Error handling
  interceptors/     3 files  → Response transform, logging, timeout
  utils/            3 files  → Slug, segments, pagination
                    ─────
                    37 files tổng cộng
```

---

## 7. TÓM TẮT

```
AppModule Phase 5.3 wiring:

Imports (Infrastructure):
  ├── AppConfigModule (@Global) — 8 namespaced configs
  ├── PrismaModule (@Global) — PostgreSQL via Prisma ORM
  ├── RedisModule (@Global) — Redis cache via ioredis
  ├── MailModule (@Global) — Gmail SMTP (Nodemailer)
  ├── ThrottlerModule — 3-tier rate limiting (guard chưa register)
  └── ScheduleModule — Cron job support

Global Filters (APP_FILTER):
  ├── PrismaExceptionFilter — Map P2002/P2025/P2003 → error codes
  └── HttpExceptionFilter — Normalize error response format

Global Interceptors (APP_INTERCEPTOR):
  ├── TransformInterceptor — Wrap response in { data }
  ├── LoggingInterceptor — Log HTTP method, URL, elapsed time
  └── TimeoutInterceptor — 30-second request timeout

Deferred to Phase 5.4:
  ├── APP_GUARD: JwtAuthGuard (needs JWT Strategy)
  └── APP_GUARD: ThrottlerGuard (register cùng JWT guard)
```
