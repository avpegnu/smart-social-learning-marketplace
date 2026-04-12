# Phase 5.3 — COMMON & CONFIG MODULE

> Tài liệu chi tiết implement các modules infrastructure: Config, Redis, Mail, Uploads,
> và tất cả common utilities (guards, interceptors, filters, pipes, decorators, DTOs).
> Tham chiếu: `docs/phase3-backend/01-backend-architecture.md`

---

## Mục lục

- [Step 1: Install Dependencies](#step-1-install-dependencies)
- [Step 2: Config Module](#step-2-config-module)
- [Step 3: Redis Module](#step-3-redis-module)
- [Step 4: Mail Module (Gmail SMTP)](#step-4-mail-module-gmail-smtp)
- [Step 5: Uploads Module (Cloudinary)](#step-5-uploads-module-cloudinary)
- [Step 6: Common Constants](#step-6-common-constants)
- [Step 7: Common Interfaces](#step-7-common-interfaces)
- [Step 8: Common DTOs](#step-8-common-dtos)
- [Step 9: Common Decorators](#step-9-common-decorators)
- [Step 10: Common Guards](#step-10-common-guards)
- [Step 11: Common Pipes](#step-11-common-pipes)
- [Step 12: Common Filters](#step-12-common-filters)
- [Step 13: Common Interceptors](#step-13-common-interceptors)
- [Step 14: Common Utils](#step-14-common-utils)
- [Step 15: Cập nhật AppModule](#step-15-cập-nhật-appmodule)
- [Step 16: Cập nhật .env.example](#step-16-cập-nhật-envexample)
- [Step 17: Verify](#step-17-verify)

---

## Step 1: Install Dependencies

> **Lưu ý:** Phần lớn packages đã được cài trong Phase 5.1. Chỉ cài thêm packages mới.

### 1.1 Packages đã có (KHÔNG cần cài lại)

Các packages sau đã có trong `apps/api/package.json`:

- `@nestjs/config`, `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`
- `ioredis`, `nodemailer`, `@types/nodemailer`, `cloudinary`, `@nestjs/schedule`
- `bcryptjs`, `@types/bcryptjs`, `@types/passport-jwt`
- `slugify` (dùng thay cho custom slug function)

### 1.2 Packages cần cài mới

```bash
cd apps/api

# Throttler (rate limiting)
npm install @nestjs/throttler

# BullMQ (job queue — thay thế @nestjs/bull + bull cũ)
npm install @nestjs/bullmq bullmq
```

### 1.3 Dọn dẹp packages cũ (Bull v4 → BullMQ)

Project hiện có `@nestjs/bull` + `bull` (cũ). Chuyển sang `@nestjs/bullmq` + `bullmq` (mới hơn, active maintained):

```bash
cd apps/api
npm uninstall @nestjs/bull bull
```

> **Tại sao BullMQ?** BullMQ là phiên bản mới của Bull, có typed events, better error handling,
> và được NestJS recommend. `@nestjs/bullmq` là official wrapper.

---

## Step 2: Config Module

### 2.1 Folder structure

```
src/config/
├── config.module.ts
├── app.config.ts
├── auth.config.ts
├── database.config.ts
├── redis.config.ts
├── cloudinary.config.ts
├── mail.config.ts
├── sepay.config.ts
└── groq.config.ts
```

### 2.2 `src/config/app.config.ts`

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

### 2.3 `src/config/auth.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
}));
```

### 2.4 `src/config/database.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
}));
```

### 2.5 `src/config/redis.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
}));
```

> **Lưu ý:** Local dùng Docker Redis (`redis://localhost:6379`).
> Production dùng Upstash — chỉ cần đổi `REDIS_URL` trong env sang Upstash URL (đã bao gồm auth token trong URL).

### 2.6 `src/config/cloudinary.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
}));
```

### 2.7 `src/config/mail.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
}));
```

### 2.8 `src/config/sepay.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const sepayConfig = registerAs('sepay', () => ({
  webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
  bankAccountName: process.env.BANK_ACCOUNT_NAME,
}));
```

### 2.9 `src/config/groq.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export const groqConfig = registerAs('groq', () => ({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
}));
```

### 2.10 `src/config/config.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { cloudinaryConfig } from './cloudinary.config';
import { mailConfig } from './mail.config';
import { sepayConfig } from './sepay.config';
import { groqConfig } from './groq.config';

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

---

## Step 3: Redis Module

### 3.1 `src/redis/redis.service.ts`

```typescript
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    const url = configService.get<string>('redis.url');
    super(url || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });

    this.on('connect', () => this.logger.log('Redis connected'));
    this.on('error', (err) => this.logger.error('Redis error', err.message));
  }

  async onModuleDestroy() {
    await this.quit();
  }

  // Rate limiting helper
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, windowSeconds);
    }
    return current <= limit;
  }

  // Cache helper with TTL
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const value = await factory();
    await this.setex(key, ttlSeconds, JSON.stringify(value));
    return value;
  }
}
```

### 3.2 `src/redis/redis.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

---

## Step 4: Mail Module (Gmail SMTP)

### 4.1 `src/mail/mail.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.smtpHost'),
      port: this.configService.get<number>('mail.smtpPort'),
      secure: false,
      auth: {
        user: this.configService.get<string>('mail.smtpUser'),
        pass: this.configService.get<string>('mail.smtpPass'),
      },
    });
    this.fromEmail =
      this.configService.get<string>('mail.fromEmail') ||
      this.configService.get<string>('mail.smtpUser') ||
      'noreply@sslm.com';
  }

  async sendEmail({ to, subject, html }: SendEmailOptions) {
    const info = await this.transporter.sendMail({
      from: `SSLM <${this.fromEmail}>`,
      to,
      subject,
      html,
    });
    this.logger.log(`Email sent to ${to}, messageId: ${info.messageId}`);
    return info;
  }

  async sendVerificationEmail(to: string, token: string) {
    const verifyUrl = `${this.configService.get('app.studentPortalUrl')}/auth/verify-email?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Verify your email — SSLM',
      html: `
        <h2>Welcome to Smart Social Learning Marketplace!</h2>
        <p>Click the link below to verify your email:</p>
        <a href="${verifyUrl}">${verifyUrl}</a>
        <p>This link expires in 24 hours.</p>
      `,
    });
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const resetUrl = `${this.configService.get('app.studentPortalUrl')}/auth/reset-password?token=${token}`;
    return this.sendEmail({
      to,
      subject: 'Reset your password — SSLM',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 1 hour.</p>
      `,
    });
  }

  async sendOrderReceiptEmail(to: string, orderId: string, totalAmount: number) {
    return this.sendEmail({
      to,
      subject: `Order Confirmation #${orderId} — SSLM`,
      html: `
        <h2>Order Confirmed!</h2>
        <p>Order ID: ${orderId}</p>
        <p>Total: ${totalAmount.toLocaleString('vi-VN')}đ</p>
      `,
    });
  }
}
```

### 4.2 `src/mail/mail.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

