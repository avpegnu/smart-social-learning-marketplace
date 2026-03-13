import {
  HttpException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
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

  it('should handle string exception response', () => {
    const exception = new HttpException('Something went wrong', 500);

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      code: 'ERROR',
      message: 'Something went wrong',
      statusCode: 500,
    });
  });

  it('should handle object exception response with code', () => {
    const exception = new ConflictException({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email already exists',
      field: 'email',
    });

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email already exists',
        field: 'email',
        statusCode: 409,
      }),
    );
  });

  it('should handle BadRequestException', () => {
    const exception = new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
    });

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  it('should handle NotFoundException', () => {
    const exception = new NotFoundException({
      code: 'COURSE_NOT_FOUND',
      message: 'Course not found',
    });

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'COURSE_NOT_FOUND',
        statusCode: 404,
      }),
    );
  });

  it('should include statusCode in response', () => {
    const exception = new HttpException('Test', 418);

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(418);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 418 }));
  });
});
