# Phase 5.1 — PROJECT SETUP

> Tài liệu chi tiết tất cả actions cần thực hiện để setup project từ đầu.
> Mỗi step đều có commands cụ thể và files cần tạo/cấu hình.

---

## Mục lục

- [Step 1: Git & Repository](#step-1-git--repository)
- [Step 2: Monorepo Root](#step-2-monorepo-root)
- [Step 3: Docker (PostgreSQL + Redis + pgAdmin)](#step-3-docker-postgresql--redis--pgadmin)
- [Step 4: EditorConfig](#step-4-editorconfig)
- [Step 5: Backend — NestJS](#step-5-backend--nestjs)
- [Step 6: Frontend — Student Portal](#step-6-frontend--student-portal)
- [Step 7: Frontend — Management Portal](#step-7-frontend--management-portal)
- [Step 8: Shared Packages](#step-8-shared-packages)
- [Step 9: Turborepo Config](#step-9-turborepo-config)
- [Step 10: Prettier](#step-10-prettier)
- [Step 11: ESLint](#step-11-eslint)
- [Step 12: Husky + lint-staged + commitlint](#step-12-husky--lint-staged--commitlint)
- [Step 13: Verify Everything](#step-13-verify-everything)

---

## Step 1: Git & Repository

### 1.1 Khởi tạo Git

```bash
cd smart-social-learning-marketplace
git init
```

### 1.2 Tạo file `.gitignore`

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
.next/
out/
.turbo/

# Documentation (private, not pushed to GitHub)
docs/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
debug.log*

# Testing
coverage/

# Prisma
apps/api/src/prisma/migrations/**/migration_lock.toml

# Docker volumes
pgdata/
redisdata/

# Misc
*.tsbuildinfo
next-env.d.ts
```

### 1.3 Tạo GitHub repository

```bash
# Tạo repo trên GitHub (public hoặc private)
# Sau đó:
git remote add origin https://github.com/<username>/smart-social-learning-marketplace.git
```

### 1.4 Initial commit

```bash
git add .gitignore CLAUDE.md docs/
git commit -m "chore: initial commit with design docs and CLAUDE.md"
git branch -M main
git push -u origin main
```

---

## Step 2: Monorepo Root

### 2.1 Tạo root `package.json`

```bash
npm init -y
```

Chỉnh sửa `package.json`:

```json
{
  "name": "smart-social-learning-marketplace",
  "version": "0.0.1",
  "private": true,
  "description": "Smart Social Learning Marketplace — Graduation Thesis",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "clean": "turbo clean && rm -rf node_modules",
    "db:dev": "docker compose up -d",
    "db:stop": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d",
    "prepare": "husky"
  },
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  }
}
```

### 2.2 Tạo thư mục apps và packages

```bash
mkdir -p apps/api
mkdir -p apps/student-portal
mkdir -p apps/management-portal
mkdir -p packages/shared-types
mkdir -p packages/shared-ui
mkdir -p packages/shared-utils
mkdir -p packages/shared-hooks
mkdir -p packages/shared-i18n
mkdir -p packages/shared-api-client
```

---

## Step 3: Docker (PostgreSQL + Redis + pgAdmin)

### 3.1 Tạo `docker-compose.yml` tại root

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: sslm-postgres
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: sslm_user
      POSTGRES_PASSWORD: sslm_password
      POSTGRES_DB: sslm_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U sslm_user -d sslm_dev']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: sslm-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: sslm-pgadmin
    restart: unless-stopped
    ports:
      - '5050:80'
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@sslm.dev
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    volumes:
      - pgadmindata:/var/lib/pgadmin
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
  redisdata:
  pgadmindata:
```

### 3.2 Verify Docker chạy được

```bash
# Start containers
docker compose up -d

# Check status
docker compose ps

# Expected: 3 containers running (postgres, redis, pgadmin)

# Test PostgreSQL connection
docker exec sslm-postgres psql -U sslm_user -d sslm_dev -c "SELECT 1;"

# Test Redis connection
docker exec sslm-redis redis-cli ping
# Expected: PONG

# Test pgAdmin: mở http://localhost:5050
# Login: admin@sslm.dev / admin

# Stop khi không cần
docker compose down
```

### 3.3 Cấu hình pgAdmin kết nối PostgreSQL

```
Mở http://localhost:5050 → Add New Server:
  - Name: SSML Local
  - Host: postgres        (tên container, KHÔNG phải localhost vì pgAdmin chạy trong Docker)
  - Port: 5432
  - Database: sslm_dev
  - Username: sslm_user
  - Password: sslm_password
```

---

## Step 4: EditorConfig

### 4.1 Tạo `.editorconfig` tại root

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
```

---

## Step 5: Backend — NestJS

### 5.1 Khởi tạo NestJS project

```bash
cd apps/api

# Tạo package.json
npm init -y
```

Chỉnh sửa `apps/api/package.json`:

```json
{
  "name": "api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "start:prod": "node dist/main.js",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node src/prisma/seed.ts"
  }
}
```

### 5.2 Install NestJS dependencies

```bash
cd apps/api

# Core NestJS
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs

# Config
npm install @nestjs/config

# Auth
npm install @nestjs/passport passport passport-jwt jsonwebtoken
npm install @nestjs/jwt

# Validation
npm install class-validator class-transformer

# Database
npm install @prisma/client
npm install prisma --save-dev

# Swagger
npm install @nestjs/swagger

# WebSocket
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Cron & Queue
npm install @nestjs/schedule
npm install @nestjs/bull bull

# External services
npm install cloudinary
npm install groq-sdk
npm install nodemailer
npm install -D @types/nodemailer
npm install ioredis

# Utilities
npm install bcryptjs
npm install slugify
npm install nanoid

# Dev dependencies
npm install --save-dev @nestjs/cli @nestjs/schematics @nestjs/testing
npm install --save-dev @types/node @types/express @types/bcryptjs @types/passport-jwt
npm install --save-dev typescript ts-node ts-loader
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### 5.3 Tạo `apps/api/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "paths": {
      "@/*": ["src/*"],
      "@common/*": ["src/common/*"],
      "@modules/*": ["src/modules/*"],
      "@config/*": ["src/config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 5.4 Tạo `apps/api/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### 5.5 Tạo `apps/api/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "builder": "swc",
    "typeCheck": true
  }
}
```

### 5.6 Tạo cấu trúc thư mục backend

```bash
cd apps/api

# Main files
mkdir -p src

# Common
mkdir -p src/common/decorators
mkdir -p src/common/guards
mkdir -p src/common/interceptors
mkdir -p src/common/pipes
mkdir -p src/common/filters
mkdir -p src/common/dto
mkdir -p src/common/interfaces
mkdir -p src/common/utils
mkdir -p src/common/constants

# Config
mkdir -p src/config

# Prisma
mkdir -p src/prisma

# Feature modules
mkdir -p src/modules/auth/dto
mkdir -p src/modules/auth/guards
mkdir -p src/modules/auth/strategies
mkdir -p src/modules/users/dto
mkdir -p src/modules/courses/dto
mkdir -p src/modules/lessons/dto
mkdir -p src/modules/enrollments/dto
mkdir -p src/modules/orders/dto
mkdir -p src/modules/payments/dto
mkdir -p src/modules/social/dto
mkdir -p src/modules/chat/dto
mkdir -p src/modules/notifications/dto
mkdir -p src/modules/qna/dto
mkdir -p src/modules/ai-tutor/dto
mkdir -p src/modules/media/dto
mkdir -p src/modules/categories/dto
mkdir -p src/modules/reviews/dto
mkdir -p src/modules/coupons/dto
mkdir -p src/modules/withdrawals/dto
mkdir -p src/modules/reports/dto
mkdir -p src/modules/analytics/dto

# Test
mkdir -p test
```

### 5.7 Tạo file `apps/api/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: [
      process.env.STUDENT_PORTAL_URL || 'http://localhost:3001',
      process.env.MANAGEMENT_PORTAL_URL || 'http://localhost:3002',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('SSML API')
    .setDescription('Smart Social Learning Marketplace API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
```

### 5.8 Tạo file `apps/api/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    // Feature modules sẽ được thêm dần ở đây
  ],
})
export class AppModule {}
```

### 5.9 Tạo Prisma module

**File `apps/api/src/prisma/prisma.module.ts`:**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**File `apps/api/src/prisma/prisma.service.ts`:**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 5.10 Tạo Prisma schema cơ bản

**File `apps/api/src/prisma/schema.prisma`:**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // For Neon.tech migrations
}

// Models sẽ được thêm dần theo từng feature
// Xem full schema tại: docs/phase2-database/01-database-design.md

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  fullName  String   @map("full_name")
  role      Role     @default(STUDENT)
  avatarUrl String?  @map("avatar_url")
  isActive  Boolean  @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@map("users")
}

enum Role {
  STUDENT
  INSTRUCTOR
  ADMIN
}
```

### 5.11 Tạo file `.env.example` cho backend

**File `apps/api/.env.example`:**

```env
# Database (Docker local)
DATABASE_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev?schema=public"
DIRECT_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev?schema=public"

# Auth
JWT_ACCESS_SECRET="your-access-secret-change-this"
JWT_REFRESH_SECRET="your-refresh-secret-change-this"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis (Docker local)
REDIS_URL="redis://localhost:6379"

# Cloudinary
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# AI
GROQ_API_KEY=""

# Email (Gmail SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM_EMAIL=""

# Payment
SEPAY_WEBHOOK_SECRET=""
BANK_ACCOUNT_NUMBER=""
BANK_ACCOUNT_NAME=""

# App URLs
PORT=3000
NODE_ENV="development"
STUDENT_PORTAL_URL="http://localhost:3001"
MANAGEMENT_PORTAL_URL="http://localhost:3002"
```

### 5.12 Tạo file `.env` cho backend (copy từ example)

```bash
cd apps/api
cp .env.example .env
# Chỉnh sửa giá trị thực tế nếu cần
```

### 5.13 Khởi tạo Prisma và database

```bash
cd apps/api

# Generate Prisma client
npx prisma generate

# Chạy migration đầu tiên (cần Docker PostgreSQL đang chạy)
npx prisma migrate dev --name init

# Verify bằng Prisma Studio
npx prisma studio
# Mở http://localhost:5555 → thấy bảng User
```

### 5.14 Tạo Jest config cho backend

**File `apps/api/jest.config.ts`:**

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/node_modules/**', '!**/dist/**'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
};

export default config;
```

### 5.15 Verify backend chạy được

```bash
cd apps/api

# Start dev server
npm run dev

# Expected output:
# 🚀 API running on http://localhost:3000
# 📚 Swagger docs: http://localhost:3000/api/docs

# Test health: mở http://localhost:3000/api/docs → thấy Swagger UI
# Ctrl+C để dừng
```

---

## Step 6: Frontend — Student Portal

### 6.1 Khởi tạo Next.js 16 project

```bash
cd apps/student-portal

# Tạo Next.js project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
# Chọn: Yes cho tất cả options
```

### 6.2 Chỉnh sửa `apps/student-portal/package.json`

```json
{
  "name": "student-portal",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001 --turbopack",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint"
  }
}
```

> **Lưu ý:** Port 3001 để không conflict với backend (3000)

### 6.3 Install thêm dependencies

```bash
cd apps/student-portal

# i18n
npm install next-intl

# Theme
npm install next-themes

# State management
npm install @tanstack/react-query zustand

# Forms
npm install react-hook-form @hookform/resolvers zod

# UI
npm install lucide-react sonner
npm install class-variance-authority clsx tailwind-merge

# Realtime
npm install socket.io-client

# Video
npm install video.js @types/video.js

# Rich text
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder

# Charts
npm install recharts

# Dev
npm install --save-dev @types/node
```

### 6.4 Install và cấu hình shadcn/ui

```bash
cd apps/student-portal

# Init shadcn/ui
npx shadcn@latest init
# Chọn:
#   Style: New York
#   Base color: Neutral
#   CSS variables: Yes

# Install core components
npx shadcn@latest add button input label card dialog sheet
npx shadcn@latest add dropdown-menu select checkbox radio-group
npx shadcn@latest add tabs avatar badge separator
npx shadcn@latest add skeleton scroll-area accordion progress
npx shadcn@latest add popover command pagination
npx shadcn@latest add table textarea switch slider
npx shadcn@latest add alert tooltip
```

### 6.5 Cấu hình next-intl

**File `apps/student-portal/src/i18n/request.ts`:**

```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'vi' | 'en')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

**File `apps/student-portal/src/i18n/routing.ts`:**

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'as-needed',
});
```

**File `apps/student-portal/src/i18n/navigation.ts`:**

```typescript
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

### 6.6 Tạo translation files cơ bản

**File `apps/student-portal/messages/vi.json`:**

```json
{
  "common": {
    "appName": "Smart Social Learning Marketplace",
    "loading": "Đang tải...",
    "save": "Lưu",
    "cancel": "Hủy",
    "delete": "Xóa",
    "edit": "Chỉnh sửa",
    "search": "Tìm kiếm",
    "back": "Quay lại",
    "next": "Tiếp theo",
    "submit": "Gửi",
    "confirm": "Xác nhận"
  }
}
```

**File `apps/student-portal/messages/en.json`:**

```json
{
  "common": {
    "appName": "Smart Social Learning Marketplace",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "back": "Back",
    "next": "Next",
    "submit": "Submit",
    "confirm": "Confirm"
  }
}
```

> **Lưu ý:** Translation files đầy đủ xem tại `docs/phase4-frontend/02-i18n-and-messages.md`.
> Sẽ bổ sung dần khi implement từng feature.

### 6.7 Cấu hình next-themes

Tích hợp trong root layout (sẽ tạo ở bước 6.9).

### 6.8 Tạo cấu trúc thư mục frontend

```bash
cd apps/student-portal/src

# App routes
mkdir -p app/[locale]/(auth)/login
mkdir -p app/[locale]/(auth)/register
mkdir -p app/[locale]/(main)
mkdir -p app/[locale]/(learning)

# Components
mkdir -p components/ui          # shadcn/ui (đã tạo bởi shadcn init)
mkdir -p components/layout      # Navbar, Footer, Sidebar
mkdir -p components/features    # Domain-specific components

# Hooks
mkdir -p hooks

# Stores
mkdir -p stores

# Lib
mkdir -p lib

# Styles (global CSS đã có từ create-next-app)
```

### 6.9 Tạo root layout với providers

**File `apps/student-portal/src/app/layout.tsx`:**

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Smart Social Learning Marketplace',
  description: 'Nền tảng học trực tuyến kết hợp mạng xã hội và AI Tutor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**File `apps/student-portal/src/app/[locale]/layout.tsx`:**

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { routing } from '@/i18n/routing';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'vi' | 'en')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey="sslm-theme"
    >
      <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
    </ThemeProvider>
  );
}
```

### 6.10 Tạo `apps/student-portal/.env.example`

```env
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
NEXT_PUBLIC_WS_URL="http://localhost:3000"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=""
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=""
```

### 6.11 Copy `.env.example` → `.env.local`

```bash
cd apps/student-portal
cp .env.example .env.local
```

### 6.12 Tạo utility function `cn()` (nếu shadcn chưa tạo)

**File `apps/student-portal/src/lib/utils.ts`:**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 6.13 Verify student portal chạy được

```bash
cd apps/student-portal

npm run dev

# Expected: mở http://localhost:3001 → thấy Next.js page
# Ctrl+C để dừng
```

---

## Step 7: Frontend — Management Portal

### 7.1 Tạo project tương tự Student Portal

```bash
cd apps/management-portal

npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 7.2 Chỉnh sửa `apps/management-portal/package.json`

```json
{
  "name": "management-portal",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002 --turbopack",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "next lint"
  }
}
```

> **Port 3002** để không conflict với backend (3000) và student portal (3001)

### 7.3 Install dependencies (giống Student Portal)

```bash
cd apps/management-portal

# Giống Step 6.3 — cùng dependencies
npm install next-intl next-themes
npm install @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod
npm install lucide-react sonner
npm install class-variance-authority clsx tailwind-merge
npm install socket.io-client
npm install recharts
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
npm install --save-dev @types/node
```

> **Không cần** video.js vì Management Portal không có video player.

### 7.4 Cấu hình shadcn/ui

```bash
cd apps/management-portal

npx shadcn@latest init
# Cùng options như Student Portal

# Install components (nhiều DataTable components hơn)
npx shadcn@latest add button input label card dialog sheet
npx shadcn@latest add dropdown-menu select checkbox radio-group
npx shadcn@latest add tabs avatar badge separator
npx shadcn@latest add skeleton scroll-area accordion progress
npx shadcn@latest add popover command pagination
npx shadcn@latest add table textarea switch slider
npx shadcn@latest add alert tooltip
```

### 7.5 Cấu hình i18n + themes (giống Student Portal)

```bash
# Copy cấu hình từ student-portal
# Tạo cùng cấu trúc files:
#   src/i18n/request.ts
#   src/i18n/routing.ts
#   src/i18n/navigation.ts
#   messages/vi.json
#   messages/en.json
```

### 7.6 Tạo cấu trúc thư mục

```bash
cd apps/management-portal/src

# App routes
mkdir -p app/[locale]/(auth)/login
mkdir -p app/[locale]/(instructor)
mkdir -p app/[locale]/(admin)

# Components
mkdir -p components/ui
mkdir -p components/layout      # Sidebar, Header
mkdir -p components/features

# Hooks, Stores, Lib
mkdir -p hooks
mkdir -p stores
mkdir -p lib
```

### 7.7 Tạo layouts (giống Student Portal nhưng khác navigation)

Tạo các file layout giống Step 6.9, thay đổi metadata phù hợp:

```typescript
// app/layout.tsx — giống student-portal
// app/[locale]/layout.tsx — giống student-portal

// Metadata khác:
export const metadata: Metadata = {
  title: 'SSML Management',
  description: 'Instructor & Admin Management Portal',
};
```

### 7.8 Tạo `.env.example` và `.env.local`

```bash
cd apps/management-portal
# Giống Student Portal
cp apps/student-portal/.env.example .env.example
cp .env.example .env.local
```

### 7.9 Verify management portal chạy được

```bash
cd apps/management-portal
npm run dev
# Expected: mở http://localhost:3002 → thấy Next.js page
```

---

## Step 8: Shared Packages

### 8.1 Package: `@shared/types`

**File `packages/shared-types/package.json`:**

```json
{
  "name": "@shared/types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  }
}
```

**File `packages/shared-types/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File `packages/shared-types/src/index.ts`:**

```typescript
// User types
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum Role {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
}

// Types sẽ được thêm dần khi implement từng feature
```

### 8.2 Package: `@shared/utils`

**File `packages/shared-utils/package.json`:**

```json
{
  "name": "@shared/utils",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  }
}
```

**File `packages/shared-utils/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File `packages/shared-utils/src/index.ts`:**

```typescript
/**
 * Format price to Vietnamese currency
 */
export function formatPrice(amount: number, locale: string = 'vi'): string {
  if (locale === 'vi') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format relative time (e.g., "2 giờ trước", "3 days ago")
 */
export function formatRelativeTime(date: string | Date, locale: string = 'vi'): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 0) return rtf.format(-diffDays, 'day');
  if (diffHours > 0) return rtf.format(-diffHours, 'hour');
  if (diffMinutes > 0) return rtf.format(-diffMinutes, 'minute');
  return rtf.format(-diffSeconds, 'second');
}

// Utils sẽ được thêm dần khi implement từng feature
```

### 8.3 Package: `@shared/ui`

**File `packages/shared-ui/package.json`:**

```json
{
  "name": "@shared/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0"
  }
}
```

**File `packages/shared-ui/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File `packages/shared-ui/src/index.ts`:**

```typescript
// Shared UI components sẽ được thêm dần
// Ví dụ: ThemeToggle, LocaleSwitcher, LoadingOverlay, ConfirmDialog...
export {};
```

### 8.4 Package: `@shared/hooks`

**File `packages/shared-hooks/package.json`:**

```json
{
  "name": "@shared/hooks",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "react": ">=19.0.0"
  }
}
```

**File `packages/shared-hooks/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File `packages/shared-hooks/src/index.ts`:**

```typescript
// Shared hooks sẽ được thêm dần
// Ví dụ: useDebounce, useInfiniteScroll, useMediaQuery...
export {};
```

### 8.5 Package: `@shared/i18n`

**File `packages/shared-i18n/package.json`:**

```json
{
  "name": "@shared/i18n",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  }
}
```

**File `packages/shared-i18n/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File `packages/shared-i18n/src/index.ts`:**

```typescript
// Shared i18n utilities
// Ví dụ: locale constants, error code mapping...

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';

// Backend error codes → i18n key mapping
export const API_ERROR_KEYS: Record<string, string> = {
  // Auth
  INVALID_CREDENTIALS: 'apiErrors.invalidCredentials',
  EMAIL_ALREADY_EXISTS: 'apiErrors.emailAlreadyExists',
  INVALID_REFRESH_TOKEN: 'apiErrors.invalidRefreshToken',
  ACCOUNT_SUSPENDED: 'apiErrors.accountSuspended',
  EMAIL_NOT_VERIFIED: 'apiErrors.emailNotVerified',

  // Sẽ bổ sung dần khi implement từng feature
  // Xem full list tại: docs/phase4-frontend/02-i18n-and-messages.md
};
```

### 8.6 Package: `@shared/api-client`

**File `packages/shared-api-client/package.json`:**

```json
{
  "name": "@shared/api-client",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "@tanstack/react-query": ">=5.0.0",
    "react": ">=19.0.0"
  }
}
```

**File `packages/shared-api-client/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**File `packages/shared-api-client/src/index.ts`:**

```typescript
// API client & TanStack Query hooks sẽ được thêm dần
// Ví dụ: ApiClient class, useAuth, useCourses, useCart...
export {};
```

---

## Step 9: Turborepo Config

### 9.1 Install Turborepo

```bash
# Tại root
npm install turbo --save-dev
```

### 9.2 Tạo `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "clean": {
      "cache": false
    },
    "test": {
      "cache": false
    }
  }
}
```

### 9.3 Verify Turborepo

```bash
# Tại root
npx turbo build

# Expected: Turbo build tất cả packages + apps theo dependency order
# Lần 2 chạy sẽ nhanh hơn (cache hit)
```

---

## Step 10: Prettier

### 10.1 Install Prettier

```bash
# Tại root
npm install --save-dev prettier prettier-plugin-tailwindcss
```

### 10.2 Tạo `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 10.3 Tạo `.prettierignore`

```
node_modules
dist
.next
build
coverage
.turbo
pnpm-lock.yaml
package-lock.json
*.min.js
*.min.css
```

### 10.4 Verify Prettier

```bash
# Format tất cả files
npm run format

# Check mà không sửa
npm run format:check
```

---

## Step 11: ESLint

### 11.1 Install ESLint (root config)

```bash
# Tại root
npm install --save-dev eslint @eslint/js typescript-eslint eslint-config-prettier eslint-plugin-import
```

### 11.2 Tạo `eslint.config.mjs` tại root

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', '.next/**', 'build/**', 'coverage/**', '.turbo/**'],
  },
);
```

### 11.3 Verify ESLint

```bash
# Lint toàn bộ project
npx turbo lint

# Fix tự động
npx eslint --fix .
```

---

## Step 12: Husky + lint-staged + commitlint

### 12.1 Install packages

```bash
# Tại root
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional
```

### 12.2 Khởi tạo Husky

```bash
npx husky init
```

### 12.3 Tạo pre-commit hook

**File `.husky/pre-commit`:**

```bash
npx lint-staged
```

### 12.4 Tạo commit-msg hook

**File `.husky/commit-msg`:**

```bash
npx --no-install commitlint --edit "$1"
```

### 12.5 Cấu hình lint-staged trong root `package.json`

Thêm vào `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md,yml,yaml}": ["prettier --write"]
  }
}
```

### 12.6 Tạo `commitlint.config.js`

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting (no code change)
        'refactor', // Code refactoring
        'perf', // Performance improvement
        'test', // Adding tests
        'chore', // Maintenance tasks
        'ci', // CI/CD changes
        'build', // Build system changes
        'revert', // Revert previous commit
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'api', // Backend
        'student', // Student Portal
        'management', // Management Portal
        'shared', // Shared packages
        'types', // @shared/types
        'ui', // @shared/ui
        'utils', // @shared/utils
        'hooks', // @shared/hooks
        'i18n', // @shared/i18n
        'api-client', // @shared/api-client
        'prisma', // Database schema
        'config', // Config files
        'docker', // Docker setup
        'deps', // Dependencies
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 200],
  },
};
```

### 12.7 Verify Husky + commitlint

```bash
# Test commit message validation
echo "invalid message" | npx commitlint
# Expected: ❌ Error — type must be one of [feat, fix, ...]

echo "feat(api): add login endpoint" | npx commitlint
# Expected: ✅ Pass

# Test full flow
git add .
git commit -m "chore(config): setup monorepo with turborepo and tooling"
# Expected: Husky runs lint-staged → commitlint → commit thành công
```

---

## Step 13: Verify Everything

### 13.1 Checklist cuối cùng

```bash
# 1. Docker — PostgreSQL + Redis + pgAdmin đang chạy
docker compose up -d
docker compose ps
# ✅ 3 containers: sslm-postgres, sslm-redis, sslm-pgadmin

# 2. pgAdmin accessible
# ✅ Mở http://localhost:5050 → login → thấy database sslm_dev

# 3. Backend — NestJS chạy được
cd apps/api
npm run dev
# ✅ http://localhost:3000/api/docs → Swagger UI
# Ctrl+C

# 4. Frontend — Student Portal chạy được
cd apps/student-portal
npm run dev
# ✅ http://localhost:3001 → Next.js page
# Ctrl+C

# 5. Frontend — Management Portal chạy được
cd apps/management-portal
npm run dev
# ✅ http://localhost:3002 → Next.js page
# Ctrl+C

# 6. Turbo build tất cả
cd <root>
npx turbo build
# ✅ Tất cả packages + apps build thành công

# 7. Turbo dev tất cả cùng lúc
npx turbo dev
# ✅ Backend :3000 + Student :3001 + Management :3002 chạy đồng thời
# Ctrl+C

# 8. Lint pass
npx turbo lint
# ✅ Không có errors

# 9. Format check pass
npm run format:check
# ✅ Tất cả files đúng format

# 10. Prisma connected
cd apps/api
npx prisma studio
# ✅ http://localhost:5555 → thấy bảng User

# 11. Git commit hoạt động với hooks
git add .
git commit -m "feat(config): complete project setup"
# ✅ lint-staged chạy → commitlint pass → commit thành công

# 12. Verify .env files KHÔNG bị commit
git status
# ✅ .env và .env.local không xuất hiện trong staged files
```

### 13.2 Ports summary

| Service               | Port | URL                            |
| --------------------- | ---- | ------------------------------ |
| **Backend API**       | 3000 | http://localhost:3000/api      |
| **Swagger Docs**      | 3000 | http://localhost:3000/api/docs |
| **Student Portal**    | 3001 | http://localhost:3001          |
| **Management Portal** | 3002 | http://localhost:3002          |
| **PostgreSQL**        | 5432 | localhost:5432                 |
| **Redis**             | 6379 | localhost:6379                 |
| **pgAdmin**           | 5050 | http://localhost:5050          |
| **Prisma Studio**     | 5555 | http://localhost:5555          |

### 13.3 Kết quả mong đợi sau khi hoàn thành setup

```
smart-social-learning-marketplace/
├── .editorconfig                ✅ Editor consistency
├── .gitignore                   ✅ Git ignore rules
├── .husky/                      ✅ Git hooks
│   ├── pre-commit               ✅ lint-staged
│   └── commit-msg               ✅ commitlint
├── .prettierrc                  ✅ Code formatting
├── .prettierignore              ✅ Prettier ignore
├── eslint.config.mjs            ✅ Linting rules
├── commitlint.config.js         ✅ Commit message rules
├── docker-compose.yml           ✅ Local services
├── turbo.json                   ✅ Monorepo orchestration
├── package.json                 ✅ npm workspaces root
├── CLAUDE.md                    ✅ AI coding guidelines
│
├── apps/
│   ├── api/                     ✅ NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   └── modules/         (17 module folders)
│   │   ├── .env.example
│   │   ├── .env
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── jest.config.ts
│   │
│   ├── student-portal/          ✅ Next.js 16 student app
│   │   ├── src/
│   │   │   ├── app/[locale]/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── lib/
│   │   │   └── i18n/
│   │   ├── messages/
│   │   │   ├── vi.json
│   │   │   └── en.json
│   │   ├── .env.example
│   │   ├── .env.local
│   │   └── package.json
│   │
│   └── management-portal/      ✅ Next.js 16 management app
│       ├── (same structure)
│       └── ...
│
├── packages/
│   ├── shared-types/            ✅ TypeScript types
│   ├── shared-utils/            ✅ Utility functions
│   ├── shared-ui/               ✅ Shared components
│   ├── shared-hooks/            ✅ Shared hooks
│   ├── shared-i18n/             ✅ i18n utilities
│   └── shared-api-client/       ✅ API client & query hooks
│
└── docs/                        ✅ Design documentation (phase 1-5)
```

---

## Ghi chú

- **Sau khi setup xong**, bước tiếp theo là implement features theo thứ tự:
  1. Auth module (login, register, JWT)
  2. User module (profile, settings)
  3. Categories module (CRUD)
  4. Courses module (CRUD, enrollment)
  5. ...và tiếp tục theo priority

- **Mỗi feature mới** sẽ được document trong file riêng:
  `docs/phase5-implementation/02-feature-auth.md`, `03-feature-courses.md`, ...

- **Xem design docs** trước khi implement:
  - API endpoints: `docs/phase3-backend/02-api-endpoints.md`
  - Database schema: `docs/phase2-database/01-database-design.md`
  - Frontend pages: `docs/phase4-frontend/03-student-portal.md`
