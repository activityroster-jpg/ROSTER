/**
 * Turn weekly availability windows (UTC/GMT) into concrete bookable call slots.
 * Pure function — no DB, no I/O — so it's easy to test and reuse on the public
 * booking page. All times are UTC; the UI labels them GMT.
 */

export interface AvailabilityWindow {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (UTC)
  startMinute: number; // minutes from 00:00 UTC
  endMinute: number;
  active: boolean;
}

export interface SlotOptions {
  now?: Date;
  horizonDays?: number; // how many days ahead to scan (default 21)
  leadMinutes?: number; // minimum notice before a slot can be booked (default 120)
  slotMinutes?: number; // slot length (default 30)
  // When set, only offer slots falling on the next N working days (Mon–Fri),
  // skipping weekends entirely. Used by the public booking page.
  maxWorkingDays?: number;
}

const isWeekend = (dow: number) => dow === 0 || dow === 6;

const DAY_MS = 86_400_000;

/**
 * Bookable slot start times (UTC), sorted ascending, excluding any that are in
 * the past (within the lead time) or already booked.
 */
export function openSlots(
  windows: AvailabilityWindow[],
  booked: Date[],
  opts: SlotOptions = {},
): Date[] {
  const now = opts.now ?? new Date();
  const horizon = opts.horizonDays ?? 21;
  const lead = opts.leadMinutes ?? 120;
  const slot = opts.slotMinutes ?? 30;

  const bookedSet = new Set(booked.map((d) => d.getTime()));
  const earliest = now.getTime() + lead * 60_000;
  const active = windows.filter((w) => w.active && w.endMinute > w.startMinute);
  if (active.length === 0) return [];

  const startDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: Date[] = [];
  let workingDaysSeen = 0;

  for (let d = 0; d <= horizon; d++) {
    const dayStart = startDay + d * DAY_MS;
    const dow = new Date(dayStart).getUTCDay();

    // Restrict to the next N working days (Mon–Fri) when asked.
    if (opts.maxWorkingDays != null) {
      if (isWeekend(dow)) continue;
      workingDaysSeen++;
      if (workingDaysSeen > opts.maxWorkingDays) break;
    }

    for (const w of active) {
      if (w.dayOfWeek !== dow) continue;
      for (let m = w.startMinute; m + slot <= w.endMinute; m += slot) {
        const t = dayStart + m * 60_000;
        if (t < earliest) continue;
        if (bookedSet.has(t)) continue;
        out.push(new Date(t));
      }
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

/** Format a UTC slot as a GMT time label, e.g. "09:30". */
export function slotTimeLabel(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Format a UTC day as "Monday 5 May". */
export function slotDayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** "HH:MM" (minutes-from-midnight) helpers for the admin availability editor. */
export function minutesToHHMM(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}
export function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
