# 01 — JWT Authentication: Access Token, Refresh Token, và Passport.js

> Giải thích cơ chế xác thực JWT trong SSLM, tại sao cần 2 loại token,
> Passport.js integration, và JWT Strategy pattern.

---

## 1. AUTHENTICATION LÀ GÌ?

### 1.1 Concept

**Authentication** (AuthN) = Xác minh danh tính: "Bạn là ai?"

```
Truyền thống (Session-based):
  1. User gửi username + password
  2. Server tạo session, lưu trong memory/database
  3. Server trả về session ID (cookie)
  4. Mỗi request, browser gửi cookie → server lookup session

  Vấn đề:
  ❌ Server phải lưu session → tốn memory
  ❌ Không scale ngang được (server A tạo session, server B không biết)
  ❌ CSRF attack qua cookie
```

```
Hiện đại (Token-based — JWT):
  1. User gửi email + password
  2. Server verify → trả về JWT token
  3. Client lưu token, gửi kèm mỗi request (Authorization header)
  4. Server verify token = valid → cho phép

  Ưu điểm:
  ✅ Stateless — server không lưu gì
  ✅ Scale ngang dễ dàng (mọi server đều verify được)
  ✅ Cross-domain — token gửi qua header, không phải cookie
```

### 1.2 SSLM dùng cả 2 pattern

```
SSLM Authentication Design:
  ├── Access Token  → JWT (stateless, gửi qua Authorization header)
  ├── Refresh Token → Random UUID (stateful, lưu DB, gửi qua httpOnly cookie)
  └── Lý do: Kết hợp ưu điểm của cả 2 pattern
```

---

## 2. JWT (JSON WEB TOKEN)

### 2.1 JWT là gì?

JWT là chuỗi string mã hóa chứa thông tin (claims), có chữ ký số để verify tính toàn vẹn:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHgxLi4uIiwicm9sZSI6IlNUVURFTlQiLCJpYXQiOjE3MTAwMDAwMDAsImV4cCI6MTcxMDAwMDkwMH0.abc123signature
│                                      │                                                                                                │                    │
│          HEADER                      │                           PAYLOAD                                                               │     SIGNATURE      │
│  (Base64URL encoded)                 │                    (Base64URL encoded)                                                           │                    │
```

### 2.2 Ba phần của JWT

```
1. HEADER — Thuật toán và loại token
{
  "alg": "HS256",     // HMAC-SHA256 signing algorithm
  "typ": "JWT"        // Token type
}

2. PAYLOAD — Dữ liệu (claims)
{
  "sub": "clx1abc...",    // Subject — User ID
  "role": "STUDENT",       // Custom claim — User role
  "iat": 1710000000,       // Issued At — thời điểm tạo
  "exp": 1710000900        // Expiration — hết hạn (15 phút sau)
}

3. SIGNATURE — Chữ ký số
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  JWT_ACCESS_SECRET    // Secret key chỉ server biết
)
```

### 2.3 Tại sao JWT an toàn?

```
Scenario: Attacker muốn sửa role từ STUDENT → ADMIN

1. Attacker decode payload (Base64 — ai cũng decode được)
2. Sửa "role": "ADMIN"
3. Encode lại thành JWT mới
4. GỬI request với JWT đã sửa

Server verify:
  a. Tách header.payload ra
  b. Tính lại signature bằng SECRET key
  c. So sánh với signature trong token
  d. KHÔNG KHỚP → Token bị tamper → 401 Unauthorized

Kết luận: Không có SECRET key → không thể tạo signature hợp lệ
```

### 2.4 SSLM JWT Payload

```typescript
// common/interfaces/jwt-payload.interface.ts
interface JwtPayload {
  sub: string; // User ID (subject — chuẩn JWT)
  role: string; // STUDENT | INSTRUCTOR | ADMIN
}
```

**Tại sao chỉ 2 fields?**

```
Payload càng nhỏ → Token càng ngắn → Request càng nhanh
Chỉ chứa thông tin CẦN THIẾT cho authorization:
  - sub (user ID): để biết "ai" đang request
  - role: để biết "quyền gì" user có

KHÔNG chứa:
  ❌ email, fullName, avatarUrl → fetch từ DB khi cần
  ❌ permissions chi tiết → derive từ role
  ❌ sensitive data → nếu token bị lộ, attacker biết ít nhất có thể
```

---

## 3. ACCESS TOKEN vs REFRESH TOKEN

### 3.1 Tại sao cần 2 token?

```
Vấn đề với 1 token:
  TTL ngắn (15 phút) → User phải login lại mỗi 15 phút → UX tệ
  TTL dài (7 ngày)   → Nếu bị lộ, attacker có quyền 7 ngày → Security tệ

