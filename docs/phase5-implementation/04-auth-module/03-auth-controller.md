# 03 — Auth Controller: HTTP Layer, Cookie Management, và DTO Validation

> Giải thích AuthController — thin controller pattern, cookie handling, DTO imports với ESLint,
> Swagger decorators, và response format.

---

## 1. THIN CONTROLLER PATTERN

### 1.1 Concept

```
Controller = HTTP adapter layer
  Nhiệm vụ DUY NHẤT:
  ├── Parse request (body, params, query, cookies, IP)
  ├── Call service method
  ├── Set/clear cookies
  └── Return response

  KHÔNG ĐƯỢC:
  ❌ Chứa business logic
  ❌ Query database
  ❌ Validate business rules
  ❌ Generate tokens
```

### 1.2 SSLM AuthController ví dụ

```typescript
// ✅ Thin controller — chỉ xử lý HTTP concerns
@Post('login')
async login(@Body() dto: LoginDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
  // 1. Call service (delegate business logic)
  const result = await this.authService.login(dto, ip);

  // 2. Set cookie (HTTP concern)
  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  // 3. Return response (filter sensitive data)
  return {
    accessToken: result.accessToken,
    user: result.user,
    // ❌ refreshToken KHÔNG trả trong body — chỉ qua cookie
  };
}
```

### 1.3 Tại sao Thin Controller?

```
1. Testability:
   Service test → mock Prisma, Redis, JWT → test business logic
   Controller test → mock Service → test HTTP behavior (cookie, response)
   Tách biệt → dễ test từng layer

2. Reusability:
   AuthService.login() có thể gọi từ:
     ├── AuthController (HTTP)
     ├── AuthGateway (WebSocket)
     └── CLI command (batch operations)
   Business logic không bị tie vào HTTP

3. Single Responsibility:
   Controller biết HTTP, không biết bcrypt
   Service biết business rules, không biết cookies
```

---

## 2. DTO IMPORTS — ESLint CONSISTENT-TYPE-IMPORTS

### 2.1 Vấn đề

```typescript
// ESLint rule: @typescript-eslint/consistent-type-imports
// Quy tắc: nếu import chỉ dùng cho type annotation → phải dùng "import type"

// Auth Service — DTOs chỉ dùng cho type annotation (param types)
import type { RegisterDto } from './dto/register.dto';  // ✅ ESLint happy
async register(dto: RegisterDto) {}
//                  ^^^^^^^^^^^^ chỉ dùng cho type → import type OK

// Auth Controller — DTOs dùng trong @Body() decorator
import { RegisterDto } from './dto/register.dto';  // ❌ ESLint muốn "import type"
async register(@Body() dto: RegisterDto) {}
//                          ^^^^^^^^^^^^ ESLint nghĩ chỉ dùng cho type
```

### 2.2 Tại sao Controller PHẢI dùng value import?

```
NestJS SWC builder + ValidationPipe:

1. SWC builder có decoratorMetadata: true (nest-cli.json default)
2. Khi compile, SWC emit metadata cho parameter types
3. ValidationPipe đọc metadata để biết DTO class nào → instantiate → validate

4. Nếu dùng "import type { RegisterDto }":
   → TypeScript STRIP import ở compile time (type-only)
   → Runtime: RegisterDto = undefined
   → ValidationPipe: "Cannot validate undefined" → crash

5. Phải dùng value import:
   → Runtime: RegisterDto = class RegisterDto { ... }
   → ValidationPipe: instantiate → validate decorators → OK
```

### 2.3 Solution trong SSLM

```typescript
// DTOs must be value imports — ValidationPipe needs runtime class reference (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from './dto/register.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from './dto/login.dto';
// ... (6 DTOs, mỗi cái 1 eslint-disable)
```

```
Giải pháp: eslint-disable cho từng import

Tại sao không tắt rule globally?
  → Rule vẫn hữu ích cho 99% imports
  → Chỉ DTO imports trong controller cần exception
  → Comment giải thích TẠI SAO disable → future dev hiểu

Tại sao không dùng eslint override trong config?
  → Quá phức tạp cho pattern cụ thể này
  → inline disable + comment rõ ràng hơn
```

### 2.4 Service vs Controller imports

