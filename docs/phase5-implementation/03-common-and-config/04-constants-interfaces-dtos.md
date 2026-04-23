# 04 — Constants, Interfaces & DTOs

> Giải thích Named Constants, TypeScript Interfaces, DTOs (Data Transfer Objects),
> class-validator, class-transformer, và Swagger decorators.

---

## 1. NAMED CONSTANTS — KHÔNG DÙNG MAGIC NUMBERS

### 1.1 Magic Numbers là gì?

**Magic number** là giá trị số/string xuất hiện trực tiếp trong code mà không có giải thích:

```typescript
// ❌ Magic numbers — đọc code không biết 12 là gì, 5 là gì
const hash = await bcrypt.hash(password, 12);
if (loginAttempts > 5) throw new Error('Too many');
if (page > 100) throw new Error('Too large');

// ✅ Named constants — self-documenting
const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
if (loginAttempts > LOGIN_RATE_LIMIT) throw new Error('Too many');
if (page > MAX_LIMIT) throw new Error('Too large');
```

### 1.2 File `app.constant.ts` — Tất cả constants của SSLM

```typescript
// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
```

**Pagination constants** dùng trong PaginationDto — mặc định page 1, 20 items/page, tối đa 100 items.

```typescript
// Auth
export const BCRYPT_ROUNDS = 12;
export const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export const RESET_TOKEN_EXPIRY_HOURS = 1;
export const OTT_EXPIRY_SECONDS = 60;
```

| Constant                          | Giá trị | Giải thích                                                         |
| --------------------------------- | ------- | ------------------------------------------------------------------ |
| `BCRYPT_ROUNDS`                   | 12      | Độ khó hash password. 12 = ~250ms/hash. Tăng 1 = gấp đôi thời gian |
| `VERIFICATION_TOKEN_EXPIRY_HOURS` | 24      | Link xác thực email hết hạn sau 24h                                |
| `RESET_TOKEN_EXPIRY_HOURS`        | 1       | Link reset password hết hạn sau 1h (bảo mật hơn)                   |
| `OTT_EXPIRY_SECONDS`              | 60      | One-Time Token (cross-portal login) hết hạn sau 60s                |

```typescript
// Rate limiting
export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_SECONDS = 60;
export const REGISTER_RATE_LIMIT = 3;
export const REGISTER_RATE_WINDOW_SECONDS = 60;
```

**Rate limiting** chống brute force attack:

- Login: Max 5 lần/phút (attacker không thể thử 1000 password)
- Register: Max 3 lần/phút (chống spam accounts)

```typescript
// Upload
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
```

**File size tính bằng bytes:** `5 * 1024 * 1024` = 5 × 1024 KB × 1024 bytes = 5,242,880 bytes = 5MB.

**Allowed MIME types** — chỉ chấp nhận format phổ biến, chặn upload file nguy hiểm (`.exe`, `.php`).

```typescript
// Learning
export const LESSON_COMPLETE_THRESHOLD = 0.8; // 80%
export const QUIZ_DEFAULT_PASSING_SCORE = 0.7; // 70%
```

- Student xem ≥80% video → lesson hoàn thành (không cần xem 100%, cho phép skip intro/outro)
- Quiz đạt ≥70% → pass

```typescript
// Cache TTL (seconds)
export const CACHE_TTL_SHORT = 60; // 1 phút
export const CACHE_TTL_MEDIUM = 300; // 5 phút
export const CACHE_TTL_LONG = 3600; // 1 giờ

// Order
export const ORDER_EXPIRY_MINUTES = 15; // Đơn hàng hết hạn sau 15 phút
export const EARNING_HOLD_DAYS = 7; // Giữ tiền 7 ngày trước khi instructor rút

// AI
export const AI_DAILY_LIMIT = 10; // 10 câu hỏi AI/ngày/user
export const RAG_TOP_K = 5; // Lấy 5 documents liên quan nhất
export const EMBEDDING_DIMENSIONS = 384; // Vector embedding dimension
```

