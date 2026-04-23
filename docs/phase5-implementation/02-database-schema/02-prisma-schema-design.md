# 02 — Prisma Schema Design: Generator, Datasource, Enums & Naming

> Giải thích cấu trúc file schema.prisma, các conventions đặt tên, và toàn bộ enums.

---

## 1. FILE schema.prisma LÀ GÌ?

### 1.1 Vai trò

`schema.prisma` là **"source of truth"** của database — tất cả bảng, cột, quan hệ, index đều được định nghĩa ở đây. Prisma dùng file này để:

1. **Generate migration SQL** — tạo file SQL thay đổi database
2. **Generate Prisma Client** — tạo TypeScript types + query methods
3. **Validate schema** — kiểm tra syntax, quan hệ, types

```
schema.prisma ──────┬──────> Migration SQL ──────> Database (PostgreSQL)
                    │
                    └──────> Prisma Client ──────> TypeScript code (NestJS)
```

### 1.2 Vị trí file

```
apps/api/src/prisma/schema.prisma    # Trong project SSLM
```

> Thông thường Prisma đặt ở `prisma/schema.prisma` (root), nhưng SSLM đặt trong `src/prisma/` để gom chung với backend code. Cần config `prisma.schema` trong `package.json` để Prisma tìm đúng file.

---

## 2. GENERATOR BLOCK

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}
```

### 2.1 `provider = "prisma-client-js"`

Nói Prisma generate **JavaScript/TypeScript client** — đây là generator mặc định và phổ biến nhất.

Sau khi chạy `npx prisma generate`, Prisma tạo code trong `node_modules/@prisma/client/` — chứa:

- TypeScript types cho mỗi model (User, Course, ...)
- Query methods (findMany, create, update, delete, ...)
- Enum types (Role, CourseStatus, ...)

```typescript
// Sau generate, dùng trong code:
import { PrismaClient, User, Role } from '@prisma/client';

const prisma = new PrismaClient();
const user: User = await prisma.user.findUnique({ where: { id: '...' } });
// user.role có type Role (STUDENT | INSTRUCTOR | ADMIN)
```

### 2.2 `previewFeatures = ["fullTextSearchPostgres"]`

**Preview features** là tính năng chưa stable nhưng đã sẵn sàng dùng. `fullTextSearchPostgres` cho phép dùng full-text search operators trong Prisma queries:

```typescript
// Tìm courses chứa "react" trong title/description
const courses = await prisma.course.findMany({
  where: {
    title: { search: 'react & typescript' }, // Full-text search
  },
});
```

> Lưu ý: Đây là Prisma-level feature. PostgreSQL tsvector/tsquery luôn hoạt động — feature này chỉ thêm TypeScript API cho Prisma Client.

---

## 3. DATASOURCE BLOCK

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 3.1 `provider = "postgresql"`

Chỉ định loại database. Prisma hỗ trợ: `postgresql`, `mysql`, `sqlite`, `sqlserver`, `mongodb`, `cockroachdb`.

### 3.2 `url = env("DATABASE_URL")`

Connection string đọc từ biến môi trường `.env`:

```bash
# .env
DATABASE_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev"
#              ^^^^^^^^    ^^^^^^^^^  ^^^^^^^^^^^^^  ^^^^^^^^^  ^^^^  ^^^^^^^^
#              protocol    username   password       host       port  database
```

### 3.3 `directUrl = env("DIRECT_URL")`

Dùng cho **Neon.tech** (database hosting). Neon dùng connection pooler — migrations cần direct connection:

```bash
# Local development — cả 2 giống nhau:
DATABASE_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev"
DIRECT_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev"

