# 02 — Users Controller & DTOs: HTTP Layer, Validation, và Swagger Integration

> Giải thích UsersController — thin controller pattern, @Public() + optional auth, DTO validation
> với class-validator, @ApiBearerAuth() Swagger, và NestJS module wiring.

---

## 1. USERS CONTROLLER — ENDPOINT MAP

### 1.1 Tổng quan 8 endpoints

```
┌──────────┬─────────┬────────────────────────────────┬──────────────────────────────┐
│ Method   │ @Public │ Route                          │ Description                  │
├──────────┼─────────┼────────────────────────────────┼──────────────────────────────┤
│ GET      │ ❌      │ /users/me                      │ Get own profile              │
│ PATCH    │ ❌      │ /users/me                      │ Update profile               │
│ PUT      │ ❌      │ /users/me/notification-prefs    │ Update notification settings │
│ GET      │ ✅      │ /users/:id                     │ Get public profile           │
│ POST     │ ❌      │ /users/:id/follow              │ Follow user                  │
│ DELETE   │ ❌      │ /users/:id/follow              │ Unfollow user                │
│ GET      │ ✅      │ /users/:id/followers            │ List followers               │
│ GET      │ ✅      │ /users/:id/following            │ List following               │
└──────────┴─────────┴────────────────────────────────┴──────────────────────────────┘

Protected: 4 endpoints (cần JWT token)
Public: 4 endpoints (không cần token, nhưng 3 support optional auth)
```

### 1.2 Route ordering — Tại sao `/me` trước `/:id`?

```typescript
@Get('me')          // Line 23 — matches first
async getMe(...) {}

@Get(':id')          // Line 50 — matches second
async getPublicProfile(...) {}
```

```
NestJS route matching = top to bottom (first match wins)

Nếu đảo ngược:
  @Get(':id')        // Trước
  @Get('me')         // Sau

  → GET /users/me → Express match ":id" = "me" → GỌI NHẦM getPublicProfile("me")!
  → "me" không phải valid CUID → ParseCuidPipe throw error

Quy tắc: Static routes TRƯỚC dynamic routes
  /me                → static (exact match)
  /me/notification-preferences → static
  /:id               → dynamic (parameter capture)
  /:id/follow        → dynamic
  /:id/followers     → dynamic
```

---

## 2. CONTROLLER CLASS DECORATORS

### 2.1 @Controller, @ApiTags, @ApiBearerAuth

```typescript
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
export class UsersController {
```

**@Controller('users'):**

```
Route prefix cho TẤT CẢ endpoints trong controller.
  → @Get('me') → GET /api/users/me
  → @Get(':id/followers') → GET /api/users/:id/followers
  → Combined với global prefix 'api' (main.ts)
```

**@ApiTags('Users'):**

```
Swagger grouping:
  → Tất cả endpoints trong controller hiển thị dưới nhóm "Users"
  → Swagger UI: Auth | Users | Instructor | ...
  → Giúp organize API docs theo domain
```

**@ApiBearerAuth():**

```
Swagger authentication:
  → Thêm biểu tượng ổ khóa 🔒 bên cạnh mỗi endpoint
  → Swagger UI hiển thị nút "Authorize" ở góc trên phải
  → User nhập: Bearer <accessToken>
  → Swagger tự động gửi header: Authorization: Bearer <token>

Cần kết hợp với main.ts:
  const config = new DocumentBuilder()
    .addBearerAuth()     // ← Khai báo security scheme
    .build();

  @ApiBearerAuth()       // ← Apply cho controller/endpoint

  Không có .addBearerAuth() → @ApiBearerAuth() không có tác dụng
  Không có @ApiBearerAuth() → Swagger không hiển thị ổ khóa

Lưu ý: @ApiBearerAuth() ở class level = apply cho TẤT CẢ endpoints
  → Kể cả @Public() endpoints cũng hiển thị ổ khóa
  → Nhưng @Public() endpoints vẫn hoạt động không cần token
  → Ổ khóa = "endpoint CÓ THỂ nhận token", không phải "BẮT BUỘC"
```