---

## Step 5: Uploads Module (Cloudinary)

### 5.1 `src/uploads/uploads.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadsService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('cloudinary.cloudName'),
      api_key: this.configService.get('cloudinary.apiKey'),
      api_secret: this.configService.get('cloudinary.apiSecret'),
    });
  }

  async generateSignedUploadParams(folder: string) {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      this.configService.get('cloudinary.apiSecret') || '',
    );

    return {
      timestamp,
      signature,
      folder,
      cloudName: this.configService.get('cloudinary.cloudName'),
      apiKey: this.configService.get('cloudinary.apiKey'),
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async getVideoInfo(publicId: string): Promise<UploadApiResponse> {
    return cloudinary.api.resource(publicId, { resource_type: 'video' });
  }
}
```

### 5.2 `src/uploads/uploads.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';

@Module({
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
```

---

## Step 6: Common Constants

### 6.1 `src/common/constants/app.constant.ts`

```typescript
// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Auth
export const BCRYPT_ROUNDS = 12;
export const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export const RESET_TOKEN_EXPIRY_HOURS = 1;
export const OTT_EXPIRY_SECONDS = 60;

// Rate limiting
export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_SECONDS = 60;
export const REGISTER_RATE_LIMIT = 3;
export const REGISTER_RATE_WINDOW_SECONDS = 60;

// Upload
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// Learning
export const LESSON_COMPLETE_THRESHOLD = 0.8;
export const QUIZ_DEFAULT_PASSING_SCORE = 0.7;

// Cache TTL (seconds)
export const CACHE_TTL_SHORT = 60; // 1 min
export const CACHE_TTL_MEDIUM = 300; // 5 min
export const CACHE_TTL_LONG = 3600; // 1 hour

// Order
export const ORDER_EXPIRY_MINUTES = 15;
export const EARNING_HOLD_DAYS = 7;

// AI
export const AI_DAILY_LIMIT = 10;
export const RAG_TOP_K = 5;
export const EMBEDDING_DIMENSIONS = 384;
```

---

## Step 7: Common Interfaces

### 7.1 `src/common/interfaces/jwt-payload.interface.ts`

```typescript
export interface JwtPayload {
  sub: string; // userId
  role: string;
  iat?: number;
  exp?: number;
}
```

### 7.2 `src/common/interfaces/paginated-result.interface.ts`

```typescript
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## Step 8: Common DTOs

### 8.1 `src/common/dto/pagination.dto.ts`

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

  @ApiPropertyOptional({ default: DEFAULT_LIMIT })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
```

### 8.2 `src/common/dto/api-response.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class ApiResponseDto<T> {
  @ApiProperty() data: T;
  @ApiPropertyOptional() meta?: MetaDto;
}

export class ApiErrorDto {
  @ApiProperty() code: string;
  @ApiProperty() message: string;
  @ApiProperty() statusCode: number;
  @ApiPropertyOptional() field?: string;
}
```

---

## Step 9: Common Decorators

### 9.1 `src/common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
```

### 9.2 `src/common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### 9.3 `src/common/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### 9.4 `src/common/decorators/index.ts`

```typescript
export { CurrentUser } from './current-user.decorator';
export { Roles, ROLES_KEY } from './roles.decorator';
export { Public, IS_PUBLIC_KEY } from './public.decorator';
```

---

## Step 10: Common Guards

### 10.1 `src/common/guards/jwt-auth.guard.ts`

> **Lưu ý:** Guard này extends `AuthGuard('jwt')` — cần Passport JWT Strategy để hoạt động.
> Strategy sẽ được tạo trong **Phase 5.4 (Auth Module)**. Trong phase này, guard chỉ được
> đăng ký nhưng tất cả routes sẽ cần `@Public()` decorator hoặc sẽ trả về 401.

```typescript
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

### 10.2 `src/common/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const payload = user as JwtPayload;
    return requiredRoles.includes(payload.role);
  }
}
```

### 10.3 `src/common/guards/ws-auth.guard.ts`

```typescript
import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth?.token || client.handshake.query?.token;

    if (!token) return false;

    try {
      const payload = this.jwtService.verify<JwtPayload>(token as string, {
        secret: this.configService.get('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      return true;
    } catch {
      return false;
    }
  }
}
```

### 10.4 `src/common/guards/index.ts`

```typescript
export { JwtAuthGuard } from './jwt-auth.guard';
export { RolesGuard } from './roles.guard';
export { WsAuthGuard } from './ws-auth.guard';
```

---

## Step 11: Common Pipes

### 11.1 `src/common/pipes/parse-cuid.pipe.ts`

```typescript
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

// CUID v1: exactly 25 chars (c + 24 alphanumeric)
// CUID v2: variable length (typically 24-32 chars)
// Support both formats for forward compatibility
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

> **Tại sao regex linh hoạt?** Prisma `cuid()` hiện tại sinh 25 ký tự (CUID v1).
> Nhưng nếu tương lai Prisma chuyển sang CUID v2 (variable length), regex vẫn hoạt động.

---

## Step 12: Common Filters

### 12.1 `src/common/filters/http-exception.filter.ts`

```typescript
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

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

### 12.2 `src/common/filters/prisma-exception.filter.ts`

```typescript
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
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
      case 'P2025':
        response.status(HttpStatus.NOT_FOUND).json({
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
          statusCode: HttpStatus.NOT_FOUND,
        });
        break;
      case 'P2003':
        response.status(HttpStatus.BAD_REQUEST).json({
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced record does not exist',
          statusCode: HttpStatus.BAD_REQUEST,
        });
        break;
      default:
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          code: 'DATABASE_ERROR',
          message: 'An unexpected database error occurred',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    }
  }
}
```

---

## Step 13: Common Interceptors

### 13.1 `src/common/interceptors/transform.interceptor.ts`

```typescript
import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
    return next.handle().pipe(
      map((data) => {
        // If response already has 'data' key (paginated), return as-is
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data;
        }
        return { data };
      }),
    );
  }
}
```

### 13.2 `src/common/interceptors/logging.interceptor.ts`

```typescript
import {
  Injectable,
  Logger,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method as string;
    const url = request.url as string;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - now;
        this.logger.log(`${method} ${url} — ${elapsed}ms`);
      }),
    );
  }
}
```

> **Lưu ý:** Dùng `Logger` của NestJS thay vì `console.warn` — NestJS Logger tự động format
> với timestamp, context, và có thể disable/redirect theo environment.

### 13.3 `src/common/interceptors/timeout.interceptor.ts`

```typescript
import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, timeout } from 'rxjs';