Giải pháp: 2 token với mục đích khác nhau
```

### 3.2 So sánh chi tiết

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│                 │   ACCESS TOKEN        │   REFRESH TOKEN       │
├─────────────────┼──────────────────────┼──────────────────────┤
│ Mục đích        │ Xác thực mỗi request │ Lấy access token mới │
│ Format          │ JWT (signed)          │ Random UUID           │
│ TTL             │ 15 phút               │ 7 ngày                │
│ Lưu ở đâu      │ Memory (Zustand)      │ httpOnly cookie       │
│ Gửi qua         │ Authorization header  │ Cookie (tự động)      │
│ Stateless?       │ ✅ Yes               │ ❌ No (lưu DB)        │
│ Revocable?       │ ❌ No (phải chờ hết) │ ✅ Yes (xóa DB)       │
│ Nếu bị lộ       │ 15 phút access       │ 7 ngày access         │
│ Bảo vệ bằng     │ HTTPS + short TTL    │ httpOnly + secure     │
└─────────────────┴──────────────────────┴──────────────────────┘
```

### 3.3 Flow hoàn chỉnh

```
1. LOGIN
   Client: POST /api/auth/login { email, password }
   Server: Verify → Generate tokens
           ├── Access Token  → return trong response body
           └── Refresh Token → set httpOnly cookie

2. NORMAL REQUEST (access token valid)
   Client: GET /api/courses
           Header: Authorization: Bearer eyJhb...
   Server: JwtAuthGuard verify → OK → return data

3. ACCESS TOKEN EXPIRED (sau 15 phút)
   Client: GET /api/courses
           Header: Authorization: Bearer eyJhb... (expired)
   Server: 401 Unauthorized

4. AUTO REFRESH
   Client: POST /api/auth/refresh
           Cookie: refreshToken=uuid-abc-123 (tự động gửi)
   Server: Lookup DB → Valid → Rotate tokens
           ├── New Access Token  → response body
           └── New Refresh Token → set cookie (token rotation)

5. RETRY ORIGINAL REQUEST
   Client: GET /api/courses
           Header: Authorization: Bearer eyJnew... (new token)
   Server: OK → return data

6. REFRESH TOKEN EXPIRED (sau 7 ngày)
   Client: POST /api/auth/refresh
           Cookie: refreshToken=uuid-old (expired in DB)
   Server: 401 → Client redirect to /login
```

### 3.4 Token Rotation — Tại sao?

```
Mỗi lần refresh:
  1. Xóa refresh token cũ khỏi DB
  2. Tạo refresh token MỚI
  3. Return access token mới + set cookie mới

Tại sao không reuse cùng refresh token?
  → Nếu attacker đánh cắp refresh token
  → Attacker dùng → server issue token mới cho attacker
  → User dùng token cũ → KHÔNG TÌM THẤY trong DB → 401
  → User phải login lại → biết có vấn đề
  → Attacker cũng chỉ dùng được 1 lần

Đây là "Refresh Token Rotation" — phát hiện theft qua reuse detection.
```

---

## 4. PASSPORT.JS & JWT STRATEGY

### 4.1 Passport.js trong NestJS

```
Passport.js = Authentication framework
  │
  ├── Core: Quản lý authentication flow
  │
  └── Strategies: Plugin cho từng auth method
      ├── passport-jwt       → Verify JWT token
      ├── passport-local     → Verify email + password
      ├── passport-google    → Google OAuth 2.0
      └── ... 500+ strategies

NestJS wrapper: @nestjs/passport
  → Biến Passport strategies thành NestJS Guards
  → Tích hợp với DI system
```

### 4.2 JWT Strategy trong SSLM

```typescript
// strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtAccessSecret'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return { sub: payload.sub, role: payload.role };
  }
}
```

### 4.3 Phân tích từng phần

**`PassportStrategy(Strategy)`:**

```typescript
import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';

// PassportStrategy(Strategy) tạo class kết hợp:
// - NestJS Injectable (DI support)
// - Passport Strategy (authentication logic)
// Strategy name mặc định: "jwt" (từ passport-jwt)
```

**`super()` options:**

```typescript
super({
  // 1. Lấy token từ đâu?
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  // → Đọc header: "Authorization: Bearer <token>"
  // → Extract phần <token>

  // 2. Có bỏ qua expiration không?
  ignoreExpiration: false,
  // → KHÔNG — token hết hạn = invalid

  // 3. Secret key để verify signature
  secretOrKey: configService.getOrThrow<string>('auth.jwtAccessSecret'),
  // → Dùng getOrThrow: nếu thiếu config → throw ngay khi app start
  // → Không dùng get() vì: undefined secret → mọi token đều invalid
});
```

