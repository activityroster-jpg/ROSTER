import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { hoursRecord as hoursRecordTable, type HoursSource, type PayUnit } from "@/lib/db/schema";
import { applyBreak, fmtClockTime, linePay, markFirstOfDay, type BreakPolicy } from "@/lib/domain";

export interface HoursRow {
  instructorName: string;
  scheduledMinutes: number;
  actualMinutes: number | null;
  rate: number | null;
  pay: number | null;
  approved: boolean;
}

/** Hours (scheduled vs actual) with pay, per instructor record. Tenant scoped. */
export async function getHoursSummary(repos: Repositories, ctx: AnyTenantContext): Promise<HoursRow[]> {
  const [records, instructors] = await Promise.all([
    repos.tenant.hoursRecord.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));

  return records.map((r) => {
    const minutes = r.actualMinutes ?? r.scheduledMinutes;
    const pay = r.rate != null ? Math.round((minutes / 60) * r.rate * 100) / 100 : null;
    return {
      instructorName: nameById.get(r.instructorId) ?? "Unknown",
      scheduledMinutes: r.scheduledMinutes,
      actualMinutes: r.actualMinutes ?? null,
      rate: r.rate ?? null,
      pay,
      approved: r.approved,
    };
  });
}

/** Render hours rows as CSV (finance export). */
export function hoursToCsv(rows: HoursRow[]): string {
  const header = ["Instructor", "Scheduled (h)", "Actual (h)", "Rate", "Pay", "Approved"];
  const lines = rows.map((r) =>
    [
      escapeCsv(r.instructorName),
      (r.scheduledMinutes / 60).toFixed(2),
      r.actualMinutes != null ? (r.actualMinutes / 60).toFixed(2) : "",
      r.rate != null ? r.rate.toFixed(2) : "",
      r.pay != null ? r.pay.toFixed(2) : "",
      r.approved ? "yes" : "no",
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface InstructorHoursRow {
  date: string | null;
  courseName: string;
  scheduledMinutes: number;
  actualMinutes: number | null;
  minutes: number;
  rate: number | null;
  pay: number | null;
  approved: boolean;
}
export interface InstructorHoursSummary {
  rows: InstructorHoursRow[];
  totalMinutes: number;
  totalPay: number;
}

/** One instructor's own hours (for the portal): the same lines payroll uses, estimated. */
export async function getInstructorHours(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<InstructorHoursSummary> {
  const { lines } = await getPayrollLines(repos, ctx, { instructorId });
  let totalMinutes = 0;
  let totalPay = 0;
  const rows: InstructorHoursRow[] = lines
    .map((l) => {
      totalMinutes += l.payableMinutes;
      totalPay += l.pay ?? 0;
      return {
        date: l.date,
        courseName: l.courseName,
        scheduledMinutes: l.scheduledMinutes,
        actualMinutes: l.clockedMinutes,
        minutes: l.payableMinutes,
        rate: l.rate,
        pay: l.pay,
        approved: l.approved,
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { rows, totalMinutes, totalPay: Math.round(totalPay * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Payroll lines — one per rostered (or clocked) session. Hours come from the
// rota by default; the clock can supply actuals; the office can pick which
// to pay per line and override minutes or pay outright during review.
// ---------------------------------------------------------------------------

export interface PayrollFilter { from?: string; to?: string; instructorId?: string }

export interface PayrollLine {
  recordId: string;
  date: string | null;
  instructorId: string;
  instructorName: string;
  courseName: string;
  start: string | null; // HH:MM
  finish: string | null; // HH:MM
  /** Minutes on the rota for this session. */
  scheduledMinutes: number;
  /** Minutes the clock recorded, if any. */
  clockedMinutes: number | null;
  /** Which minutes this line pays on. */
  source: HoursSource;
  /** Office override of the minutes (wins over source). */
  overrideMinutes: number | null;
  /** The minutes actually used before breaks. */
  workedMinutes: number;
  breakMinutes: number;
  payableMinutes: number;
  payUnit: PayUnit;
  rate: number | null;
  /** Office override of the pay (wins over everything). */
  overridePay: number | null;
  pay: number | null;
  approved: boolean;
  note: string | null;
  /** true when start/finish come from clock-in/out rather than the schedule. */
  clocked: boolean;
}

export interface PayrollSummaryRow {
  instructorName: string;
  shifts: number;
  workedMinutes: number;
  breakMinutes: number;
  payableMinutes: number;
  pay: number;
  /** Lines with no rate set — pay unknown, not zero. */
  unpriced: number;
}

const toMs = (v: Date | number | string | null | undefined): number | null =>
  v == null ? null : v instanceof Date ? v.getTime() : Number(v);
// Session times are wall-clock values stored as UTC — shown as stored.
const hhmm = (ms: number | null) => (ms == null || Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(11, 16));

/** Every hours record as a payroll line, filtered, with the pay rules applied. Tenant scoped. */
export async function getPayrollLines(
  repos: Repositories,
  ctx: AnyTenantContext,
  filter: PayrollFilter = {},
): Promise<{ lines: PayrollLine[]; policy: BreakPolicy }> {
  const t = repos.tenant;
  const [records, instructors, sessions, courses, entries, settings] = await Promise.all([
    filter.instructorId ? t.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, filter.instructorId)) : t.hoursRecord.list(ctx),
    t.instructor.list(ctx),
    t.courseSession.list(ctx),
    t.course.list(ctx),
    t.timeEntry.list(ctx),
    t.orgSettings.list(ctx),
  ]);
  const s = settings[0];
  const policy: BreakPolicy = { afterMinutes: s?.breakAfterMinutes ?? 360, breakMinutes: s?.breakMinutes ?? 0, paid: Boolean(s?.breakPaid) };
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const sessionById = new Map(sessions.map((x) => [x.id, x]));
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Course"]));
  const entryFor = new Map<string, (typeof entries)[number]>();
  for (const e of entries) if (e.courseSessionId && e.clockOutAt) entryFor.set(`${e.instructorId}|${e.courseSessionId}`, e);

  type Partial1 = Omit<PayrollLine, "pay" | "breakMinutes" | "payableMinutes">;
  const partials: Partial1[] = [];
  for (const r of records) {
    const session = r.courseSessionId ? sessionById.get(r.courseSessionId) : undefined;
    const date = session?.date ?? (toMs(r.createdAt) != null ? new Date(toMs(r.createdAt)!).toISOString().slice(0, 10) : null);
    if (filter.from && (!date || date < filter.from)) continue;
    if (filter.to && (!date || date > filter.to)) continue;
    const entry = r.courseSessionId ? entryFor.get(`${r.instructorId}|${r.courseSessionId}`) : undefined;
    // Clock times are real instants (shown in UK time); session times are wall-clock.
    const startMs = entry ? toMs(entry.clockInAt) : toMs(session?.startAt);
    const endMs = entry ? toMs(entry.clockOutAt) : toMs(session?.endAt);
    const show = (ms: number | null) => (ms == null || Number.isNaN(ms) ? null : entry ? fmtClockTime(ms) : hhmm(ms));
    const clocked = r.actualMinutes ?? null;
    const source: HoursSource = r.source ?? "roster";
    const worked = r.overrideMinutes ?? (source === "clock" ? clocked ?? r.scheduledMinutes : r.scheduledMinutes);
    partials.push({
      recordId: r.id,
      date,
      instructorId: r.instructorId,
      instructorName: nameById.get(r.instructorId) ?? "Unknown",
      courseName: session ? courseName.get(session.courseId) ?? "Session" : "Other",
      start: show(startMs),
      finish: show(endMs),
      scheduledMinutes: r.scheduledMinutes,
      clockedMinutes: clocked,
      source,
      overrideMinutes: r.overrideMinutes ?? null,
      workedMinutes: worked,
      payUnit: r.payUnit ?? "hour",
      rate: r.rate ?? null,
      overridePay: r.overridePay ?? null,
      approved: r.approved,
      note: r.note ?? null,
      clocked: Boolean(entry),
    });
  }
  partials.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.instructorName.localeCompare(b.instructorName) || (a.start ?? "").localeCompare(b.start ?? ""));
  const firstOfDay = markFirstOfDay(partials);
  const lines: PayrollLine[] = partials.map((p, i) => {
    // Breaks only make sense for hourly pay.
    const { breakMinutes, payableMinutes } = p.payUnit === "hour" ? applyBreak(p.workedMinutes, policy) : { breakMinutes: 0, payableMinutes: p.workedMinutes };
    const computed = linePay({ unit: p.payUnit, rate: p.rate, payableMinutes, firstOfDay: firstOfDay[i]! });
    return { ...p, breakMinutes, payableMinutes, pay: p.overridePay ?? computed };
  });
  return { lines, policy };
}

/** Totals per instructor. */
export function summariseByInstructor(lines: PayrollLine[]): PayrollSummaryRow[] {
  const by = new Map<string, PayrollSummaryRow>();
  for (const l of lines) {
    const row = by.get(l.instructorId) ?? { instructorName: l.instructorName, shifts: 0, workedMinutes: 0, breakMinutes: 0, payableMinutes: 0, pay: 0, unpriced: 0 };
    row.shifts++;
    row.workedMinutes += l.workedMinutes;
    row.breakMinutes += l.breakMinutes;
    row.payableMinutes += l.payableMinutes;
    if (l.pay == null) row.unpriced++;
    row.pay = Math.round((row.pay + (l.pay ?? 0)) * 100) / 100;
    by.set(l.instructorId, row);
  }
  return [...by.values()].sort((a, b) => a.instructorName.localeCompare(b.instructorName));
}

const h = (m: number) => (m / 60).toFixed(2);
const UNIT: Record<PayUnit, string> = { hour: "per hour", session: "per session", day: "per day" };

/** Spreadsheet (CSV) — one row per shift. */
export function payrollLinesToCsv(lines: PayrollLine[]): string {
  const header = ["Date", "Instructor", "Course", "Start", "Finish", "Rostered (h)", "Clocked (h)", "Paid on", "Worked (h)", "Lunch break (min)", "Paid hours", "Rate", "Basis", "Pay", "Approved", "Note"];
  const rows = lines.map((l) => [
    l.date ?? "", escapeCsv(l.instructorName), escapeCsv(l.courseName), l.start ?? "", l.finish ?? "",
    h(l.scheduledMinutes), l.clockedMinutes != null ? h(l.clockedMinutes) : "", l.overrideMinutes != null ? "office" : l.source,
    h(l.workedMinutes), String(l.breakMinutes), h(l.payableMinutes),
    l.rate != null ? l.rate.toFixed(2) : "", UNIT[l.payUnit], l.pay != null ? l.pay.toFixed(2) : "", l.approved ? "yes" : "no", escapeCsv(l.note ?? ""),
  ].join(","));
  return [header.join(","), ...rows].join("\n");
}

/** Spreadsheet (CSV) — totals per instructor. */
export function payrollSummaryToCsv(rows: PayrollSummaryRow[]): string {
  const header = ["Instructor", "Shifts", "Worked (h)", "Lunch breaks (h)", "Paid hours", "Pay", "Shifts without a rate"];
  const out = rows.map((r) => [escapeCsv(r.instructorName), String(r.shifts), h(r.workedMinutes), h(r.breakMinutes), h(r.payableMinutes), r.pay.toFixed(2), String(r.unpriced)].join(","));
  return [header.join(","), ...out].join("\n");
}
