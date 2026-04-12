import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { QueueService } from '@/modules/jobs/queue.service';

// ─── Mocks ───────────────────────────────────────────────
const MOCK_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
jest.mock('bcryptjs');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => MOCK_UUID),
}));
const mockedBcrypt = jest.mocked(bcrypt);

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
  get: jest.fn().mockReturnValue('7d'),
};

const mockRedis = {
  checkRateLimit: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(1),
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
};

const mockQueue = {
  addVerificationEmail: jest.fn().mockResolvedValue(undefined),
  addResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
  addOrderReceiptEmail: jest.fn().mockResolvedValue(undefined),
  addNotification: jest.fn().mockResolvedValue(undefined),
  addFeedFanout: jest.fn().mockResolvedValue(undefined),
};

// ─── Test data ───────────────────────────────────────────
const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  fullName: 'Test User',
  role: 'STUDENT',
  avatarUrl: null,
  status: 'ACTIVE',
  verificationToken: null,
  verificationExpiresAt: null,
  resetToken: null,
  resetTokenExpiresAt: null,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RedisService, useValue: mockRedis },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();

    // Reset default mocks
    mockJwt.sign.mockReturnValue('mock-access-token');
    mockConfig.getOrThrow.mockReturnValue('test-secret');
    mockConfig.get.mockReturnValue('7d');
    mockRedis.checkRateLimit.mockResolvedValue(true);
    mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
  });

  // ==================== REGISTER ====================
  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'Password123',
      fullName: 'New User',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user' });

      const result = await service.register(registerDto);

      expect(result).toEqual({ message: 'REGISTER_SUCCESS' });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: registerDto.email,
          passwordHash: 'hashed-password',
          fullName: registerDto.fullName,
          verificationToken: MOCK_UUID,
        }),
      });
    });

    it('should send verification email after registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user' });

      await service.register(registerDto);

      expect(mockQueue.addVerificationEmail).toHaveBeenCalledWith(registerDto.email, MOCK_UUID);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockQueue.addVerificationEmail).not.toHaveBeenCalled();
    });

    it('should include error code EMAIL_ALREADY_EXISTS', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);

      try {
        await service.register(registerDto);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = (error as ConflictException).getResponse();
        expect(response).toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', field: 'email' });
      }
    });

    it('should set verificationExpiresAt to ~24 hours in the future', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user' });

      const before = Date.now();
      await service.register(registerDto);
      const after = Date.now();

      const createCall = mockPrisma.user.create.mock.calls[0]![0];
      const expiresAt = createCall.data.verificationExpiresAt as Date;
      const expectedMin = before + 24 * 60 * 60 * 1000;
      const expectedMax = after + 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  // ==================== LOGIN ====================
  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123' };
    const ip = '127.0.0.1';

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockPrisma.refreshToken.create.mockResolvedValue({ token: MOCK_UUID });
    });

    it('should login successfully and return tokens + user', async () => {
      const result = await service.login(loginDto, ip);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_UUID,
        user: {
          id: MOCK_USER.id,
          email: MOCK_USER.email,
          fullName: MOCK_USER.fullName,
          role: MOCK_USER.role,
          avatarUrl: MOCK_USER.avatarUrl,
        },
      });
    });

    it('should check rate limit before processing login', async () => {
      await service.login(loginDto, ip);

      expect(mockRedis.checkRateLimit).toHaveBeenCalledWith(`login_attempts:${ip}`, 5, 60);
    });

    it('should throw BadRequestException when rate limited', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(false);

      await expect(service.login(loginDto, ip)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should include error code TOO_MANY_LOGIN_ATTEMPTS', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(false);

      try {
        await service.login(loginDto, ip);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ code: 'TOO_MANY_LOGIN_ATTEMPTS' });
      }
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto, ip)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user has no passwordHash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, passwordHash: null });

      await expect(service.login(loginDto, ip)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw INVALID_CREDENTIALS error code for wrong user/password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.login(loginDto, ip);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      }
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, status: 'UNVERIFIED' });

      try {
        await service.login(loginDto, ip);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
      }
    });

    it('should throw UnauthorizedException if account suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...MOCK_USER, status: 'SUSPENDED' });

      try {
        await service.login(loginDto, ip);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
      }
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(loginDto, ip)).rejects.toThrow(UnauthorizedException);
    });

    it('should reset rate limit on successful login', async () => {
      await service.login(loginDto, ip);

      expect(mockRedis.del).toHaveBeenCalledWith(`login_attempts:${ip}`);
    });

    it('should generate both access and refresh tokens', async () => {
      await service.login(loginDto, ip);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        { sub: MOCK_USER.id, role: MOCK_USER.role },
        expect.objectContaining({ secret: 'test-secret' }),
      );
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: MOCK_UUID,
          userId: MOCK_USER.id,
        }),
      });
    });
  });

  // ==================== REFRESH ====================
  describe('refresh', () => {
    const storedToken = {
      id: 'rt-1',
      token: 'old-refresh-token',
      expiresAt: new Date(Date.now() + 86400000), // future
      user: MOCK_USER,
    };

    beforeEach(() => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      mockPrisma.refreshToken.delete.mockResolvedValue(storedToken);
      mockPrisma.refreshToken.create.mockResolvedValue({ token: MOCK_UUID });
    });

    it('should return new access + refresh tokens', async () => {
      const result = await service.refresh('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_UUID,
        user: {
          id: MOCK_USER.id,
          email: MOCK_USER.email,
          fullName: MOCK_USER.fullName,
          role: MOCK_USER.role,
          avatarUrl: MOCK_USER.avatarUrl,
        },
      });
    });

    it('should rotate: delete old token and create new one', async () => {
      await service.refresh('old-refresh-token');

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: storedToken.id },
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token expired', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000), // past
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should include INVALID_REFRESH_TOKEN error code', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      try {
        await service.refresh('invalid');
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      }
    });
  });

  // ==================== LOGOUT ====================
  describe('logout', () => {
    it('should delete the refresh token', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('some-refresh-token');

      expect(result).toEqual({ message: 'LOGOUT_SUCCESS' });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
      });
    });

    it('should succeed even if token does not exist', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.logout('nonexistent');

      expect(result).toEqual({ message: 'LOGOUT_SUCCESS' });
    });
  });

  // ==================== VERIFY EMAIL ====================
  describe('verifyEmail', () => {
    it('should verify email and set status to ACTIVE', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(MOCK_USER);
      mockPrisma.user.update.mockResolvedValue({ ...MOCK_USER, status: 'ACTIVE' });

      const result = await service.verifyEmail('valid-token');

      expect(result).toEqual({ message: 'EMAIL_VERIFIED' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: {
          status: 'ACTIVE',
          verificationToken: null,
          verificationExpiresAt: null,
        },
      });
    });

    it('should query with token and non-expired condition', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(MOCK_USER);
      mockPrisma.user.update.mockResolvedValue(MOCK_USER);

      await service.verifyEmail('some-token');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          verificationToken: 'some-token',
          verificationExpiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid')).rejects.toThrow(BadRequestException);
    });

    it('should include INVALID_VERIFICATION_TOKEN error code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      try {
        await service.verifyEmail('bad');
        fail('Should have thrown');
      } catch (error) {
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ code: 'INVALID_VERIFICATION_TOKEN' });
      }
    });
  });

  // ==================== RESEND VERIFICATION ====================
  describe('resendVerification', () => {
    it('should generate new token and send verification email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        status: 'PENDING',
      });
      mockPrisma.user.update.mockResolvedValue(MOCK_USER);

      const result = await service.resendVerification('test@test.com');

      expect(result.message).toBe('VERIFICATION_EMAIL_SENT');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationToken: expect.any(String),
            verificationExpiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mockQueue.addVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        expect.any(String),
      );
    });

    it('should return success even if user not found (anti-enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification('nonexistent@test.com');

      expect(result.message).toBe('VERIFICATION_EMAIL_SENT');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockQueue.addVerificationEmail).not.toHaveBeenCalled();
    });

    it('should return success if user already verified (anti-enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        status: 'ACTIVE',
      });

      const result = await service.resendVerification('test@test.com');

      expect(result.message).toBe('VERIFICATION_EMAIL_SENT');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ==================== FORGOT PASSWORD ====================
  describe('forgotPassword', () => {
    it('should generate reset token and send email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
      mockPrisma.user.update.mockResolvedValue(MOCK_USER);

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({ message: 'RESET_EMAIL_SENT' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: expect.objectContaining({
          resetToken: MOCK_UUID,
          resetTokenExpiresAt: expect.any(Date),
        }),
      });
      expect(mockQueue.addResetPasswordEmail).toHaveBeenCalledWith('test@example.com', MOCK_UUID);
    });

    it('should return success even if user does not exist (prevent email enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result).toEqual({ message: 'RESET_EMAIL_SENT' });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockQueue.addResetPasswordEmail).not.toHaveBeenCalled();
    });

    it('should set resetTokenExpiresAt to ~1 hour in the future', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
      mockPrisma.user.update.mockResolvedValue(MOCK_USER);

      const before = Date.now();
      await service.forgotPassword('test@example.com');
      const after = Date.now();

      const updateCall = mockPrisma.user.update.mock.calls[0]![0];
      const expiresAt = updateCall.data.resetTokenExpiresAt as Date;
      const expectedMin = before + 1 * 60 * 60 * 1000;
      const expectedMax = after + 1 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  // ==================== RESET PASSWORD ====================
  describe('resetPassword', () => {
    const resetDto = { token: 'valid-reset-token', newPassword: 'NewPassword123' };

    it('should reset password successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(MOCK_USER);
      mockPrisma.user.update.mockResolvedValue(MOCK_USER);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.resetPassword(resetDto);

      expect(result).toEqual({ message: 'PASSWORD_RESET_SUCCESS' });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(resetDto.newPassword, 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_USER.id },
        data: {
          passwordHash: 'hashed-password',
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
    });

    it('should invalidate all refresh tokens after password reset', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(MOCK_USER);
      mockPrisma.user.update.mockResolvedValue(MOCK_USER);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await service.resetPassword(resetDto);

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: MOCK_USER.id },
      });
    });

    it('should throw BadRequestException for invalid reset token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
    });

    it('should include INVALID_RESET_TOKEN error code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      try {
        await service.resetPassword(resetDto);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ code: 'INVALID_RESET_TOKEN' });
      }
    });
  });

  // ==================== GENERATE OTT ====================
  describe('generateOtt', () => {
    it('should store OTT in Redis with 60s TTL and return it', async () => {
      const result = await service.generateOtt('user-1');

      expect(result).toBe(MOCK_UUID);
      expect(mockRedis.setex).toHaveBeenCalledWith(`ott:${MOCK_UUID}`, 60, 'user-1');
    });
  });

  // ==================== VALIDATE OTT ====================
  describe('validateOtt', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue('user-1');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'STUDENT',
        avatarUrl: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: MOCK_UUID });
    });

    it('should validate OTT and return tokens + user', async () => {
      const result = await service.validateOtt('valid-ott');

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_UUID,
        user: expect.objectContaining({
          id: 'user-1',
          email: 'test@example.com',
        }),
      });
    });

    it('should delete OTT after use (one-time)', async () => {
      await service.validateOtt('valid-ott');

      expect(mockRedis.del).toHaveBeenCalledWith('ott:valid-ott');
    });

    it('should throw UnauthorizedException if OTT not found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.validateOtt('invalid-ott')).rejects.toThrow(UnauthorizedException);
    });

    it('should include INVALID_OTT error code', async () => {
      mockRedis.get.mockResolvedValue(null);

      try {
        await service.validateOtt('bad');
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'INVALID_OTT' });
      }
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.validateOtt('valid-ott');
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'USER_NOT_FOUND' });
      }
    });
  });
});