const DEFAULT_TIMEOUT = 30_000; // 30 seconds

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(timeout(DEFAULT_TIMEOUT));
  }
}
```

---

## Step 14: Common Utils

### 14.1 `src/common/utils/slug.util.ts`

> Sử dụng package `slugify` đã cài sẵn (hỗ trợ tốt Unicode/Vietnamese).

```typescript
import slugify from 'slugify';

export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true, // Strip special characters
    locale: 'vi', // Vietnamese support (đ → d, etc.)
  });
}

export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}
```

### 14.2 `src/common/utils/segments.util.ts`

```typescript
/**
 * Merge overlapping video watched segments.
 * Input: [[0, 240], [200, 480], [600, 900]]
 * Output: [[0, 480], [600, 900]]
 */
export function mergeSegments(segments: [number, number][]): [number, number][] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Calculate total watched duration from segments.
 */
export function calculateWatchedDuration(segments: [number, number][]): number {
  return segments.reduce((total, [start, end]) => total + (end - start), 0);
}

/**
 * Calculate watched percentage.
 */
export function calculateWatchedPercent(
  segments: [number, number][],
  totalDuration: number,
): number {
  if (totalDuration === 0) return 0;
  const watched = calculateWatchedDuration(segments);
  return Math.min(watched / totalDuration, 1);
}
```

### 14.3 `src/common/utils/pagination.util.ts`

```typescript
import type { PaginatedResult } from '../interfaces/paginated-result.interface';

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

