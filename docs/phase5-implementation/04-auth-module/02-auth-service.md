# 02 — Auth Service: Business Logic, Token Management, và Security Patterns

> Giải thích chi tiết AuthService — 9 methods, security patterns (rate limiting, email enumeration,
> password hashing), token generation, và cách các dependencies phối hợp.

---

## 1. TỔNG QUAN AUTH SERVICE

### 1.1 Vai trò

AuthService chứa **toàn bộ business logic** của authentication module. Controller chỉ xử lý HTTP concerns (parse request, set cookie), rồi delegate cho service.

```
Controller (thin):
  ├── Parse request body/params/cookies
  ├── Call service method
  ├── Set/clear cookies
  └── Return response

Service (fat):
  ├── Validate business rules
  ├── Query/update database
  ├── Hash passwords
  ├── Generate tokens
  ├── Send emails
  └── Rate limiting
```

### 1.2 Dependencies (5 services)

```typescript
constructor(
  @Inject(PrismaService) private readonly prisma: PrismaService,    // Database
  @Inject(JwtService) private readonly jwt: JwtService,              // JWT signing
  @Inject(ConfigService) private readonly config: ConfigService,     // Environment config
  @Inject(RedisService) private readonly redis: RedisService,        // Cache + rate limit
  @Inject(MailService) private readonly mail: MailService,           // Email sending
) {}
```

```
Dependency Map:

AuthService
    │
    ├── PrismaService → User table, RefreshToken table
    │                    (CRUD operations, findUnique, create, update, delete)
    │
    ├── JwtService → jwt.sign() — tạo access token
    │                (from @nestjs/jwt, wraps jsonwebtoken)
    │
    ├── ConfigService → JWT secrets, token TTL, app URLs
    │                   (from @nestjs/config, namespaced config)
    │
    ├── RedisService → Rate limiting (checkRateLimit, del)
    │                   OTT storage (setex, get, del)
    │
    └── MailService → sendVerificationEmail()
                      sendResetPasswordEmail()
```

### 1.3 `USER_SAFE_SELECT` constant

```typescript
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  avatarUrl: true,
} as const;
```

```
User table chứa nhiều fields nhạy cảm:
  ❌ passwordHash      → KHÔNG BAO GIỜ trả về client
  ❌ verificationToken  → Token nội bộ
  ❌ resetToken         → Token nội bộ
  ❌ googleId           → Không cần thiết
  ❌ deletedAt          → Soft delete flag

USER_SAFE_SELECT đảm bảo:
  → Mọi chỗ trả user data đều dùng constant này
  → Nếu cần thêm/bớt field → sửa 1 chỗ duy nhất
  → DRY principle — không copy-paste select object

`as const` → TypeScript infer literal types (readonly)
```

---

## 2. REGISTER — ĐĂNG KÝ TÀI KHOẢN

### 2.1 Flow

```
POST /api/auth/register
  Body: { email, password, fullName }

Step 1: Check email chưa tồn tại
  │ findUnique({ email }) → found?
  │ ├── YES → 409 Conflict { code: 'EMAIL_ALREADY_EXISTS' }
  │ └── NO → tiếp tục
  │
Step 2: Hash password
  │ bcrypt.hash(password, BCRYPT_ROUNDS)
  │ → "$2a$12$..." (60 chars hash)
  │
Step 3: Generate verification token
  │ crypto.randomUUID() → "a1b2c3d4-..."
  │ Tính expiry: now + 24 hours
  │
Step 4: Create user (status: UNVERIFIED)
  │ prisma.user.create({ email, passwordHash, fullName, verificationToken, ... })
  │
Step 5: Send verification email
  │ mail.sendVerificationEmail(email, token)
  │ → User nhận email với link: /auth/verify-email?token=a1b2c3d4
  │
Return: { message: 'REGISTER_SUCCESS' }
```

### 2.2 Password Hashing — bcryptjs

```typescript
const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
```

**Tại sao hash password?**

