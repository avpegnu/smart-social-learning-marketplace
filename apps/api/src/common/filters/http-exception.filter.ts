import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

// Exceptions thrown with a bare string message carry no machine-readable `code`
// (e.g. ThrottlerException -> "Too Many Requests"). Derive one from the HTTP
// status so the frontend can localize it via `apiErrors.<code>`.
function codeFromStatus(status: number): string {
  switch (status) {
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'ERROR';
  }
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse =
      typeof exceptionResponse === 'string'
        ? { code: codeFromStatus(status), message: exceptionResponse, statusCode: status }
        : { statusCode: status, ...exceptionResponse };

    response.status(status).json(errorResponse);
  }
}
