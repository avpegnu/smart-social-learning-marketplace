# 03 — Backend NestJS API

> Giải thích kiến trúc NestJS, Prisma ORM, và tất cả files trong `apps/api/`.

---

## 1. NESTJS LÀ GÌ?

### 1.1 Tổng quan

**NestJS** là framework backend cho Node.js, lấy cảm hứng từ **Angular** (frontend framework). Nó cung cấp:

- **Architecture có tổ chức**: Modules, Controllers, Services, Guards, Pipes, Interceptors
- **Dependency Injection (DI)**: Tự động quản lý dependencies giữa các class
- **TypeScript first**: Built with TypeScript, type-safe từ đầu
- **Decorator-based**: Dùng `@` decorators để khai báo metadata

### 1.2 So sánh với Express.js thuần

```
Express.js (thuần):
  ✅ Đơn giản, linh hoạt
  ❌ Không có cấu trúc chuẩn — mỗi người code 1 kiểu
  ❌ Phải tự setup validation, DI, testing
  ❌ Dễ thành "spaghetti code" khi project lớn

NestJS (framework):
  ✅ Cấu trúc rõ ràng — Module/Controller/Service pattern
  ✅ Built-in: Validation, Guards, Interceptors, WebSocket, Queue, Swagger
  ✅ Dependency Injection — dễ test, dễ thay thế components
  ✅ Scalable — phù hợp cho project lớn (60+ models như SSLM)
  ❌ Learning curve cao hơn Express
```

### 1.3 Kiến trúc NestJS — Request Lifecycle

```
Client Request
    │
    ▼
┌─────────────────┐
│   Middleware     │  → Logging, CORS, Cookie parsing
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│    Guards        │  → Authentication (JWT), Authorization (Roles)
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│ Interceptors(B) │  → Before: Request transformation
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│    Pipes         │  → Validation (DTO), Transformation
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│  Controller      │  → Route handler — parse request, call service
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│   Service        │  → Business logic — query DB, process data
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│ Interceptors(A) │  → After: Response transformation
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│Exception Filter  │  → Catch errors, format error response
└─────────────────┘
         │
    ▼
  Response to Client
```

---

## 2. CẤU TRÚC FOLDER `apps/api/`

```
apps/api/
├── .env                     # Environment variables (KHÔNG commit)
├── .env.example             # Template cho .env
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript config
├── tsconfig.build.json      # TypeScript config cho build (exclude tests)
├── nest-cli.json            # NestJS CLI config (SWC builder)
├── jest.config.ts           # Jest testing config
│
├── src/
│   ├── main.ts              # Entry point — bootstrap NestJS app
│   ├── app.module.ts        # Root module — imports all feature modules
│   └── prisma/
│       ├── schema.prisma    # Database schema definition
│       ├── prisma.module.ts # Prisma module (DI container)
│       └── prisma.service.ts# Prisma service (DB connection)
│
└── dist/                    # Build output (gitignored)
```

---

## 3. GIẢI THÍCH TỪNG FILE

### 3.1 package.json — Dependencies & Scripts

#### Scripts

```json
{
  "scripts": {
    "dev": "nest start --watch", // Dev server với hot-reload
    "build": "nest build", // Build TypeScript → JavaScript
    "start": "node dist/main.js", // Run built JavaScript
    "start:prod": "node dist/main.js", // Production start
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest", // Run unit tests
    "test:watch": "jest --watch", // Run tests với auto-rerun
    "test:cov": "jest --coverage", // Run tests + coverage report
    "prisma:generate": "prisma generate", // Generate Prisma Client
    "prisma:migrate": "prisma migrate dev", // Create & run migration
    "prisma:studio": "prisma studio", // Open Prisma Studio (DB GUI)
    "prisma:seed": "ts-node src/prisma/seed.ts" // Seed database
  }
}
```

#### Dependencies — Giải thích từng package

**Core NestJS:**

| Package                    | Mục đích                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `@nestjs/common`           | Decorators cơ bản: `@Controller`, `@Get`, `@Post`, `@Injectable`, `ValidationPipe`, ... |
| `@nestjs/core`             | Core engine của NestJS — DI container, module system                                    |
| `@nestjs/platform-express` | HTTP adapter — NestJS dùng Express.js bên dưới                                          |
| `reflect-metadata`         | Polyfill cho TypeScript decorators (cần cho DI)                                         |
| `rxjs`                     | Reactive Extensions — NestJS dùng Observable pattern                                    |

