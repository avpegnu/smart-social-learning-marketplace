# 07 — Pipes & Exception Filters: Validation, Error Handling

> Giải thích Pipe pattern, ParseCuidPipe, Exception Filters,
> Prisma error mapping, và error handling strategy của SSLM.

---

## 1. PIPE LÀ GÌ?

### 1.1 Concept

**Pipe** là layer xử lý data **trước khi** đến controller method. Pipe có 2 chức năng:

```
┌──────────┐     ┌──────────┐     ┌────────────┐
│  Client   │ ──→ │   PIPE   │ ──→ │ Controller │
│  Request  │     │          │     │            │
└──────────┘     │ 1. Transform│   └────────────┘
                  │ 2. Validate │
                  │            │
                  │ ❌ Throw   │
                  │ if invalid │
                  └──────────┘
```

| Chức năng     | Mô tả                 | Ví dụ                             |
| ------------- | --------------------- | --------------------------------- |
| **Transform** | Chuyển đổi input data | `"123"` → `123` (string → number) |
| **Validate**  | Kiểm tra input hợp lệ | ID phải là CUID format            |

### 1.2 Built-in Pipes của NestJS

```typescript
ParseIntPipe; // "123" → 123, throw nếu không phải number
ParseBoolPipe; // "true" → true
ParseUUIDPipe; // Validate UUID format
ParseEnumPipe; // Validate enum value
DefaultValuePipe; // Set default nếu undefined
ValidationPipe; // Validate DTO (class-validator) — đã register global
```

### 1.3 Tại sao cần custom pipe?

NestJS có `ParseUUIDPipe` nhưng SSLM dùng **CUID** (không phải UUID). Cần custom pipe validate CUID format.

---

## 2. ParseCuidPipe — CUSTOM VALIDATION PIPE

### 2.1 File `parse-cuid.pipe.ts`

```typescript
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const CUID_REGEX = /^c[a-z0-9]{20,32}$/;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!CUID_REGEX.test(value)) {
      throw new BadRequestException({
        code: 'INVALID_CUID',
        message: 'Invalid ID format',
      });
    }
    return value;
  }
}
```

### 2.2 CUID Regex giải thích

```
/^c[a-z0-9]{20,32}$/
 ^                 $     Khớp toàn bộ string (từ đầu đến cuối)
 ^c                      Bắt đầu bằng ký tự 'c'
   [a-z0-9]              Lowercase letters + digits
           {20,32}       Từ 20 đến 32 ký tự (sau 'c')

Tổng length: 21-33 ký tự

Ví dụ hợp lệ:
  clx1abc2d0000l708dkvjxqz2      ✅ CUID v1 (25 chars)
  cm1abc2d0000l708dkvjxqz2def    ✅ CUID v2 (variable length)

Ví dụ KHÔNG hợp lệ:
  123abc                          ❌ Không bắt đầu bằng 'c'
  cXYZ                            ❌ Uppercase
  c                               ❌ Quá ngắn
  550e8400-e29b-41d4-a716-...     ❌ UUID format, không phải CUID
```

### 2.3 Tại sao regex linh hoạt `{20,32}` thay vì exact `{24}`?

```
CUID v1: chính xác 25 ký tự (c + 24)   → Prisma hiện tại dùng
CUID v2: variable length (24-32 ký tự)  → Tương lai có thể chuyển

{20,32} cho phép cả 2 format → forward compatible
```

### 2.4 `PipeTransform<string, string>` interface

```typescript
interface PipeTransform<T, R> {
  transform(value: T, metadata: ArgumentMetadata): R;
}

// ParseCuidPipe:
//   T = string (input type — ID từ URL params)
//   R = string (output type — validated ID, cùng type)
```

### 2.5 Cách sử dụng

```typescript
// Cách 1: Per-parameter
@Get(':id')
findOne(@Param('id', ParseCuidPipe) id: string) {
  //              ^^^^^^^^^^^^^ Validate id là CUID trước khi vào method
  return this.coursesService.findOne(id);
}

// Cách 2: Truyền vào nhiều params
@Get(':courseId/sections/:sectionId')
findSection(
  @Param('courseId', ParseCuidPipe) courseId: string,
  @Param('sectionId', ParseCuidPipe) sectionId: string,
) {}
```

**Nếu ID không hợp lệ:**

```json
// GET /api/courses/not-a-cuid
// Response: 400 Bad Request
{
  "code": "INVALID_CUID",
  "message": "Invalid ID format",
  "statusCode": 400
}
```

---

## 3. EXCEPTION FILTERS

### 3.1 Exception Filter là gì?

**Exception Filter** catch exceptions (errors) và format response trước khi gửi về client.

