import { mergeSegments, calculateWatchedDuration, calculateWatchedPercent } from './segments.util';

describe('segments.util', () => {
  describe('mergeSegments', () => {
    it('should return empty array for empty input', () => {
      expect(mergeSegments([])).toEqual([]);
    });

    it('should return single segment unchanged', () => {
      expect(mergeSegments([[0, 100]])).toEqual([[0, 100]]);
    });

    it('should merge overlapping segments', () => {
      expect(
        mergeSegments([
          [0, 240],
          [200, 480],
        ]),
      ).toEqual([[0, 480]]);
    });

    it('should merge multiple overlapping segments', () => {
      expect(
        mergeSegments([
          [0, 240],
          [200, 480],
          [600, 900],
        ]),
      ).toEqual([
        [0, 480],
        [600, 900],
      ]);
    });

    it('should not merge non-overlapping segments', () => {
      expect(
        mergeSegments([
          [0, 100],
          [200, 300],
        ]),
      ).toEqual([
        [0, 100],
        [200, 300],
      ]);
    });

    it('should handle segments touching at boundary', () => {
      // [0, 100] and [100, 200] touch at 100 → merge
      expect(
        mergeSegments([
          [0, 100],
          [100, 200],
        ]),
      ).toEqual([[0, 200]]);
    });

    it('should handle unsorted segments', () => {
      expect(
        mergeSegments([
          [200, 300],
          [0, 100],
          [50, 250],
        ]),
      ).toEqual([[0, 300]]);
    });

    it('should handle contained segments', () => {
      // [0, 500] contains [100, 200]
      expect(
        mergeSegments([
          [0, 500],
          [100, 200],
        ]),
      ).toEqual([[0, 500]]);
    });

    it('should handle duplicate segments', () => {
      expect(
        mergeSegments([
          [0, 100],
          [0, 100],
        ]),
      ).toEqual([[0, 100]]);
    });
  });

  describe('calculateWatchedDuration', () => {
    it('should return 0 for empty segments', () => {
      expect(calculateWatchedDuration([])).toBe(0);
    });

    it('should calculate duration of single segment', () => {
      expect(calculateWatchedDuration([[0, 100]])).toBe(100);
    });

    it('should sum durations of multiple segments', () => {
      expect(
        calculateWatchedDuration([
          [0, 480],
          [600, 900],
        ]),
      ).toBe(780);
    });
  });

  describe('calculateWatchedPercent', () => {
    it('should return 0 for zero total duration', () => {
      expect(calculateWatchedPercent([[0, 100]], 0)).toBe(0);
    });

    it('should return correct percentage', () => {
      expect(
        calculateWatchedPercent(
          [
            [0, 480],
            [600, 900],
          ],
          900,
        ),
      ).toBeCloseTo(0.8667, 3);
    });

    it('should cap at 1 (100%)', () => {
      // Watched more than total (edge case with overlapping unmerged segments)
      expect(calculateWatchedPercent([[0, 1000]], 500)).toBe(1);
    });

    it('should return 0 for empty segments', () => {
      expect(calculateWatchedPercent([], 900)).toBe(0);
    });

    it('should return 1 for fully watched', () => {
      expect(calculateWatchedPercent([[0, 900]], 900)).toBe(1);
    });
  });
});