```
Nếu lưu plaintext password trong DB:
  → DB bị hack → attacker có TẤT CẢ mật khẩu
  → User thường dùng chung password → compromised ở mọi nơi

Hash = one-way function:
  "Password123" → "$2a$12$LJ3m..." (không thể reverse)

Verify: hash("Password123") === stored_hash? → true/false
  Không cần biết mật khẩu gốc để verify
```

**bcryptjs vs bcrypt:**

```
bcrypt (native):
  ✅ Nhanh hơn (C++ binding)
  ❌ Cần node-gyp, Python, C++ compiler
  ❌ Build fails trên một số OS/platform
  ❌ Docker image lớn hơn

bcryptjs (pure JavaScript):
  ✅ Zero native dependencies
  ✅ Install đơn giản, portable
  ❌ Chậm hơn ~30% (acceptable cho auth)

SSLM chọn bcryptjs vì: graduation thesis, đơn giản là ưu tiên.
```

**BCRYPT_ROUNDS = 12:**

```
Salt rounds (cost factor) quyết định hash MẤT BAO LÂU:

  Rounds | Time per hash
  -------+-------------
    10   |   ~65ms
    12   |  ~250ms    ← SSLM dùng
    14   |    ~1s
    16   |    ~4s

Càng nhiều rounds → càng chậm → brute force càng khó
12 rounds = cân bằng giữa security và UX (user chờ login ~250ms)
```

### 2.3 Verification Token — crypto.randomUUID()

```typescript
const verificationToken = crypto.randomUUID();
// → "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

```
crypto.randomUUID():
  → Built-in Node.js (không cần package)
  → UUID v4 format (128-bit random)
  → Cryptographically secure (CSPRNG)
  → 2^122 possible values → collision gần như impossible

Tại sao không dùng JWT cho verification token?
  → Verification token stateful (lưu DB, xóa sau khi dùng)
  → Đơn giản hơn: random string + DB lookup
  → Không cần thêm claims/signing
```

---

## 3. LOGIN — ĐĂNG NHẬP

### 3.1 Flow chi tiết

```
POST /api/auth/login
  Body: { email, password }
  IP: extracted bởi @Ip() decorator

Step 1: Rate Limiting (chống brute force)
  │ key = "login_attempts:{ip}"
  │ redis.checkRateLimit(key, 5, 60)
  │ ├── < 5 attempts trong 60s → OK
  │ └── >= 5 attempts → 400 { code: 'TOO_MANY_LOGIN_ATTEMPTS' }
  │
Step 2: Find user by email
  │ prisma.user.findUnique({ email })
  │ ├── Not found → 401 { code: 'INVALID_CREDENTIALS' }
  │ └── Found → check status
  │
Step 3: Check account status
  │ ├── UNVERIFIED → 401 { code: 'EMAIL_NOT_VERIFIED' }
  │ ├── SUSPENDED  → 401 { code: 'ACCOUNT_SUSPENDED' }
  │ └── ACTIVE     → tiếp tục
  │
Step 4: Verify password
  │ bcrypt.compare(password, user.passwordHash)
  │ ├── false → 401 { code: 'INVALID_CREDENTIALS' }
  │ └── true  → tiếp tục
  │
Step 5: Generate tokens
  │ ├── Access Token: JWT signed (15 min)
  │ └── Refresh Token: UUID stored in DB (7 days)
  │
Step 6: Reset rate limit on success
  │ redis.del(key) → xóa counter
  │
Return: { accessToken, refreshToken, user: { id, email, fullName, role, avatarUrl } }
```

### 3.2 Rate Limiting — Chống Brute Force

```typescript
const rateLimitKey = `login_attempts:${ip}`;
const allowed = await this.redis.checkRateLimit(
  rateLimitKey,
  LOGIN_RATE_LIMIT, // 5 attempts
  LOGIN_RATE_WINDOW_SECONDS, // 60 seconds
);
```

```
Redis key: "login_attempts:192.168.1.100"
  Mỗi login attempt → increment counter
  Counter > 5 trong 60s → block