---

## 3. @Public() + OPTIONAL AUTH — PATTERN ĐẶC BIỆT

### 3.1 Vấn đề

```
GET /users/:id là PUBLIC (ai cũng xem được)
NHƯNG nếu đã login → muốn biết isFollowing status

JwtAuthGuard behavior:
  → Protected route + no token → 401 Unauthorized
  → Protected route + valid token → request.user = JwtPayload

  → @Public() route + no token → request.user = undefined
  → @Public() route + valid token → ???

Vấn đề: @Public() bypass JwtAuthGuard hoàn toàn
  → Ngay cả khi có valid token → request.user vẫn undefined
  → Không thể biết ai đang request
```

### 3.2 JwtAuthGuard đã xử lý Optional Auth

```typescript
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Vẫn TRY verify token, nhưng KHÔNG throw nếu fail
      return super.canActivate(context)
        // Bắt lỗi khi không có token → pass through
        .catch?.(() => true) || true;
    }

    return super.canActivate(context);
  }
}
```

```
Thực tế SSLM JwtAuthGuard:
  @Public() routes → TRY to verify token
  → Có token hợp lệ → request.user = JwtPayload ✅
  → Không có token → catch error → return true → request.user = undefined
  → Token invalid → catch error → return true → request.user = undefined

→ "Optional authentication": verify nếu có, ignore nếu không
```

### 3.3 Controller implementation

```typescript
@Public()
@Get(':id')
async getPublicProfile(
  @Param('id', ParseCuidPipe) id: string,
  @CurrentUser() user?: JwtPayload,  // Optional — undefined nếu anonymous
) {
  return this.usersService.getPublicProfile(id, user?.sub);
}
```

```
@CurrentUser() user?: JwtPayload:
  → TypeScript optional parameter (?)
  → Nếu logged in: user = { sub: "userId", role: "STUDENT" }
  → Nếu anonymous: user = undefined

user?.sub:
  → Optional chaining
  → Logged in: user?.sub = "userId" → service nhận currentUserId
  → Anonymous: user?.sub = undefined → service biết không có auth

Service xử lý:
  currentUserId = "userId" → check isFollowing → true/false
  currentUserId = undefined → skip check → isFollowing = null
```

### 3.4 Apply cho followers/following lists

```typescript
@Public()
@Get(':id/followers')
async getFollowers(
  @Param('id', ParseCuidPipe) id: string,
  @Query() query: PaginationDto,
  @CurrentUser() user?: JwtPayload,   // Optional auth
) {
  return this.usersService.getFollowers(id, query, user?.sub);
}
```

```
Cùng pattern: @Public() + @CurrentUser() user?

3 endpoints dùng optional auth:
  GET /:id          → getPublicProfile (isFollowing per profile)
  GET /:id/followers → getFollowers (isFollowing per user in list)
  GET /:id/following → getFollowing (isFollowing per user in list)

Lý do: UX tốt hơn
  Anonymous: thấy followers list (không có follow buttons)
  Logged in: thấy followers list + biết mình follow ai (show "Following" badge)
```

---

## 4. PARAMETER DECORATORS

### 4.1 @Param('id', ParseCuidPipe)

```typescript
@Param('id', ParseCuidPipe) id: string
```

```
@Param('id'):
  → Extract route parameter :id
  → URL: /users/clx1abc123 → id = "clx1abc123"

ParseCuidPipe:
  → Custom pipe (Phase 5.3)
  → Validate id format là CUID
  → CUID: lowercase alphanumeric, starts with 'c', ~25 chars
  → "clx1abc123def" → ✅ valid CUID
  → "not-a-cuid!!!" → ❌ throw BadRequest
  → "1" → ❌ throw BadRequest

Tại sao validate ID format?
  → Prevent invalid DB queries (Prisma throw nếu ID format lạ)
  → Fail fast: trả 400 TRƯỚC khi query database
  → Security: tránh injection qua ID parameter
```

### 4.2 @Query() query: PaginationDto

