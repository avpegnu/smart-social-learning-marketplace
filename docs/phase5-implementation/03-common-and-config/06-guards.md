# 06 — Guards: JWT Authentication, Role-Based Access, WebSocket Auth

> Giải thích Guard pattern trong NestJS, JwtAuthGuard, RolesGuard, WsAuthGuard,
> Passport.js integration, và authorization flow.

---

## 1. GUARD LÀ GÌ?

### 1.1 Concept

**Guard** là layer kiểm tra **quyền truy cập** (authorization) trước khi request đến controller. Guard quyết định: **cho phép** hay **từ chối** request.

```
Client Request
      │
      ▼
┌─────────────┐
│   GUARD     │ ──── "User có quyền truy cập không?"
│             │
│  return true │ → ✅ Cho phép → tiếp tục đến Controller
│  return false│ → ❌ Từ chối → 403 Forbidden
│  throw error │ → ❌ Từ chối → Custom error (401/403)
└─────────────┘
```

### 1.2 Guard vs Middleware

```
Middleware:
  ├── Chạy TRƯỚC guard
  ├── Không biết route handler nào sẽ xử lý
  ├── Không đọc được metadata (@Public, @Roles)
  └── Dùng cho: logging, CORS, cookie parsing

Guard:
  ├── Chạy SAU middleware
  ├── Biết route handler (có ExecutionContext)
  ├── Đọc được metadata (@Public, @Roles)
  └── Dùng cho: Authentication, Authorization
```

### 1.3 Interface CanActivate

```typescript
interface CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
}
```

- Return `true` → cho phép
- Return `false` → NestJS throw `ForbiddenException` (403)
- Throw exception → NestJS catch và trả về error response

---

## 2. JwtAuthGuard — AUTHENTICATION

### 2.1 Passport.js là gì?

**Passport.js** là authentication framework cho Node.js, dùng **strategy pattern**:

```
Passport.js
├── Strategy: "JWT"        → Verify JWT token
├── Strategy: "Local"      → Verify email + password
├── Strategy: "Google"     → Verify Google OAuth token
└── Strategy: "Facebook"   → Verify Facebook token

Mỗi strategy biết cách verify 1 loại credentials.
NestJS wrapper: @nestjs/passport
```

### 2.2 JWT Strategy Flow

```
1. Client gửi request:
   GET /api/profile
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
                         ^^^^^^^^^^^^^^^^^^^^^^^^
                         JWT Access Token

2. JwtAuthGuard gọi Passport JWT Strategy:
   a. Extract token từ Authorization header
   b. Verify signature bằng JWT_ACCESS_SECRET
   c. Check expiration (exp claim)
   d. Decode payload: { sub: 'clx1...', role: 'STUDENT' }
   e. Gắn payload vào request.user

3. Controller nhận request.user:
   @CurrentUser() user → { sub: 'clx1...', role: 'STUDENT' }
```

### 2.3 File `jwt-auth.guard.ts`

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(Reflector) private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Bypass JWT check
    }

    return super.canActivate(context); // Delegate to Passport
  }
}
```

### 2.4 Phân tích

**`extends AuthGuard('jwt')`:**

```typescript
AuthGuard('jwt');
//        ^^^^^ strategy name — khớp với JWT Strategy sẽ tạo ở Phase 5.4

// AuthGuard là factory class từ @nestjs/passport:
// - Tự động gọi passport.authenticate('jwt')
// - Extract token từ request
// - Verify bằng JWT Strategy
// - Gắn decoded payload vào request.user
// - Throw UnauthorizedException nếu invalid
```

**`this.reflector.getAllAndOverride()`:**

```typescript
this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(), // Kiểm tra metadata trên METHOD trước
  context.getClass(), // Rồi kiểm tra trên CLASS
]);
```

`getAllAndOverride` — lấy giá trị metadata, ưu tiên method > class:

```typescript
@Public() // Class-level: tất cả methods đều public
@Controller('health')
export class HealthController {
  @Get()
  check() {} // ← isPublic = true (từ class)

