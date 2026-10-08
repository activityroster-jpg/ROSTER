/**
 * Availability has no blank (audit Part E, decision 4).
 *
 * Within the centre's availability window every slot counts as Busy until the
 * instructor (or the office) marks it Free or Maybe. An instructor's "usual week"
 * (a weekday pattern) fills in any day they haven't answered individually. Beyond
 * the window nobody has been asked yet, so a slot there is "unasked" and never
 * blocks rostering.
 *
 * Office-managed people (no sign-up needed; the office keeps their availability)
 * are the other way round: a slot nobody has answered counts as Free
 * ("assumed"), and the office only marks the days they can't work.
 *
 * Pure functions only: no DB, no framework, no clock. Callers pass today's date.
 */

export type AvailabilityAnswer = "available" | "tentative" | "unavailable";
export type EffectiveStatus = AvailabilityAnswer | "unasked";
/** Where an effective status came from: a dated answer, the usual week, the Busy default, outside the window, or assumed Free (office-managed). */
export type AvailabilitySource = "set" | "pattern" | "default" | "unasked" | "assumed";

export interface EffectiveAvailability {
  status: EffectiveStatus;
  source: AvailabilitySource;
}

/** Half-open date range [from, to) in which instructors are being asked for availability. */
export interface AvailabilityHorizon {
  from: string;
  to: string;
  weeksAhead: number;
}

export interface AvailabilityIndex {
  /** `${date}|${slot}` → answer for that exact day. */
  dated: Record<string, AvailabilityAnswer>;
  /** `${weekday}|${slot}` (weekday 0 = Sunday … 6 = Saturday) → the usual-week answer. */
  pattern: Record<string, AvailabilityAnswer>;
  /** Office-managed: an unanswered slot counts as Free instead of Busy. */
  assumeFree?: boolean;
}

/** Whether the office keeps this person's availability: their own setting, else the centre's. */
export function managedByOffice(person: { managedBy?: string | null }, centre: { staffManagedBy?: string | null } | null | undefined): boolean {
  return (person.managedBy ?? centre?.staffManagedBy ?? "staff") === "office";
}

export const SLOT_ORDER = ["AM", "PM", "EV"] as const;

export const keyOf = (date: string, slot: string): string => `${date}|${slot}`;
export const patternKeyOf = (weekday: number, slot: string): string => `${weekday}|${slot}`;

/** 0 = Sunday … 6 = Saturday, the JavaScript convention (and the one welfare duty uses). */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/** ISO date of the Monday of the week holding `isoDate`. */
export function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The window runs from this week's Monday for `weeksAhead` weeks (1–26; default 4). */
export function horizonFor(todayIso: string, weeksAhead: number | null | undefined): AvailabilityHorizon {
  const weeks = Math.max(1, Math.min(26, Math.round(Number(weeksAhead) || 4)));
  const from = mondayOf(todayIso);
  return { from, to: addDaysIso(from, weeks * 7), weeksAhead: weeks };
}

export const inHorizon = (h: AvailabilityHorizon, isoDate: string): boolean => isoDate >= h.from && isoDate < h.to;

/** Build the lookup index from raw rows (dated and weekday rows mixed, as stored). */
export function indexAvailability(
  rows: readonly { date: string | null; weekday: number | null; slot: string; status: string }[],
  opts: { assumeFree?: boolean } = {},
): AvailabilityIndex {
  const dated: Record<string, AvailabilityAnswer> = {};
  const pattern: Record<string, AvailabilityAnswer> = {};
  for (const r of rows) {
    const status = r.status as AvailabilityAnswer;
    if (r.date) dated[keyOf(r.date, r.slot)] = status;
    else if (r.weekday !== null && r.weekday !== undefined) pattern[patternKeyOf(r.weekday, r.slot)] = status;
  }
  return { dated, pattern, ...(opts.assumeFree ? { assumeFree: true } : {}) };
}

/** The status that applies to one date and slot, and why. */
export function effectiveAvailability(index: AvailabilityIndex, horizon: AvailabilityHorizon, date: string, slot: string): EffectiveAvailability {
  const set = index.dated[keyOf(date, slot)];
  if (set) return { status: set, source: "set" };
  const usual = index.pattern[patternKeyOf(weekdayOf(date), slot)];
  if (usual) return { status: usual, source: "pattern" };
  if (index.assumeFree) return { status: "available", source: "assumed" };
  if (!inHorizon(horizon, date)) return { status: "unasked", source: "unasked" };
  return { status: "unavailable", source: "default" };
}

/** True when rostering this slot should be stopped (override allowed): any kind of Busy. */
export const blocksRostering = (e: EffectiveAvailability): boolean => e.status === "unavailable";

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** Plain-English reason for a Busy result, for the assignment message. */
export function describeBusy(e: EffectiveAvailability, date: string, slot: string): string {
  if (e.source === "pattern") return `Usually busy on ${DAY_NAMES[weekdayOf(date)]} ${slot} (their usual week)`;
  if (e.source === "default") return `Hasn't marked ${date} ${slot} as free yet (counts as busy until they do)`;
  return `Marked busy on ${date} ${slot}`;
}

/**
 * How an instructor stands against a course's slots, for the staff picker.
 *   available   every slot Free
 *   partial     a mix of Free / Maybe (and perhaps unasked), nothing Busy
 *   unavailable said Busy (or usually busy) for at least one slot
 *   silent      hasn't answered at least one slot inside the window (counts as busy)
 *   unset       none of the slots has been asked about yet (beyond the window)
 *   none        the course has no sessions
 */
export type CourseAvailState = "available" | "partial" | "unavailable" | "silent" | "unset" | "none";

export function courseAvailState(index: AvailabilityIndex, horizon: AvailabilityHorizon, keys: readonly string[]): CourseAvailState {
  if (keys.length === 0) return "none";
  let said = false, silent = false, asked = 0, allFree = true;
  for (const k of keys) {
    const [date, slot] = k.split("|") as [string, string];
    const e = effectiveAvailability(index, horizon, date, slot);
    if (e.status === "unavailable") { if (e.source === "default") silent = true; else said = true; continue; }
    if (e.status === "unasked") { allFree = false; continue; }
    asked++;
    if (e.status !== "available") allFree = false;
  }
  if (said) return "unavailable";
  if (silent) return "silent";
  if (asked === 0) return "unset";
  return allFree && asked === keys.length ? "available" : "partial";
}

/** Short label for a picker option. */
export function courseAvailLabel(state: CourseAvailState): string {
  switch (state) {
    case "available": return "✓ free";
    case "partial": return "~ partly free";
    case "unavailable": return "✕ busy";
    case "silent": return "· hasn't answered (counts as busy)";
    case "unset": return "? not asked yet";
    default: return "";
  }
}