```typescript
@Query() query: PaginationDto
```

```
@Query():
  → Extract TẤT CẢ query parameters thành object
  → URL: /users/u1/followers?page=2&limit=10
  → query = PaginationDto { page: 2, limit: 10 }

ValidationPipe xử lý:
  1. Transform: string "2" → number 2
  2. Validate: @IsInt() @Min(1) → OK
  3. Default: không gửi ?page → page = 1 (class default)

PaginationDto kết hợp với Prisma:
  → query.skip (getter) → Prisma skip
  → query.limit → Prisma take
  → Tự động handle offset pagination
```

### 4.3 @Body() dto: UpdateProfileDto

```typescript
@Patch('me')
async updateProfile(
  @CurrentUser() user: JwtPayload,
  @Body() dto: UpdateProfileDto,
) {
  return this.usersService.updateProfile(user.sub, dto);
}
```

```
@Body():
  → Extract request body
  → JSON: { "fullName": "New Name", "bio": "Hello" }
  → dto = UpdateProfileDto { fullName: "New Name", bio: "Hello" }

ValidationPipe global options (main.ts):
  whitelist: true → Strip fields KHÔNG có trong DTO
    Client gửi: { fullName: "New", role: "ADMIN" }
    → role bị strip (không có decorator trong DTO)
    → dto = { fullName: "New" }

  forbidNonWhitelisted: true → Throw error nếu có extra fields
    → Thay vì silent strip → 400 Bad Request
    → Security: detect nếu client cố gửi fields không cho phép

  transform: true → Auto instantiate DTO class
    → Plain object → UpdateProfileDto instance
    → class-validator decorators hoạt động
```

---

## 5. DTO VALIDATION — class-validator

### 5.1 UpdateProfileDto

```typescript
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'Sinh viên CNTT yêu thích lập trình...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

**Decorator chain — thứ tự quan trọng:**

```
@IsOptional():
  → Nếu field undefined hoặc null → SKIP tất cả validators sau
  → Nếu field có giá trị → chạy validators tiếp

@IsString():
  → Giá trị phải là string (không phải number, boolean, etc.)
  → { fullName: 123 } → ❌ fail

@MinLength(2):
  → String phải >= 2 ký tự
  → "A" → ❌ fail (1 char)
  → "AB" → ✅ pass

@MaxLength(100):
  → String phải <= 100 ký tự
  → "A".repeat(101) → ❌ fail

Kết hợp:
  undefined     → @IsOptional() → skip → ✅
  null          → @IsOptional() → skip → ✅
  "Nguyễn Văn A" → string ✅ → length 13 (>= 2, <= 100) ✅
  ""            → string ✅ → length 0 < 2 → ❌ @MinLength
  123           → ❌ @IsString
```

**TypeScript `?:` vs class-validator `@IsOptional()`:**

```typescript
fullName?: string;  // TypeScript: type = string | undefined
@IsOptional()       // class-validator: skip validation if undefined
```

```
Hai khác biệt:
  TypeScript ?: → compile-time type check → "có thể undefined"
  @IsOptional() → runtime validation → "skip nếu không gửi"

Cần CẢ HAI:
  → ?: cho TypeScript biết field có thể undefined (type safety)
  → @IsOptional() cho class-validator biết skip nếu undefined (validation)
  → Thiếu ?: → TypeScript complain "possibly undefined"
  → Thiếu @IsOptional() → validator fail khi field không gửi
```

**@ApiPropertyOptional — Swagger docs:**

```
@ApiPropertyOptional() thay vì @ApiProperty():
  → Swagger UI hiển thị field là "optional" (không bắt buộc)
  → example: giá trị mẫu hiển thị trong Swagger "Try it out"
  → Swagger auto-generate request body schema từ decorators
```

### 5.2 UpdateNotificationPreferencesDto

```typescript
export class NotificationChannel {
  @IsBoolean()
  inApp!: boolean;