Flow:
  Attempt 1: counter = 1 → ✅
  Attempt 2: counter = 2 → ✅
  ...
  Attempt 5: counter = 5 → ✅ (last chance)
  Attempt 6: counter = 6 → ❌ TOO_MANY_LOGIN_ATTEMPTS

Sau 60 giây: Redis key expire → counter reset → thử lại được

Tại sao rate limit bằng IP, không phải email?
  → Attacker có thể thử nhiều email từ 1 IP
  → IP-based chặn tất cả attempts từ cùng source
  → Email-based: attacker lock account người khác (DoS)
```

**Reset on success:**

```typescript
await this.redis.del(rateLimitKey);
```

```
Login thành công → xóa counter
→ User bình thường: 1-2 lần thử → login → counter reset
→ Chỉ chặn khi thật sự spam 5+ lần
```

### 3.3 Timing Attack Prevention

```typescript
if (!user || !user.passwordHash) {
  throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
}
// ... verify password ...
if (!valid) {
  throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
}
```

```
Cùng 1 error code 'INVALID_CREDENTIALS' cho cả:
  - Email không tồn tại
  - Password sai

Tại sao? → Email enumeration prevention
  Nếu trả "EMAIL_NOT_FOUND" → attacker biết email nào tồn tại
  Nếu trả "WRONG_PASSWORD" → attacker biết email đúng, chỉ cần brute force password

Cùng response → attacker không phân biệt được 2 case
```

### 3.4 Account Status Check

```typescript
if (user.status === 'UNVERIFIED') {
  throw new UnauthorizedException({ code: 'EMAIL_NOT_VERIFIED' });
}
if (user.status === 'SUSPENDED') {
  throw new UnauthorizedException({ code: 'ACCOUNT_SUSPENDED' });
}
```

```
UserStatus enum:
  UNVERIFIED → Mới register, chưa verify email
  ACTIVE     → Đã verify, sử dụng bình thường
  SUSPENDED  → Admin ban/suspend

Check status TRƯỚC verify password:
  → Tránh tốn CPU hash compare cho banned users
  → Trả error cụ thể để frontend hiển thị đúng message
  → "EMAIL_NOT_VERIFIED" → frontend show "Kiểm tra email để xác thực"
  → "ACCOUNT_SUSPENDED" → frontend show "Tài khoản bị tạm khóa"
```

---

## 4. REFRESH — TOKEN ROTATION

### 4.1 Flow

```typescript
async refresh(refreshTokenValue: string) {
  const storedToken = await this.prisma.refreshToken.findUnique({
    where: { token: refreshTokenValue },
    include: { user: true },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN' });
  }

  // Rotate: delete old, create new
  await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const accessToken = this.generateAccessToken(storedToken.user.id, storedToken.user.role);
  const newRefreshToken = await this.generateRefreshToken(storedToken.user.id);

  return { accessToken, refreshToken: newRefreshToken };
}
```

### 4.2 Phân tích

```
1. Lookup: findUnique({ token }) + include user
   → 1 query thay vì 2 (token lookup + user lookup)
   → Prisma JOIN internally

2. Validation:
   ├── !storedToken → token không tồn tại (đã dùng hoặc fake)
   └── expiresAt < new Date() → token hết hạn trong DB

3. Rotation:
   a. DELETE old token → one-time use
   b. Generate new access token
   c. Generate new refresh token (new UUID, new DB record)
   d. Return cả hai

4. Controller set new cookie → browser tự động update
```

---

## 5. LOGOUT — HỦY SESSION

```typescript
async logout(refreshTokenValue: string) {
  await this.prisma.refreshToken.deleteMany({
    where: { token: refreshTokenValue },
  });
  return { message: 'LOGOUT_SUCCESS' };
}
```

```
deleteMany thay vì delete:
  → deleteMany không throw nếu token không tồn tại
  → delete throws RecordNotFound → cần try/catch
  → deleteMany an toàn hơn cho logout flow

Controller cũng clearCookie → browser xóa cookie
→ Cả server-side (DB) và client-side (cookie) đều clean
```

---

## 6. EMAIL VERIFICATION

### 6.1 Verify Email

```typescript
async verifyEmail(token: string) {
  const user = await this.prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw new BadRequestException({ code: 'INVALID_VERIFICATION_TOKEN' });
  }

  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      status: 'ACTIVE',
      verificationToken: null,
      verificationExpiresAt: null,
    },
  });

  return { message: 'EMAIL_VERIFIED' };
}
```

```
findFirst thay vì findUnique:
  → verificationToken không phải @unique trong schema
  → findFirst + where condition để tìm

