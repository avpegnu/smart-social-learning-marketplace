/**
 * Merge overlapping video watched segments.
 * Input: [[0, 240], [200, 480], [600, 900]]
 * Output: [[0, 480], [600, 900]]
 */
export function mergeSegments(segments: [number, number][]): [number, number][] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const first = sorted[0]!;
  const merged: [number, number][] = [first];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const current = sorted[i]!;

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Calculate total watched duration from segments.
 */
export function calculateWatchedDuration(segments: [number, number][]): number {
  return segments.reduce((total, [start, end]) => total + (end - start), 0);
}

/**
 * Calculate watched percentage.
 */
export function calculateWatchedPercent(
  segments: [number, number][],
  totalDuration: number,
): number {
  if (totalDuration === 0) return 0;
  const watched = calculateWatchedDuration(segments);
  return Math.min(watched / totalDuration, 1);
}