  @Public() // Method-level override
  @Get('detailed')
  detailed() {} // ← isPublic = true (từ method)
}
```

**`super.canActivate(context)`:**

```typescript
if (isPublic) {
  return true; // Public → không cần token
}
return super.canActivate(context); // Private → delegate cho Passport verify JWT
```

Khi gọi `super.canActivate()`, Passport thực hiện:

1. Tìm token trong `Authorization: Bearer <token>`
2. Verify token (signature + expiration)
3. Gắn decoded payload vào `request.user`
4. Return `true` nếu OK, throw `UnauthorizedException` nếu fail

### 2.5 Tại sao chưa register global trong Phase 5.3?

```typescript
// ❌ KHÔNG LÀM ở Phase 5.3:
{ provide: APP_GUARD, useClass: JwtAuthGuard }

// Lý do: JwtAuthGuard extends AuthGuard('jwt')
//         → cần JWT Strategy để hoạt động
//         → JWT Strategy sẽ tạo ở Phase 5.4
//         → Nếu register trước → app crash khi nhận BẤT KỲ request nào

// ✅ Phase 5.4 sẽ:
// 1. Tạo JWT Strategy
// 2. Register JwtAuthGuard global
```

---

## 3. RolesGuard — AUTHORIZATION

### 3.1 Authentication vs Authorization

```
Authentication (AuthN):
  "Bạn là AI?" → Verify identity
  JWT token → User ID
  JwtAuthGuard xử lý

Authorization (AuthZ):
  "Bạn có QUYỀN làm điều này?" → Check permissions
  User role → Allowed actions
  RolesGuard xử lý
```

### 3.2 File `roles.guard.ts`

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // Không có @Roles() → ai cũng vào được
    }

    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload;
    return requiredRoles.includes(payload.role);
  }
}
```

### 3.3 Flow

```
@Roles('ADMIN', 'INSTRUCTOR')
@Post('approve')
approve(@CurrentUser() user: JwtPayload) {}

Request flow:
  1. RolesGuard.canActivate() called
  2. reflector reads metadata: requiredRoles = ['ADMIN', 'INSTRUCTOR']
  3. request.user.role = 'STUDENT'
  4. ['ADMIN', 'INSTRUCTOR'].includes('STUDENT') → false
  5. Return false → 403 Forbidden

Another request:
  1. request.user.role = 'ADMIN'
  2. ['ADMIN', 'INSTRUCTOR'].includes('ADMIN') → true
  3. Return true → ✅ Tiếp tục đến controller
```

### 3.4 `!requiredRoles` — Không có @Roles() decorator

```typescript
if (!requiredRoles) {
  return true;
}
```

Nếu method/class KHÔNG có `@Roles()` → `requiredRoles = undefined` → cho phép tất cả. Chỉ kiểm tra role khi developer explicitly set `@Roles(...)`.

### 3.5 Guard order quan trọng

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
//         ^^^^^^^^^^^^  ^^^^^^^^^^
//         Chạy TRƯỚC    Chạy SAU

// JwtAuthGuard chạy trước → gắn request.user
// RolesGuard chạy sau → đọc request.user.role
// Nếu đảo ngược → RolesGuard không có user → crash!
```

---

## 4. WsAuthGuard — WEBSOCKET AUTHENTICATION

### 4.1 Tại sao cần guard riêng cho WebSocket?

```
HTTP Request:
  Header: Authorization: Bearer <token>
  → AuthGuard tự extract từ header

WebSocket:
  Không có HTTP headers sau khi handshake
  Token gửi qua handshake auth hoặc query params
  → Cần guard riêng extract token từ socket