---

## Step 15: Cập nhật AppModule

> **QUAN TRỌNG:** File `app.module.ts` hiện tại đã có `ConfigModule.forRoot({ isGlobal: true })`.
> Thay thế hoàn toàn bằng `AppConfigModule` (đã bao gồm `ConfigModule.forRoot` bên trong).
> Không import cả hai — sẽ bị duplicate config.

### 15.1 `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

@Module({
  imports: [
    // Global config (replaces previous ConfigModule.forRoot)
    AppConfigModule,
    PrismaModule,
    RedisModule,
    MailModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),

    // Cron jobs
    ScheduleModule.forRoot(),

    // Feature modules (sẽ thêm dần từ Phase 5.4+)
    // AuthModule,
    // UsersModule,
    // CoursesModule,
    // ...
  ],
  providers: [
    // NOTE: JwtAuthGuard + ThrottlerGuard sẽ được register global trong Phase 5.4
    // khi JWT Strategy đã sẵn sàng. Nếu register ngay sẽ crash vì thiếu strategy.

    // Global filters
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
```

> **Tại sao chưa register `JwtAuthGuard` và `ThrottlerGuard` global?**
>
> - `JwtAuthGuard` extends `AuthGuard('jwt')` — cần JWT Strategy (tạo trong Phase 5.4)
> - `ThrottlerGuard` cần ThrottlerModule import — đã có, nhưng sẽ register cùng lúc JWT guard
> - Nếu register `JwtAuthGuard` mà chưa có strategy → app crash khi nhận request bất kỳ
> - Sẽ thêm cả 2 guards vào `APP_GUARD` trong Phase 5.4 sau khi tạo JWT strategy

---

## Step 16: Cập nhật .env.example

### 16.1 `apps/api/.env.example`

> Cập nhật file `.env.example` hiện tại — thêm các env vars mới, giữ nguyên DB credentials
> khớp với `docker-compose.yml` (`sslm_user:sslm_password`).

```env
# Database (Docker local — khớp docker-compose.yml)
DATABASE_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev?schema=public"
DIRECT_URL="postgresql://sslm_user:sslm_password@localhost:5432/sslm_dev?schema=public"

# Auth
JWT_ACCESS_SECRET="your-access-secret-change-this"
JWT_REFRESH_SECRET="your-refresh-secret-change-this"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Redis (Docker local)
REDIS_URL="redis://localhost:6379"

# Cloudinary
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# Email (Gmail SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM_EMAIL=""

# Groq
GROQ_API_KEY=""
GROQ_MODEL="llama-3.3-70b-versatile"
GROQ_MAX_TOKENS="2048"

# SePay
SEPAY_WEBHOOK_SECRET=""
BANK_ACCOUNT_NUMBER=""
BANK_ACCOUNT_NAME=""

# App URLs
PORT=3000
NODE_ENV="development"
APP_URL="http://localhost:3000"
STUDENT_PORTAL_URL="http://localhost:3001"
MANAGEMENT_PORTAL_URL="http://localhost:3002"
```

---

## Step 17: Verify

### 17.1 Kiểm tra folder structure

```bash
# Verify all files exist
ls apps/api/src/config/              # 9 files
ls apps/api/src/redis/               # 2 files
ls apps/api/src/mail/                # 2 files
ls apps/api/src/uploads/             # 2 files
ls apps/api/src/common/constants/    # 1 file
ls apps/api/src/common/interfaces/   # 2 files
ls apps/api/src/common/dto/          # 2 files
ls apps/api/src/common/decorators/   # 4 files (3 + index.ts)
ls apps/api/src/common/guards/       # 4 files (3 + index.ts)
ls apps/api/src/common/pipes/        # 1 file
ls apps/api/src/common/filters/      # 2 files
ls apps/api/src/common/interceptors/ # 3 files
ls apps/api/src/common/utils/        # 3 files
```

Expected structure (new files marked with `[NEW]`):

```
src/
├── config/                          [NEW — toàn bộ folder]
│   ├── config.module.ts
│   ├── app.config.ts
│   ├── auth.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── cloudinary.config.ts
│   ├── mail.config.ts
│   ├── sepay.config.ts
│   └── groq.config.ts
├── redis/                           [NEW — toàn bộ folder]
│   ├── redis.module.ts
│   └── redis.service.ts
├── mail/                            [NEW — toàn bộ folder]
│   ├── mail.module.ts
│   └── mail.service.ts
├── uploads/                         [NEW — toàn bộ folder]
│   ├── uploads.module.ts
│   └── uploads.service.ts
├── common/                          [NEW — toàn bộ folder]
│   ├── constants/
│   │   └── app.constant.ts
│   ├── interfaces/
│   │   ├── jwt-payload.interface.ts
│   │   └── paginated-result.interface.ts
│   ├── dto/
│   │   ├── pagination.dto.ts
│   │   └── api-response.dto.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── index.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   ├── ws-auth.guard.ts
│   │   └── index.ts
│   ├── pipes/
│   │   └── parse-cuid.pipe.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   └── prisma-exception.filter.ts
│   ├── interceptors/
│   │   ├── transform.interceptor.ts
│   │   ├── logging.interceptor.ts
│   │   └── timeout.interceptor.ts
│   └── utils/
│       ├── slug.util.ts
│       ├── segments.util.ts
│       └── pagination.util.ts
├── prisma/                          [EXISTING — từ Phase 5.2]
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── app.module.ts                    [MODIFIED]
└── main.ts                          [EXISTING — không đổi]
```

### 17.2 Chạy lint check

```bash
npm run lint --workspace=apps/api
```

### 17.3 Chạy build

```bash
npm run build --workspace=apps/api
```

### 17.4 Checklist

- [ ] Config module loads all env vars correctly (8 config files)
- [ ] Redis connects to Docker container (check logs: "Redis connected")
- [ ] Filters + Interceptors registered globally in AppModule
- [ ] Guards created but NOT registered global yet (Phase 5.4 sẽ register)
- [ ] @Public(), @Roles(), @CurrentUser() decorators defined
- [ ] PrismaExceptionFilter catches P2002, P2025, P2003
- [ ] TransformInterceptor wraps response in { data }
- [ ] PaginationDto validates page/limit
- [ ] ParseCuidPipe validates CUID format
- [ ] ESLint passes with 0 errors
- [ ] NestJS build passes (`npm run build --workspace=apps/api`)
- [ ] App starts without crash (`npm run dev --workspace=apps/api`)
- [ ] Swagger accessible at http://localhost:3000/api/docs