2 conditions trong where:
  1. verificationToken === token → match token
  2. verificationExpiresAt > now → chưa hết hạn (24 hours)

Sau verify:
  → status: UNVERIFIED → ACTIVE (user có thể login)
  → verificationToken: null (one-time use)
  → verificationExpiresAt: null (cleanup)
```

### 6.2 Forgot Password — Anti-Enumeration

```typescript
async forgotPassword(email: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  // Always return success to prevent email enumeration
  if (!user) return { message: 'RESET_EMAIL_SENT' };

  const resetToken = crypto.randomUUID();
  const resetTokenExpiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await this.prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiresAt },
  });

  await this.mail.sendResetPasswordEmail(email, resetToken);

  return { message: 'RESET_EMAIL_SENT' };
}
```

```
CRITICAL SECURITY PATTERN: Anti-Enumeration

❌ Không an toàn:
  if (!user) throw new NotFoundException('Email not found');
  → Attacker: thử "alice@gmail.com" → "Not found" → email không tồn tại
  → Thử "bob@gmail.com" → "Reset email sent" → email tồn tại!
  → Attacker biết user nào tồn tại trong hệ thống

✅ An toàn (SSLM):
  if (!user) return { message: 'RESET_EMAIL_SENT' };
  → DÙ email tồn tại hay không, response GIỐNG HỆT NHAU
  → Attacker không phân biệt được

  Email tồn tại → gửi email reset + response 'RESET_EMAIL_SENT'
  Email không tồn tại → KHÔNG gửi email + response 'RESET_EMAIL_SENT'
  → Client thấy cùng response → không leak thông tin
