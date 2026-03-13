import type { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService);
  });

  describe('validate', () => {
    it('should return JwtPayload with sub and role', () => {
      const payload = { sub: 'user-1', role: 'STUDENT', iat: 123, exp: 456 };

      const result = strategy.validate(payload);

      expect(result).toEqual({ sub: 'user-1', role: 'STUDENT' });
    });

    it('should strip iat and exp from the result', () => {
      const payload = { sub: 'user-2', role: 'INSTRUCTOR', iat: 100, exp: 200 };

      const result = strategy.validate(payload);

      expect(result).not.toHaveProperty('iat');
      expect(result).not.toHaveProperty('exp');
    });

    it('should preserve role as-is', () => {
      const payload = { sub: 'user-3', role: 'ADMIN' };

      const result = strategy.validate(payload);

      expect(result.role).toBe('ADMIN');
    });
  });
});
