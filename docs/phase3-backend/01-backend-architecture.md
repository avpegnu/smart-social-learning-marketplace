# 1. BACKEND ARCHITECTURE — NestJS Modular Design

## 1.1 Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NestJS Backend                                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     API Layer (Controllers)                    │  │
│  │                                                               │  │
│  │  /api/auth/*    /api/users/*    /api/courses/*   /api/admin/* │  │
│  │  /api/cart/*    /api/orders/*   /api/posts/*     /api/ai/*    │  │
│  │  /api/groups/*  /api/questions/* /api/notifications/*          │  │
│  │  /api/instructor/*  /api/webhooks/*  /api/uploads/*           │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
│             │                                                       │
│  ┌──────────▼────────────────────────────────────────────────────┐  │
│  │                  Guards / Interceptors / Pipes                 │  │
│  │                                                               │  │
│  │  JwtAuthGuard    RolesGuard     ThrottlerGuard               │  │
│  │  TransformInterceptor    LoggingInterceptor                  │  │
│  │  ValidationPipe (global)                                      │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
│             │                                                       │
│  ┌──────────▼────────────────────────────────────────────────────┐  │
│  │                     Service Layer (Business Logic)             │  │
│  │                                                               │  │
│  │  AuthService     UserService     CourseService               │  │
│  │  OrderService    EnrollmentService  CartService              │  │
│  │  PostService     ChatService     NotificationService          │  │
│  │  RecommendationService    AiTutorService    CronService      │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
│             │                                                       │
│  ┌──────────▼────────────────────────────────────────────────────┐  │
│  │              Data Access Layer (Prisma + External)             │  │
│  │                                                               │  │
│  │  PrismaService (DB)         RedisService (Cache/Rate limit)  │  │
│  │  CloudinaryService (Media)  MailService (Gmail SMTP)         │  │
│  │  GroqService (AI)           SepayService (Payment)           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              WebSocket Layer (Socket.io Gateway)               │  │
│  │                                                               │  │
│  │  ChatGateway (rooms, messages, typing, read receipts)        │  │
│  │  NotificationGateway (realtime push to online users)         │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 1.2 Project Structure (Folder Layout)

```
src/
├── main.ts                          # Bootstrap, Swagger, CORS, global pipes
├── app.module.ts                    # Root module — imports all feature modules
│
├── common/                          # Shared utilities
│   ├── decorators/
│   │   ├── current-user.decorator.ts    # @CurrentUser() — extract user from JWT
│   │   ├── roles.decorator.ts           # @Roles('ADMIN', 'INSTRUCTOR')
│   │   ├── public.decorator.ts          # @Public() — skip JWT guard
│   │   └── api-paginated.decorator.ts   # Swagger pagination schema
│   ├── guards/
│   │   ├── jwt-auth.guard.ts            # Verify JWT access token
│   │   ├── roles.guard.ts              # Check user role
│   │   └── ws-auth.guard.ts            # WebSocket JWT verification
│   ├── interceptors/
│   │   ├── transform.interceptor.ts     # Wrap response: { data, meta }
│   │   ├── logging.interceptor.ts       # Log request/response time
│   │   └── timeout.interceptor.ts       # Request timeout (30s default)
│   ├── pipes/
│   │   └── parse-cuid.pipe.ts           # Validate CUID format
│   ├── filters/
│   │   ├── http-exception.filter.ts     # Standardize error responses
│   │   └── prisma-exception.filter.ts   # Catch Prisma errors → HTTP errors
│   ├── dto/
│   │   ├── pagination.dto.ts            # PaginationQueryDto { page, limit, sort }
│   │   └── api-response.dto.ts          # ApiResponse<T> { data, meta, message }
│   ├── interfaces/
│   │   ├── jwt-payload.interface.ts     # { userId, role, iat, exp }
│   │   └── paginated-result.interface.ts
│   ├── utils/
│   │   ├── slug.util.ts                 # Generate URL-safe slug
│   │   ├── segments.util.ts             # Merge overlapping video segments
│   │   └── pagination.util.ts           # Build Prisma skip/take from page/limit
│   └── constants/
│       ├── roles.constant.ts            # Role enum values
│       └── app.constant.ts              # Magic numbers, TTLs, limits
│
├── config/                          # Configuration module
│   ├── config.module.ts
│   ├── app.config.ts                    # PORT, NODE_ENV
│   ├── auth.config.ts                   # JWT secrets, TTLs
│   ├── database.config.ts               # DATABASE_URL
│   ├── redis.config.ts                  # UPSTASH_REDIS_URL
│   ├── cloudinary.config.ts             # Cloud name, API key/secret
│   ├── sepay.config.ts                  # Bank info, webhook secret
│   ├── groq.config.ts                   # API key, model name
│   └── mail.config.ts                   # SMTP host, port, user, pass, from email
│
├── prisma/                          # Prisma module (Database)
│   ├── prisma.module.ts                 # Global module
│   └── prisma.service.ts               # extends PrismaClient, onModuleInit
│
├── redis/                           # Redis module (Upstash)
│   ├── redis.module.ts
│   └── redis.service.ts                # get, set, incr, del — wrapper
│
├── modules/                         # Feature modules (10 modules)
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts           # /api/auth/*
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts          # Passport JWT strategy
│   │   │   └── google.strategy.ts       # Passport Google OAuth
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       ├── login.dto.ts
│   │       ├── refresh-token.dto.ts
│   │       ├── forgot-password.dto.ts
│   │       ├── reset-password.dto.ts
│   │       └── google-auth.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts          # /api/users/*
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       └── user-response.dto.ts
│   │
│   ├── instructor/
│   │   ├── instructor.module.ts
│   │   ├── instructor.controller.ts     # /api/instructor/*
│   │   ├── instructor.service.ts
│   │   ├── applications/
│   │   │   ├── applications.controller.ts
│   │   │   └── applications.service.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   └── dashboard.service.ts
│   │   ├── withdrawals/
│   │   │   ├── withdrawals.controller.ts
│   │   │   └── withdrawals.service.ts
│   │   ├── coupons/
│   │   │   ├── coupons.controller.ts
│   │   │   └── coupons.service.ts
│   │   └── dto/
│   │       ├── create-application.dto.ts
│   │       ├── update-instructor-profile.dto.ts
│   │       ├── create-coupon.dto.ts
│   │       └── create-withdrawal.dto.ts
│   │
│   ├── courses/
│   │   ├── courses.module.ts
│   │   ├── courses.controller.ts        # /api/courses/* (public browsing)
│   │   ├── courses.service.ts
│   │   ├── course-management/
│   │   │   ├── course-management.controller.ts  # /api/instructor/courses/*
│   │   │   └── course-management.service.ts
│   │   ├── sections/
│   │   │   ├── sections.controller.ts
│   │   │   └── sections.service.ts
│   │   ├── chapters/
│   │   │   ├── chapters.controller.ts
│   │   │   └── chapters.service.ts
│   │   ├── lessons/
│   │   │   ├── lessons.controller.ts
│   │   │   └── lessons.service.ts
│   │   ├── quizzes/
│   │   │   ├── quizzes.controller.ts
│   │   │   └── quizzes.service.ts
│   │   ├── reviews/
│   │   │   ├── reviews.controller.ts
│   │   │   └── reviews.service.ts
│   │   └── dto/
│   │       ├── create-course.dto.ts
│   │       ├── update-course.dto.ts
│   │       ├── course-query.dto.ts      # Filter, sort, search, pagination
│   │       ├── create-section.dto.ts
│   │       ├── create-chapter.dto.ts
│   │       ├── create-lesson.dto.ts
│   │       ├── create-quiz.dto.ts
│   │       ├── submit-quiz.dto.ts
│   │       └── create-review.dto.ts
│   │
│   ├── ecommerce/
│   │   ├── ecommerce.module.ts
│   │   ├── cart/
│   │   │   ├── cart.controller.ts       # /api/cart/*
│   │   │   └── cart.service.ts
│   │   ├── orders/
│   │   │   ├── orders.controller.ts     # /api/orders/*
│   │   │   └── orders.service.ts
│   │   ├── enrollments/
│   │   │   ├── enrollments.controller.ts
│   │   │   └── enrollments.service.ts
│   │   ├── wishlists/
│   │   │   ├── wishlists.controller.ts  # /api/wishlists/*
│   │   │   └── wishlists.service.ts
│   │   ├── webhooks/
│   │   │   ├── webhooks.controller.ts   # /api/webhooks/sepay
│   │   │   └── webhooks.service.ts
│   │   └── dto/
│   │       ├── add-cart-item.dto.ts
│   │       ├── create-order.dto.ts
│   │       └── apply-coupon.dto.ts
│   │
│   ├── learning/
│   │   ├── learning.module.ts
│   │   ├── progress/
│   │   │   ├── progress.controller.ts   # /api/learning/progress/*
│   │   │   └── progress.service.ts
│   │   ├── certificates/
│   │   │   ├── certificates.controller.ts
│   │   │   └── certificates.service.ts
│   │   ├── placement-tests/
│   │   │   ├── placement-tests.controller.ts
│   │   │   └── placement-tests.service.ts
│   │   └── dto/
│   │       ├── update-progress.dto.ts
│   │       └── submit-placement.dto.ts
│   │
│   ├── social/
│   │   ├── social.module.ts
│   │   ├── posts/
│   │   │   ├── posts.controller.ts      # /api/posts/*
│   │   │   └── posts.service.ts
│   │   ├── follows/
│   │   │   ├── follows.controller.ts    # /api/users/:id/follow
│   │   │   └── follows.service.ts
│   │   ├── feed/
│   │   │   ├── feed.controller.ts       # /api/feed
│   │   │   └── feed.service.ts
│   │   ├── chat/
│   │   │   ├── chat.controller.ts       # /api/conversations/*
│   │   │   ├── chat.service.ts
│   │   │   └── chat.gateway.ts          # WebSocket gateway
│   │   ├── groups/
│   │   │   ├── groups.controller.ts     # /api/groups/*
│   │   │   └── groups.service.ts
│   │   └── dto/
│   │       ├── create-post.dto.ts
│   │       ├── create-comment.dto.ts
│   │       ├── send-message.dto.ts
│   │       └── create-group.dto.ts
│   │
│   ├── qa-forum/
│   │   ├── qa-forum.module.ts
│   │   ├── questions/
│   │   │   ├── questions.controller.ts  # /api/questions/*
│   │   │   └── questions.service.ts
│   │   ├── answers/
│   │   │   ├── answers.controller.ts    # /api/questions/:id/answers
│   │   │   └── answers.service.ts
│   │   └── dto/
│   │       ├── create-question.dto.ts
│   │       ├── create-answer.dto.ts
│   │       └── vote.dto.ts
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts  # /api/notifications/*
│   │   ├── notifications.service.ts
│   │   ├── notifications.gateway.ts     # WebSocket push
│   │   └── dto/
│   │       └── notification-preferences.dto.ts
│   │
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai-tutor/
│   │   │   ├── ai-tutor.controller.ts   # /api/ai/tutor/*
│   │   │   └── ai-tutor.service.ts
│   │   ├── embeddings/
│   │   │   └── embeddings.service.ts    # Transformers.js local
│   │   └── dto/
│   │       └── ask-question.dto.ts
│   │
│   ├── recommendations/
│   │   ├── recommendations.module.ts
│   │   ├── recommendations.controller.ts # /api/recommendations/*
│   │   ├── recommendations.service.ts
│   │   └── algorithms/
│   │       ├── content-based.service.ts     # Cosine Similarity
│   │       ├── collaborative.service.ts     # Jaccard Similarity
│   │       ├── popularity.service.ts        # Wilson Score + Time Decay
│   │       └── chapter-suggestion.service.ts # Tag Overlap
│   │
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts          # /api/admin/*
│   │   ├── admin.service.ts
│   │   ├── instructor-apps/
│   │   │   ├── instructor-apps.controller.ts
│   │   │   └── instructor-apps.service.ts
│   │   ├── course-reviews/
│   │   │   ├── course-reviews.controller.ts
│   │   │   └── course-reviews.service.ts
│   │   ├── reports/
│   │   │   ├── reports.controller.ts
│   │   │   └── reports.service.ts
│   │   ├── analytics/
│   │   │   ├── analytics.controller.ts
│   │   │   └── analytics.service.ts
│   │   └── dto/
│   │       ├── review-application.dto.ts
│   │       ├── review-course.dto.ts
│   │       ├── review-report.dto.ts
│   │       ├── manage-user.dto.ts
│   │       └── update-settings.dto.ts
│   │
│   └── uploads/
│       ├── uploads.module.ts
│       ├── uploads.controller.ts        # /api/uploads/*
│       ├── uploads.service.ts
│       └── cloudinary.service.ts        # Cloudinary SDK wrapper
│
├── mail/                            # Email module (Gmail SMTP)
│   ├── mail.module.ts
│   ├── mail.service.ts
│   └── templates/                       # Email HTML templates
│       ├── verification.template.ts
│       ├── reset-password.template.ts
│       ├── order-completed.template.ts
│       ├── course-approved.template.ts
│       └── withdrawal-completed.template.ts
│
├── cron/                            # Scheduled jobs (@nestjs/schedule)
│   ├── cron.module.ts
│   └── cron.service.ts                 # All 9 cron jobs
│
└── queue/                           # Bull queue (Upstash Redis)
    ├── queue.module.ts
    ├── processors/
    │   ├── email.processor.ts           # Process email send jobs
    │   ├── notification.processor.ts    # Process notification fan-out
    │   └── feed.processor.ts            # Process feed fanout-on-write
    └── constants/
        └── queue.constant.ts            # Queue names
```

## 1.3 Kiến trúc Request Pipeline

```
Client Request
  │
  ▼
┌─────────────────────────────────────────┐
│ 1. Global Middleware                     │
│    - CORS (whitelist origins)            │
│    - Helmet (security headers)           │
│    - Compression (gzip)                  │
│    - Morgan/Logger (request logging)     │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 2. Global Pipes                          │
│    - ValidationPipe (class-validator)    │
│      + whitelist: true (strip unknown)   │
│      + forbidNonWhitelisted: true        │
│      + transform: true (auto-cast)       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 3. Guards (tuần tự)                      │
│    a. ThrottlerGuard (rate limiting)     │
│    b. JwtAuthGuard (authentication)      │
│       → Skip nếu @Public()              │
│       → Extract user from JWT payload   │
│    c. RolesGuard (authorization)         │
│       → Check @Roles() decorator        │
│       → 403 nếu không đủ quyền          │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 4. Interceptors                          │
│    a. LoggingInterceptor (pre/post log) │
│    b. TimeoutInterceptor (30s timeout)  │
│    c. TransformInterceptor              │
│       → Wrap response: { data, meta }   │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 5. Controller → Service → Prisma/Redis  │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 6. Exception Filters (catch errors)      │
│    a. PrismaExceptionFilter             │
│       → P2002 (unique) → 409 Conflict  │
│       → P2025 (not found) → 404        │
│    b. HttpExceptionFilter               │
│       → Standardize error format        │
└─────────────────────────────────────────┘
           │
           ▼
Client Response: { data, meta?, message? }
```

## 1.4 Response Format chuẩn

### Success Response

```typescript
// Single resource
{
  "data": {
    "id": "clx...",
    "title": "React Mastery",
    "slug": "react-mastery"
  }
}

// List resource (paginated)
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}

// Action response
{
  "message": "Đăng ký thành công. Vui lòng kiểm tra email."
}
```

### Error Response

```typescript
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "Email không hợp lệ" },
    { "field": "password", "message": "Mật khẩu cần ít nhất 8 ký tự" }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/auth/register"
}
```

## 1.5 Authentication & Authorization

### JWT Strategy

```typescript
// JWT Payload — lưu minimal data, tránh token quá lớn
interface JwtPayload {
  userId: string; // CUID
  role: Role; // STUDENT | INSTRUCTOR | ADMIN
  iat: number; // issued at
  exp: number; // expires at (15 phút)
}

// Access Token: JWT RS256, 15 phút
// Refresh Token: opaque UUID, 7 ngày, lưu DB (refresh_tokens table)
// Refresh Token gửi qua httpOnly cookie (chống XSS)
```

### Guard Flow

```typescript
// 1. JwtAuthGuard (global, mặc định apply cho TẤT CẢ routes)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Check @Public() decorator → skip auth
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// 2. RolesGuard — check role từ JWT payload
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // Không có @Roles() → allow all authenticated
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user.role);
  }
}

// 3. Sử dụng trong Controller
@Controller('api/admin')
@Roles('ADMIN')                    // Toàn bộ controller chỉ cho Admin
export class AdminController {

  @Get('users')
  findAllUsers() { ... }          // Chỉ Admin

  @Public()                        // Override → public
  @Get('health')
  healthCheck() { ... }
}
```

### Authorization Matrix (Route-level)

```
┌─────────────────────────────────────┬────────┬────────┬───────────┬───────┐
│ Route Pattern                       │ Guest  │Student │Instructor │ Admin │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ POST   /api/auth/register           │ ✅     │ —      │ —         │ —     │
│ POST   /api/auth/login              │ ✅     │ —      │ —         │ —     │
│ POST   /api/auth/refresh            │ ✅     │ ✅     │ ✅        │ ✅    │
│ POST   /api/auth/forgot-password    │ ✅     │ —      │ —         │ —     │
│ GET    /api/auth/verify             │ ✅     │ —      │ —         │ —     │
│ POST   /api/auth/google             │ ✅     │ —      │ —         │ —     │
│ POST   /api/auth/cross-portal-token │ —      │ —      │ ✅        │ ✅    │
│ POST   /api/auth/exchange-ott       │ ✅     │ —      │ —         │ —     │
│ POST   /api/auth/logout             │ —      │ ✅     │ ✅        │ ✅    │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/users/me                │ —      │ ✅     │ ✅        │ ✅    │
│ PUT    /api/users/me                │ —      │ ✅     │ ✅        │ ✅    │
│ POST   /api/users/me/avatar        │ —      │ ✅     │ ✅        │ ✅    │
│ GET    /api/users/:id               │ ✅     │ ✅     │ ✅        │ ✅    │
│ POST   /api/users/:id/follow        │ —      │ ✅     │ ✅        │ —     │
│ DELETE /api/users/:id/follow        │ —      │ ✅     │ ✅        │ —     │
│ GET    /api/users/:id/followers     │ ✅     │ ✅     │ ✅        │ ✅    │
│ GET    /api/users/:id/following     │ ✅     │ ✅     │ ✅        │ ✅    │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/courses                 │ ✅     │ ✅     │ ✅        │ ✅    │
│ GET    /api/courses/:slug           │ ✅     │ ✅     │ ✅        │ ✅    │
│ GET    /api/courses/:id/learn/:lid  │ —      │ ✅     │ ✅        │ —     │
│ POST   /api/courses/:id/reviews     │ —      │ ✅     │ ✅        │ —     │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ POST   /api/instructor/applications │ —      │ ✅     │ —         │ —     │
│ GET    /api/instructor/courses      │ —      │ —      │ ✅        │ —     │
│ POST   /api/instructor/courses      │ —      │ —      │ ✅        │ —     │
│ PUT    /api/instructor/courses/:id  │ —      │ —      │ ✅ (own)  │ —     │
│ GET    /api/instructor/dashboard    │ —      │ —      │ ✅        │ —     │
│ POST   /api/instructor/withdrawals  │ —      │ —      │ ✅        │ —     │
│ CRUD   /api/instructor/coupons      │ —      │ —      │ ✅        │ —     │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/cart                     │ —      │ ✅     │ ✅        │ —     │
│ POST   /api/cart/items              │ —      │ ✅     │ ✅        │ —     │
│ POST   /api/orders                  │ —      │ ✅     │ ✅        │ —     │
│ GET    /api/orders/:id              │ —      │ ✅     │ ✅        │ ✅    │
│ POST   /api/webhooks/sepay          │ ✅*    │ —      │ —         │ —     │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ PUT    /api/learning/progress/:lid  │ —      │ ✅     │ ✅        │ —     │
│ GET    /api/learning/dashboard      │ —      │ ✅     │ ✅        │ —     │
│ GET    /api/certificates/verify/:id │ ✅     │ ✅     │ ✅        │ ✅    │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/feed                    │ —      │ ✅     │ ✅        │ —     │
│ CRUD   /api/posts                   │ —      │ ✅     │ ✅        │ —     │
│ POST   /api/posts/:id/like          │ —      │ ✅     │ ✅        │ —     │
│ CRUD   /api/conversations           │ —      │ ✅     │ ✅        │ —     │
│ CRUD   /api/groups                  │ —      │ ✅     │ ✅        │ —     │
│ CRUD   /api/questions               │ —      │ ✅     │ ✅        │ —     │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/notifications           │ —      │ ✅     │ ✅        │ ✅    │
│ PUT    /api/notifications/:id/read  │ —      │ ✅     │ ✅        │ ✅    │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ POST   /api/ai/tutor/ask            │ —      │ ✅     │ ✅        │ —     │
│ GET    /api/ai/tutor/sessions       │ —      │ ✅     │ ✅        │ —     │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/recommendations         │ ✅     │ ✅     │ ✅        │ —     │
│ GET    /api/recommendations/chapters│ —      │ ✅     │ ✅        │ —     │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ GET    /api/admin/**                │ —      │ —      │ —         │ ✅    │
│ PUT    /api/admin/**                │ —      │ —      │ —         │ ✅    │
├─────────────────────────────────────┼────────┼────────┼───────────┼───────┤
│ POST   /api/uploads/sign            │ —      │ —      │ ✅        │ —     │
│ POST   /api/uploads/:id/complete    │ —      │ —      │ ✅        │ —     │
│ POST   /api/reports                 │ —      │ ✅     │ ✅        │ —     │
│ CRUD   /api/wishlists               │ —      │ ✅     │ ✅        │ —     │
└─────────────────────────────────────┴────────┴────────┴───────────┴───────┘
 ✅* = SePay webhook — public nhưng verify bằng API key trong header
```

### Instructor Resource Ownership Check

```typescript
// Ngoài RolesGuard, cần check instructor chỉ sửa khóa CỦA MÌNH
// Implement dưới dạng service-level check (không dùng guard riêng)

async updateCourse(courseId: string, userId: string, dto: UpdateCourseDto) {
  const course = await this.prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundException('Không tìm thấy khóa học');
  if (course.instructorId !== userId) throw new ForbiddenException('Bạn không sở hữu khóa học này');
  // ... update
}
```

## 1.6 Rate Limiting Strategy

```typescript
// Global rate limit (ThrottlerModule)
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'short', ttl: 1000, limit: 10 },   // 10 req/s per IP
    { name: 'medium', ttl: 60000, limit: 100 },  // 100 req/min per IP
  ],
}),

// Per-route override
@Throttle({ short: { ttl: 60000, limit: 5 } })   // Login: 5 req/min
@Post('login')
login() { ... }

@Throttle({ short: { ttl: 86400000, limit: 10 } }) // AI: 10 req/day
@Post('ai/tutor/ask')
askAiTutor() { ... }

// Redis-based rate limit cho precision (login attempts per IP)
// Key pattern: rate_limit:login:{ip}
// TTL: 15 phút
// Max: 5 attempts → block 15 phút
```

## 1.7 Validation (class-validator + class-transformer)

```typescript
// Ví dụ DTO: RegisterDto
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' })
  @MaxLength(100)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu cần ít nhất 1 chữ hoa và 1 số',
  })
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2, { message: 'Họ tên cần ít nhất 2 ký tự' })
  @MaxLength(100)
  fullName: string;
}

// Ví dụ DTO: CourseQueryDto (search + filter + pagination)
export class CourseQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string; // Full-text search

  @IsOptional()
  @IsString()
  categorySlug?: string; // Filter by category

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(['popular', 'newest', 'highest_rated', 'price_asc', 'price_desc'])
  sort?: string;
}
```

## 1.8 Error Handling

### Prisma Exception Filter

```typescript
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': // Unique constraint violation
        const field = (exception.meta?.target as string[])?.[0];
        response.status(409).json({
          statusCode: 409,
          error: 'Conflict',
          message: `${field} đã tồn tại`,
        });
        break;

      case 'P2025': // Record not found
        response.status(404).json({
          statusCode: 404,
          error: 'Not Found',
          message: 'Không tìm thấy dữ liệu',
        });
        break;

      case 'P2003': // Foreign key constraint
        response.status(400).json({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Dữ liệu tham chiếu không hợp lệ',
        });
        break;

      default:
        response.status(500).json({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Lỗi cơ sở dữ liệu',
        });
    }
  }
}
```

### Business Error Classes

```typescript
// Các lỗi nghiệp vụ tùy chỉnh
export class InsufficientBalanceException extends BadRequestException {
  constructor() {
    super('Số dư không đủ để rút tiền');
  }
}

export class CourseNotOwnedException extends ForbiddenException {
  constructor() {
    super('Bạn không sở hữu khóa học này');
  }
}

export class AlreadyEnrolledException extends ConflictException {
  constructor() {
    super('Bạn đã đăng ký khóa học này');
  }
}

export class InsufficientProgressException extends BadRequestException {
  constructor() {
    super('Bạn cần học ít nhất 30% để đánh giá khóa học');
  }
}

export class OrderExpiredException extends GoneException {
  constructor() {
    super('Đơn hàng đã hết hạn');
  }
}

export class AiQuotaExceededException extends TooManyRequestsException {
  constructor() {
    super('Bạn đã hết lượt hỏi AI Tutor hôm nay (10/ngày)');
  }
}
```

## 1.9 Swagger/OpenAPI Configuration

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — chỉ cho phép 2 portal origins
  app.enableCors({
    origin: [
      process.env.STUDENT_PORTAL_URL, // https://app.example.com
      process.env.MANAGEMENT_PORTAL_URL, // https://manage.example.com
    ],
    credentials: true, // Cho phép cookies (refresh token)
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new TimeoutInterceptor(),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Smart Social Learning Marketplace API')
    .setDescription('REST API cho hệ thống marketplace khóa học + mạng xã hội học tập')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & Authorization')
    .addTag('Users', 'User profile management')
    .addTag('Courses', 'Course browsing & search')
    .addTag('Course Management', 'Instructor course CRUD')
    .addTag('Cart', 'Shopping cart')
    .addTag('Orders', 'Checkout & payment')
    .addTag('Learning', 'Course player & progress')
    .addTag('Social', 'Posts, feed, follow')
    .addTag('Chat', 'Real-time messaging')
    .addTag('Groups', 'Study groups')
    .addTag('Q&A', 'Question & Answer forum')
    .addTag('Notifications', 'Multi-channel notifications')
    .addTag('AI Tutor', 'RAG-based AI chat')
    .addTag('Recommendations', 'Course recommendations')
    .addTag('Admin', 'Platform administration')
    .addTag('Uploads', 'File upload (Cloudinary)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}
```

## 1.10 Environment Variables

```bash
# .env
# ============================================================================
# App
# ============================================================================
NODE_ENV=development
PORT=3000
STUDENT_PORTAL_URL=http://localhost:3001
MANAGEMENT_PORTAL_URL=http://localhost:3002

# ============================================================================
# Database (Neon.tech)
# ============================================================================
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DIRECT_URL=postgresql://user:pass@host/db?sslmode=require

# ============================================================================
# Auth (JWT)
# ============================================================================
JWT_ACCESS_SECRET=your-access-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# ============================================================================
# Redis (Upstash)
# ============================================================================
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# ============================================================================
# Cloudinary
# ============================================================================
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# ============================================================================
# SePay (Payment)
# ============================================================================
SEPAY_WEBHOOK_SECRET=your-webhook-secret
SEPAY_BANK_ID=MB
SEPAY_ACCOUNT_NUMBER=xxx
SEPAY_ACCOUNT_NAME=xxx

# ============================================================================
# Groq (AI)
# ============================================================================
GROQ_API_KEY=gsk_xxx
GROQ_MODEL=llama-3.3-70b-versatile

# ============================================================================
# SMTP (Gmail)
# ============================================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx@gmail.com
SMTP_PASS=xxx
SMTP_FROM_EMAIL=xxx@gmail.com

# ============================================================================
# Sentry (Error tracking)
# ============================================================================
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## 1.11 Module Dependency Graph

```
AppModule
  ├── ConfigModule (global)
  ├── PrismaModule (global)
  ├── RedisModule (global)
  ├── ThrottlerModule (global)
  ├── ScheduleModule (cron)
  ├── BullModule (queue — Upstash Redis)
  │
  ├── AuthModule
  │   └── depends: PrismaModule, RedisModule, MailModule, ConfigModule
  │
  ├── UsersModule
  │   └── depends: PrismaModule, UploadsModule
  │
  ├── InstructorModule
  │   └── depends: PrismaModule, MailModule, NotificationsModule, UploadsModule
  │
  ├── CoursesModule
  │   └── depends: PrismaModule, RedisModule, RecommendationsModule
  │
  ├── EcommerceModule
  │   └── depends: PrismaModule, RedisModule, MailModule, NotificationsModule
  │
  ├── LearningModule
  │   └── depends: PrismaModule, CoursesModule, NotificationsModule
  │
  ├── SocialModule
  │   └── depends: PrismaModule, RedisModule, NotificationsModule, QueueModule
  │
  ├── QaForumModule
  │   └── depends: PrismaModule, NotificationsModule
  │
  ├── NotificationsModule
  │   └── depends: PrismaModule, RedisModule, MailModule, QueueModule
  │
  ├── AiModule
  │   └── depends: PrismaModule, RedisModule, ConfigModule
  │
  ├── RecommendationsModule
  │   └── depends: PrismaModule, RedisModule
  │
  ├── AdminModule
  │   └── depends: PrismaModule, MailModule, NotificationsModule
  │
  ├── UploadsModule
  │   └── depends: PrismaModule, ConfigModule
  │
  ├── MailModule
  │   └── depends: ConfigModule
  │
  ├── CronModule
  │   └── depends: PrismaModule, RedisModule, RecommendationsModule
  │
  └── QueueModule
      └── depends: PrismaModule, MailModule
```