```

### 6.3 Reset Password

```typescript
async resetPassword(dto: ResetPasswordDto) {
  const user = await this.prisma.user.findFirst({
    where: {
      resetToken: dto.token,
      resetTokenExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw new BadRequestException({ code: 'INVALID_RESET_TOKEN' });
  }

  const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  // Invalidate all refresh tokens for security
  await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  return { message: 'PASSWORD_RESET_SUCCESS' };
}
```

```
Sau reset password:
  1. Hash new password → update DB
  2. Clear reset token → one-time use
  3. DELETE ALL refresh tokens cho user này

Tại sao xóa tất cả refresh tokens?
  → Password changed = tất cả sessions phải bị invalidate
  → Nếu attacker có refresh token cũ → vô dụng
  → User phải login lại với password mới
  → Security best practice
```

---

## 7. ONE-TIME TOKEN (OTT) — CROSS-PORTAL

### 7.1 Vấn đề

```
SSLM có 2 frontend portals:
  Student Portal:    http://localhost:3001
  Management Portal: http://localhost:3002

Cùng 1 user (INSTRUCTOR) có thể dùng cả 2 portals.
Vấn đề: Login ở portal A, muốn chuyển sang portal B → phải login lại?

httpOnly cookie có path: /api/auth
  → Cookie chỉ gửi đến API server
  → Hai portals khác domain → không share được cookie
  → Access token trong memory → mất khi chuyển page

Giải pháp: One-Time Token (OTT)
```

### 7.2 OTT Flow

```
Student Portal (đã login)
    │
    ├── 1. GET /api/auth/ott (with access token)
    │      → Server tạo OTT, lưu Redis: "ott:{uuid}" → userId
    │      → TTL: 60 seconds
    │      → Return { ott: "uuid-abc-123" }
    │
    ├── 2. Redirect to Management Portal:
    │      http://localhost:3002/auth/callback?ott=uuid-abc-123
    │
    ▼
Management Portal
    │
    ├── 3. POST /api/auth/ott/validate { ott: "uuid-abc-123" }
    │      → Server lookup Redis: "ott:uuid-abc-123" → userId
    │      → DELETE OTT from Redis (one-time use)
    │      → Generate new access + refresh tokens
    │      → Return { accessToken, user } + set cookie
    │
    └── 4. User đã login ở Management Portal ✅
```

### 7.3 Implementation

```typescript
// Generate OTT (protected endpoint — cần access token)
async generateOtt(userId: string): Promise<string> {
  const ott = crypto.randomUUID();
  await this.redis.setex(`ott:${ott}`, OTT_EXPIRY_SECONDS, userId);
  return ott;
}
```

```
Redis SETEX = SET + EXPIRE:
  Key:   "ott:a1b2c3d4-..."
  Value: "clx1userId..."
  TTL:   60 seconds

Tại sao Redis mà không phải DB?
  → OTT rất short-lived (60s) → DB overhead không cần thiết
  → Redis tự expire → không cần cleanup
  → Fast read/write cho single-use token
```

```typescript
// Validate OTT (public endpoint — OTT thay thế cho access token)
async validateOtt(ott: string) {
  const userId = await this.redis.get(`ott:${ott}`);
  if (!userId) {
    throw new UnauthorizedException({ code: 'INVALID_OTT' });
  }
  // One-time: delete after use
  await this.redis.del(`ott:${ott}`);

  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: USER_SAFE_SELECT,
  });
  if (!user) throw new UnauthorizedException({ code: 'USER_NOT_FOUND' });

  const accessToken = this.generateAccessToken(user.id, user.role);
  const refreshToken = await this.generateRefreshToken(user.id);

  return { accessToken, refreshToken, user };
}
```

```
Security:
  1. OTT hết hạn sau 60s → window rất nhỏ
  2. One-time use → xóa ngay sau khi dùng
  3. Random UUID → không đoán được
  4. USER_SAFE_SELECT → không leak sensitive data
```

---

## 8. HELPER METHODS

### 8.1 generateAccessToken

```typescript
private generateAccessToken(userId: string, role: string): string {
  const payload: JwtPayload = { sub: userId, role };
  return this.jwt.sign(payload, {
    secret: this.config.getOrThrow<string>('auth.jwtAccessSecret'),
    expiresIn: this.config.getOrThrow<string>('auth.jwtAccessExpiresIn') as StringValue,
  });
}
```

```
jwt.sign(payload, options):
  → Tạo JWT string từ payload + secret + options

getOrThrow vs get:
  get()         → return undefined nếu config thiếu → silent failure
  getOrThrow()  → throw error ngay → fail fast, biết ngay lỗi

  SSLM dùng getOrThrow cho critical config:
  → Nếu thiếu JWT secret → app KHÔNG NÊN chạy
  → Crash lúc startup tốt hơn crash lúc user login

as StringValue (from 'ms' package):
  → @nestjs/jwt internally dùng 'ms' library
  → expiresIn nhận: number (ms) hoặc StringValue ("15m", "7d")
  → TypeScript cần explicit cast để type-safe
  → "15m" as StringValue → compiler biết đây là valid duration string
```

### 8.2 generateRefreshToken

```typescript
private async generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const refreshExpiresIn = this.config.get<string>('auth.jwtRefreshExpiresIn') || '7d';
  const ms = this.parseDurationToMs(refreshExpiresIn);
  const expiresAt = new Date(Date.now() + ms);

  await this.prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });

  return token;
}
```

```
Refresh token flow:
  1. Generate random UUID (not JWT — stateful token)
  2. Parse "7d" → 604800000 ms
  3. Calculate expiry: now + 7 days
  4. Store in DB: { token, userId, expiresAt }
  5. Return token string (controller set vào cookie)
