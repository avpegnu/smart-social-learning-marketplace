# Phase 5.4 — AUTH MODULE

> Implement authentication & authorization: Register, Login, JWT, Refresh Token, Email Verification, Password Reset, OTT.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md` — Module 1: Authentication

---

## Mục lục

- [Step 1: Install Dependencies](#step-1-install-dependencies)
- [Step 2: Module Structure](#step-2-module-structure)
- [Step 3: DTOs](#step-3-dtos)
- [Step 4: JWT Strategy (Passport)](#step-4-jwt-strategy-passport)
- [Step 5: Auth Service](#step-5-auth-service)
- [Step 6: Auth Controller](#step-6-auth-controller)
- [Step 7: Auth Module Registration](#step-7-auth-module-registration)
- [Step 8: Update main.ts — Cookie Parser](#step-8-update-maints--cookie-parser)
- [Step 9: Update app.module.ts — Import + Global Guards](#step-9-update-appmodulets--import--global-guards)
- [Step 10: Verification & Testing](#step-10-verification--testing)

---

## Prerequisites — Đã sẵn sàng từ Phase 5.2 + 5.3

| Dependency                                                              | File                                         | Status |
| ----------------------------------------------------------------------- | -------------------------------------------- | ------ |
| User model (email, passwordHash, status, verificationToken, resetToken) | `prisma/schema.prisma`                       | ✅     |
| RefreshToken model (token, userId, expiresAt)                           | `prisma/schema.prisma`                       | ✅     |
| UserStatus enum (UNVERIFIED, ACTIVE, SUSPENDED)                         | `prisma/schema.prisma`                       | ✅     |
| Role enum (STUDENT, INSTRUCTOR, ADMIN)                                  | `prisma/schema.prisma`                       | ✅     |
| JwtPayload interface ({ sub, role })                                    | `common/interfaces/jwt-payload.interface.ts` | ✅     |
| Auth constants (BCRYPT_ROUNDS, LOGIN_RATE_LIMIT, etc.)                  | `common/constants/app.constant.ts`           | ✅     |
| Auth config (jwtAccessSecret, jwtRefreshExpiresIn, etc.)                | `config/auth.config.ts`                      | ✅     |
| PrismaService                                                           | `prisma/prisma.service.ts`                   | ✅     |
| RedisService.checkRateLimit()                                           | `redis/redis.service.ts`                     | ✅     |
| MailService.sendVerificationEmail/sendResetPasswordEmail                | `mail/mail.service.ts`                       | ✅     |
| @Public, @Roles, @CurrentUser decorators                                | `common/decorators/`                         | ✅     |
| JwtAuthGuard (with @Public bypass), RolesGuard                          | `common/guards/`                             | ✅     |
| @nestjs/jwt, @nestjs/passport, passport-jwt, bcryptjs                   | `package.json`                               | ✅     |

---

## Step 1: Install Dependencies

```bash
cd apps/api
npm install cookie-parser
npm install -D @types/cookie-parser
```

> Tất cả packages khác (passport, @nestjs/jwt, bcryptjs, etc.) đã được install trong Phase 5.1.

---

## Step 2: Module Structure

```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   └── jwt.strategy.ts
└── dto/
    ├── register.dto.ts
    ├── login.dto.ts
    ├── verify-email.dto.ts
    ├── forgot-password.dto.ts
    ├── reset-password.dto.ts
    └── validate-ott.dto.ts
```

---

## Step 3: DTOs

> **Lưu ý:** Tất cả DTO properties dùng `!:` (definite assignment assertion) vì project dùng TypeScript strict mode.
> class-validator decorators đảm bảo runtime validation, `!:` chỉ để TypeScript compiler không báo lỗi.

### 3.1 `dto/register.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;
}
```

### 3.2 `dto/login.dto.ts`

```typescript
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  password!: string;
}
```

### 3.3 `dto/verify-email.dto.ts`

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-...' })
  @IsString()
  token!: string;
}
```