# Production (Neon.tech) — khác nhau:
DATABASE_URL="postgresql://...@ep-xxx.neon.tech/sslm_prod?pgbouncer=true"   # Qua pooler
DIRECT_URL="postgresql://...@ep-xxx.neon.tech/sslm_prod"                    # Direct
```

- `DATABASE_URL`: Dùng cho **runtime queries** (qua connection pooler, nhanh hơn)
- `DIRECT_URL`: Dùng cho **migrations** (cần direct connection để ALTER TABLE)

---

## 4. NAMING CONVENTIONS

### 4.1 Quy tắc đặt tên trong Prisma

SSLM tuân thủ quy tắc: **camelCase trong code, snake_case trong database**.

| Gì                | Convention               | Ví dụ                                     |
| ----------------- | ------------------------ | ----------------------------------------- |
| Model name        | PascalCase               | `User`, `CourseTag`, `LessonProgress`     |
| Field name (code) | camelCase                | `userId`, `fullName`, `createdAt`         |
| DB table name     | snake_case via `@@map()` | `users`, `course_tags`, `lesson_progress` |
| DB column name    | snake_case via `@map()`  | `user_id`, `full_name`, `created_at`      |
| Enum name         | PascalCase               | `Role`, `CourseStatus`, `OrderItemType`   |
| Enum value        | UPPER_SNAKE_CASE         | `PENDING_REVIEW`, `ALL_LEVELS`            |

### 4.2 `@map()` và `@@map()` — Bridge giữa code và DB

```prisma
model InstructorProfile {
  id     String @id @default(cuid())
  userId String @map("user_id")        // Field camelCase → column snake_case
  //                  ^^^^^^^^^ DB column name

  @@map("instructor_profiles")          // Model PascalCase → table snake_case
  //     ^^^^^^^^^^^^^^^^^^^^^ DB table name
}
```

**Tại sao cần 2 convention khác nhau?**

- **Code (TypeScript)**: camelCase là chuẩn JavaScript/TypeScript — `user.fullName` đọc tự nhiên hơn `user.full_name`
- **Database (SQL)**: snake_case là chuẩn SQL/PostgreSQL — `SELECT full_name FROM users` đọc tự nhiên hơn `SELECT fullName FROM Users`

Prisma `@map`/`@@map` tự động translate giữa 2 thế giới.

### 4.3 ID Strategy — CUID

```prisma
model User {
  id String @id @default(cuid())
  //                     ^^^^^^ CUID — Collision-resistant Unique ID
}
```

**CUID vs UUID vs Auto-increment:**

| Strategy       | Ví dụ               | Ưu điểm                                 | Nhược điểm                            |
| -------------- | ------------------- | --------------------------------------- | ------------------------------------- |
| **CUID**       | `clx1abc2d0000...`  | URL-safe, sortable, collision-resistant | Dài hơn integer                       |
| UUID v4        | `550e8400-e29b-...` | Globally unique                         | Không sortable, index performance kém |
| Auto-increment | `1, 2, 3, ...`      | Đơn giản, nhỏ                           | Dễ đoán, khó merge data giữa các DB   |

SSLM chọn CUID vì:

- **URL-safe**: Dùng trong routes `/courses/clx1abc2d...`
- **Sortable**: Có timestamp prefix → sort by ID ≈ sort by created time
- **Collision-resistant**: An toàn khi generate ở nhiều server

### 4.4 Timestamps — Luôn có `createdAt` và `updatedAt`

```prisma
createdAt DateTime  @default(now()) @map("created_at")
updatedAt DateTime  @updatedAt      @map("updated_at")
deletedAt DateTime?                 @map("deleted_at")   // Optional — soft delete
```

| Field       | Giải thích                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `createdAt` | Tự động set thời điểm tạo record. `@default(now())` = PostgreSQL `DEFAULT NOW()`                      |
| `updatedAt` | Tự động update mỗi khi record thay đổi. `@updatedAt` = Prisma tự manage                               |
| `deletedAt` | **Soft delete** — thay vì xóa thật (DELETE), set `deletedAt = now()`. Chỉ dùng cho User, Course, Post |

**Soft delete vs Hard delete:**

```typescript
// Hard delete — xóa thật, không khôi phục được
await prisma.user.delete({ where: { id: 'xxx' } });

// Soft delete — đánh dấu xóa, có thể khôi phục
await prisma.user.update({
  where: { id: 'xxx' },
  data: { deletedAt: new Date() },
});

// Query chỉ lấy records chưa xóa
const users = await prisma.user.findMany({
  where: { deletedAt: null },
});
```

---

## 5. ENUMS — TOÀN BỘ 24 ENUMS

### 5.1 Enum là gì?

**Enum** (enumeration) là kiểu dữ liệu chỉ chấp nhận **một tập giá trị cố định**. Trong PostgreSQL, enum tạo ra một custom type.

```prisma
enum Role {
  STUDENT        // Giá trị 1
  INSTRUCTOR     // Giá trị 2
  ADMIN          // Giá trị 3
}
```

```sql
-- PostgreSQL tạo:
CREATE TYPE "Role" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');

