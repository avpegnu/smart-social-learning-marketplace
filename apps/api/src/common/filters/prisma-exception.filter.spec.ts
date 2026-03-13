import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    };
  });

  function createPrismaError(
    code: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('Prisma error', {
      code,
      clientVersion: '6.0.0',
      meta,
    });
  }

  describe('P2002 — Unique constraint violation', () => {
    it('should return 409 with UNIQUE_CONSTRAINT_VIOLATION code', () => {
      const error = createPrismaError('P2002', { target: ['email'] });

      filter.catch(error, mockHost as never);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'A record with this email already exists',
        statusCode: HttpStatus.CONFLICT,
        field: 'email',
      });
    });

    it('should join multiple fields', () => {
      const error = createPrismaError('P2002', { target: ['userId', 'courseId'] });

      filter.catch(error, mockHost as never);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'userId, courseId',
          message: 'A record with this userId, courseId already exists',
        }),
      );
    });

    it('should fallback to "field" when target is missing', () => {
      const error = createPrismaError('P2002');

      filter.catch(error, mockHost as never);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'field' }));
    });
  });

  describe('P2025 — Record not found', () => {
    it('should return 404 with RECORD_NOT_FOUND code', () => {
      const error = createPrismaError('P2025');

      filter.catch(error, mockHost as never);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 'RECORD_NOT_FOUND',
        message: 'The requested record was not found',
        statusCode: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('P2003 — Foreign key violation', () => {
    it('should return 400 with FOREIGN_KEY_VIOLATION code', () => {
      const error = createPrismaError('P2003');

      filter.catch(error, mockHost as never);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced record does not exist',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('Unknown Prisma error', () => {
    it('should return 500 with DATABASE_ERROR code', () => {
      const error = createPrismaError('P9999');

      filter.catch(error, mockHost as never);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 'DATABASE_ERROR',
        message: 'An unexpected database error occurred',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
});
