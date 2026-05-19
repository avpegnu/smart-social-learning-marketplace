# 08 — Migration, Raw SQL & Seed Data

> Giải thích Prisma migration workflow, raw SQL cho tsvector/pgvector, và seed data.

---

## 1. PRISMA MIGRATION LÀ GÌ?

### 1.1 Vấn đề Migration giải quyết

Database schema thay đổi liên tục trong quá trình phát triển. Migration là cách **version control cho database** — giống git cho code.

```
Không có migration:
├── Dev 1: ALTER TABLE users ADD COLUMN phone VARCHAR
├── Dev 2: Không biết cần chạy ALTER TABLE
├── Production: Thiếu cột phone → App crash

Có migration:
├── Migration 001: CREATE TABLE users (id, email, ...)
├── Migration 002: ALTER TABLE users ADD COLUMN phone
├── Dev 2: chạy "prisma migrate dev" → tự động apply migration 002
└── Production: chạy "prisma migrate deploy" → đồng bộ
```

### 1.2 Prisma Migration Workflow

```
schema.prisma ──→ prisma migrate dev ──→ Migration SQL file ──→ Database
     (1)                (2)                    (3)                 (4)

(1) Developer sửa schema.prisma
(2) Chạy CLI command
(3) Prisma generate file SQL (diff giữa schema mới và DB hiện tại)
(4) Apply SQL vào database
```

### 1.3 Các lệnh migration

| Lệnh                             | Khi nào dùng       | Giải thích                                       |
| -------------------------------- | ------------------ | ------------------------------------------------ |
| `prisma validate`                | Trước khi migrate  | Check syntax schema, không chạy SQL              |
| `prisma format`                  | Trước khi migrate  | Auto-format schema.prisma                        |
| `prisma migrate dev --name xxx`  | Development        | Tạo migration file + apply + generate client     |
| `prisma migrate deploy`          | Production         | Apply pending migrations (không tạo mới)         |
| `prisma migrate status`          | Debug              | Xem migrations nào đã apply, nào pending         |
| `prisma generate`                | Sau khi sửa schema | Tạo TypeScript types (không động DB)             |
| `prisma db push`                 | Prototyping        | Apply schema trực tiếp, không tạo migration file |
| `prisma db seed`                 | Sau migrate        | Chạy seed script                                 |
| `prisma db execute --file x.sql` | Raw SQL            | Chạy file SQL trực tiếp                          |

---

## 2. MIGRATION TRONG SSLM

### 2.1 Cấu trúc thư mục migrations

```
apps/api/src/prisma/
├── schema.prisma
├── migrations/
│   ├── 20260313100000_init/
│   │   └── migration.sql           # Migration cũ (Phase 5.1)
│   └── 20260313124737_init_full_schema/
│       └── migration.sql           # Migration mới (Phase 5.2)
├── sql/                            # Raw SQL (không phải Prisma migration)
│   ├── 00-search-vector.sql
│   └── 01-pgvector.sql
├── seed.ts
├── prisma.module.ts
└── prisma.service.ts
```

### 2.2 Tên migration

```bash
npx prisma migrate dev --name init_full_schema
#                              ^^^^^^^^^^^^^^^^ Tên developer đặt

# Prisma tạo folder: 20260313124737_init_full_schema
#                     ^^^^^^^^^^^^^^ Timestamp tự động
```

Timestamp đảm bảo thứ tự apply đúng.

### 2.3 File migration.sql

Prisma tự generate SQL từ schema.prisma:

```sql
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'SUSPENDED');
-- ... (24 enums)

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "full_name" TEXT NOT NULL,
    -- ... (16 columns)
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" ( ... );
-- ... (60 tables)

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
-- ... (dozens of indexes)

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ... (dozens of foreign keys)
```

### 2.4 `_prisma_migrations` table

Prisma tạo bảng đặc biệt trong DB để track migrations:

```sql
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations;

-- migration_name                         | finished_at        | applied_steps_count
-- 20260313100000_init                     | 2026-03-13 10:00   | 1
-- 20260313124737_init_full_schema         | 2026-03-13 12:47   | 1
```

Prisma dùng bảng này để biết migration nào đã apply → chỉ apply migration mới.

---

## 3. RAW SQL MIGRATIONS

### 3.1 Tại sao cần Raw SQL?

Prisma **chưa hỗ trợ** một số tính năng PostgreSQL:

- `tsvector` type (full-text search)
- `vector` type (pgvector)
- Custom triggers
- Custom functions
- Partial indexes

Cần viết SQL thủ công và chạy qua `prisma db execute`.

### 3.2 File 00-search-vector.sql — Full-text search

