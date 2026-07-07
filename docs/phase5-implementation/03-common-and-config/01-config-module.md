# 01 — Config Module: Namespaced Configuration & Environment Variables

> Giải thích chi tiết cách NestJS quản lý environment variables, pattern `registerAs()`,
> namespaced config, và tại sao SSLM tách 8 config files riêng biệt.

---

## 1. VẤN ĐỀ: QUẢN LÝ ENVIRONMENT VARIABLES

### 1.1 Tại sao cần environment variables?

Application cần nhiều config values thay đổi theo môi trường:

```
Development:
  DATABASE_URL = "postgresql://localhost:5432/sslm_dev"
  JWT_SECRET   = "dev-secret"
  PORT         = 3000

Production:
  DATABASE_URL = "postgresql://neon.tech/sslm_prod"
  JWT_SECRET   = "super-secret-random-string-256-chars"
  PORT         = 8080
```

**Quy tắc vàng:** KHÔNG BAO GIỜ hardcode secrets trong code. Luôn đọc từ environment.

### 1.2 Cách đọc env vars trong Node.js

```typescript
// Cách thô — dùng process.env trực tiếp
const port = process.env.PORT; // string | undefined
const secret = process.env.JWT_SECRET; // string | undefined

// Vấn đề:
// ❌ Không type-safe (luôn là string hoặc undefined)
// ❌ Không có default values
// ❌ Không validate (thiếu biến → crash lúc runtime)
// ❌ Scattered — process.env.XYZ rải rác khắp codebase
```

### 1.3 NestJS ConfigModule giải quyết vấn đề này

```typescript
// ✅ Centralized — config tập trung 1 chỗ
// ✅ Type-safe — biết chính xác kiểu dữ liệu
// ✅ Default values — fallback khi env var thiếu
// ✅ Namespaced — nhóm config theo domain
// ✅ DI-ready — inject ConfigService ở bất kỳ đâu
```

---

## 2. `@nestjs/config` — ConfigModule & ConfigService

### 2.1 ConfigModule là gì?

`ConfigModule` là NestJS module đọc file `.env` và load vào `ConfigService`:

```
.env file                    ConfigModule                  ConfigService
─────────                    ────────────                  ─────────────
PORT=3000                    Đọc .env file       ┌──→     .get('PORT')        → "3000"
JWT_SECRET=abc      ────→    Parse key=value     ├──→     .get('JWT_SECRET')  → "abc"
REDIS_URL=redis://   Load    Merge process.env   └──→     .get('REDIS_URL')   → "redis://"
```

### 2.2 Cách dùng cơ bản (Phase 5.1)

```typescript
// Phase 5.1 — cách cũ, flat config
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Available ở mọi module
      envFilePath: '.env', // Đọc từ file .env
    }),
  ],
})
export class AppModule {}

// Sử dụng:
configService.get('PORT'); // "3000" (string)
configService.get('JWT_SECRET'); // "abc" (string)
```

**Vấn đề với flat config:**

```typescript
// 30+ env vars → khó quản lý, dễ nhầm tên
configService.get('JWT_ACCESS_SECRET'); // Auth
configService.get('JWT_REFRESH_SECRET'); // Auth
configService.get('CLOUDINARY_CLOUD_NAME'); // Upload
configService.get('CLOUDINARY_API_KEY'); // Upload
configService.get('SMTP_USER'); // Email
configService.get('GROQ_API_KEY'); // AI
// ... còn nhiều nữa

// ❌ Không biết env var thuộc module nào
// ❌ Không có intellisense / autocomplete
// ❌ Tất cả đều là string, cần parseInt() thủ công
```

---

## 3. `registerAs()` — NAMESPACED CONFIG

### 3.1 Concept

`registerAs()` nhóm các config values liên quan vào **namespace** (nhóm có tên):

```typescript
import { registerAs } from '@nestjs/config';

// Tạo namespace "auth" chứa tất cả config liên quan đến authentication
export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
}));
```

### 3.2 Cách truy cập