### 1.3 Quy tắc đặt tên constants

```typescript
UPPER_SNAKE_CASE    // Convention cho constants
^^^^^  ^^^^^  ^^^^
  Từ 1  Từ 2  Từ 3

Ví dụ:
  MAX_LIMIT              // Tối đa
  DEFAULT_PAGE           // Mặc định
  BCRYPT_ROUNDS          // Cài đặt
  CACHE_TTL_SHORT        // Loại + đặc tính
  ALLOWED_IMAGE_TYPES    // Whitelist
```

---

## 2. INTERFACES — TYPE DEFINITIONS

### 2.1 `JwtPayload` Interface

```typescript
export interface JwtPayload {
  sub: string; // userId — "subject" (JWT standard claim)
  role: string; // User role: STUDENT, INSTRUCTOR, ADMIN
  iat?: number; // Issued At — timestamp khi token được tạo
  exp?: number; // Expiration — timestamp khi token hết hạn
}
```

**JWT Standard Claims:**

```json
// JWT Token (decoded) looks like:
{
  "sub": "clx1abc2d0000...", // Subject — ai sở hữu token
  "role": "STUDENT", // Custom claim — role trong SSLM
  "iat": 1710000000, // Issued At — tạo lúc nào
  "exp": 1710000900 // Expires — hết hạn lúc nào (15 min later)
}
```

**Tại sao `sub` thay vì `userId`?**

- `sub` (subject) là **registered claim** trong JWT spec (RFC 7519)
- Dùng tên chuẩn → tương thích với libraries, third-party services
- Convention: `sub` = identifier của entity mà token đại diện

**`iat` và `exp` optional** (`?`) vì:

- Khi **tạo** token: chỉ cần `sub` và `role`, JWT library tự thêm `iat` và `exp`
- Khi **verify** token: `iat` và `exp` luôn có, nhưng code có thể không cần truy cập

### 2.2 `PaginatedResult<T>` Interface

```typescript
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number; // Trang hiện tại
    limit: number; // Số items/trang
    total: number; // Tổng số records
    totalPages: number; // Tổng số trang
  };
}
```

**Generic type `<T>`** — PaginatedResult dùng cho BẤT KỲ model nào:

```typescript
PaginatedResult<Course>; // { data: Course[], meta: { page, limit, total, totalPages } }
PaginatedResult<User>; // { data: User[], meta: { ... } }
PaginatedResult<Post>; // { data: Post[], meta: { ... } }
```

**API Response format:**

```json
// GET /api/courses?page=2&limit=10
{
  "data": [
    { "id": "clx1...", "title": "React Mastery", ... },
    { "id": "clx2...", "title": "Node.js Deep Dive", ... },
    // ... 10 courses
  ],
  "meta": {
    "page": 2,
    "limit": 10,
    "total": 156,
    "totalPages": 16    // Math.ceil(156 / 10) = 16
  }
}
```

---

## 3. DTOs — DATA TRANSFER OBJECTS

### 3.1 DTO là gì?

**DTO** (Data Transfer Object) là class định nghĩa **shape** của data truyền giữa client và server.

```
Client                    DTO                     Service
──────                    ───                     ───────
POST /api/courses    →   CreateCourseDto    →    coursesService.create(dto)
Body: {                  Validate:                 Nhận data đã validate
  title: "React",         - title: required          - An toàn sử dụng
  price: 150000,          - price: number, min 0     - Không cần validate lại
  level: "BEGINNER"       - level: valid enum
}
```

### 3.2 Tại sao cần DTO?

```typescript
// ❌ Không có DTO — truyền trực tiếp request body
@Post()
create(@Body() body: any) {
  // body có thể chứa BẤT KỲ gì!
  // { title: 123, price: "abc", hack: "DROP TABLE" }
  // Không type-safe, không validation
}

// ✅ Có DTO — validate + transform trước khi vào service
@Post()
create(@Body() dto: CreateCourseDto) {
  // dto đã được validate:
  // - title: string, not empty
  // - price: number, >= 0
  // - Các fields lạ đã bị strip (whitelist)
  return this.coursesService.create(dto);
}
```