**Authentication:**

| Package            | Mục đích                                     |
| ------------------ | -------------------------------------------- |
| `@nestjs/passport` | Tích hợp Passport.js vào NestJS              |
| `@nestjs/jwt`      | JWT (JSON Web Token) module cho NestJS       |
| `passport`         | Authentication middleware (strategy pattern) |
| `passport-jwt`     | JWT strategy cho Passport                    |
| `jsonwebtoken`     | Thư viện tạo/verify JWT tokens               |
| `bcryptjs`         | Hash password (bcrypt algorithm)             |

**Database & Cache:**

| Package          | Mục đích                                   |
| ---------------- | ------------------------------------------ |
| `@prisma/client` | Prisma Client — type-safe database queries |
| `ioredis`        | Redis client cho Node.js                   |

**API Documentation:**

| Package           | Mục đích                              |
| ----------------- | ------------------------------------- |
| `@nestjs/swagger` | Tự động generate Swagger/OpenAPI docs |

**Validation:**

| Package             | Mục đích                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `class-validator`   | Validation decorators: `@IsEmail()`, `@MinLength()`, `@IsNotEmpty()` |
| `class-transformer` | Transform plain objects → class instances (dùng với DTO)             |

**Real-time & Background Jobs:**

| Package                      | Mục đích                                 |
| ---------------------------- | ---------------------------------------- |
| `@nestjs/websockets`         | WebSocket support                        |
| `@nestjs/platform-socket.io` | Socket.IO adapter                        |
| `socket.io`                  | Real-time engine (chat, notifications)   |
| `@nestjs/bull`               | Job queue integration (background tasks) |
| `bull`                       | Redis-based job queue                    |
| `@nestjs/schedule`           | Cron jobs (scheduled tasks)              |

**External Services:**

| Package      | Mục đích                             |
| ------------ | ------------------------------------ |
| `cloudinary` | Upload/manage images & videos        |
| `groq-sdk`   | AI — call Llama 3.3 70B via Groq API |
| `nodemailer` | Send transactional emails via SMTP   |

**Utilities:**

| Package          | Mục đích                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| `@nestjs/config` | Environment variables management                                       |
| `nanoid`         | Generate short unique IDs                                              |
| `slugify`        | Convert text → URL-friendly slug ("Khóa học React" → "khoa-hoc-react") |

#### Dev Dependencies

| Package                  | Mục đích                                               |
| ------------------------ | ------------------------------------------------------ |
| `@nestjs/cli`            | CLI tool — `nest build`, `nest start`, `nest generate` |
| `@nestjs/schematics`     | Code generators cho NestJS CLI                         |
| `@nestjs/testing`        | Testing utilities (Test module, mock providers)        |
| `@swc/core` + `@swc/cli` | SWC compiler — build nhanh hơn TypeScript compiler 20x |
| `typescript`             | TypeScript compiler                                    |
| `jest` + `ts-jest`       | Testing framework + TypeScript support                 |
| `supertest`              | HTTP testing (test API endpoints)                      |
| `prisma`                 | Prisma CLI (migrations, generate, studio)              |
| `ts-node`                | Run TypeScript directly (cho seed script)              |
| `ts-loader`              | Webpack loader cho TypeScript                          |
| `@types/*`               | Type definitions cho JavaScript packages               |