```
Service throws error → Exception Filter catches → Formatted JSON response

Không có filter:
  throw new Error('Something wrong')
  → 500 Internal Server Error (generic, không helpful)

Có filter:
  throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS', field: 'email' })
  → { code: 'EMAIL_ALREADY_EXISTS', message: '...', statusCode: 409, field: 'email' }
```

### 3.2 NestJS Exception Flow

```
Code throws exception
        │
        ▼
┌─────────────────────┐
│ Exception Filters    │ ← Catch exceptions, từ specific → general
│                      │
│ 1. PrismaExceptionF │ ← Catch Prisma errors (P2002, P2025, ...)
│ 2. HttpExceptionF   │ ← Catch HTTP exceptions (400, 401, 404, ...)
│ 3. (NestJS default) │ ← Catch everything else → 500
└─────────────────────┘
        │
        ▼
JSON Response to Client
```

**Filter order quan trọng:** Specific filters đặt TRƯỚC generic filters.

---

## 4. HttpExceptionFilter

### 4.1 File `http-exception.filter.ts`

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse =
      typeof exceptionResponse === 'string'
        ? { code: 'ERROR', message: exceptionResponse, statusCode: status }
        : { statusCode: status, ...exceptionResponse };

    response.status(status).json(errorResponse);
  }
}
```

### 4.2 `@Catch(HttpException)` — Bắt loại error nào?

```typescript
@Catch(HttpException)
//     ^^^^^^^^^^^^^ Bắt TẤT CẢ HttpException và subclasses:

// Subclasses:
BadRequestException      // 400
UnauthorizedException    // 401
ForbiddenException       // 403
NotFoundException        // 404
ConflictException        // 409
InternalServerErrorException  // 500
// ... và nhiều hơn
```

### 4.3 Normalize response format

NestJS cho phép throw exception với string hoặc object:

```typescript
// Cách 1: String message
throw new NotFoundException('Course not found');
// exception.getResponse() → "Course not found" (string)

// Cách 2: Object with code
throw new NotFoundException({
  code: 'COURSE_NOT_FOUND',
  message: 'Course not found',
});
// exception.getResponse() → { code: 'COURSE_NOT_FOUND', message: 'Course not found' }
```

Filter normalize cả 2 cách:

```typescript
const errorResponse =
  typeof exceptionResponse === 'string'
    ? { code: 'ERROR', message: exceptionResponse, statusCode: status }
    : //   Cách 1: string → tạo object với code = 'ERROR'
      { statusCode: status, ...exceptionResponse };
//   Cách 2: object → spread, thêm statusCode
```

**Kết quả luôn nhất quán:**

```json
// Cả 2 cách đều trả về format giống nhau:
{
  "code": "COURSE_NOT_FOUND",
  "message": "Course not found",
  "statusCode": 404
}
```

### 4.4 `ArgumentsHost` là gì?

```typescript
catch(exception: HttpException, host: ArgumentsHost) {
  const ctx = host.switchToHttp();
  //               ^^^^^^^^^^^^^^ Chuyển sang HTTP context
  const response = ctx.getResponse<Response>();
  //               ^^^^^^^^^^^^^^^^^^^^^^^^^^^  Express Response object
```

`ArgumentsHost` — wrapper chứa arguments của handler. Tùy transport mà switch:

```
host.switchToHttp()   → HTTP: getRequest(), getResponse()
host.switchToWs()     → WebSocket: getClient(), getData()
host.switchToRpc()    → Microservice: getContext(), getData()
```

---

## 5. PrismaExceptionFilter

### 5.1 Tại sao cần filter riêng cho Prisma?

Prisma throw **PrismaClientKnownRequestError** với error codes (P2002, P2025, ...) khi database operations fail. Nếu không catch → 500 Internal Server Error (không helpful cho frontend).

### 5.2 File `prisma-exception.filter.ts`

```typescript
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': { ... }  // Unique constraint violation
      case 'P2025': { ... }  // Record not found
      case 'P2003': { ... }  // Foreign key violation
      default:      { ... }  // Unknown database error
    }
  }
}
```

### 5.3 Prisma Error Codes

| Code      | Tên                    | Khi nào xảy ra                       | HTTP Status     | SSLM Error Code               |
| --------- | ---------------------- | ------------------------------------ | --------------- | ----------------------------- |
| **P2002** | Unique constraint      | Insert/update duplicate unique field | 409 Conflict    | `UNIQUE_CONSTRAINT_VIOLATION` |
| **P2025** | Record not found       | Update/delete record không tồn tại   | 404 Not Found   | `RECORD_NOT_FOUND`            |
| **P2003** | Foreign key constraint | Reference đến record không tồn tại   | 400 Bad Request | `FOREIGN_KEY_VIOLATION`       |

### 5.4 P2002 — Unique Constraint Violation

```typescript
case 'P2002': {
  const target = (exception.meta?.target as string[])?.join(', ') || 'field';
  response.status(HttpStatus.CONFLICT).json({
    code: 'UNIQUE_CONSTRAINT_VIOLATION',
    message: `A record with this ${target} already exists`,
    statusCode: HttpStatus.CONFLICT,
    field: target,
  });
  break;
}
```

**Ví dụ:**

```typescript
// User register với email đã tồn tại:
await prisma.user.create({ data: { email: 'test@example.com', ... } });
// → Prisma throw P2002: Unique constraint failed on the fields: (`email`)

