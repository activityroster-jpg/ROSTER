/**
 * Course default schedules and break rules. Pure — no DB, no I/O.
 */

/** One session in a course type's default schedule. `day` is 1-based (Day 1, Day 2…). */
export interface DefaultSession { day: number; start: string; end: string }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_DEFAULT_SESSIONS = 14;

/** Validate and normalise a schedule (drops bad rows, sorts by day then start). */
export function normaliseDefaultSchedule(input: unknown): DefaultSession[] {
  if (!Array.isArray(input)) return [];
  const out: DefaultSession[] = [];
  for (const r of input.slice(0, MAX_DEFAULT_SESSIONS)) {
    if (!r || typeof r !== "object") continue;
    const { day, start, end } = r as Record<string, unknown>;
    const d = Math.round(Number(day));
    if (!Number.isFinite(d) || d < 1 || d > 60) continue;
    if (typeof start !== "string" || typeof end !== "string" || !HHMM.test(start) || !HHMM.test(end) || end <= start) continue;
    out.push({ day: d, start, end });
  }
  return out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

/** Parse the stored JSON (tolerates null / garbage → empty). */
export function parseDefaultSchedule(json: string | null | undefined): DefaultSession[] {
  if (!json) return [];
  try { return normaliseDefaultSchedule(JSON.parse(json)); } catch { return []; }
}

/** Turn a default schedule into dated sessions, Day 1 = startDate (YYYY-MM-DD). */
export function expandDefaultSchedule(startDate: string, sessions: DefaultSession[]): { date: string; start: string; end: string }[] {
  const base = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(base)) return [];
  return sessions.map((s) => ({
    date: new Date(base + (s.day - 1) * 86_400_000).toISOString().slice(0, 10),
    start: s.start,
    end: s.end,
  }));
}

/** Short human summary, e.g. "2 sessions over 2 days · 09:00–17:00". */
export function describeDefaultSchedule(sessions: DefaultSession[]): string {
  if (sessions.length === 0) return "No default";
  const days = new Set(sessions.map((s) => s.day)).size;
  const times = [...new Set(sessions.map((s) => `${s.start}–${s.end}`))];
  const n = `${sessions.length} session${sessions.length === 1 ? "" : "s"}${days > 1 ? ` over ${days} days` : ""}`;
  return `${n} · ${times.length === 1 ? times[0] : "varied times"}`;
}

/** A centre's break rule. breakMinutes 0 = no breaks. */
export interface BreakPolicy { afterMinutes: number; breakMinutes: number; paid: boolean }

/**
 * Apply the break rule to a stint of work: anyone working MORE than
 * `afterMinutes` takes a `breakMinutes` break. Unpaid breaks come off the
 * payable minutes; paid ones don't.
 */
export function applyBreak(workedMinutes: number, policy: BreakPolicy | null | undefined): { breakMinutes: number; payableMinutes: number } {
  const worked = Math.max(0, Math.round(workedMinutes));
  if (!policy || policy.breakMinutes <= 0 || worked <= policy.afterMinutes) return { breakMinutes: 0, payableMinutes: worked };
  const br = Math.min(policy.breakMinutes, worked);
  return { breakMinutes: br, payableMinutes: policy.paid ? worked : worked - br };
}