```typescript
// Trước (flat) — string key, dễ typo
configService.get('JWT_ACCESS_SECRET');

// Sau (namespaced) — dot notation, có cấu trúc
configService.get('auth.jwtAccessSecret');
//                  ^^^^  ^^^^^^^^^^^^^^^^
//                  namespace  property
```

### 3.3 Tại sao dùng registerAs?

```
┌──────────────────────────────────────────────────┐
│              BEFORE (Flat Config)                  │
│                                                    │
│  process.env.JWT_ACCESS_SECRET                     │
│  process.env.JWT_REFRESH_SECRET                    │
│  process.env.CLOUDINARY_CLOUD_NAME                 │
│  process.env.CLOUDINARY_API_KEY                    │
│  process.env.SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS │
│  process.env.GROQ_API_KEY                          │
│  ... 30+ env vars lộn xộn trong 1 flat namespace   │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              AFTER (Namespaced Config)              │
│                                                    │
│  auth.jwtAccessSecret                              │
│  auth.jwtRefreshSecret        ← Auth group         │
│  auth.googleClientId                               │
│                                                    │
│  cloudinary.cloudName                              │
│  cloudinary.apiKey            ← Upload group       │
│  cloudinary.apiSecret                              │
│                                                    │
│  mail.smtpHost               ← Email group        │
│  mail.smtpUser                                     │
│  mail.fromEmail                                    │
│                                                    │
│  groq.apiKey                  ← AI group           │
│  groq.model                                        │
└──────────────────────────────────────────────────┘
```

---

## 4. CÁC CONFIG FILES TRONG SSLM

### 4.1 Tổng quan 8 config files

```
src/config/
├── config.module.ts        ← Module gom tất cả configs
├── app.config.ts           ← App-level (port, URLs, env)
├── auth.config.ts          ← JWT, Google OAuth
├── database.config.ts      ← PostgreSQL URLs
├── redis.config.ts         ← Redis connection
├── cloudinary.config.ts    ← Media upload
├── mail.config.ts          ← Email service
├── sepay.config.ts         ← Payment gateway
└── groq.config.ts          ← AI service (Llama 3.3)
```

### 4.2 `app.config.ts` — Cấu hình ứng dụng

```typescript
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  studentPortalUrl: process.env.STUDENT_PORTAL_URL || 'http://localhost:3001',
  managementPortalUrl: process.env.MANAGEMENT_PORTAL_URL || 'http://localhost:3002',
  isProduction: process.env.NODE_ENV === 'production',
}));
```

**Giải thích:**

| Property              | Env Var                 | Mô tả                               | Default        |
| --------------------- | ----------------------- | ----------------------------------- | -------------- |
| `port`                | `PORT`                  | Port server lắng nghe               | 3000           |
| `nodeEnv`             | `NODE_ENV`              | Môi trường (development/production) | development    |
| `appUrl`              | `APP_URL`               | URL của backend API                 | localhost:3000 |
| `studentPortalUrl`    | `STUDENT_PORTAL_URL`    | URL student frontend                | localhost:3001 |
| `managementPortalUrl` | `MANAGEMENT_PORTAL_URL` | URL instructor/admin frontend       | localhost:3002 |
| `isProduction`        | —                       | Computed flag                       | false          |

**`parseInt(process.env.PORT || '3000', 10)`** — Env vars luôn là string. Cần convert sang number:

- `process.env.PORT` → `"3000"` (string)
- `parseInt("3000", 10)` → `3000` (number)
- `, 10` = radix 10 (hệ thập phân) — best practice để tránh bug khi string bắt đầu bằng `0`

**`isProduction`** — Computed property, không đọc từ env var. Dùng để toggle behavior:

```typescript
if (configService.get('app.isProduction')) {
  // Production: enable strict security
} else {
  // Development: enable Swagger, verbose logging
}
```

### 4.3 `auth.config.ts` — Authentication

```typescript
export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
}));
```

**Tại sao 2 JWT secrets khác nhau?**