**`validate()` method:**

```typescript
validate(payload: JwtPayload): JwtPayload {
  return { sub: payload.sub, role: payload.role };
}
```

```
Passport gọi validate() SAU KHI:
  ✅ Token extracted thành công
  ✅ Signature verified
  ✅ Expiration checked

validate() nhận payload đã decode:
  { sub: "clx1...", role: "STUDENT", iat: 17100..., exp: 17100... }

Return value → gắn vào request.user:
  { sub: "clx1...", role: "STUDENT" }
  // Bỏ iat, exp vì controller không cần

Nếu validate() throw error → 401 Unauthorized
```

### 4.4 Tại sao constructor không lưu configService?

```typescript
// ✅ SSLM — configService chỉ dùng trong super()
constructor(@Inject(ConfigService) configService: ConfigService) {
  super({ secretOrKey: configService.getOrThrow(...) });
  // configService không cần sau đây → không lưu vào class property
}

// So sánh với AuthService — cần configService nhiều lần
constructor(
  @Inject(ConfigService) private readonly config: ConfigService,
  //                      ^^^^^^^^^^^^^^^^^ lưu vào this.config
) {}
```

---

## 5. JwtAuthGuard — GLOBAL AUTHENTICATION

### 5.1 Flow trong SSLM

```
Mỗi HTTP request đến server:
    │
    ▼
ThrottlerGuard (rate limit check)
    │
    ▼
JwtAuthGuard
    ├── Check @Public() metadata?
    │   ├── YES → return true (skip auth)
    │   └── NO → delegate to Passport JWT Strategy
    │              ├── Extract token từ header
    │              ├── Verify signature + expiration
    │              ├── Call validate() → request.user
    │              └── Return true | throw 401
    │
    ▼
RolesGuard (nếu route có @Roles())
    ├── Read @Roles() metadata
    ├── Compare request.user.role
    └── Return true | throw 403
    │
    ▼
Controller Handler
```

### 5.2 @Public() decorator bypass

```
SSLM đăng ký JwtAuthGuard GLOBAL → mọi route đều cần JWT.
Nhưng một số routes phải public:

@Public() routes (không cần token):
  POST /auth/register      → Ai cũng đăng ký được
  POST /auth/login         → Chưa có token để gửi
  POST /auth/refresh       → Dùng cookie, không dùng access token
  POST /auth/verify-email  → Click link từ email
  POST /auth/forgot-password
  POST /auth/reset-password
  POST /auth/ott/validate

Protected routes (cần token):
  GET  /auth/ott           → Phải biết user ID để tạo OTT
  POST /auth/logout        → Phải biết user để log
  GET  /courses            → (future) cần personalization
```

### 5.3 Global Guard Registration

```typescript
// app.module.ts
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

**`APP_GUARD` token:**

```
NestJS cung cấp special DI token APP_GUARD.
Mỗi provider dùng APP_GUARD → tự động apply cho MỌI route.

Thứ tự execution: theo thứ tự khai báo
  1. ThrottlerGuard (rate limit) — chặn spam trước khi verify JWT
  2. JwtAuthGuard (authentication) — verify identity

Tại sao ThrottlerGuard TRƯỚC JwtAuthGuard?
  → Rate limit check nhẹ hơn JWT verify
  → Chặn brute force TRƯỚC khi tốn CPU verify token
  → Defense in depth
```

---

## 6. httpOnly COOKIE — BẢO VỆ REFRESH TOKEN

### 6.1 Tại sao refresh token trong cookie?

```
Access Token → Memory (Zustand store):
  ✅ Không accessible bởi JavaScript khác (closure)
  ❌ Mất khi refresh page → cần refresh token

Refresh Token → httpOnly Cookie:
  ✅ Browser tự động gửi kèm request → không cần code
  ✅ httpOnly → JavaScript KHÔNG thể đọc → XSS-proof
  ✅ Persist qua page refresh
  ❌ Có thể bị CSRF → mitigated bằng sameSite: strict

KHÔNG LƯU TOKEN TRONG:
  ❌ localStorage → XSS attack đọc được
  ❌ sessionStorage → XSS attack đọc được
  ❌ Regular cookie → XSS attack đọc được (document.cookie)
