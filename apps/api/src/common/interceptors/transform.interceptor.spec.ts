import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const mockContext = {} as never;

  function createCallHandler(data: unknown) {
    return { handle: () => of(data) };
  }

  it('should wrap plain object in { data }', (done) => {
    const handler = createCallHandler({ id: '1', title: 'React' });

    interceptor.intercept(mockContext, handler).subscribe((result) => {
      expect(result).toEqual({ data: { id: '1', title: 'React' } });
      done();
    });
  });

  it('should wrap array in { data }', (done) => {
    const handler = createCallHandler([{ id: '1' }, { id: '2' }]);

    interceptor.intercept(mockContext, handler).subscribe((result) => {
      expect(result).toEqual({ data: [{ id: '1' }, { id: '2' }] });
      done();
    });
  });

  it('should wrap string in { data }', (done) => {
    const handler = createCallHandler('hello');

    interceptor.intercept(mockContext, handler).subscribe((result) => {
      expect(result).toEqual({ data: 'hello' });
      done();
    });
  });

  it('should wrap null in { data }', (done) => {
    const handler = createCallHandler(null);

    interceptor.intercept(mockContext, handler).subscribe((result) => {
      expect(result).toEqual({ data: null });
      done();
    });
  });

  it('should pass through paginated response (has data + meta)', (done) => {
    const paginatedResponse = {
      data: [{ id: '1' }],
      meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
    };
    const handler = createCallHandler(paginatedResponse);

    interceptor.intercept(mockContext, handler).subscribe((result) => {
      // Should NOT double-wrap
      expect(result).toEqual(paginatedResponse);
      done();
    });
  });

  it('should wrap object that has data but no meta', (done) => {
    const handler = createCallHandler({ data: 'something' });

    interceptor.intercept(mockContext, handler).subscribe((result) => {
      // Has "data" key but no "meta" → should wrap
      expect(result).toEqual({ data: { data: 'something' } });
      done();
    });
  });
});