```sql
-- 1. Thêm cột search_vector vào bảng courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Tạo GIN index cho search nhanh
CREATE INDEX IF NOT EXISTS idx_courses_search
  ON courses USING GIN(search_vector);

-- 3. Tạo function tự động cập nhật search_vector
CREATE OR REPLACE FUNCTION update_course_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Tạo trigger gọi function khi INSERT/UPDATE
CREATE TRIGGER trg_courses_search_vector
  BEFORE INSERT OR UPDATE OF title, short_description, description
  ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_course_search_vector();
```

**Giải thích từng phần:**

#### `tsvector` là gì?

```sql
-- tsvector = "text search vector" — phiên bản đã tokenize của text
SELECT to_tsvector('simple', 'Learn React and TypeScript');
-- Kết quả: 'and':3 'learn':1 'react':2 'typescript':4
-- Mỗi từ được tách ra + ghi nhận vị trí
```

#### `setweight()` — Trọng số tìm kiếm

```sql
setweight(to_tsvector('simple', title), 'A')              -- Weight A: cao nhất
setweight(to_tsvector('simple', short_description), 'B')   -- Weight B: trung bình
setweight(to_tsvector('simple', description), 'C')         -- Weight C: thấp nhất
```

Khi search "React":

- Tìm trong title → relevance cao (weight A)
- Tìm trong description → relevance thấp hơn (weight C)

#### `GIN index` là gì?

**GIN** (Generalized Inverted Index) — index đặc biệt cho full-text search:

```
Inverted index (ví dụ):
"react"      → [course_1, course_5, course_12]
"typescript" → [course_1, course_3]
"python"     → [course_2, course_7, course_8, course_15]

Search "react & typescript" → course_1 (intersection)
```

Nhanh hơn nhiều so với `LIKE '%react%'` vì không cần scan toàn bộ bảng.

#### `to_tsvector('simple', ...)` — Tại sao dùng 'simple'?

PostgreSQL hỗ trợ nhiều **text search configurations**:

- `'english'`: Stemming (running → run), stop words (the, is, at)
- `'simple'`: Không stemming, không stop words — giữ nguyên từ gốc

SSLM dùng `'simple'` vì:

- Hỗ trợ cả tiếng Việt và tiếng Anh (không cần stemmer riêng)
- Course titles thường ngắn — stop words ít ảnh hưởng

#### Trigger — Tự động cập nhật

```sql
CREATE TRIGGER trg_courses_search_vector
  BEFORE INSERT OR UPDATE OF title, short_description, description
  ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_course_search_vector();
```

**Khi nào trigger chạy?**

- `INSERT`: Instructor tạo khóa mới → tự động tạo search_vector
- `UPDATE OF title, short_description, description`: Instructor sửa → tự động cập nhật

**Tại sao dùng trigger thay vì application code?**

```
Trigger (database level):
✅ Luôn đồng bộ — bất kể insert/update từ đâu (app, admin tool, raw SQL)
✅ Atomic — trong cùng transaction
✅ Performance — không cần round-trip giữa app và DB

Application code:
❌ Có thể quên gọi — dev mới không biết cần update search_vector
❌ Race condition — 2 updates đồng thời
```

### 3.3 File 01-pgvector.sql — Vector search

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Thêm cột embedding
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 3. Tạo IVFFlat index
CREATE INDEX IF NOT EXISTS idx_course_chunks_embedding
  ON course_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

(Chi tiết về pgvector đã giải thích trong file `01-docker-pgvector.md`)

### 3.4 `IF NOT EXISTS` — Idempotent SQL

```sql
ADD COLUMN IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
CREATE EXTENSION IF NOT EXISTS ...
```

Chạy nhiều lần không lỗi — an toàn khi script bị re-run.

### 3.5 Thư mục `sql/` đặt ngoài `migrations/`

```
prisma/
├── migrations/     ← Prisma quản lý (tự động)
│   └── 202603.../
└── sql/            ← Raw SQL (thủ công)
    ├── 00-search-vector.sql
    └── 01-pgvector.sql
```

**Tại sao không đặt trong `migrations/`?**

Prisma scan folder `migrations/` và nghĩ mỗi subfolder là 1 migration. Folder `sql/` sẽ bị coi là "pending migration" → lỗi `prisma migrate status`.

---

## 4. SEED DATA

### 4.1 Seed là gì?

**Seed** = dữ liệu khởi tạo ban đầu — data cần thiết để hệ thống chạy được.

