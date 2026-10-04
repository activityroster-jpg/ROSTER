/**
 * Working-time rules for young workers and adults. Pure: no DB, no
 * I/O. The figures come from a jurisdiction "pack" (data, see
 * lib/rules/working-time), never from code, and every pack figure carries a
 * verified flag so unverified numbers are shown as such. The centre remains
 * the employer and legally responsible; these checks are an aid.
 */
import { ageOn, parseIsoDate } from "./age";

export type PackKey = "gb" | "ni" | "ie";
export type SchoolLeavingRule = "gb" | "ni" | "ie";

/** Hour limits for one period type (term time or school holidays). */
export interface PeriodLimits {
  maxHoursPerDay: number | null;
  maxHoursPerWeek: number | null;
  /** Term time only: cap on a school day (Mon–Fri in term). */
  maxHoursSchoolDay?: number | null;
  maxHoursSaturday?: number | null;
  maxHoursSunday?: number | null;
}

export interface AgeBand {
  id: string;
  label: string;
  /** Inclusive age range; `until: "schoolLeaving"` ends the band at the school-leaving date instead of a birthday. */
  minAge: number;
  maxAge: number;
  until?: "schoolLeaving";
  /** Bands that apply only after school-leaving age (UK 16–17). */
  from?: "schoolLeaving";
  termTime: PeriodLimits;
  holiday: PeriodLimits;
  earliestStart: string | null; // "07:00"
  latestFinish: string | null;  // "19:00"
  latestFinishNoSchoolNextDay?: string | null;
  breakMinutes: number | null;
  breakAfterHours: number | null;
  dailyRestHours: number | null;
  weeklyRestHours?: number | null;
  weeklyRestDays?: number | null;
  annualBreak: string | null;
  paperwork: string | null;
  /** Field names whose figure is not yet verified against an official source. */
  unverified: string[];
  notes?: string;
}

export interface WorkingTimePack {
  key: PackKey;
  name: string;
  version: string;
  verified: boolean;
  schoolLeaving: SchoolLeavingRule;
  volunteersCovered: boolean;
  citations: { label: string; url: string }[];
  bands: AgeBand[];
  adults: { maxHoursPerWeekAveraged: number; breakMinutes: number; breakAfterHours: number; dailyRestHours: number; weeklyRestHours: number; notes: string };
}

export interface Shift { date: string; startAt: number; endAt: number; label?: string; proposed?: boolean }
export interface TermRange { from: string; to: string; label?: string }

export type WtSeverity = "block" | "warn" | "info";
export interface WtFinding { code: string; severity: WtSeverity; message: string; verified: boolean; date?: string }

export interface WorkingTimeInput {
  pack: WorkingTimePack | null;
  dateOfBirth: string | null;
  employmentType: string; // "employed" | "freelance" | "volunteer"
  termRanges: TermRange[];
  /** Everything already rostered for this person (any course). */
  existing: Shift[];
  /** What is about to be added. */
  proposed: Shift[];
  now?: Date;
}

const H = 3_600_000;
const DAY = 86_400_000;