```

### 6.2 Cookie options trong SSLM

```typescript
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true, // JavaScript không đọc được
  secure: process.env.NODE_ENV === 'production', // HTTPS only trong production
  sameSite: 'strict' as const, // Chỉ gửi cho same origin
  path: '/api/auth', // Chỉ gửi cho auth endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
};
```

**Giải thích từng option:**

| Option     | Value           | Tại sao                                                          |
| ---------- | --------------- | ---------------------------------------------------------------- |
| `httpOnly` | `true`          | XSS protection — `document.cookie` không thấy                    |
| `secure`   | production only | Development dùng HTTP (localhost), production bắt buộc HTTPS     |
| `sameSite` | `'strict'`      | CSRF protection — browser chỉ gửi cookie cho request same-origin |
| `path`     | `'/api/auth'`   | Cookie chỉ gửi cho auth endpoints — không leak cho routes khác   |
| `maxAge`   | 7 ngày          | Khớp với refresh token TTL trong DB                              |

### 6.3 `path: '/api/auth'` — Scope nhỏ nhất

```
Browser gửi cookie KHI VÀ CHỈ KHI request URL match path:

  POST /api/auth/refresh    → ✅ Gửi cookie (match /api/auth)
  POST /api/auth/logout     → ✅ Gửi cookie
  GET  /api/courses         → ❌ Không gửi cookie (/api/courses ≠ /api/auth)
  GET  /api/users/profile   → ❌ Không gửi cookie

Lý do: Principle of Least Privilege
  → Cookie chỉ đến nơi CẦN nó (auth endpoints)
  → Giảm attack surface
```

---

## 7. `cookie-parser` MIDDLEWARE

### 7.1 Tại sao cần?

```typescript
// main.ts
import cookieParser from 'cookie-parser';
app.use(cookieParser());
```

```
Express/NestJS mặc định KHÔNG parse cookies.
req.cookies → undefined

Sau khi thêm cookie-parser:
  1. Đọc header "Cookie: refreshToken=uuid-abc-123; other=value"
  2. Parse thành object: { refreshToken: "uuid-abc-123", other: "value" }
  3. Gắn vào req.cookies

Controller access:
  req.cookies?.refreshToken → "uuid-abc-123"
```

### 7.2 Packages cần install

```bash
npm install cookie-parser         # Runtime dependency
npm install -D @types/cookie-parser  # TypeScript types
```

---

## 8. TWO SECRETS STRATEGY

### 8.1 Tại sao 2 JWT secrets?

```
JWT_ACCESS_SECRET  → Ký access token (15 min)
JWT_REFRESH_SECRET → Dùng cho tương lai (Google OAuth, etc.)

SSLM hiện tại:
  Access Token:  JWT signed với JWT_ACCESS_SECRET
  Refresh Token: Random UUID (KHÔNG phải JWT) → lưu DB

Tại sao refresh token là UUID, không phải JWT?
  → JWT stateless → KHÔNG thể revoke
  → Refresh token CẦN revocable (logout = xóa khỏi DB)
  → UUID + DB lookup = stateful + revocable
  → Best of both worlds
```

### 8.2 Defense in Depth

```
Scenario: JWT_ACCESS_SECRET bị lộ
  → Attacker tạo được access token giả
  → Nhưng access token hết hạn sau 15 phút
  → Refresh token vẫn an toàn (UUID, lưu DB)
  → Admin đổi secret → tất cả access token cũ invalid ngay lập tức
  → Refresh flow vẫn hoạt động (không dùng secret)

Scenario: Database bị lộ (refresh tokens)
  → Attacker có UUID refresh tokens
  → Nhưng không biết JWT_ACCESS_SECRET → không tạo được access token
  → Admin xóa toàn bộ refresh tokens → force re-login
  → User password vẫn an toàn (bcrypt hash)
```

---

## 9. TÓM TẮT

```
JWT Authentication trong SSLM:

1. Token Design:
   ├── Access Token: JWT (stateless, 15 min, Authorization header)
   ├── Refresh Token: UUID (stateful, 7 days, httpOnly cookie)
   └── Token Rotation: mỗi refresh tạo cặp token mới

2. Passport.js Integration:
   ├── JwtStrategy: extract + verify + validate
   ├── JwtAuthGuard: global guard + @Public() bypass
   └── RolesGuard: per-route RBAC

3. Security Layers:
   ├── httpOnly cookie: XSS protection cho refresh token
   ├── sameSite strict: CSRF protection
   ├── path scoping: chỉ gửi cookie cho /api/auth
   ├── Token rotation: detect theft qua reuse
   ├── 2 secrets: defense in depth
   └── Short TTL: giới hạn damage nếu access token lộ

4. Cookie Parser:
   ├── Middleware parse Cookie header → req.cookies
   └── Required cho refresh token flow
```