### 3.2 tsconfig.json — TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "commonjs", // Output CommonJS (NestJS yêu cầu)
    "declaration": true, // Generate .d.ts type files
    "removeComments": true, // Xóa comments trong build output
    "emitDecoratorMetadata": true, // Emit decorator metadata (cần cho DI)
    "experimentalDecorators": true, // Enable @ decorators
    "allowSyntheticDefaultImports": true,
    "target": "ES2022", // Compile to ES2022 JavaScript
    "sourceMap": true, // Generate .map files (debug)
    "outDir": "./dist", // Build output folder
    "rootDir": "./src", // Source code folder
    "baseUrl": "./", // Base path for path aliases
    "incremental": true, // Incremental build (faster rebuilds)
    "skipLibCheck": true, // Skip type checking node_modules
    "strict": true, // Enable ALL strict checks
    "noUncheckedIndexedAccess": true, // obj['key'] returns T | undefined
    "noUnusedLocals": true, // Error on unused variables
    "noUnusedParameters": true, // Error on unused function params
    "noFallthroughCasesInSwitch": true, // Error on switch fallthrough
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true, // Allow import JSON files
    "esModuleInterop": true, // CJS/ESM interop
    "paths": {
      // Path aliases
      "@/*": ["src/*"], // @/prisma/... → src/prisma/...
      "@common/*": ["src/common/*"], // @common/guards/... → src/common/guards/...
      "@modules/*": ["src/modules/*"], // @modules/auth/... → src/modules/auth/...
      "@config/*": ["src/config/*"] // @config/... → src/config/...
    }
  }
}
```

#### Tại sao cần `emitDecoratorMetadata` và `experimentalDecorators`?

NestJS dùng **decorators** (`@Controller`, `@Injectable`, `@Get`) và **reflection** để:

1. Biết class nào là controller, service, module
2. Biết constructor cần inject dependencies nào
3. Biết route nào map đến method nào

```typescript
@Injectable() // ← Decorator: đánh dấu class này có thể inject
export class AuthService {
  constructor(
    private prisma: PrismaService, // ← DI biết cần inject PrismaService
    private jwtService: JwtService, // ← DI biết cần inject JwtService
  ) {}
}
```

Không có 2 flags này → decorators không hoạt động → NestJS không thể resolve dependencies.

#### Path aliases giải thích

```typescript
// Không có path alias (relative import hell):
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthGuard } from '../../common/guards/auth.guard';

// Có path alias (clean, readable):
import { PrismaService } from '@/prisma/prisma.service';
import { AuthGuard } from '@common/guards/auth.guard';
```

### 3.3 tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

Khi build production, exclude test files và spec files — chúng không cần trong build output.

### 3.4 nest-cli.json

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics", // Code generators
  "sourceRoot": "src", // Source code root
  "compilerOptions": {
    "deleteOutDir": true, // Xóa dist/ trước khi build mới
    "builder": "swc", // Dùng SWC thay vì tsc
    "typeCheck": true // Vẫn check types (SWC mặc định không check)
  }
}
```

#### SWC là gì?

**SWC** (Speedy Web Compiler) là compiler viết bằng Rust, thay thế TypeScript compiler (`tsc`):

- **Nhanh hơn 20-70x** so với tsc
- **Không type-check** mặc định (chỉ transform syntax) → ta bật `typeCheck: true`
- Build time: tsc ~5s → SWC ~0.3s

### 3.5 jest.config.ts — Testing Configuration

```typescript
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'], // File types Jest xử lý
  rootDir: 'src', // Test root folder
  testRegex: '.*\\.spec\\.ts$', // Pattern: *.spec.ts files
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest', // Dùng ts-jest để compile TS
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/node_modules/**', '!**/dist/**'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node', // Chạy trong Node.js (không phải browser)
  moduleNameMapper: {
    // Map path aliases cho Jest
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
};
```

**moduleNameMapper**: Jest không hiểu TypeScript path aliases (`@/`, `@common/`), nên phải map lại bằng regex.

### 3.6 .env.example

```bash
# Database (Docker local)
DATABASE_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev?schema=public"
DIRECT_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev?schema=public"
```

**DATABASE_URL vs DIRECT_URL:**

- `DATABASE_URL`: Connection string chính — có thể đi qua connection pooler (PgBouncer, Neon proxy)
- `DIRECT_URL`: Connection trực tiếp đến database — cần cho Prisma migrations (migrations không hoạt động qua pooler)

Ở local development, cả 2 giống nhau. Ở production (Neon.tech), chúng khác nhau:

```bash
DATABASE_URL="postgresql://...@ep-xxx.us-east-2.aws.neon.tech/sslm?sslmode=require"     # Pooled
DIRECT_URL="postgresql://...@ep-xxx.us-east-2.aws.neon.tech/sslm?sslmode=require"        # Direct
```

---

## 4. SOURCE CODE — GIẢI THÍCH CHI TIẾT