```
Access Token:
  Secret: JWT_ACCESS_SECRET
  TTL: 15 phút
  Dùng: Xác thực mỗi API request
  Nếu lộ: Attacker chỉ có quyền 15 phút

Refresh Token:
  Secret: JWT_REFRESH_SECRET
  TTL: 7 ngày
  Dùng: Lấy access token mới khi hết hạn
  Nếu lộ: Attacker có quyền 7 ngày → nguy hiểm hơn
```

Dùng 2 secrets riêng biệt → nếu 1 bị lộ, cái còn lại vẫn an toàn. Đây là **defense in depth** (bảo vệ nhiều lớp).

**Google OAuth (optional):** `googleClientId` và `googleClientSecret` không có default value — chỉ dùng khi đã setup Google OAuth project.

### 4.4 `database.config.ts` — PostgreSQL

```typescript
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
}));
```

**Không có default values** — database URL là bắt buộc, thiếu thì app không thể chạy. Prisma sẽ throw error rõ ràng nếu thiếu.

### 4.5 `redis.config.ts` — Redis Cache

```typescript
export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}));
```

Default `redis://localhost:6379` — Docker Redis container chạy ở local.

### 4.6 `cloudinary.config.ts` — Media Upload

```typescript
export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
}));
```

3 credentials cần từ Cloudinary dashboard. Không có default — upload không hoạt động nếu thiếu.

### 4.7 `mail.config.ts` — Email

```typescript
export const mailConfig = registerAs('mail', () => ({
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
}));
```

`smtpHost` có default `smtp.gmail.com` — production dùng Gmail App Password. Development có thể dùng placeholder (email sẽ không gửi thật nếu thiếu SMTP credentials).

### 4.8 `sepay.config.ts` — Payment

```typescript
export const sepayConfig = registerAs('sepay', () => ({
  webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
  bankAccountName: process.env.BANK_ACCOUNT_NAME,
}));
```

SePay là payment gateway của Việt Nam — xử lý QR bank transfer. `webhookSecret` dùng để verify webhook requests.

### 4.9 `groq.config.ts` — AI Service

```typescript
export const groqConfig = registerAs('groq', () => ({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
}));
```

**Groq** là inference provider — chạy Llama 3.3 70B model cực nhanh. SSLM dùng cho AI Tutor feature.

---

## 5. AppConfigModule — GOM TẤT CẢ CONFIGS

### 5.1 File `config.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { authConfig } from './auth.config';
// ... (import tất cả 8 config files)

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        cloudinaryConfig,
        mailConfig,
        sepayConfig,
        groqConfig,
      ],
      envFilePath: ['.env'],
    }),
  ],
})
export class AppConfigModule {}
```

### 5.2 Giải thích từng option

| Option           | Giá trị            | Giải thích                                                     |
| ---------------- | ------------------ | -------------------------------------------------------------- |
| `isGlobal: true` | Boolean            | `ConfigService` available ở **mọi module** mà không cần import |
| `load`           | Array of factories | 8 `registerAs()` factories — mỗi factory tạo 1 namespace       |
| `envFilePath`    | `['.env']`         | Đọc file `.env` ở root folder `apps/api/`                      |

### 5.3 `@Global()` decorator

```typescript
@Global()   // ← Module này không cần import ở các module khác
@Module({ ... })
export class AppConfigModule {}
```

Khi `AppConfigModule` được import trong `AppModule` (root), tất cả providers bên trong (bao gồm `ConfigService`) tự động available ở mọi module con. Không cần `imports: [AppConfigModule]` ở mỗi feature module.

### 5.4 Tại sao đặt tên `AppConfigModule` thay vì `ConfigModule`?

```typescript
// ❌ Trùng tên với @nestjs/config
import { ConfigModule } from '@nestjs/config'; // NestJS's module
import { ConfigModule } from './config.module'; // Our module ← CONFLICT!

// ✅ Tên riêng, không conflict
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config.module'; // Clear distinction
```

### 5.5 Flow hoạt động

```
App starts
    │
    ▼