  @IsBoolean()
  email!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    example: {
      POST_LIKED: { inApp: true, email: false },
      NEW_FOLLOWER: { inApp: true, email: false },
    },
  })
  @IsObject()
  preferences!: Record<string, NotificationChannel>;
}
```

**Definite assignment `!:` — TypeScript strict mode:**

```typescript
inApp!: boolean;
//    ^ exclamation mark
```

```
TypeScript strict mode (strictPropertyInitialization):
  → Class property PHẢI có giá trị khởi tạo hoặc assignment trong constructor
  → inApp: boolean; → ❌ Error: "Property 'inApp' has no initializer"

  → inApp!: boolean; → ✅ "Trust me, this will be assigned"
  → ! = definite assignment assertion

Tại sao DTO cần !: ?
  → DTO không có constructor gán giá trị
  → class-transformer gán giá trị SAU khi instantiate
  → TypeScript không biết điều này → cần ! assertion

  Flow:
    1. new NotificationChannel()  → inApp = undefined (TS worries here)
    2. class-transformer: plainToInstance → gán inApp = true
    3. class-validator: @IsBoolean() → validate inApp is boolean
    → Khi validator chạy, inApp ĐÃ CÓ giá trị
```

**Record<string, NotificationChannel>:**

```typescript
preferences!: Record<string, NotificationChannel>;
```

```
Record<string, NotificationChannel>:
  → TypeScript utility type
  → Key: string (notification type name)
  → Value: NotificationChannel { inApp: boolean, email: boolean }

@IsObject():
  → Validate preferences là object (không phải string, array, etc.)
  → KHÔNG deep-validate values (NotificationChannel)
  → Deep validation cần @ValidateNested() + @Type()

Lưu ý: @IsObject() chỉ check top-level:
  { POST_LIKED: { inApp: true, email: false } } → ✅ (is object)
  { POST_LIKED: "invalid" } → ✅ (still object, value not validated)
  "string" → ❌ (not object)

Trade-off: Simplified validation vs strict validation
  → Full validation: @ValidateNested() mỗi value + @Type() decorator
  → SSLM: @IsObject() đủ vì:
    1. Endpoint chỉ authenticated user gọi (không phải public input)
    2. Frontend gửi đúng format (controlled client)
    3. Prisma Json field accept bất kỳ valid JSON
```

---

## 6. DTO IMPORTS — ESLint PATTERN

### 6.1 Vấn đề

```typescript
// ❌ ESLint muốn "import type" vì chỉ thấy dùng cho type annotation
import { UpdateProfileDto } from './dto/update-profile.dto';
async updateProfile(@Body() dto: UpdateProfileDto) {}
//                              ^^^^^^^^^^^^^^^^ ESLint: "only used as type"

// ❌ Nhưng "import type" sẽ BREAK ValidationPipe
import type { UpdateProfileDto } from './dto/update-profile.dto';
// → Runtime: UpdateProfileDto = undefined
// → ValidationPipe: cannot instantiate undefined → crash
```

### 6.2 SSLM Solution

```typescript
// Value imports — ValidationPipe needs runtime class reference (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProfileDto } from './dto/update-profile.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
```

```
Pattern cho TẤT CẢ controller DTO imports:
  1. Comment giải thích TẠI SAO disable
  2. eslint-disable-next-line (chỉ 1 line)
  3. Value import (không có "type")

Áp dụng cho:
  AuthController:      6 DTOs (Register, Login, VerifyEmail, etc.)
  UsersController:     3 DTOs (UpdateProfile, UpdateNotificationPreferences, Pagination)
  InstructorController: 2 DTOs (CreateApplication, UpdateInstructorProfile)

KHÔNG áp dụng cho service imports:
  // Service chỉ dùng DTO cho type annotation → import type OK
  import type { UpdateProfileDto } from './dto/update-profile.dto';
```

---

## 7. HTTP METHODS — PATCH vs PUT vs POST vs DELETE

### 7.1 SSLM endpoint design

```
PATCH /users/me:
  → Partial update (chỉ fields gửi)
  → { fullName: "New" } → chỉ update fullName