### 4.2 File seed.ts

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Admin account — cần để đăng nhập lần đầu
  // 2. Categories — cấu trúc danh mục khóa học
  // 3. Tags — nhãn cho khóa học và Q&A
  // 4. Commission tiers — bậc hoa hồng
  // 5. Platform settings — cài đặt hệ thống
}
```

### 4.3 Tại sao dùng `upsert` thay vì `create`?

```typescript
await prisma.user.upsert({
  where: { email: 'admin@sslm.com' },
  update: {},        // Nếu đã tồn tại → không làm gì
  create: { ... },   // Nếu chưa tồn tại → tạo mới
});
```

**Upsert = Update + Insert** — chạy seed nhiều lần không lỗi (idempotent). Nếu dùng `create`:

```typescript
// ❌ Chạy lần 2 → Error: Unique constraint failed on email
await prisma.user.create({ data: { email: 'admin@sslm.com', ... } });

// ✅ Chạy bao nhiêu lần cũng OK
await prisma.user.upsert({ where: { email: 'admin@sslm.com' }, ... });
```

### 4.4 Dữ liệu seed chi tiết

#### Admin account

```typescript
{
  email: 'admin@sslm.com',
  passwordHash: await bcrypt.hash('Admin@123', 12),
  fullName: 'System Admin',
  role: 'ADMIN',
  status: 'ACTIVE',    // Skip verification
  provider: 'LOCAL',
}
```

> ⚠️ Password `Admin@123` chỉ dùng cho development. Production phải đổi ngay.

#### Categories (8 danh mục)

```
Web Development, Mobile Development, Data Science,
DevOps & Cloud, Programming Languages, Database,
UI/UX Design, Cybersecurity
```

#### Tags (43 tags)

```
JavaScript, TypeScript, React, Next.js, Vue.js, Angular,
Node.js, NestJS, Express, Python, Django, FastAPI,
Java, Spring Boot, Go, Rust, C#, .NET,
SQL, PostgreSQL, MongoDB, Redis, GraphQL, REST API,
Docker, Kubernetes, AWS, Git, CI/CD, Linux,
HTML, CSS, Tailwind, Sass, Figma,
React Native, Flutter, Swift, Kotlin,
Machine Learning, Deep Learning, NLP, Computer Vision
```

#### Commission tiers (3 bậc)

| Doanh thu tích lũy       | Hoa hồng platform |
| ------------------------ | ----------------- |
| 0 → 10,000,000đ          | 30%               |
| 10,000,000 → 50,000,000đ | 25%               |
| > 50,000,000đ            | 20%               |

#### Platform settings (7 cài đặt)

| Key                       | Value   | Đơn vị       |
| ------------------------- | ------- | ------------ |
| min_withdrawal_amount     | 200,000 | VND          |
| order_expiry_minutes      | 15      | phút         |
| refund_period_days        | 7       | ngày         |
| refund_max_progress       | 0.10    | tỷ lệ (10%)  |
| ai_daily_limit            | 10      | câu hỏi/ngày |
| review_min_progress       | 0.30    | tỷ lệ (30%)  |
| lesson_complete_threshold | 0.80    | tỷ lệ (80%)  |

### 4.5 Cấu hình seed trong package.json

```json
{
  "prisma": {
    "schema": "src/prisma/schema.prisma",
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} src/prisma/seed.ts"
  }
}
```

- `schema`: Chỉ đường dẫn schema file (không ở default location)
- `seed`: Lệnh chạy seed script
- `--compiler-options {"module":"CommonJS"}`: Cần vì seed.ts dùng `import` (ESM) nhưng ts-node mặc định chạy CommonJS

### 4.6 `console.warn` thay vì `console.log`

```typescript
console.warn(`Admin created: ${admin.email}`);
// warn thay vì log
```

ESLint rule `no-console` trong project chỉ cho phép `console.warn` và `console.error`. `console.log` bị cấm để tránh log rác trong production.

---

## 5. TOÀN BỘ COMMANDS PHASE 5.2

```bash
# 1. Docker — đổi image + restart
docker compose down
docker compose up -d

# 2. Verify pgvector
docker exec sslm-postgres psql -U sslm_user -d sslm_dev \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Prisma — validate + format
cd apps/api
npx prisma validate --schema src/prisma/schema.prisma
npx prisma format --schema src/prisma/schema.prisma

# 4. Migration
npx prisma migrate dev --name init_full_schema --schema src/prisma/schema.prisma

# 5. Generate client
npx prisma generate --schema src/prisma/schema.prisma

# 6. Raw SQL
npx prisma db execute --file src/prisma/sql/00-search-vector.sql --schema src/prisma/schema.prisma
npx prisma db execute --file src/prisma/sql/01-pgvector.sql --schema src/prisma/schema.prisma

# 7. Seed
npx prisma db seed

# 8. Verify
npx prisma migrate status --schema src/prisma/schema.prisma
grep -c "^model " src/prisma/schema.prisma    # Expect: 60
grep -c "^enum " src/prisma/schema.prisma     # Expect: 24
```
