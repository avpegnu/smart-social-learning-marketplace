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
