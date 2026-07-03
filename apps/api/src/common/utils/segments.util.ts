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
 * Sanitize (khử trùng -> làm sạch) client-reported watched segments before trusting them.
 *
 * The watched time that drives lesson completion comes from the client, so the
 * server must not blindly trust it. This drops malformed entries and clamps
 * each segment to [0, maxDuration] so out-of-range values cannot inflate the
 * watched total. A non-positive maxDuration means "duration unknown" → only the
 * shape and the lower bound are enforced.
 */
export function sanitizeSegments(segments: unknown, maxDuration: number): [number, number][] {
  if (!Array.isArray(segments)) return [];

  const upperBound = maxDuration > 0 ? maxDuration : Number.POSITIVE_INFINITY;
  const clean: [number, number][] = [];

  for (const segment of segments) {
    if (!Array.isArray(segment) || segment.length !== 2) continue;

    const [rawStart, rawEnd] = segment;
    if (typeof rawStart !== 'number' || typeof rawEnd !== 'number') continue;
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) continue;

    const start = Math.min(Math.max(Math.floor(rawStart), 0), upperBound);
    const end = Math.min(Math.max(Math.floor(rawEnd), 0), upperBound);
    if (end > start) clean.push([start, end]);
  }

  return clean;
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
