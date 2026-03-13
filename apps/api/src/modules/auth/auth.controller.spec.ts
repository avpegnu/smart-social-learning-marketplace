import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ─── Mocks ───────────────────────────────────────────────
const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  verifyEmail: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  generateOtt: jest.fn(),
  validateOtt: jest.fn(),
};

const mockResponse = (): Partial<Response> => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const mockRequest = (cookies: Record<string, string> = {}): Partial<Request> => ({
  cookies,
});

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  // ==================== REGISTER ====================
  describe('register', () => {
    it('should delegate to AuthService.register', async () => {
      const dto = { email: 'a@b.com', password: 'Pass1234', fullName: 'Test' };
      mockAuthService.register.mockResolvedValue({ message: 'REGISTER_SUCCESS' });

      const result = await controller.register(dto);

      expect(result).toEqual({ message: 'REGISTER_SUCCESS' });
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  // ==================== LOGIN ====================
  describe('login', () => {
    it('should set refresh token cookie and return access token + user', async () => {
      const dto = { email: 'a@b.com', password: 'Pass1234' };
      const res = mockResponse();
      mockAuthService.login.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', email: 'a@b.com', fullName: 'Test', role: 'STUDENT' },
      });

      const result = await controller.login(dto, '127.0.0.1', res as Response);

      expect(result).toEqual({
        accessToken: 'at',
        user: { id: 'u1', email: 'a@b.com', fullName: 'Test', role: 'STUDENT' },
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'rt',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
        }),
      );
    });

    it('should pass IP to service for rate limiting', async () => {
      const res = mockResponse();
      mockAuthService.login.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: {},
      });

      await controller.login({ email: 'a@b.com', password: 'x' }, '10.0.0.1', res as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        { email: 'a@b.com', password: 'x' },
        '10.0.0.1',
      );
    });

    it('should NOT return refreshToken in response body', async () => {
      const res = mockResponse();
      mockAuthService.login.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: {},
      });

      const result = await controller.login(
        { email: 'a@b.com', password: 'x' },
        '::1',
        res as Response,
      );

      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  // ==================== REFRESH ====================
  describe('refresh', () => {
    it('should read refreshToken from cookie and set new cookie', async () => {
      const req = mockRequest({ refreshToken: 'old-rt' });
      const res = mockResponse();
      mockAuthService.refresh.mockResolvedValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      });

      const result = await controller.refresh(req as Request, res as Response);

      expect(result).toEqual({ accessToken: 'new-at' });
      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-rt');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-rt',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should throw UnauthorizedException if no cookie', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await expect(controller.refresh(req as Request, res as Response)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include MISSING_REFRESH_TOKEN error code', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      try {
        await controller.refresh(req as Request, res as Response);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as UnauthorizedException).getResponse();
        expect(response).toMatchObject({ code: 'MISSING_REFRESH_TOKEN' });
      }
    });
  });

  // ==================== LOGOUT ====================
  describe('logout', () => {
    it('should clear cookie and delegate to service', async () => {
      const req = mockRequest({ refreshToken: 'rt-to-delete' });
      const res = mockResponse();
      mockAuthService.logout.mockResolvedValue({ message: 'LOGOUT_SUCCESS' });

      const result = await controller.logout(req as Request, res as Response);

      expect(result).toEqual({ message: 'LOGOUT_SUCCESS' });
      expect(mockAuthService.logout).toHaveBeenCalledWith('rt-to-delete');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
    });

    it('should still clear cookie even if no refresh token exists', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await controller.logout(req as Request, res as Response);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  // ==================== VERIFY EMAIL ====================
  describe('verifyEmail', () => {
    it('should delegate token to service', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({ message: 'EMAIL_VERIFIED' });

      const result = await controller.verifyEmail({ token: 'verify-token' });

      expect(result).toEqual({ message: 'EMAIL_VERIFIED' });
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('verify-token');
    });
  });

  // ==================== FORGOT PASSWORD ====================
  describe('forgotPassword', () => {
    it('should delegate email to service', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'RESET_EMAIL_SENT' });

      const result = await controller.forgotPassword({ email: 'a@b.com' });

      expect(result).toEqual({ message: 'RESET_EMAIL_SENT' });
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('a@b.com');
    });
  });

  // ==================== RESET PASSWORD ====================
  describe('resetPassword', () => {
    it('should delegate dto to service', async () => {
      const dto = { token: 'reset-tok', newPassword: 'NewPass123' };
      mockAuthService.resetPassword.mockResolvedValue({ message: 'PASSWORD_RESET_SUCCESS' });

      const result = await controller.resetPassword(dto);

      expect(result).toEqual({ message: 'PASSWORD_RESET_SUCCESS' });
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  // ==================== OTT ====================
  describe('generateOtt', () => {
    it('should return OTT from service', async () => {
      mockAuthService.generateOtt.mockResolvedValue('ott-value');

      const result = await controller.generateOtt({ sub: 'user-1', role: 'STUDENT' });

      expect(result).toEqual({ ott: 'ott-value' });
      expect(mockAuthService.generateOtt).toHaveBeenCalledWith('user-1');
    });
  });

  describe('validateOtt', () => {
    it('should set cookie and return tokens + user', async () => {
      const res = mockResponse();
      mockAuthService.validateOtt.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1' },
      });

      const result = await controller.validateOtt({ ott: 'valid-ott' }, res as Response);

      expect(result).toEqual({
        accessToken: 'at',
        user: { id: 'u1' },
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'rt',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should NOT return refreshToken in response body', async () => {
      const res = mockResponse();
      mockAuthService.validateOtt.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: {},
      });

      const result = await controller.validateOtt({ ott: 'x' }, res as Response);

      expect(result).not.toHaveProperty('refreshToken');
    });
  });
});