AppModule imports AppConfigModule
    │
    ▼
AppConfigModule imports NestConfigModule.forRoot()
    │
    ├── Đọc .env file
    ├── Load 8 config factories (registerAs)
    ├── Merge env vars vào ConfigService
    │
    ▼
ConfigService sẵn sàng — inject ở bất kỳ đâu:
    configService.get('app.port')              → 3000
    configService.get('auth.jwtAccessSecret')  → "access-secret-dev"
    configService.get('redis.url')             → "redis://localhost:6379"
    configService.get('cloudinary.cloudName')  → "my-cloud"
    configService.get('groq.model')            → "llama-3.3-70b-versatile"
```

---

## 6. CÁCH SỬ DỤNG TRONG SERVICE

### 6.1 Inject ConfigService

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SomeService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  getPort(): number {
    return this.configService.get<number>('app.port')!;
    //                          ^^^^^^^^  ^^^^^^^^^^
    //                          type hint  namespace.key
  }
}
```

### 6.2 Tại sao dùng `@Inject(ConfigService)` thay vì chỉ `private configService: ConfigService`?

Đây là pattern đặc biệt trong SSLM — liên quan đến **SWC builder + ESLint `consistent-type-imports`**:

```typescript
// ESLint rule: consistent-type-imports
// Yêu cầu: nếu import chỉ dùng cho type → phải dùng "import type"
// Nhưng NestJS DI cần runtime class reference

// ❌ ESLint báo lỗi — ConfigService chỉ dùng cho type annotation
import { ConfigService } from '@nestjs/config';
constructor(private configService: ConfigService) {}
//                                 ^^^^^^^^^^^^^ ESLint: this is type-only

// ✅ Thêm @Inject() — ESLint nhận ra ConfigService dùng ở runtime
import { ConfigService } from '@nestjs/config';
constructor(@Inject(ConfigService) private configService: ConfigService) {}
//           ^^^^^^^^^^^^^^^^^^^^^^ Runtime usage → ESLint happy
```

**Bối cảnh kỹ thuật:**

- **SWC builder** (Rust-based compiler, nhanh 20x) KHÔNG hỗ trợ `emitDecoratorMetadata` thực sự
- NestJS DI thường dựa vào decorator metadata để biết inject class nào
- `@Inject(ConfigService)` **nói trực tiếp** cho NestJS: "inject ConfigService ở đây"
- Không phụ thuộc vào metadata → hoạt động với mọi builder (tsc, SWC, esbuild)

---

## 7. SO SÁNH VỚI CÁC CÁCH KHÁC

### 7.1 NestJS ConfigModule vs dotenv thuần

|                | dotenv thuần   | NestJS ConfigModule        |
| -------------- | -------------- | -------------------------- |
| Type safety    | ❌ Luôn string | ✅ Generic types           |
| Namespace      | ❌ Flat        | ✅ registerAs()            |
| DI integration | ❌ process.env | ✅ Inject ConfigService    |
| Validation     | ❌ Manual      | ✅ Joi / class-validator   |
| Testing        | ❌ Khó mock    | ✅ Easy mock ConfigService |

### 7.2 Khi nào cần validation?

SSLM hiện chưa validate env vars (throw error nếu thiếu). Có thể thêm sau:

```typescript
// Ví dụ: validate bắt buộc DATABASE_URL
import * as Joi from 'joi';

NestConfigModule.forRoot({
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_ACCESS_SECRET: Joi.string().required(),
    PORT: Joi.number().default(3000),
  }),
});
```

---

## 8. TÓM TẮT

```
Vấn đề: 30+ env vars → khó quản lý, không type-safe, scattered
    │
    ▼
Giải pháp: registerAs() + namespaced config
    │
    ├── 8 config files, mỗi file 1 domain (auth, database, redis, ...)
    ├── AppConfigModule gom tất cả, @Global() → available everywhere
    ├── ConfigService.get('namespace.key') → type-safe access
    └── @Inject(ConfigService) → SWC-compatible DI pattern
```