PUT /users/me/notification-preferences:
  → Full replace (toàn bộ preferences object)
  → Client gửi COMPLETE preferences object
  → Không phải partial → PUT semantics đúng

POST /users/:id/follow:
  → Create resource (follow relationship)
  → Idempotent? No — duplicate follow → 409 Conflict

DELETE /users/:id/follow:
  → Remove resource (follow relationship)
  → RESTful: resource = follow, action = delete
```

### 7.2 Tại sao PATCH cho profile, không phải PUT?

```
PUT semantics (RFC 7231):
  → Replace TOÀN BỘ resource
  → Client PHẢI gửi tất cả fields
  → Fields không gửi → set thành null/default

PATCH semantics (RFC 5789):
  → Partial modification
  → Client chỉ gửi fields MUỐN thay đổi
  → Fields không gửi → KHÔNG thay đổi

SSLM profile update:
  → User chỉ muốn đổi tên → gửi { fullName: "New" }
  → Không muốn mất bio, avatarUrl
  → PATCH phù hợp hơn PUT

Tại sao notification dùng PUT?
  → preferences là 1 JSON object hoàn chỉnh
  → Client luôn gửi FULL object (tất cả notification types)
  → Không có "partial update 1 notification type"
  → PUT semantics: replace toàn bộ preferences
```

---

## 8. NestJS MODULE WIRING

### 8.1 UsersModule

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

```
3 arrays trong @Module():

controllers: [UsersController]
  → NestJS register routes từ controller
  → Scan method decorators (@Get, @Post, etc.)
  → Tạo HTTP route handlers

providers: [UsersService]
  → Register trong DI container
  → Khi UsersController cần UsersService → inject instance
  → Singleton by default (1 instance shared)

exports: [UsersService]
  → Allow OTHER modules import UsersService
  → Ví dụ: SocialModule cần check isFollowing
    → import UsersModule → access UsersService

  Không export → UsersService chỉ available TRONG UsersModule
  Export → available cho modules import UsersModule
```

### 8.2 App Module Registration

```typescript
// app.module.ts
@Module({
  imports: [
    // ... config, prisma, auth ...
    UsersModule,
    InstructorModule,
  ],
})
export class AppModule {}
```

```
imports: [UsersModule]:
  → NestJS load module
  → Register controllers → create routes
  → Register providers → create DI bindings
  → export providers → available cho other modules

Thứ tự imports KHÔNG quan trọng cho routing
  (NestJS resolve routes sau khi load TẤT CẢ modules)

Nhưng dependency order QUAN TRỌNG:
  → AuthModule phải load trước (provides guards)
  → PrismaModule phải load trước (provides DB)
  → ConfigModule phải load trước (provides env config)
  → Trong SSLM: global modules (Config, Prisma) + forRoot() handle order
```

---

## 9. TÓM TẮT

```
UsersController & DTOs:

Controller Pattern:
  ├── @Controller('users') + @ApiTags + @ApiBearerAuth
  ├── Thin: parse request → call service → return
  ├── Static routes (/me) TRƯỚC dynamic (/:id)
  └── 8 endpoints: 4 protected + 4 public (3 optional auth)

Optional Auth:
  ├── @Public() + @CurrentUser() user?: JwtPayload
  ├── JwtAuthGuard: try verify, catch on failure
  ├── Logged in: user?.sub = userId
  └── Anonymous: user?.sub = undefined

DTO Validation:
  ├── @IsOptional() + @IsString() + @MinLength/@MaxLength
  ├── !: definite assignment (TypeScript strict mode)
  ├── @ApiPropertyOptional for Swagger docs
  └── whitelist + forbidNonWhitelisted (strip/reject extra fields)

ESLint DTO Imports:
  ├── Controllers: value import + eslint-disable (ValidationPipe needs runtime class)
  ├── Services: import type (chỉ cần TypeScript type)
  └── Comment giải thích tại sao disable

Module:
  ├── controllers: [UsersController]
  ├── providers: [UsersService]
  └── exports: [UsersService] (cho other modules dùng)
```