```
AuthService:
  import type { RegisterDto } from './dto/register.dto';
  //     ^^^^
  // Service KHÔNG cần runtime class — chỉ dùng cho TypeScript type checking
  // SWC không cần metadata cho service method params
  // ESLint happy ✅

AuthController:
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  import { RegisterDto } from './dto/register.dto';
  // Controller CẦN runtime class cho @Body() + ValidationPipe
  // ESLint disabled per-line ✅
```

---

## 3. COOKIE MANAGEMENT

### 3.1 REFRESH_COOKIE_OPTIONS constant

```typescript
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
```

```
DRY principle — constant dùng ở 3 chỗ:
  1. login() → res.cookie('refreshToken', token, OPTIONS)
  2. refresh() → res.cookie('refreshToken', newToken, OPTIONS)
  3. validateOtt() → res.cookie('refreshToken', token, OPTIONS)

"as const" trên 'strict':
  TypeScript infer 'strict' as string → không match CookieOptions.sameSite
  'strict' as const → literal type 'strict' → match union type
```

### 3.2 Set Cookie

```typescript
res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
```

```
Browser nhận Set-Cookie header:
  Set-Cookie: refreshToken=uuid-abc-123; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

Browser tự động:
  → Lưu cookie
  → Gửi kèm mọi request đến /api/auth/*
  → KHÔNG cho JavaScript đọc (httpOnly)
```

### 3.3 Clear Cookie (logout)

```typescript
res.clearCookie('refreshToken', { path: '/api/auth' });
```

```
clearCookie gửi:
  Set-Cookie: refreshToken=; Path=/api/auth; Max-Age=0

Browser nhận Max-Age=0 → xóa cookie ngay lập tức

QUAN TRỌNG: path PHẢI match!
  Set cookie với path: '/api/auth'
  Clear cookie cũng phải path: '/api/auth'
  Nếu path khác → browser coi là cookie khác → không xóa
```

### 3.4 Response format — refreshToken KHÔNG trong body

```typescript
// Login response:
return {
  accessToken: result.accessToken,
  user: result.user,
  // ❌ refreshToken KHÔNG có ở đây
};
```

```
Tại sao refreshToken không trả trong response body?
  → Body accessible bởi JavaScript
  → XSS attack có thể đọc response body
  → refreshToken CHỈ truyền qua httpOnly cookie
  → JavaScript KHÔNG THỂ đọc httpOnly cookie
  → Defense in depth
```

---

## 4. PARAMETER DECORATORS

### 4.1 @Body() — Request Body

```typescript
@Post('register')
async register(@Body() dto: RegisterDto) {}
```

```
Flow:
  1. Client gửi POST với JSON body: { email: "a@b.com", password: "Abc123" }
  2. @Body() → NestJS extract request body
  3. ValidationPipe (global):
     a. Instantiate RegisterDto from JSON
     b. Run class-validator decorators:
        @IsEmail() trên email → valid ✅
        @MinLength(8) trên password → "Abc123" (6 chars) → fail ❌
     c. Throw BadRequestException với validation errors
  4. Nếu pass → dto object sẵn sàng
```

### 4.2 @Ip() — Client IP

```typescript
@Post('login')
async login(@Body() dto: LoginDto, @Ip() ip: string, ...) {}
```

```
NestJS @Ip() extract client IP address:
  → req.ip (Express underlying)
  → Dùng cho rate limiting: "login_attempts:{ip}"

Lưu ý production:
  Nếu có reverse proxy (Nginx, Cloudflare):
    req.ip = proxy IP (không phải client)
    Cần: app.set('trust proxy', 1) → đọc X-Forwarded-For header
```

### 4.3 @Req() / @Res() — Raw Request/Response

```typescript
@Post('refresh')
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {}
```

```
@Req() → Express Request object (đọc cookies, headers, etc.)
  req.cookies?.refreshToken → đọc cookie

@Res({ passthrough: true }) → Express Response object (set cookies)
  res.cookie('name', 'value', options) → set cookie
  res.clearCookie('name') → clear cookie

QUAN TRỌNG: passthrough: true
  Mặc định @Res() → NestJS NGỪNG auto-send response
  → Developer phải res.send() / res.json() manually

  passthrough: true → NestJS VẪN auto-send return value
  → res.cookie() chỉ set header, return value thành response body
  → Best of both worlds
```

