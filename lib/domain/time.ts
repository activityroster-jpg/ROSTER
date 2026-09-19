/**
 * Pure time helpers. All instants are epoch milliseconds.
 */

export interface Interval {
  readonly startAt: number;
  readonly endAt: number;
}

/**
 * Two half-open intervals overlap iff `a.start < b.end && b.start < a.end`.
 * Touching end-to-start (a.end === b.start) does NOT overlap.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function durationMinutes(i: Interval): number {
  return Math.max(0, Math.round((i.endAt - i.startAt) / 60000));
}