### 3.3 `PaginationDto` — Phân tích từng decorator

```typescript
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../constants/app.constant';

export class PaginationDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;
```

**Decorator execution order** (bottom → top → left → right):

```
1. @Min(1)            — Validate: page >= 1
2. @IsInt()           — Validate: page phải là integer
3. @Transform(...)    — Transform: string → number (query params luôn là string)
4. @IsOptional()      — Nếu không gửi → dùng default value
5. @ApiPropertyOptional — Swagger docs: field này optional
```

**Tại sao cần `@Transform()`?**

```
URL: GET /api/courses?page=2&limit=10
                            ^       ^^
                            Đều là STRING trong query params!

Không có @Transform:
  page = "2"  (string) → @IsInt() FAIL! "2" không phải integer

Có @Transform:
  page = "2" → parseInt("2", 10) → 2 (number) → @IsInt() OK!
```

**`limit` field:**

```typescript
  @ApiPropertyOptional({ default: DEFAULT_LIMIT })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)   // ← Thêm: tối đa 100 items/page
  limit: number = DEFAULT_LIMIT;
```

`@Max(MAX_LIMIT)` — Ngăn client request `?limit=999999` (quá nhiều data, chậm query).

**`sortBy` và `sortOrder`:**

```typescript
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;   // "createdAt", "price", "title", ...

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';  // Mới nhất trước (default)
```

**Computed property `skip`:**

```typescript
  get skip(): number {
    return (this.page - 1) * this.limit;
  }
```

Prisma dùng `skip` (offset) thay vì `page`:

```typescript
// page=3, limit=10 → skip = (3-1) * 10 = 20
const courses = await prisma.course.findMany({
  skip: dto.skip, // 20 — bỏ qua 20 records đầu
  take: dto.limit, // 10 — lấy 10 records
});
```

### 3.4 `ApiResponseDto` và `ApiErrorDto` — Swagger Documentation

```typescript
export class MetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
```

**`!:` (definite assignment assertion):**

```typescript
// ❌ TypeScript strict mode yêu cầu initializer
@ApiProperty() page: number;
// Error: Property 'page' has no initializer

// ✅ Nói TypeScript: "trust me, field này sẽ có giá trị"
@ApiProperty() page!: number;
//                   ^ Definite assignment assertion
```

DTOs response không cần initializer vì chúng được tạo từ data, không phải từ `new MetaDto()`.

**`ApiResponseDto<T>` — Generic Swagger:**

```typescript
export class ApiResponseDto<T> {
  @ApiProperty() data!: T;
  @ApiPropertyOptional() meta?: MetaDto;
}
```

Mọi API success response đều có format này:

```json
// Single item
{ "data": { "id": "clx1...", "title": "React" } }

// Paginated list
{
  "data": [{ ... }, { ... }],
  "meta": { "page": 1, "limit": 20, "total": 156, "totalPages": 8 }
}
```

**`ApiErrorDto` — Error response format:**

```typescript
export class ApiErrorDto {
  @ApiProperty() code!: string; // "EMAIL_ALREADY_EXISTS"
  @ApiProperty() message!: string; // "A record with this email already exists"
  @ApiProperty() statusCode!: number; // 409
  @ApiPropertyOptional() field?: string; // "email"
}
```

**Pattern quan trọng:** Backend trả **error code** (machine-readable), KHÔNG trả text dịch:

```typescript
// ✅ Backend trả error code
{ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 }

// ❌ Backend trả text dịch (KHÔNG LÀM)
{ message: 'Email đã tồn tại', statusCode: 409 }
```

Frontend map code → localized text:

