import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
    return next.handle().pipe(
      map((data) => {
        // If response already has 'data' key (paginated), return as-is
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data;
        }
        return { data };
      }),
    );
  }
}
