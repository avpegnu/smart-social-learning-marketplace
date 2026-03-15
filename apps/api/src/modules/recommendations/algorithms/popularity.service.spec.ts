import { PopularityService } from './popularity.service';

describe('PopularityService', () => {
  describe('wilsonScoreLowerBound', () => {
    let service: PopularityService;

    beforeEach(() => {
      service = new PopularityService(null as never);
    });

    it('should return 0 for no reviews', () => {
      expect(service.wilsonScoreLowerBound(5.0, 0)).toBe(0);
    });

    it('should return higher score for more reviews at same rating', () => {
      const score1Review = service.wilsonScoreLowerBound(4.5, 1);
      const score100Reviews = service.wilsonScoreLowerBound(4.5, 100);

      // 100 reviews should have higher confidence → higher score
      expect(score100Reviews).toBeGreaterThan(score1Review);
    });

    it('should return lower score for lower ratings', () => {
      const score5Stars = service.wilsonScoreLowerBound(5.0, 50);
      const score3Stars = service.wilsonScoreLowerBound(3.0, 50);

      expect(score5Stars).toBeGreaterThan(score3Stars);
    });

    it('should return value between 0 and 1', () => {
      const score = service.wilsonScoreLowerBound(4.0, 20);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