### 4.1 main.ts — Entry Point

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // 1. Tạo NestJS application từ root module
  const app = await NestFactory.create(AppModule);

  // 2. Đặt prefix cho tất cả routes: /api/users, /api/courses, ...
  app.setGlobalPrefix('api');

  // 3. CORS — cho phép frontend gọi API
  app.enableCors({
    origin: [
      process.env.STUDENT_PORTAL_URL || 'http://localhost:3001',
      process.env.MANAGEMENT_PORTAL_URL || 'http://localhost:3002',
    ],
    credentials: true, // Cho phép gửi cookies (refresh token)
  });

  // 4. Global validation pipe — validate TẤT CẢ incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động strip properties không khai báo trong DTO
      forbidNonWhitelisted: true, // Throw error nếu gửi properties lạ
      transform: true, // Tự động transform types (string → number)
      transformOptions: {
        enableImplicitConversion: true, // "123" → 123 tự động
      },
    }),
  );

  // 5. Swagger — auto-generate API documentation
  const config = new DocumentBuilder()
    .setTitle('SSLM API')
    .setDescription('Smart Social Learning Marketplace API')
    .setVersion('1.0')
    .addBearerAuth() // Thêm nút "Authorize" cho JWT token
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // URL: /api/docs

  // 6. Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
```

#### CORS là gì?

**CORS** (Cross-Origin Resource Sharing) là cơ chế bảo mật của browser. Mặc định, browser CHẶN requests từ origin A gọi đến origin B:

```
Student Portal (localhost:3001) → API (localhost:3000)
                                    ❌ BLOCKED! Different origin

Với CORS enabled:
  origin: ['http://localhost:3001']
                                    ✅ ALLOWED!
```

**Origin** = protocol + domain + port. `http://localhost:3001` ≠ `http://localhost:3000` → different origins.

`credentials: true` cho phép browser gửi cookies kèm request (cần cho httpOnly refresh token).

#### ValidationPipe giải thích

```typescript
// DTO (Data Transfer Object) khai báo:
class CreateUserDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}

// Khi client gửi:
POST /api/users
{
  "email": "not-an-email",     // ← Sai format
  "password": "123",           // ← Quá ngắn
  "hackField": "malicious"     // ← Field không khai báo
}

// ValidationPipe tự động:
// 1. whitelist: true → strip "hackField" (không có trong DTO)
// 2. forbidNonWhitelisted: true → throw 400 error vì "hackField"
// 3. Validate email format → throw 400 error
// 4. Validate password length → throw 400 error
```

#### Swagger là gì?

**Swagger (OpenAPI)** là standard mô tả REST API. NestJS tự động generate documentation từ decorators:

```typescript
@ApiOperation({ summary: 'Create a new course' })  // Mô tả endpoint
@ApiBody({ type: CreateCourseDto })                 // Mô tả request body
@ApiResponse({ status: 201, type: CourseEntity })   // Mô tả response
```

Truy cập `http://localhost:3000/api/docs` để xem interactive API documentation — có thể test API trực tiếp từ browser.

### 4.2 app.module.ts — Root Module

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService available ở MỌI module
      envFilePath: '.env', // Đọc biến môi trường từ .env
    }),
    PrismaModule, // Database connection
  ],
})
export class AppModule {}
```

#### Module Pattern trong NestJS

**Module** là đơn vị tổ chức code trong NestJS. Mỗi module nhóm các components liên quan:

```
AppModule (Root)
├── ConfigModule          → Environment variables
├── PrismaModule          → Database connection
├── AuthModule            → Login, register, JWT (sẽ thêm sau)
├── UsersModule           → User CRUD (sẽ thêm sau)
├── CoursesModule         → Course management (sẽ thêm sau)
└── ...
```

```typescript
@Module({
  imports: [],      // Các modules khác mà module này cần
  controllers: [],  // HTTP route handlers
  providers: [],    // Services, guards, pipes (DI container)
  exports: [],      // Providers share cho modules khác dùng
})
```

#### `isGlobal: true` là gì?

Mặc định, mỗi module phải import modules mà nó cần. Với `isGlobal: true`, module đó tự động available ở mọi nơi:

```typescript
// Không global — phải import ở mỗi module:
@Module({
  imports: [ConfigModule], // Phải import ở MỌI module
})
export class AuthModule {}

