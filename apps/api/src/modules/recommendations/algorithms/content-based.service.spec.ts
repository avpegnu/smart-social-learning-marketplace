import { ContentBasedService } from './content-based.service';

describe('ContentBasedService', () => {
  let service: ContentBasedService;

  beforeEach(() => {
    service = new ContentBasedService(null as never);
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const result = service.cosineSimilarity([1, 0, 1, 0], [1, 0, 1, 0]);
      expect(result).toBeCloseTo(1.0);
    });

    it('should return 0 for orthogonal vectors', () => {
      const result = service.cosineSimilarity([1, 0, 0, 0], [0, 1, 0, 0]);
      expect(result).toBeCloseTo(0.0);
    });

    it('should return value between 0 and 1 for partial overlap', () => {
      // Course A: tags [react, hooks]
      // Course B: tags [react, nextjs]
      // Overlap on "react" only
      const result = service.cosineSimilarity([1, 1, 0], [1, 0, 1]);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
      // cos(60°) = 0.5
      expect(result).toBeCloseTo(0.5);
    });

    it('should return 0 for zero vectors', () => {
      const result = service.cosineSimilarity([0, 0, 0], [0, 0, 0]);
      expect(result).toBe(0);
    });

    it('should return 0 when one vector is zero', () => {
      const result = service.cosineSimilarity([1, 1, 0], [0, 0, 0]);
      expect(result).toBe(0);
    });

    it('should handle single dimension', () => {
      const result = service.cosineSimilarity([1], [1]);
      expect(result).toBeCloseTo(1.0);
    });

    it('should be symmetric: cos(A,B) = cos(B,A)', () => {
      const a = [1, 0, 1, 1, 0];
      const b = [0, 1, 1, 0, 1];
      expect(service.cosineSimilarity(a, b)).toBeCloseTo(service.cosineSimilarity(b, a));
    });
  });
});