```

### 4.2 File `ws-auth.guard.ts`

```typescript
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth?.token || client.handshake.query?.token;

    if (!token) return false;

    try {
      const payload = this.jwtService.verify<JwtPayload>(token as string, {
        secret: this.configService.get('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      return true;
    } catch {
      return false;
    }
  }
}
```

### 4.3 Phân tích

**`context.switchToWs().getClient()`:**

```typescript
// HTTP context → getRequest() → Express Request
// WS context   → getClient()  → Socket.IO Socket
const client: Socket = context.switchToWs().getClient();
```

**Token extraction:**

```typescript
const token = client.handshake.auth?.token || client.handshake.query?.token;
```

Socket.IO client gửi token khi connect:

```typescript
// Frontend (Socket.IO client):
const socket = io('http://localhost:3000', {
  auth: { token: accessToken }, // Cách 1: auth object (recommended)
  // hoặc
  query: { token: accessToken }, // Cách 2: query params (fallback)
});
```

**Manual JWT verify (không dùng Passport):**

```typescript
const payload = this.jwtService.verify<JwtPayload>(token as string, {
  secret: this.configService.get('auth.jwtAccessSecret'),
});
```

WsAuthGuard dùng `JwtService.verify()` trực tiếp thay vì Passport vì:

- Passport không hỗ trợ WebSocket context natively
- `JwtService.verify()` đủ cho WebSocket (chỉ cần verify token)
- Không cần extract strategy phức tạp

**Gắn user data vào socket:**

```typescript
client.data.userId = payload.sub;
client.data.role = payload.role;
```

Sau khi verify → gắn userId, role vào `socket.data`. Gateway handlers đọc:

```typescript
// Chat Gateway:
@SubscribeMessage('send_message')
handleMessage(@ConnectedSocket() client: Socket, @MessageBody() data: SendMessageDto) {
  const userId = client.data.userId;   // ← Đọc từ guard đã gắn
  const role = client.data.role;
}
```

### 4.4 try/catch — Graceful failure

```typescript
try {
  // verify token
  return true;
} catch {
  return false; // Token invalid → disconnect, không throw error
}
```

WebSocket khác HTTP — không trả về error response, chỉ `return false` → NestJS disconnect client.

---

## 5. PHÂN BIỆT 3 GUARDS

```
┌─────────────────────────────────────────────────────────────┐
│                    GUARD COMPARISON                          │
├──────────────┬──────────────┬──────────────┬───────────────┤
│              │ JwtAuthGuard │  RolesGuard  │  WsAuthGuard  │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ Purpose      │ Authentication│ Authorization│ WS Auth       │
│ Transport    │ HTTP          │ HTTP         │ WebSocket     │
│ Token from   │ Auth header   │ N/A          │ Handshake     │
│ Check        │ JWT valid?    │ Role match?  │ JWT valid?    │
│ Uses Passport│ ✅ Yes        │ ❌ No        │ ❌ No          │
│ Reads metadata│ @Public     │ @Roles       │ N/A           │
│ Fail response│ 401          │ 403          │ Disconnect    │
│ Global?      │ ✅ (Phase 5.4)│ ❌ Per-route │ ❌ Per-gateway │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

---

## 6. @Inject() PATTERN TRONG GUARDS

### 6.1 Tại sao dùng `@Inject(Reflector)` thay vì chỉ `private reflector: Reflector`?

```typescript
// Lý do: SWC builder + ESLint consistent-type-imports
// SWC không hỗ trợ emitDecoratorMetadata thực sự
// @Inject() nói trực tiếp cho DI: inject class này

constructor(@Inject(Reflector) private reflector: Reflector) {}
//          ^^^^^^^^^^^^^^^^^^
//          Explicit DI token → hoạt động với mọi builder
```

Áp dụng cho tất cả guards trong SSLM:

- JwtAuthGuard: `@Inject(Reflector)`
- RolesGuard: `@Inject(Reflector)`
- WsAuthGuard: `@Inject(JwtService)`, `@Inject(ConfigService)`

---

## 7. TÓM TẮT

```
Guards trong Phase 5.3:

JwtAuthGuard (Authentication):
  ├── extends AuthGuard('jwt') — Passport integration
  ├── Kiểm tra @Public() metadata → bypass nếu public
  ├── Verify JWT token → gắn payload vào request.user
  └── CHƯA register global (chờ Phase 5.4 tạo JWT Strategy)

RolesGuard (Authorization):
  ├── implements CanActivate
  ├── Kiểm tra @Roles() metadata → compare với user.role
  ├── Không có @Roles() → cho phép tất cả
  └── Dùng per-route: @UseGuards(JwtAuthGuard, RolesGuard)

WsAuthGuard (WebSocket Authentication):
  ├── implements CanActivate
  ├── Extract token từ socket handshake
  ├── JwtService.verify() trực tiếp (không qua Passport)
  ├── Gắn userId, role vào client.data
  └── Dùng per-gateway: @UseGuards(WsAuthGuard)
```