```

### 8.3 parseDurationToMs

```typescript
private parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback 7 days
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] || 24 * 60 * 60 * 1000);
}
```

```
Parse duration string → milliseconds:
  "30s" → 30 * 1000 = 30,000
  "15m" → 15 * 60,000 = 900,000
  "1h"  → 1 * 3,600,000 = 3,600,000
  "7d"  → 7 * 86,400,000 = 604,800,000

Regex: /^(\d+)([smhd])$/
  ^       → start of string
  (\d+)   → capture group 1: one or more digits
  ([smhd])→ capture group 2: s/m/h/d (seconds/minutes/hours/days)
  $       → end of string

  "7d" → match[1] = "7", match[2] = "d"
  "abc" → no match → fallback 7 days

Tại sao tự parse thay vì dùng 'ms' library?
  → Lightweight — chỉ cần 4 units (s/m/h/d)
  → 'ms' library hỗ trợ "2.5 hrs", "1y" — over-featured cho SSLM
  → Zero dependencies cho helper function
```

---

## 9. ERROR CODES — MACHINE-READABLE

### 9.1 Pattern

```typescript
// ✅ SSLM pattern — error codes
throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS', field: 'email' });
throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
throw new BadRequestException({ code: 'TOO_MANY_LOGIN_ATTEMPTS' });

// ❌ KHÔNG dùng — localized messages
throw new ConflictException('Email đã tồn tại');
throw new UnauthorizedException('Sai mật khẩu');
```

### 9.2 Tất cả error codes trong Auth Module

```
Registration:
  EMAIL_ALREADY_EXISTS     → 409 Conflict (email đã đăng ký)

Login:
  TOO_MANY_LOGIN_ATTEMPTS  → 400 Bad Request (rate limited)
  INVALID_CREDENTIALS      → 401 Unauthorized (email/password sai)
  EMAIL_NOT_VERIFIED       → 401 Unauthorized (chưa verify email)
  ACCOUNT_SUSPENDED        → 401 Unauthorized (bị ban)

Token:
  MISSING_REFRESH_TOKEN    → 401 Unauthorized (cookie thiếu)
  INVALID_REFRESH_TOKEN    → 401 Unauthorized (token expired/invalid)

Verification:
  INVALID_VERIFICATION_TOKEN → 400 Bad Request (token sai/hết hạn)

Password Reset:
  INVALID_RESET_TOKEN      → 400 Bad Request (token sai/hết hạn)

OTT:
  INVALID_OTT              → 401 Unauthorized (OTT sai/hết hạn)
  USER_NOT_FOUND           → 401 Unauthorized (user đã bị xóa)
```

### 9.3 Frontend mapping

```typescript
// Frontend (tương lai):
const errorMessages: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: t('auth.errors.emailExists'),
  INVALID_CREDENTIALS: t('auth.errors.invalidCredentials'),
  EMAIL_NOT_VERIFIED: t('auth.errors.emailNotVerified'),
  // ... etc
};
```

---

## 10. TÓM TẮT

```
AuthService — 9 methods:

Public flows (không cần token):
  ├── register()       → Create user + send verification email
  ├── login()          → Rate limit + verify + generate tokens
  ├── refresh()        → Token rotation (delete old, create new)
  ├── verifyEmail()    → UNVERIFIED → ACTIVE
  ├── forgotPassword() → Anti-enumeration + send reset email
  ├── resetPassword()  → New password + invalidate all sessions
  └── validateOtt()    → Cross-portal login via one-time token

Protected flows (cần token):
  ├── logout()         → Delete refresh token from DB
  └── generateOtt()    → Create OTT in Redis (60s TTL)

Security patterns:
  ├── bcryptjs (12 rounds) → password hashing
  ├── Rate limiting (Redis) → brute force protection
  ├── Anti-enumeration → forgotPassword always returns success
  ├── Token rotation → refresh token one-time use
  ├── USER_SAFE_SELECT → never expose sensitive fields
  ├── getOrThrow → fail fast for critical config
  └── Machine-readable error codes → i18n-friendly
```
