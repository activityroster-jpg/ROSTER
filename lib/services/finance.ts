import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { hoursRecord as hoursRecordTable } from "@/lib/db/schema";
import { applyBreak, fmtClockTime, type BreakPolicy } from "@/lib/domain";

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

/** One instructor's own hours (for the portal): sessions with scheduled vs
 * actual time and estimated pay. Tenant scoped. */
export async function getInstructorHours(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<InstructorHoursSummary> {
  const [records, sessions, courses] = await Promise.all([
    repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, instructorId)),
    repos.tenant.courseSession.list(ctx),
    repos.tenant.course.list(ctx),
  ]);
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Session"]));
  const sessionInfo = new Map(sessions.map((s) => [s.id, { date: s.date, courseId: s.courseId }]));

  let totalMinutes = 0;
  let totalPay = 0;
  const rows: InstructorHoursRow[] = records
    .map((r) => {
      const info = r.courseSessionId ? sessionInfo.get(r.courseSessionId) : undefined;
      const minutes = r.actualMinutes ?? r.scheduledMinutes;
      const pay = r.rate != null ? Math.round((minutes / 60) * r.rate * 100) / 100 : null;
      totalMinutes += minutes;
      totalPay += pay ?? 0;
      return {
        date: info?.date ?? null,
        courseName: info ? courseName.get(info.courseId) ?? "Session" : "Session",
        scheduledMinutes: r.scheduledMinutes,
        actualMinutes: r.actualMinutes ?? null,
        minutes,
        rate: r.rate ?? null,
        pay,
        approved: r.approved,
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return { rows, totalMinutes, totalPay: Math.round(totalPay * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Payroll lines (per shift) — filterable by period and instructor, with start,
// finish and the centre's lunch-break rule applied. Feeds the Payroll page and
// its spreadsheet/PDF exports.
// ---------------------------------------------------------------------------

export interface PayrollFilter { from?: string; to?: string; instructorId?: string }

export interface PayrollLine {
  date: string | null;
  instructorId: string;
  instructorName: string;
  courseName: string;
  start: string | null; // HH:MM
  finish: string | null; // HH:MM
  workedMinutes: number;
  breakMinutes: number;
  payableMinutes: number;
  rate: number | null;
  pay: number | null;
  approved: boolean;
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
}

const toMs = (v: Date | number | string | null | undefined): number | null =>
  v == null ? null : v instanceof Date ? v.getTime() : Number(v);
const hhmm = (ms: number | null) => (ms == null || Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(11, 16));

/** Every hours record as a payroll line, filtered and with breaks applied. Tenant scoped. */
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

  const lines: PayrollLine[] = [];
  for (const r of records) {
    const session = r.courseSessionId ? sessionById.get(r.courseSessionId) : undefined;
    const date = session?.date ?? (toMs(r.createdAt) != null ? new Date(toMs(r.createdAt)!).toISOString().slice(0, 10) : null);
    if (filter.from && (!date || date < filter.from)) continue;
    if (filter.to && (!date || date > filter.to)) continue;
    const entry = r.courseSessionId ? entryFor.get(`${r.instructorId}|${r.courseSessionId}`) : undefined;
    // Clock times are real instants (shown in UK time); session times are
    // wall-clock values stored as UTC (shown as stored).
    const startMs = entry ? toMs(entry.clockInAt) : toMs(session?.startAt);
    const endMs = entry ? toMs(entry.clockOutAt) : toMs(session?.endAt);
    const show = (ms: number | null) => (ms == null || Number.isNaN(ms) ? null : entry ? fmtClockTime(ms) : hhmm(ms));
    const worked = r.actualMinutes ?? r.scheduledMinutes;
    const { breakMinutes, payableMinutes } = applyBreak(worked, policy);
    lines.push({
      date,
      instructorId: r.instructorId,
      instructorName: nameById.get(r.instructorId) ?? "Unknown",
      courseName: session ? courseName.get(session.courseId) ?? "Session" : "Other",
      start: show(startMs),
      finish: show(endMs),
      workedMinutes: worked,
      breakMinutes,
      payableMinutes,
      rate: r.rate ?? null,
      pay: r.rate != null ? Math.round((payableMinutes / 60) * r.rate * 100) / 100 : null,
      approved: r.approved,
      clocked: Boolean(entry),
    });
  }
  lines.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.instructorName.localeCompare(b.instructorName) || (a.start ?? "").localeCompare(b.start ?? ""));
  return { lines, policy };
}

/** Totals per instructor. */
export function summariseByInstructor(lines: PayrollLine[]): PayrollSummaryRow[] {
  const by = new Map<string, PayrollSummaryRow>();
  for (const l of lines) {
    const row = by.get(l.instructorId) ?? { instructorName: l.instructorName, shifts: 0, workedMinutes: 0, breakMinutes: 0, payableMinutes: 0, pay: 0 };
    row.shifts++;
    row.workedMinutes += l.workedMinutes;
    row.breakMinutes += l.breakMinutes;
    row.payableMinutes += l.payableMinutes;
    row.pay = Math.round((row.pay + (l.pay ?? 0)) * 100) / 100;
    by.set(l.instructorId, row);
  }
  return [...by.values()].sort((a, b) => a.instructorName.localeCompare(b.instructorName));
}

const h = (m: number) => (m / 60).toFixed(2);

/** Spreadsheet (CSV) — one row per shift. */
export function payrollLinesToCsv(lines: PayrollLine[]): string {
  const header = ["Date", "Instructor", "Course", "Start", "Finish", "Worked (h)", "Lunch break (min)", "Paid hours", "Rate", "Pay", "Approved", "Times from"];
  const rows = lines.map((l) => [
    l.date ?? "", escapeCsv(l.instructorName), escapeCsv(l.courseName), l.start ?? "", l.finish ?? "",
    h(l.workedMinutes), String(l.breakMinutes), h(l.payableMinutes),
    l.rate != null ? l.rate.toFixed(2) : "", l.pay != null ? l.pay.toFixed(2) : "", l.approved ? "yes" : "no", l.clocked ? "clock" : "schedule",
  ].join(","));
  return [header.join(","), ...rows].join("\n");
}

/** Spreadsheet (CSV) — totals per instructor. */
export function payrollSummaryToCsv(rows: PayrollSummaryRow[]): string {
  const header = ["Instructor", "Shifts", "Worked (h)", "Lunch breaks (h)", "Paid hours", "Pay"];
  const out = rows.map((r) => [escapeCsv(r.instructorName), String(r.shifts), h(r.workedMinutes), h(r.breakMinutes), h(r.payableMinutes), r.pay.toFixed(2)].join(","));
  return [header.join(","), ...out].join("\n");
}