// Với isGlobal: true — không cần import:
@Module({}) // ConfigService tự động available
export class AuthModule {}
```

### 4.3 prisma.service.ts — Database Connection

```typescript
@Injectable() // Đánh dấu: class này có thể inject vào class khác
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect(); // Kết nối DB khi module init
  }

  async onModuleDestroy() {
    await this.$disconnect(); // Ngắt kết nối khi module destroy
  }
}
```

#### Dependency Injection (DI) giải thích

**DI** là design pattern: thay vì class tự tạo dependencies, framework inject chúng vào.

```typescript
// ❌ Không có DI — tự tạo:
class AuthService {
  private prisma = new PrismaService(); // Hard-coded dependency
  private jwt = new JwtService(); // Hard-coded dependency
}

// ✅ Có DI — NestJS tự inject:
@Injectable()
class AuthService {
  constructor(
    private prisma: PrismaService, // NestJS tự inject PrismaService instance
    private jwt: JwtService, // NestJS tự inject JwtService instance
  ) {}
}
```

**Lợi ích DI:**

1. **Testable**: Khi test, inject mock PrismaService thay vì real DB
2. **Singleton**: Cả app dùng chung 1 PrismaService instance (1 DB connection pool)
3. **Loose coupling**: Thay đổi implementation mà không sửa code

#### OnModuleInit / OnModuleDestroy

Đây là **lifecycle hooks** — NestJS gọi chúng tại các thời điểm cụ thể:

```
App start
  │
  ├── constructor()        → Tạo instance
  ├── onModuleInit()       → Module đã init → KẾT NỐI DB
  ├── ... app running ...
  ├── onModuleDestroy()    → App shutting down → NGẮT KẾT NỐI DB
  │
App exit
```

### 4.4 prisma.module.ts — Prisma Module

```typescript
@Global() // Available ở mọi module (không cần import)
@Module({
  providers: [PrismaService], // Khai báo PrismaService trong DI container
  exports: [PrismaService], // Cho phép modules khác inject PrismaService
})
export class PrismaModule {}
```

`@Global()` + `exports` = mọi module trong app đều có thể inject `PrismaService` mà không cần import `PrismaModule`.

### 4.5 schema.prisma — Database Schema

```prisma
generator client {
  provider = "prisma-client-js"    // Generate TypeScript client
}

datasource db {
  provider  = "postgresql"         // Database type
  url       = env("DATABASE_URL")  // Connection string từ .env
  directUrl = env("DIRECT_URL")    // Direct connection (cho migrations)
}
```

#### Prisma là gì?

**Prisma** là **ORM** (Object-Relational Mapping) — cầu nối giữa TypeScript objects và database tables.

```
TypeScript (Objects)          Database (Tables)
─────────────────          ───────────────────
interface User {            CREATE TABLE users (
  id: string                  id VARCHAR PRIMARY KEY,
  email: string               email VARCHAR UNIQUE,
  fullName: string            full_name VARCHAR,
  role: Role                  role VARCHAR DEFAULT 'STUDENT',
  isActive: boolean           is_active BOOLEAN DEFAULT true
}                           );
```

**Prisma tự động generate:**

1. TypeScript types từ schema → type-safe queries
2. SQL migrations từ schema changes → version control cho DB

```typescript
// Prisma query (TypeScript, type-safe):
const user = await prisma.user.findUnique({
  where: { email: 'test@example.com' },
});
// user: User | null  ← TypeScript biết type chính xác