### 3.4 `dto/forgot-password.dto.ts`

```typescript
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
```

### 3.5 `dto/reset-password.dto.ts`

```typescript
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-...' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewPassword123' })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  })
  newPassword!: string;
}
```

### 3.6 `dto/validate-ott.dto.ts`

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateOttDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-...' })
  @IsString()
  ott!: string;
}
```

---

## Step 4: JWT Strategy (Passport)

### 4.1 `strategies/jwt.strategy.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtAccessSecret'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return { sub: payload.sub, role: payload.role };
  }
}
```

> **Lưu ý:** Dùng `@Inject(ConfigService)` thay vì bare `private configService` vì SWC builder + ESLint `consistent-type-imports` conflict (đã ghi nhận từ Phase 5.3). Constructor param không lưu vào class property vì chỉ dùng trong `super()`.

---

## Step 5: Auth Service

### 5.1 `auth.service.ts`

```typescript
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { MailService } from '@/mail/mail.service';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import {
  BCRYPT_ROUNDS,
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_SECONDS,
  OTT_EXPIRY_SECONDS,
  RESET_TOKEN_EXPIRY_HOURS,
  VERIFICATION_TOKEN_EXPIRY_HOURS,
} from '@/common/constants/app.constant';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

// Safe user fields to return in responses (never expose passwordHash, tokens, etc.)
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  avatarUrl: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  // ==================== REGISTER ====================
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS', field: 'email' });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const verificationToken = crypto.randomUUID();
    const verificationExpiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        verificationToken,
        verificationExpiresAt,
      },
    });

    await this.mail.sendVerificationEmail(dto.email, verificationToken);

    return { message: 'REGISTER_SUCCESS' };
  }

  // ==================== LOGIN ====================
  async login(dto: LoginDto, ip: string) {
    // Rate limiting by IP
    const rateLimitKey = `login_attempts:${ip}`;
    const allowed = await this.redis.checkRateLimit(
      rateLimitKey,
      LOGIN_RATE_LIMIT,
      LOGIN_RATE_WINDOW_SECONDS,
    );
    if (!allowed) {
      throw new BadRequestException({ code: 'TOO_MANY_LOGIN_ATTEMPTS' });
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }

    // Check status
    if (user.status === 'UNVERIFIED') {
      throw new UnauthorizedException({ code: 'EMAIL_NOT_VERIFIED' });
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException({ code: 'ACCOUNT_SUSPENDED' });
    }

    // Verify password
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Reset rate limit on success
    await this.redis.del(rateLimitKey);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  // ==================== REFRESH ====================
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

  // ==================== LOGOUT ====================
  async logout(refreshTokenValue: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshTokenValue },
    });
    return { message: 'LOGOUT_SUCCESS' };
  }

  // ==================== VERIFY EMAIL ====================
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

  // ==================== FORGOT PASSWORD ====================
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return { message: 'RESET_EMAIL_SENT' };

    const resetToken = crypto.randomUUID();
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiresAt },
    });

    await this.mail.sendResetPasswordEmail(email, resetToken);

    return { message: 'RESET_EMAIL_SENT' };
  }

  // ==================== RESET PASSWORD ====================
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

  // ==================== ONE-TIME TOKEN (Cross-portal) ====================
  async generateOtt(userId: string): Promise<string> {
    const ott = crypto.randomUUID();
    await this.redis.setex(`ott:${ott}`, OTT_EXPIRY_SECONDS, userId);
    return ott;
  }

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

  // ==================== HELPERS ====================
  private generateAccessToken(userId: string, role: string): string {
    const payload: JwtPayload = { sub: userId, role };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('auth.jwtAccessSecret'),
      expiresIn: this.config.getOrThrow<string>('auth.jwtAccessExpiresIn') as StringValue,
    });
  }

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
}
```

### Giải thích các thay đổi so với bản cũ:

| #   | Vấn đề                                                   | Fix                                                                          |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `import * as bcrypt from 'bcrypt'`                       | → `'bcryptjs'` (pure JS, đã install)                                         |
| 2   | Constructor thiếu `@Inject()`                            | Thêm `@Inject(ClassName)` cho tất cả params (SWC + consistent-type-imports)  |
| 3   | `validateOtt` trả toàn bộ User (kể cả passwordHash)      | Extract `USER_SAFE_SELECT` constant, dùng `select` chỉ lấy safe fields       |
| 4   | Refresh token expiry hardcoded `7 * 24 * 60 * 60 * 1000` | Dùng `config.get('auth.jwtRefreshExpiresIn')` + `parseDurationToMs()` helper |
| 5   | `config.get()` cho JWT secret (có thể undefined)         | Dùng `config.getOrThrow()` — throw ngay nếu thiếu config                     |
| 6   | `expiresIn` type không match `jwt.sign()`                | Cast `as StringValue` (import từ `ms` package) cho type safety               |

---

## Step 6: Auth Controller

### 6.1 `auth.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Inject,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// DTOs must be value imports — ValidationPipe needs runtime class reference (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from './dto/register.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from './dto/login.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VerifyEmailDto } from './dto/verify-email.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ForgotPasswordDto } from './dto/forgot-password.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ResetPasswordDto } from './dto/reset-password.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ValidateOttDto } from './dto/validate-ott.dto';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, ip);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN' });
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });
    return { message: 'LOGOUT_SUCCESS' };
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('ott')
  @ApiOperation({ summary: 'Generate one-time token for cross-portal redirect' })
  async generateOtt(@CurrentUser() user: JwtPayload) {
    const ott = await this.authService.generateOtt(user.sub);
    return { ott };
  }

  @Public()
  @Post('ott/validate')
  @ApiOperation({ summary: 'Validate OTT and get tokens' })
  async validateOtt(@Body() dto: ValidateOttDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.validateOtt(dto.ott);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
```

### Giải thích các thay đổi so với bản cũ:

| #   | Vấn đề                                                    | Fix                                                                             |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Import `Public` và `CurrentUser` từ 2 dòng riêng          | Gộp 1 dòng `import { CurrentUser, Public } from '@/common/decorators'`          |
| 2   | `throw new Error('No refresh token')`                     | → `UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN' })`                    |
| 3   | `@Body('ott') ott: string` — raw body extraction          | → `@Body() dto: ValidateOttDto` — proper DTO validation                         |
| 4   | Cookie options lặp lại 3 lần                              | → Extract `REFRESH_COOKIE_OPTIONS` constant                                     |
| 5   | Thiếu `@Inject()` trên constructor                        | Thêm `@Inject(AuthService)`                                                     |
| 6   | DTOs dùng `import type` → ValidationPipe không nhận class | Dùng value import + `eslint-disable @typescript-eslint/consistent-type-imports` |

---

## Step 7: Auth Module Registration

### 7.1 `auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Options passed per-sign in service
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

> **Tại sao `JwtModule.register({})`?** — Secret và expiresIn được truyền trực tiếp trong `jwt.sign()` call ở AuthService thay vì global config. Cho phép dùng secret khác nhau cho access vs refresh token nếu cần.

---

## Step 8: Update main.ts — Cookie Parser

```typescript
// Thêm import
import cookieParser from 'cookie-parser';

// Thêm sau NestFactory.create(), trước setGlobalPrefix()
app.use(cookieParser());
```

> **Tại sao?** Refresh token được lưu trong httpOnly cookie. Không có cookie-parser, `req.cookies` sẽ là `undefined`.

---

## Step 9: Update app.module.ts — Import + Global Guards

```typescript
// Thêm imports
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    // ... existing imports ...
    AuthModule, // <-- THÊM
  ],
  providers: [
    // ... existing filters + interceptors ...

    // Global guards (THÊM — trước đó comment vì chưa có JWT Strategy)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

### Guard execution order:

```
Request → ThrottlerGuard (rate limit) → JwtAuthGuard (auth) → RolesGuard (RBAC per-route)
```

> **Lưu ý:** `RolesGuard` KHÔNG register global vì chỉ áp dụng trên routes có `@Roles()`. Dùng `@UseGuards(RolesGuard)` + `@Roles(Role.INSTRUCTOR)` per-controller/per-method.

---

## Step 10: Verification & Testing

### 10.1 TypeScript compilation

```bash
cd apps/api
npx tsc --noEmit
```

### 10.2 Chạy API

```bash
docker compose up -d
cd apps/api
npx prisma migrate dev
npm run start:dev
```

### 10.3 Mở Swagger — http://localhost:3000/api/docs

Test flow:

1. `POST /api/auth/register` — Register account
2. Check email hoặc dùng Prisma Studio update status = ACTIVE
3. `POST /api/auth/login` — Login, nhận accessToken
4. Click "Authorize" trên Swagger, nhập Bearer token
5. `GET /api/auth/ott` — Test protected endpoint
6. `POST /api/auth/logout` — Logout

### 10.4 Checklist

- [ ] Register creates user with UNVERIFIED status
- [ ] Login returns accessToken + sets refreshToken cookie
- [ ] Refresh rotates both tokens (old refresh deleted, new created)
- [ ] Logout clears refresh token from DB + cookie
- [ ] Email verification changes status to ACTIVE
- [ ] Forgot password sends email (check Gmail sent folder or logs)
- [ ] Reset password changes password + invalidates ALL refresh tokens
- [ ] Rate limiting works (6th login attempt from same IP blocked)
- [ ] OTT generates and validates correctly (one-time use)
- [ ] @Public routes skip JWT auth
- [ ] Protected routes return 401 without token
- [ ] ThrottlerGuard applies globally
- [ ] JwtAuthGuard applies globally (bypassed by @Public)
- [ ] validateOtt does NOT expose passwordHash in response

---

## Tổng hợp thay đổi so với bản cũ

| #   | Issue                       | Bản cũ                                            | Fix                                                           |
| --- | --------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Wrong package               | `import * as bcrypt from 'bcrypt'`                | `'bcryptjs'`                                                  |
| 2   | Missing `!:`                | DTO: `email: string`                              | `email!: string`                                              |
| 3   | Missing `@Inject()`         | `private readonly prisma: PrismaService`          | `@Inject(PrismaService) private readonly prisma`              |
| 4   | Generic Error               | `throw new Error('No refresh token')`             | `UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN' })`    |
| 5   | Duplicate import            | 2 dòng import từ `@/common/decorators`            | Gộp 1 dòng                                                    |
| 6   | Hardcoded expiry            | `7 * 24 * 60 * 60 * 1000` in generateRefreshToken | `config.get('auth.jwtRefreshExpiresIn')` + parser             |
| 7   | Data leak                   | `validateOtt` trả full User object                | `USER_SAFE_SELECT` constant + `select`                        |
| 8   | Missing global guards       | Chỉ nói import AuthModule                         | Thêm APP_GUARD: JwtAuthGuard + ThrottlerGuard                 |
| 9   | Raw body extraction         | `@Body('ott') ott: string`                        | `@Body() dto: ValidateOttDto`                                 |
| 10  | Cookie options DRY          | Lặp 3 lần                                         | Extract `REFRESH_COOKIE_OPTIONS` constant                     |
| 11  | Missing ValidateOttDto      | Không có DTO cho OTT validate                     | Thêm `validate-ott.dto.ts`                                    |
| 12  | Missing prerequisites table | Không check dependencies                          | Thêm table đầu file                                           |
| 13  | `config.get()` nullable     | JWT secret có thể undefined                       | `config.getOrThrow()` — fail fast                             |
| 14  | `expiresIn` type mismatch   | `string` không match `jwt.sign()`                 | `as StringValue` (from `ms` package)                          |
| 15  | DTO imports ESLint conflict | `import type` vs value import                     | `eslint-disable consistent-type-imports` + comment giải thích |
