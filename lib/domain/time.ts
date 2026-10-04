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
 * ONE RULE FOR TIMES (decided 4 Oct 2026): there are no time zones. Every time a
 * person types or sees is a wall-clock value, 24-hour, exactly as typed, all
 * year. Session times AND clock-in/out stamps are stored as that wall-clock
 * value encoded as if UTC (09:00 is 09:00Z), so durations subtract cleanly and
 * every output formats with timeZone "UTC". The only place a real zone exists is
 * `wallClockMs`: turning the real "now" into today's wall-clock for a centre,
 * used when a device doesn't say its local time and to time the morning digest.
 * The centre's zone is detected from the browser at sign-up; it is never shown.
 */
export const DEFAULT_TIMEZONE = "Europe/London";

/** "HH:MM" of a stored wall-clock value (session or clock stamp). */
export function fmtWallTime(ms: number | Date): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}
/** "YYYY-MM-DD" of a stored wall-clock value. */
export function wallDateIso(ms: number | Date): string {
  return (ms instanceof Date ? ms : new Date(ms)).toISOString().slice(0, 10);
}
/** Kept for callers that still name it this way: clock stamps are wall-clock too now. The zone argument is ignored. */
export function fmtClockTime(ms: number | Date, _timeZone?: string): string {
  return fmtWallTime(ms);
}

/** The real instant `now` as the wall-clock in `timeZone`, encoded as UTC ms (the storage convention above). */
export function wallClockMs(timeZone: string = DEFAULT_TIMEZONE, now: number = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(now));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = g("hour") === "24" ? "00" : g("hour");
  return Date.parse(`${g("year")}-${g("month")}-${g("day")}T${hour}:${g("minute")}:${g("second")}.000Z`);
}

/** A device-reported local time "YYYY-MM-DDTHH:MM" as wall-clock ms, or null when malformed or more than 20 minutes from the centre's own clock (never trust the client blindly). */
export function wallClockFromDevice(local: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE, now: number = Date.now()): number | null {
  if (!local || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) return null;
  const ms = Date.parse(`${local.length === 16 ? `${local}:00` : local}.000Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.abs(ms - wallClockMs(timeZone, now)) <= 20 * 60_000 ? ms : null;
}

/** Hour (0–23) of the real instant in a zone; used only to time the morning digest. */
export function hourIn(timeZone: string = DEFAULT_TIMEZONE, now: number = Date.now()): number {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hour12: false }).format(new Date(now)));
  return h % 24;
}

/** "YYYY-MM-DD" of a real instant in the given zone (today's date for a centre). */
export function isoDateInTz(ms: number | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Today's date in the centre's zone. */
export function todayIso(timeZone: string = DEFAULT_TIMEZONE, now: number = Date.now()): string {
  return isoDateInTz(now, timeZone);
}

/** True when the name is an IANA zone this runtime knows. */
export function isKnownTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return true; } catch { return false; }
}