// Tương đương SQL:
// SELECT * FROM users WHERE email = 'test@example.com' LIMIT 1;
```

#### Model User giải thích

```prisma
model User {
  id        String    @id @default(cuid())    // Primary key, auto-generate CUID
  email     String    @unique                 // Unique constraint
  password  String                            // Bcrypt hash, KHÔNG phải plaintext
  fullName  String    @map("full_name")       // TS: fullName → DB column: full_name
  role      Role      @default(STUDENT)       // Enum, default = STUDENT
  avatarUrl String?   @map("avatar_url")      // ? = nullable (optional)
  isActive  Boolean   @default(true) @map("is_active")

  createdAt DateTime  @default(now()) @map("created_at")   // Auto-set khi create
  updatedAt DateTime  @updatedAt @map("updated_at")        // Auto-update khi modify
  deletedAt DateTime? @map("deleted_at")                   // Soft delete

  @@map("users")   // Model name: User (PascalCase) → Table name: users (snake_case)
}
```

#### CUID là gì?

**CUID** (Collision-resistant Unique ID) là ID format:

```
clh3am7k90001l708dkvjxqz2
│       │    │    │
│       │    │    └── Random characters
│       │    └── Counter (chống collision)
│       └── Timestamp
└── Prefix
```

**So sánh ID strategies:**

| Strategy       | Example          | Pros                              | Cons                                               |
| -------------- | ---------------- | --------------------------------- | -------------------------------------------------- |
| Auto-increment | 1, 2, 3, ...     | Đơn giản                          | Lộ số lượng records, merge conflict giữa databases |
| UUID v4        | 550e8400-e29b... | Unique globally                   | Dài (36 chars), không sortable                     |
| **CUID**       | clh3am7k9...     | Unique, sortable by time, shorter | Slightly longer than int                           |

#### Soft Delete là gì?

```
Hard delete:  DELETE FROM users WHERE id = 'xxx'  → Data MẤT VĨNH VIỄN

Soft delete:  UPDATE users SET deleted_at = NOW() WHERE id = 'xxx'
              → Data vẫn trong DB, chỉ bị đánh dấu "đã xóa"
              → Có thể khôi phục: UPDATE users SET deleted_at = NULL
              → Queries phải thêm: WHERE deleted_at IS NULL
```

SSLM dùng soft delete cho User, Course, Post — data quan trọng cần khôi phục được.

#### @map() và @@map()

Prisma convention: TypeScript dùng **camelCase**, PostgreSQL dùng **snake_case**:

```
@map("full_name")   → Field level: fullName (TS) → full_name (DB column)
@@map("users")      → Model level: User (TS) → users (DB table)
```

---

## 5. DEPENDENCY INJECTION — HIỂU SÂU HƠN

### 5.1 Cách NestJS resolve dependencies

```typescript
// Khi app start, NestJS:

// 1. Scan tất cả @Module() declarations
// 2. Tạo DI container (registry of all providers)
// 3. Khi cần tạo AuthService:
//    a. Nhìn constructor: cần PrismaService và JwtService
//    b. Tìm trong DI container: đã có PrismaService instance chưa?
//    c. Nếu chưa → tạo PrismaService → gọi onModuleInit() → cache instance
//    d. Inject PrismaService instance vào AuthService constructor
//    e. Tương tự với JwtService
//    f. Trả về AuthService instance hoàn chỉnh

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService, // NestJS inject
    private jwt: JwtService, // NestJS inject
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      // Dùng prisma
      where: { email: dto.email },
    });
    // ...
  }
}
```

### 5.2 Provider Scope

```
Singleton (mặc định):
  1 instance cho cả app
  Phù hợp: PrismaService, JwtService, ...

Request scope:
  1 instance mới cho MỖI HTTP request
  Phù hợp: Request-specific context

Transient scope:
  1 instance mới mỗi lần inject
  Hiếm khi dùng
```

---

## 6. TÓM TẮT FLOW

```
npm run dev (trong apps/api/)
│
├── nest start --watch
│   ├── SWC compile TypeScript → JavaScript (dist/)
│   ├── Node.js chạy dist/main.js
│   │   ├── NestFactory.create(AppModule)
│   │   │   ├── Load ConfigModule → đọc .env
│   │   │   ├── Load PrismaModule
│   │   │   │   └── PrismaService.$connect() → PostgreSQL (localhost:5432)
│   │   │   └── DI container ready
│   │   ├── setGlobalPrefix('api')
│   │   ├── enableCors([localhost:3001, localhost:3002])
│   │   ├── useGlobalPipes(ValidationPipe)
│   │   ├── Swagger setup → /api/docs
│   │   └── app.listen(3000)
│   │
│   └── File watcher: khi edit .ts → auto-rebuild + restart
│
└── Server running: http://localhost:3000
    ├── API endpoints: /api/...
    └── Swagger docs: /api/docs
```