```typescript
// Frontend
const message = t(`apiErrors.${error.code}`);
// apiErrors.EMAIL_ALREADY_EXISTS → "Email đã được sử dụng" (vi)
// apiErrors.EMAIL_ALREADY_EXISTS → "Email already in use" (en)
```

---

## 4. CLASS-VALIDATOR & CLASS-TRANSFORMER

### 4.1 class-validator — Validation bằng Decorators

```typescript
import {
  IsEmail, // Validate email format
  IsString, // Validate type string
  IsInt, // Validate integer
  IsOptional, // Field không bắt buộc
  MinLength, // String length >= N
  Min,
  Max, // Number range
  IsEnum, // Value phải thuộc enum
  IsNotEmpty, // Không được empty string
  IsUrl, // Validate URL format
} from 'class-validator';
```

**Cách hoạt động với NestJS ValidationPipe:**

```
Client Request → ValidationPipe → class-transformer → class-validator → Controller
                     │                    │                    │
                     │              Transform raw body    Validate rules
                     │              to class instance     from decorators
                     │                    │                    │
                     │              { page: "2" }         @IsInt → FAIL
                     │              ↓ Transform            vì "2" là string
                     │              { page: 2 }           @IsInt → OK
                     │                                    2 là integer
                     │
                     └── Nếu validation fail → 400 Bad Request response
```

### 4.2 class-transformer — Transform Data

```typescript
import { Transform, Type, Exclude, Expose } from 'class-transformer';

// @Transform — custom transformation
@Transform(({ value }) => parseInt(value as string, 10))
page: number;
// "2" → 2

// @Type — transform nested objects
@Type(() => Number)
price: number;

// @Exclude — hide field trong response
@Exclude()
passwordHash: string;
```

### 4.3 Thứ tự Decorator = Quan trọng

```typescript
@IsOptional()     // 1. Nếu không gửi → skip validation, dùng default
@Transform(...)   // 2. Transform raw value (string → number)
@IsInt()          // 3. Validate transformed value
@Min(1)           // 4. Validate range

// Decorators thực thi từ TRONG RA NGOÀI (bottom-up):
// Min(1) → IsInt() → Transform() → IsOptional()
```

---

## 5. SWAGGER DECORATORS

### 5.1 `@ApiProperty()` vs `@ApiPropertyOptional()`

```typescript
@ApiProperty()            // Field BẮT BUỘC — hiển thị required trong Swagger
@ApiPropertyOptional()    // Field OPTIONAL — hiển thị optional trong Swagger
```

Swagger UI (http://localhost:3000/api/docs) tự động generate documentation từ decorators:

```
┌─────────────────────────────────────────┐
│  PaginationDto                           │
├─────────────────────────────────────────┤
│  page    number (optional, default: 1)   │
│  limit   number (optional, default: 20)  │
│  sortBy  string (optional)               │
│  sortOrder  "asc" | "desc" (optional)    │
└─────────────────────────────────────────┘
```

### 5.2 Tại sao dùng Swagger decorators trên DTOs?

- **Tự động generate API docs** — không cần viết docs riêng
- **Interactive testing** — test API trực tiếp từ browser
- **Type information** — Swagger biết chính xác type, enum values
- **Frontend team** — đọc Swagger docs để biết API contract

---

## 6. TÓM TẮT

```
Constants (app.constant.ts):
  ├── UPPER_SNAKE_CASE — self-documenting
  ├── 40+ constants nhóm theo domain
  └── Tránh magic numbers scattered trong code

Interfaces:
  ├── JwtPayload — JWT token structure (sub, role, iat, exp)
  └── PaginatedResult<T> — Generic paginated API response

DTOs:
  ├── PaginationDto — Query params validation (page, limit, sort)
  ├── ApiResponseDto<T> — Success response format { data, meta? }
  └── ApiErrorDto — Error response format { code, message, statusCode }

Validation Stack:
  class-transformer (Transform) → class-validator (Validate) → NestJS ValidationPipe (Orchestrate)
```