function isoOf(ms: number, tz = "Europe/London"): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
function hmOf(ms: number, tz = "Europe/London"): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}
function weekdayOf(iso: string): number { return new Date(`${iso}T12:00:00Z`).getUTCDay(); } // 0 Sun … 6 Sat
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10);
}
function addDaysIso(iso: string, n: number): string { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/**
 * Is this date in school term time? With no term dates configured at all the
 * answer is YES: the term-time caps are the stricter ones, so a centre that has
 * not entered its dates yet gets the safe assumption, never the lenient one.
 */
export function inTerm(iso: string, ranges: TermRange[]): boolean {
  if (ranges.length === 0) return true;
  return ranges.some((r) => r.from <= iso && iso <= r.to);
}

/** Last Friday in June of the given year. */
function lastFridayOfJune(year: number): string {
  const d = new Date(Date.UTC(year, 5, 30));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * When compulsory school age ends. GB (England and Wales; Scotland approximated,
 * marked unverified in the pack): the last Friday in June of the school year in
 * which the person turns 16. NI: 30 June of that school year. Ireland: the 16th
 * birthday (the Act distinguishes children under 16 from young persons 16–17).
 */
export function schoolLeavingDate(dob: string, rule: SchoolLeavingRule): string | null {
  const b = parseIsoDate(dob);
  if (!b) return null;
  if (rule === "ie") return `${b.y + 16}-${String(b.m).padStart(2, "0")}-${String(b.d).padStart(2, "0")}`;
  // School year runs 1 September – 31 August. The year they turn 16 falls in the
  // school year starting the previous September when the birthday is Sept–Dec.
  const sixteenth = b.y + 16;
  const schoolYearEnd = b.m >= 9 ? sixteenth + 1 : sixteenth;
  return rule === "ni" ? `${schoolYearEnd}-06-30` : lastFridayOfJune(schoolYearEnd);
}

/** Which band applies on a date, or null (adult, or no DOB). */
export function selectBand(pack: WorkingTimePack, dob: string | null, onIso: string): AgeBand | null {
  if (!dob) return null;
  const age = ageOn(dob, new Date(`${onIso}T12:00:00Z`));
  if (age === null || age >= 18) return null;
  const leaving = schoolLeavingDate(dob, pack.schoolLeaving);
  const pastSchool = leaving ? onIso >= leaving : age >= 16;
  for (const band of pack.bands) {
    if (age < band.minAge || age > band.maxAge) continue;
    if (band.until === "schoolLeaving" && pastSchool) continue;
    if (band.from === "schoolLeaving" && !pastSchool) continue;
    return band;
  }
  return null;
}

const hours = (s: Shift) => (s.endAt - s.startAt) / H;
const fmtH = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

/**
 * Evaluate a person's rostered and proposed shifts against the pack. Returns
 * findings; "block" ones are breaches, "warn" ones need a human look, "info"
 * ones explain why checks are limited. Adults get warnings only (their limits
 * are averaged and can be opted out of); people with no date of birth get one
 * info finding.
 */
export function evaluateWorkingTime(input: WorkingTimeInput): WtFinding[] {
  const out: WtFinding[] = [];
  const { pack } = input;
  if (!pack) return [{ code: "no-pack", severity: "info", message: "Young-worker hour checks are not active for this centre's jurisdiction yet.", verified: true }];
  if (!input.dateOfBirth) return [{ code: "no-dob", severity: "info", message: "No date of birth on file, so young-worker hour checks can't run for this person.", verified: true }];
  const all = [...input.existing, ...input.proposed].filter((s) => s.endAt > s.startAt);
  if (all.length === 0) return out;
  const proposedDates = new Set(input.proposed.map((s) => s.date));
  const touchedWeeks = new Set(input.proposed.map((s) => mondayOf(s.date)));
  const inScope = all.filter((s) => touchedWeeks.has(mondayOf(s.date)));
  const onDate = input.proposed[0]?.date ?? input.existing[0]!.date;
  const band = selectBand(pack, input.dateOfBirth, onDate);
  if (!band) {
    // Younger than any band in the pack: the platform does not roster them as
    // workers (minimum age is the youngest band's minAge), so no caps are
    // applied; say so, loudly if they are recorded as employed.
    const age = ageOn(input.dateOfBirth, new Date(`${onDate}T12:00:00Z`));
    const minAge = Math.min(...pack.bands.map((b) => b.minAge));
    if (age !== null && age < minAge) {
      const volunteer = input.employmentType === "volunteer";
      out.push({
        code: "under-minimum-age",
        severity: volunteer ? "info" : "warn",
        message: volunteer
          ? `Aged ${age}: under ${minAge}, so no working-time caps are applied; under-${minAge}s may only volunteer, never be employed, and the centre remains responsible for their supervision.`
          : `Aged ${age} and recorded as ${input.employmentType}: ActivityRoster does not roster under-${minAge}s as workers and applies no hour caps to them. Change their employment type to volunteer, or do not roster them.`,
        verified: true,
      });
    }
    if (age !== null && age >= 18) return [...out, ...evaluateAdult(input, pack, inScope, proposedDates, touchedWeeks)];
    return out; // below the minimum age
  }
  const unv = (field: string) => !band.unverified.includes(field);
  if (input.employmentType === "volunteer" && !pack.volunteersCovered) {
    out.push({ code: "volunteer", severity: "info", message: `${pack.name}: the rules are framed around employment; applied to volunteers as best practice.`, verified: true });
  }

  // --- per shift: start/finish times and breaks ---
  for (const s of input.proposed) {
    const start = hmOf(s.startAt), end = hmOf(s.endAt);
    if (band.earliestStart && start < band.earliestStart) out.push({ code: "early-start", severity: "block", date: s.date, message: `${s.date}: starts at ${start}, earlier than ${band.earliestStart} allowed for ${band.label}.`, verified: unv("earliestStart") });
    const latest = band.latestFinish;
    if (latest && end > latest) out.push({ code: "late-finish", severity: "block", date: s.date, message: `${s.date}: finishes at ${end}, later than ${latest} allowed for ${band.label}.`, verified: unv("latestFinish") });
    if (band.breakAfterHours != null && band.breakMinutes != null && hours(s) > band.breakAfterHours) {
      out.push({ code: "break", severity: "warn", date: s.date, message: `${s.date}: ${fmtH(hours(s))} on one session. ${band.label} must get a ${band.breakMinutes}-minute break after ${band.breakAfterHours} hours; make sure it is scheduled.`, verified: unv("breakMinutes") });
    }
  }

  // --- per day: hours caps ---
  const byDate = new Map<string, number>();
  for (const s of inScope) byDate.set(s.date, (byDate.get(s.date) ?? 0) + hours(s));
  for (const [date, h] of byDate) {
    if (!proposedDates.has(date)) continue;
    const term = inTerm(date, input.termRanges);
    const limits = term ? band.termTime : band.holiday;
    const wd = weekdayOf(date);
    let cap: number | null = limits.maxHoursPerDay ?? null;
    let why = term ? "term time" : "school holidays";
    if (term && wd >= 1 && wd <= 5 && limits.maxHoursSchoolDay != null) { cap = limits.maxHoursSchoolDay; why = "a school day"; }
    if (wd === 6 && limits.maxHoursSaturday != null) { cap = limits.maxHoursSaturday; why = `a Saturday in ${term ? "term time" : "the holidays"}`; }
    if (wd === 0 && limits.maxHoursSunday != null) { cap = limits.maxHoursSunday; why = `a Sunday in ${term ? "term time" : "the holidays"}`; }
    if (cap != null && h > cap + 1e-9) out.push({ code: "daily-hours", severity: "block", date, message: `${date}: ${fmtH(h)} rostered on ${why}; the limit for ${band.label} is ${fmtH(cap)}.`, verified: unv("maxHoursPerDay") });
  }

  // --- per week: hours cap, rest days ---
  for (const monday of touchedWeeks) {
    const days = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
    const weekShifts = inScope.filter((s) => s.date >= monday && s.date <= days[6]!);
    const total = weekShifts.reduce((a, s) => a + hours(s), 0);
    const anyTerm = days.some((d) => inTerm(d, input.termRanges));
    const limits = anyTerm ? band.termTime : band.holiday;
    if (limits.maxHoursPerWeek != null && total > limits.maxHoursPerWeek + 1e-9) {
      out.push({ code: "weekly-hours", severity: "block", date: monday, message: `Week of ${monday}: ${fmtH(total)} rostered in ${anyTerm ? "term time" : "the holidays"}; the limit for ${band.label} is ${fmtH(limits.maxHoursPerWeek)} a week.`, verified: unv("maxHoursPerWeek") });
    }
    const workedDays = new Set(weekShifts.map((s) => s.date)).size;
    if (band.weeklyRestDays != null && 7 - workedDays < band.weeklyRestDays) {
      out.push({ code: "weekly-rest", severity: "block", date: monday, message: `Week of ${monday}: rostered on ${workedDays} days; ${band.label} must have ${band.weeklyRestDays} days off in every 7.`, verified: unv("weeklyRestDays") });
    } else if (band.weeklyRestHours != null && band.weeklyRestDays == null) {
      const needDays = band.weeklyRestHours >= 48 ? 2 : 1;
      if (7 - workedDays < needDays) out.push({ code: "weekly-rest", severity: "block", date: monday, message: `Week of ${monday}: rostered on ${workedDays} days; ${band.label} must have ${band.weeklyRestHours} hours' rest each week (about ${needDays} clear day${needDays === 1 ? "" : "s"}).`, verified: unv("weeklyRestHours") });
    }
  }

  // --- daily rest between consecutive days ---
  if (band.dailyRestHours != null) {
    const sorted = [...inScope].sort((a, b) => a.startAt - b.startAt);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!, cur = sorted[i]!;
      if (cur.date === prev.date) continue;
      if (!proposedDates.has(cur.date) && !proposedDates.has(prev.date)) continue;
      const gap = (cur.startAt - prev.endAt) / H;
      if (gap < band.dailyRestHours && cur.startAt - prev.endAt < DAY) {
        out.push({ code: "daily-rest", severity: "block", date: cur.date, message: `${prev.date} → ${cur.date}: only ${fmtH(Math.max(0, gap))} between finishing and starting; ${band.label} need ${band.dailyRestHours} hours' rest.`, verified: unv("dailyRestHours") });
      }
    }
  }

  if (band.annualBreak) out.push({ code: "annual-break", severity: "info", message: `${band.label}: ${band.annualBreak}. Check this across the season by hand.`, verified: unv("annualBreak") });
  if (band.paperwork) out.push({ code: "paperwork", severity: "info", message: `${band.label}: ${band.paperwork}`, verified: unv("paperwork") });
  if (!pack.verified) out.push({ code: "unverified-pack", severity: "info", message: `The ${pack.name} figures have not all been verified against official sources yet; treat these checks as a guide.`, verified: false });
  return out;
}

/**
 * Adults (18+): the Working Time Regulations figures from the pack's `adults`
 * block, as warnings rather than blocks. The weekly limit is an average over a
 * reference period and a worker may opt out in writing, and a break can be taken
 * inside a long session, so a single rostered week can only ever suggest a look.
 */
function evaluateAdult(input: WorkingTimeInput, pack: WorkingTimePack, inScope: Shift[], proposedDates: Set<string>, touchedWeeks: Set<string>): WtFinding[] {
  const a = pack.adults;
  const out: WtFinding[] = [];
  if (!a) return out;
  const label = "adults";
  for (const s of input.proposed) {
    if (a.breakAfterHours != null && a.breakMinutes != null && hours(s) > a.breakAfterHours) {
      out.push({ code: "break", severity: "warn", date: s.date, message: `${s.date}: ${fmtH(hours(s))} on one session. Adults working more than ${a.breakAfterHours} hours are entitled to a ${a.breakMinutes}-minute break; make sure it is scheduled.`, verified: pack.verified });
    }
  }
  for (const monday of touchedWeeks) {
    const end = addDaysIso(monday, 6);
    const weekShifts = inScope.filter((s) => s.date >= monday && s.date <= end);
    const total = weekShifts.reduce((n, s) => n + hours(s), 0);
    if (a.maxHoursPerWeekAveraged != null && total > a.maxHoursPerWeekAveraged + 1e-9) {
      out.push({ code: "weekly-hours", severity: "warn", date: monday, message: `Week of ${monday}: ${fmtH(total)} rostered. The adult limit is ${fmtH(a.maxHoursPerWeekAveraged)} a week averaged over the reference period, unless this person has opted out in writing; check the surrounding weeks.`, verified: pack.verified });
    }
    const workedDays = new Set(weekShifts.map((s) => s.date)).size;
    if (a.weeklyRestHours != null && workedDays >= 7) {
      out.push({ code: "weekly-rest", severity: "warn", date: monday, message: `Week of ${monday}: rostered on all 7 days. Adults are entitled to ${a.weeklyRestHours} hours' rest a week (or twice that a fortnight); check the week either side.`, verified: pack.verified });
    }
  }
  if (a.dailyRestHours != null) {
    const sorted = [...inScope].sort((x, y) => x.startAt - y.startAt);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!, cur = sorted[i]!;
      if (cur.date === prev.date) continue;
      if (!proposedDates.has(cur.date) && !proposedDates.has(prev.date)) continue;
      const gap = (cur.startAt - prev.endAt) / H;
      if (gap < a.dailyRestHours && cur.startAt - prev.endAt < DAY) {
        out.push({ code: "daily-rest", severity: "warn", date: cur.date, message: `${prev.date} → ${cur.date}: only ${fmtH(Math.max(0, gap))} between finishing and starting; ${label} are entitled to ${a.dailyRestHours} hours' rest between working days.`, verified: pack.verified });
      }
    }
  }
  return out;
}

/** Summary helper for the staff page: hours this week vs the applicable cap. */
export function weekSummary(pack: WorkingTimePack | null, dob: string | null, shifts: Shift[], weekMondayIso: string, termRanges: TermRange[]): { hours: number; cap: number | null; band: string | null } {
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekMondayIso, i));
  const week = shifts.filter((s) => s.date >= weekMondayIso && s.date <= days[6]!);
  const total = week.reduce((a, s) => a + hours(s), 0);
  if (!pack || !dob) return { hours: total, cap: null, band: null };
  const band = selectBand(pack, dob, weekMondayIso);
  if (!band) {
    const age = ageOn(dob, new Date(`${weekMondayIso}T12:00:00Z`));
    if (age !== null && age >= 18 && pack.adults) return { hours: total, cap: pack.adults.maxHoursPerWeekAveraged, band: "adults (48-hour average)" };
    return { hours: total, cap: null, band: null };
  }
  const anyTerm = days.some((d) => inTerm(d, termRanges));
  return { hours: total, cap: (anyTerm ? band.termTime : band.holiday).maxHoursPerWeek, band: band.label };
}

export { isoOf as isoDateOf, hmOf as clockOf };
