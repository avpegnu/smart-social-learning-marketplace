import { BadRequestException } from '@nestjs/common';
import { ParseCuidPipe } from './parse-cuid.pipe';

describe('ParseCuidPipe', () => {
  let pipe: ParseCuidPipe;

  beforeEach(() => {
    pipe = new ParseCuidPipe();
  });

  describe('valid CUIDs', () => {
    it('should accept valid CUID v1 (25 chars)', () => {
      const cuid = 'clx1abc2d0000l708dkvjxqz2';
      expect(pipe.transform(cuid)).toBe(cuid);
    });

    it('should accept CUID starting with c followed by lowercase alphanumeric', () => {
      const cuid = 'cm1abc2d0000l708dkvjxqz22';
      expect(pipe.transform(cuid)).toBe(cuid);
    });

    it('should accept minimum length CUID (21 chars: c + 20)', () => {
      const cuid = 'c' + 'a'.repeat(20);
      expect(pipe.transform(cuid)).toBe(cuid);
    });

    it('should accept maximum length CUID (33 chars: c + 32)', () => {
      const cuid = 'c' + 'a'.repeat(32);
      expect(pipe.transform(cuid)).toBe(cuid);
    });

    it('should accept CUID with digits', () => {
      const cuid = 'c1234567890abcdefghijk';
      expect(pipe.transform(cuid)).toBe(cuid);
    });
  });

  describe('invalid CUIDs', () => {
    it('should reject empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('should reject string not starting with c', () => {
      expect(() => pipe.transform('alx1abc2d0000l708dkvjxqz2')).toThrow(BadRequestException);
    });

    it('should reject UUID format', () => {
      expect(() => pipe.transform('550e8400-e29b-41d4-a716-446655440000')).toThrow(
        BadRequestException,
      );
    });

    it('should reject uppercase characters', () => {
      expect(() => pipe.transform('cABC123def456ghi789jkl01')).toThrow(BadRequestException);
    });

    it('should reject too short string (c + 19 = 20 chars)', () => {
      const short = 'c' + 'a'.repeat(19);
      expect(() => pipe.transform(short)).toThrow(BadRequestException);
    });

    it('should reject too long string (c + 33 = 34 chars)', () => {
      const long = 'c' + 'a'.repeat(33);
      expect(() => pipe.transform(long)).toThrow(BadRequestException);
    });

    it('should reject string with special characters', () => {
      expect(() => pipe.transform('clx1abc-d0000l708dkvjxq')).toThrow(BadRequestException);
    });

    it('should return error with INVALID_CUID code', () => {
      try {
        pipe.transform('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toEqual(
          expect.objectContaining({
            code: 'INVALID_CUID',
            message: 'Invalid ID format',
          }),
        );
      }
    });
  });
});
