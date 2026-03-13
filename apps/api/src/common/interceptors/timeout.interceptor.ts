import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, timeout } from 'rxjs';

const DEFAULT_TIMEOUT = 30_000; // 30 seconds

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(timeout(DEFAULT_TIMEOUT));
  }
}