// Filter catch → response:
{
  "code": "UNIQUE_CONSTRAINT_VIOLATION",
  "message": "A record with this email already exists",
  "statusCode": 409,
  "field": "email"
}
```

**`exception.meta?.target`** — Prisma gắn thông tin field nào bị vi phạm:

```typescript
// exception.meta = { target: ['email'] }
// (exception.meta?.target as string[])?.join(', ') → "email"
```

### 5.5 P2025 — Record Not Found

```typescript
case 'P2025':
  response.status(HttpStatus.NOT_FOUND).json({
    code: 'RECORD_NOT_FOUND',
    message: 'The requested record was not found',
    statusCode: HttpStatus.NOT_FOUND,
  });
  break;
```

Xảy ra khi dùng `prisma.xxx.update()` hoặc `prisma.xxx.delete()` với ID không tồn tại.

### 5.6 P2003 — Foreign Key Violation

```typescript
case 'P2003':
  response.status(HttpStatus.BAD_REQUEST).json({
    code: 'FOREIGN_KEY_VIOLATION',
    message: 'Referenced record does not exist',
    statusCode: HttpStatus.BAD_REQUEST,
  });
  break;
```

**Ví dụ:**

```typescript
// Tạo course với categoryId không tồn tại:
await prisma.course.create({
  data: { categoryId: 'non-existent-id', ... }
});
// → P2003: Foreign key constraint failed on the field: `category_id`
```

---

## 6. ERROR HANDLING STRATEGY TRONG SSLM

### 6.1 Error flow toàn cảnh

```
Service throws error
        │
        ├── PrismaClientKnownRequestError (DB error)
        │   └── PrismaExceptionFilter
        │       ├── P2002 → 409 UNIQUE_CONSTRAINT_VIOLATION
        │       ├── P2025 → 404 RECORD_NOT_FOUND
        │       ├── P2003 → 400 FOREIGN_KEY_VIOLATION
        │       └── Other → 500 DATABASE_ERROR
        │
        ├── HttpException (business error)
        │   └── HttpExceptionFilter
        │       ├── BadRequestException → 400
        │       ├── UnauthorizedException → 401
        │       ├── ForbiddenException → 403
        │       ├── NotFoundException → 404
        │       └── ConflictException → 409
        │
        └── Unknown Error
            └── NestJS default handler → 500
```

### 6.2 Service best practice

```typescript
// ✅ Throw with error code (SSLM pattern)
throw new ConflictException({
  code: 'EMAIL_ALREADY_EXISTS',
  message: 'Email already exists',
  field: 'email',
});

// ✅ Let Prisma errors bubble up → PrismaExceptionFilter handles
const user = await this.prisma.user.update({
  where: { id: userId },
  data: { email: newEmail },
});
// If id not found → P2025 → 404 RECORD_NOT_FOUND
// If email duplicate → P2002 → 409 UNIQUE_CONSTRAINT_VIOLATION

// ❌ KHÔNG catch Prisma errors manually nếu filter đã handle
try {
  await this.prisma.user.create({ data });
} catch (e) {
  if (e.code === 'P2002') throw new ConflictException('...');
  // ← Không cần! PrismaExceptionFilter tự làm
}
```

---

## 7. TÓM TẮT

```
Pipes:
  ParseCuidPipe — Validate CUID format (/^c[a-z0-9]{20,32}$/)
  ValidationPipe — Global, validate DTOs (class-validator)

Exception Filters:
  PrismaExceptionFilter:
    ├── P2002 → 409 UNIQUE_CONSTRAINT_VIOLATION
    ├── P2025 → 404 RECORD_NOT_FOUND
    ├── P2003 → 400 FOREIGN_KEY_VIOLATION
    └── Default → 500 DATABASE_ERROR

  HttpExceptionFilter:
    ├── Normalize string/object responses
    └── Consistent format: { code, message, statusCode, field? }

Error Strategy:
  Backend trả error CODES → Frontend map to localized text
  Prisma errors auto-handled → không cần try/catch manual
```