### 4.4 @CurrentUser() — Custom Decorator

```typescript
@Get('ott')
async generateOtt(@CurrentUser() user: JwtPayload) {}
```

```
@CurrentUser() = custom parameter decorator (từ Phase 5.3)
  → Extract request.user (gắn bởi JwtAuthGuard/Passport)
  → Return JwtPayload { sub: "userId", role: "STUDENT" }

Flow:
  1. JwtAuthGuard verify JWT → gắn payload vào request.user
  2. @CurrentUser() → return request.user
  3. Controller nhận typed JwtPayload
```

---

## 5. SWAGGER DECORATORS

### 5.1 @ApiTags() và @ApiOperation()

```typescript
@Controller('auth')
@ApiTags('Auth')                                              // Nhóm endpoints
export class AuthController {

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })       // Mô tả endpoint
  async register(@Body() dto: RegisterDto) {}
```

```
Swagger UI (http://localhost:3000/api/docs):

Auth                                    ← @ApiTags('Auth')
  ├── POST /api/auth/register           ← Register a new account
  ├── POST /api/auth/login              ← Login with email and password
  ├── POST /api/auth/refresh            ← Refresh access token
  ├── POST /api/auth/logout             ← Logout and invalidate refresh token
  ├── POST /api/auth/verify-email       ← Verify email with token
  ├── POST /api/auth/forgot-password    ← Send password reset email
  ├── POST /api/auth/reset-password     ← Reset password with token
  ├── GET  /api/auth/ott               ← Generate one-time token
  └── POST /api/auth/ott/validate      ← Validate OTT and get tokens
```

### 5.2 DTO → Swagger Request Body

```typescript
// RegisterDto class-validator decorators tự động generate Swagger schema:
export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
  // Swagger: { email: { type: "string", example: "user@example.com" } }
}
```

---

## 6. ENDPOINT ANALYSIS — 9 ENDPOINTS

```
┌──────────────────────────────────────────────────────────────────┐
│                       AUTH ENDPOINTS                              │
├──────────┬─────────┬──────────────────┬─────────────────────────┤
│ Method   │ @Public │ Route            │ Response                 │
├──────────┼─────────┼──────────────────┼─────────────────────────┤
│ POST     │ ✅      │ /register        │ { message }              │
│ POST     │ ✅      │ /login           │ { accessToken, user }    │
│          │         │                  │ + Set-Cookie             │
│ POST     │ ✅      │ /refresh         │ { accessToken }          │
│          │         │                  │ + Set-Cookie (rotation)  │
│ POST     │ ❌      │ /logout          │ { message }              │
│          │         │                  │ + Clear-Cookie           │
│ POST     │ ✅      │ /verify-email    │ { message }              │
│ POST     │ ✅      │ /forgot-password │ { message }              │
│ POST     │ ✅      │ /reset-password  │ { message }              │
│ GET      │ ❌      │ /ott             │ { ott }                  │
│ POST     │ ✅      │ /ott/validate    │ { accessToken, user }    │
│          │         │                  │ + Set-Cookie             │
└──────────┴─────────┴──────────────────┴─────────────────────────┘

@Public routes: 7/9 — hầu hết auth endpoints không cần JWT
Protected routes: logout (cần biết session), ott (cần biết user)
```

---

## 7. TÓM TẮT

```
AuthController — Thin HTTP adapter:

Pattern:
  ├── Thin controller: parse request → call service → set cookie → return
  ├── NO business logic in controller
  └── Service handles: validation, DB, hashing, tokens

DTO Imports:
  ├── Controller: value import + eslint-disable (ValidationPipe cần runtime class)
  ├── Service: import type (chỉ cần TypeScript type)
  └── Comment giải thích tại sao disable ESLint

Cookie Management:
  ├── REFRESH_COOKIE_OPTIONS constant (DRY)
  ├── httpOnly + secure + sameSite strict + path scoped
  ├── refreshToken KHÔNG trong response body (XSS protection)
  └── clearCookie phải match path

Swagger:
  ├── @ApiTags('Auth') → group endpoints
  ├── @ApiOperation → describe each endpoint
  └── @ApiProperty on DTOs → auto-generate request schema
```
