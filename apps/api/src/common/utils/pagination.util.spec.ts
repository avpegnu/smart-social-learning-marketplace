import { createPaginatedResult } from './pagination.util';

describe('pagination.util', () => {
  describe('createPaginatedResult', () => {
    it('should create paginated result with correct meta', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = createPaginatedResult(data, 50, 1, 20);

      expect(result).toEqual({
        data,
        meta: {
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      });
    });

    it('should calculate totalPages correctly with exact division', () => {
      const result = createPaginatedResult([], 100, 1, 20);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should ceil totalPages for partial last page', () => {
      const result = createPaginatedResult([], 101, 1, 20);
      expect(result.meta.totalPages).toBe(6); // Math.ceil(101/20) = 6
    });

    it('should handle zero total', () => {
      const result = createPaginatedResult([], 0, 1, 20);
      expect(result.meta.totalPages).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('should handle single item', () => {
      const result = createPaginatedResult([{ id: '1' }], 1, 1, 20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should preserve generic type', () => {
      interface Course {
        id: string;
        title: string;
      }
      const courses: Course[] = [{ id: 'c1', title: 'React' }];
      const result = createPaginatedResult<Course>(courses, 1, 1, 10);
      expect(result.data[0]?.title).toBe('React');
    });
  });
});
