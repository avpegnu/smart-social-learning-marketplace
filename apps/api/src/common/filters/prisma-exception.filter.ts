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