-- Cột role chỉ chấp nhận 3 giá trị trên:
INSERT INTO users (role) VALUES ('STUDENT');   -- ✅ OK
INSERT INTO users (role) VALUES ('MANAGER');   -- ❌ Error!
```

### 5.2 Tại sao dùng Enum thay vì String?

| Enum                                                            | String                                |
| --------------------------------------------------------------- | ------------------------------------- |
| Validate ở **database level** — không thể insert giá trị sai    | Bất kỳ string nào cũng được — dễ typo |
| TypeScript type-safe — IDE autocomplete                         | Cần validate thủ công                 |
| Query performance tốt hơn (stored as integer internally)        | String comparison chậm hơn            |
| Self-documenting — đọc schema biết ngay có bao nhiêu trạng thái | Phải đọc code/docs                    |

### 5.3 Danh sách 24 Enums theo module

#### Auth & Users (4 enums)

| Enum                | Giá trị                       | Dùng cho                         |
| ------------------- | ----------------------------- | -------------------------------- |
| `Role`              | STUDENT, INSTRUCTOR, ADMIN    | Vai trò user — phân quyền        |
| `UserStatus`        | UNVERIFIED, ACTIVE, SUSPENDED | Trạng thái tài khoản             |
| `AuthProvider`      | LOCAL, GOOGLE                 | Đăng nhập bằng email hoặc Google |
| `ApplicationStatus` | PENDING, APPROVED, REJECTED   | Đơn đăng ký instructor           |

#### Course (4 enums)

| Enum           | Giá trị                                                        | Dùng cho          |
| -------------- | -------------------------------------------------------------- | ----------------- |
| `CourseLevel`  | BEGINNER, INTERMEDIATE, ADVANCED, ALL_LEVELS                   | Độ khó khóa học   |
| `CourseStatus` | DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, REJECTED, ARCHIVED | Vòng đời khóa học |
| `LessonType`   | VIDEO, TEXT, QUIZ                                              | Loại bài học      |
| `MediaType`    | VIDEO, IMAGE, ATTACHMENT                                       | Loại media upload |

```
CourseStatus lifecycle:
  DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED
                         → REJECTED
  PUBLISHED → ARCHIVED
```

#### Ecommerce (6 enums)

| Enum             | Giá trị                               | Dùng cho                        |
| ---------------- | ------------------------------------- | ------------------------------- |
| `MediaStatus`    | UPLOADING, PROCESSING, READY, FAILED  | Trạng thái upload media         |
| `OrderStatus`    | PENDING, COMPLETED, EXPIRED, REFUNDED | Trạng thái đơn hàng             |
| `OrderItemType`  | COURSE, CHAPTER                       | Mua cả khóa hoặc từng chương    |
| `EnrollmentType` | FULL, PARTIAL                         | Đăng ký toàn bộ hoặc một phần   |
| `CouponType`     | PERCENTAGE, FIXED_AMOUNT              | Giảm giá % hoặc số tiền cố định |
| `EarningStatus`  | PENDING, AVAILABLE, WITHDRAWN         | Trạng thái thu nhập instructor  |

#### Social & Chat (3 enums)

| Enum          | Giá trị                  | Dùng cho           |
| ------------- | ------------------------ | ------------------ |
| `PostType`    | TEXT, CODE, LINK, SHARED | Loại bài đăng      |
| `MessageType` | TEXT, IMAGE, CODE, FILE  | Loại tin nhắn chat |
| `GroupRole`   | OWNER, ADMIN, MEMBER     | Vai trò trong nhóm |

#### Others (7 enums)

| Enum                  | Giá trị                                          | Dùng cho                |
| --------------------- | ------------------------------------------------ | ----------------------- |
| `WithdrawalStatus`    | PENDING, PROCESSING, COMPLETED, REJECTED         | Rút tiền instructor     |
| `NotificationType`    | FOLLOW, POST_LIKE, POST_COMMENT, ... (14 values) | Phân loại notification  |
| `AiMessageRole`       | USER, ASSISTANT                                  | Vai trò trong chat AI   |
| `ReportTargetType`    | USER, COURSE, POST, COMMENT, ... (7 values)      | Loại nội dung bị report |
| `ReportStatus`        | PENDING, REVIEWED, ACTION_TAKEN, DISMISSED       | Xử lý report            |
| `SimilarityAlgorithm` | CONTENT, COLLABORATIVE, HYBRID                   | Thuật toán gợi ý        |
| `AnalyticsType`       | DAILY_USERS, DAILY_REVENUE, ... (4 values)       | Loại thống kê           |

---

## 6. CẤU TRÚC FILE schema.prisma

### 6.1 Thứ tự trong file

```prisma
// 1. Generator block
generator client { ... }

// 2. Datasource block
datasource db { ... }

// 3. Tất cả Enums (nhóm theo module)
enum Role { ... }
enum UserStatus { ... }
// ...

// 4. Models nhóm theo module
// MODULE 1: AUTH & USERS
model User { ... }
model RefreshToken { ... }
// ...

// MODULE 2: COURSE STRUCTURE
model Category { ... }
model Course { ... }
// ...
```

### 6.2 Tại sao nhóm theo module?

Schema SSLM có **60 models** — nếu để lộn xộn sẽ rất khó tìm. Nhóm theo module giúp:

- Dễ navigate trong file
- Dễ review khi thay đổi
- Map 1:1 với NestJS modules (`modules/auth/`, `modules/courses/`, ...)

### 6.3 Comment markers

```prisma
// ============================================
// MODULE 1: AUTH & USERS
// ============================================
```

Dùng comment block để phân cách visual giữa các module — không ảnh hưởng code.
