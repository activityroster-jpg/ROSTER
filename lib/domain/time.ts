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

/**
 * The centres run on UK time. Session times are stored as wall-clock values
 * (parsed as if UTC) and are displayed with timeZone "UTC"; clock-ins, however,
 * are REAL instants and must be shown in local time, or they read an hour early
 * all summer. These helpers format real instants in the centre's zone.
 */
export const DEFAULT_TIMEZONE = "Europe/London";

/** "HH:MM" of a real instant in the given zone. */
export function fmtClockTime(ms: number | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
}

/** "YYYY-MM-DD" of a real instant in the given zone. */
export function isoDateInTz(ms: number | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Today's date in the centre's zone (not UTC, which flips an hour early in summer). */
export function todayIso(timeZone: string = DEFAULT_TIMEZONE, now: number = Date.now()): string {
  return isoDateInTz(now, timeZone);
}
