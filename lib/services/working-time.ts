import { and, eq, gte, lte } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, courseSession as courseSessionTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import type { CourseSession, CourseStaff, OrgSettings, WorkingTimeMode } from "@/lib/db/schema";
import {
  evaluateWorkingTime,
  selectBand,
  isoDateOf,
  clockOf,
  type Shift,
  type TermRange,
  type WorkingTimePack,
  type WtFinding,
} from "@/lib/domain/working-time";
import { ageOn } from "@/lib/domain/age";
import { packKeyFor } from "@/lib/rules/working-time/packs";
import { loadPack } from "@/lib/rules/working-time/load";
import { writeAudit } from "./audit";
import { publishedWeeks, weekOf } from "./roster";
import { liveSessions } from "@/lib/domain/sessions";

/**
 * Young workers' hours: glue between the pure engine in lib/domain/working-time
 * and a centre's data. The legal figures come from the rule pack for the
 * centre's jurisdiction (built-in or edited in the Dev Center); the centre
 * chooses only how a breach is handled and which weeks are term time.
 */

export interface WorkingTimeCheck {
  /** False when the jurisdiction has no pack yet: nothing is checked and the UI says so. */
  active: boolean;
  mode: WorkingTimeMode;
  pack: WorkingTimePack | null;
  findings: WtFinding[];
  blocks: WtFinding[];
  warns: WtFinding[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Parse the term-dates JSON kept on org_settings; anything malformed is ignored. */
export function termRangesOf(settings: Pick<OrgSettings, "termDates"> | null | undefined): TermRange[] {
  if (!settings?.termDates) return [];
  try {
    const raw: unknown = JSON.parse(settings.termDates);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r): r is { from: string; to: string; label?: string } =>
        typeof r === "object" && r !== null && ISO.test(String((r as { from?: unknown }).from)) && ISO.test(String((r as { to?: unknown }).to)))
      .map((r) => ({ from: r.from, to: r.to, label: typeof r.label === "string" ? r.label : undefined }));
  } catch {
    return [];
  }
}

function toMs(v: Date | number): number { return v instanceof Date ? v.getTime() : Number(v); }
function noon(iso: string): Date { return new Date(`${iso}T12:00:00Z`); }

function toShift(s: CourseSession, proposed = false): Shift {
  return { date: s.date, startAt: toMs(s.startAt), endAt: toMs(s.endAt), label: s.slot, proposed };
}

/** The pack for a centre, or null when its jurisdiction has none. */
export async function packForCentre(repos: Repositories, ctx: AnyTenantContext): Promise<WorkingTimePack | null> {
  const org = await repos.control.organisationById(ctx.organisationId);
  const key = packKeyFor(org?.jurisdiction);
  if (!key) return null;
  return (await loadPack(repos.db, key))?.pack ?? null;
}

export interface CheckInput {
  instructorId: string;
  courseId: string;
  /** Pre-loaded data when the caller already has it (assignStaff does). */
  settings?: OrgSettings | null;
  allSessions?: CourseSession[];
  existingAssignments?: CourseStaff[];
}

/**
 * Would adding this instructor to this course break their working-time rules?
 * Looks at every session already rostered for them in the weeks the course
 * touches, plus the course's own sessions. Adults produce no findings.
 */
export async function checkWorkingTime(repos: Repositories, ctx: AnyTenantContext, input: CheckInput): Promise<WorkingTimeCheck> {
  const t = repos.tenant;
  const settings = input.settings === undefined ? (await t.orgSettings.list(ctx))[0] ?? null : input.settings;
  const mode: WorkingTimeMode = settings?.workingTimeMode ?? "block_override";
  const none = (pack: WorkingTimePack | null, findings: WtFinding[] = []): WorkingTimeCheck => ({ active: pack !== null, mode, pack, findings, blocks: [], warns: [] });

  const pack = await packForCentre(repos, ctx);
  if (!pack) return none(null, [{ code: "no-pack", severity: "info", message: "Young-worker hour checks are not active for this centre's jurisdiction yet.", verified: true }]);

  const instructor = await t.instructor.findById(ctx, input.instructorId);
  if (!instructor) return none(pack);
  const allSessions = liveSessions(input.allSessions ?? (await t.courseSession.list(ctx)));
  const proposed = allSessions.filter((s) => s.courseId === input.courseId).map((s) => toShift(s, true));
  if (proposed.length === 0) return none(pack);

  // Cheap exit for adults: the engine would say the same, but skip the queries.
  const firstDate = [...proposed].sort((a, b) => a.date.localeCompare(b.date))[0]!.date;
  if (instructor.dateOfBirth && !selectBand(pack, instructor.dateOfBirth, firstDate)) return none(pack);

  const assignments = input.existingAssignments ?? (await t.courseStaff.list(ctx, eq(courseStaffTable.instructorId, input.instructorId)));
  const otherCourses = new Set(assignments.filter((a) => a.status !== "declined" && a.courseId !== input.courseId).map((a) => a.courseId));
  const existing = allSessions.filter((s) => otherCourses.has(s.courseId)).map((s) => toShift(s));

  const findings = evaluateWorkingTime({
    pack,
    dateOfBirth: instructor.dateOfBirth ?? null,
    employmentType: instructor.employmentType,
    termRanges: termRangesOf(settings),
    existing,
    proposed,
  });
  return {
    active: true,
    mode,
    pack,
    findings,
    blocks: findings.filter((f) => f.severity === "block"),
    warns: findings.filter((f) => f.severity === "warn"),
  };
}

/** One line per finding, for messages and audit notes. */
export function describeFindings(findings: WtFinding[]): string {
  return findings.map((f) => (f.verified ? f.message : `${f.message} (figure not yet verified)`)).join("; ");
}

// --- Young-worker time register ---------------------------------------------

export interface RegisterRow {
  date: string;
  instructor: string;
  age: number | null;
  course: string;
  start: string;
  finish: string;
  hours: number;
  status: string;
  overridden: boolean;
  overrideNote: string;
  assignedAt: string;
  confirmedAt: string;
  weekPublishedAt: string;
}

/**
 * Every session worked (or rostered) by an under-18 between two dates, with
 * the timestamps an inspector would ask for. Viewing it is written to the
 * audit log because it lists children's working patterns.
 */
export async function youngWorkerRegister(repos: Repositories, ctx: AnyTenantContext, from: string, to: string): Promise<RegisterRow[]> {
  const t = repos.tenant;
  const [instructors, sessions, published] = await Promise.all([
    t.instructor.list(ctx),
    t.courseSession.list(ctx, and(gte(courseSessionTable.date, from), lte(courseSessionTable.date, to))).then(liveSessions),
    publishedWeeks(repos, ctx),
  ]);
  const inRange = [...new Set(sessions.map((s) => s.courseId))];
  const [staff, courses] = await Promise.all([
    t.courseStaff.listIn(ctx, courseStaffTable.courseId, inRange),
    t.course.listIn(ctx, courseTable.id, inRange),
  ]);
  const young = new Map(instructors.filter((i) => i.dateOfBirth && (ageOn(i.dateOfBirth, noon(to)) ?? 99) < 18).map((i) => [i.id, i]));
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? c.id]));
  const byCourse = new Map<string, CourseSession[]>();
  for (const s of sessions) if (s.date >= from && s.date <= to) (byCourse.get(s.courseId) ?? byCourse.set(s.courseId, []).get(s.courseId)!).push(s);

  const rows: RegisterRow[] = [];
  for (const a of staff) {
    const who = young.get(a.instructorId);
    if (!who || !who.dateOfBirth) continue;
    for (const s of byCourse.get(a.courseId) ?? []) {
      const startMs = toMs(s.startAt), endMs = toMs(s.endAt);
      rows.push({
        date: s.date,
        instructor: who.name,
        age: ageOn(who.dateOfBirth, noon(s.date)),
        course: courseName.get(a.courseId) ?? a.courseId,
        start: clockOf(startMs),
        finish: clockOf(endMs),
        hours: Math.round(((endMs - startMs) / 3_600_000) * 100) / 100,
        status: a.status,
        overridden: Boolean(a.isOverride),
        overrideNote: a.overrideNote ?? "",
        assignedAt: a.createdAt ? new Date(toMs(a.createdAt)).toISOString() : "",
        confirmedAt: a.confirmedAt ? new Date(toMs(a.confirmedAt)).toISOString() : "",
        weekPublishedAt: published.get(weekOf(s.date))?.toISOString() ?? "",
      });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.instructor.localeCompare(b.instructor) || a.start.localeCompare(b.start));
  await writeAudit(repos, ctx, { action: "view_young_worker_register", entity: "instructor", after: { from, to, rows: rows.length } });
  return rows;
}

export function registerToCsv(rows: RegisterRow[]): string {
  const esc = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date", "Instructor", "Age on day", "Course", "Start", "Finish", "Hours", "Status", "Override", "Override note", "Assigned at", "Confirmed at", "Week published at"];
  const lines = rows.map((r) => [r.date, r.instructor, r.age, r.course, r.start, r.finish, r.hours, r.status, r.overridden ? "yes" : "", r.overrideNote, r.assignedAt, r.confirmedAt, r.weekPublishedAt].map(esc).join(","));
  return [head.join(","), ...lines].join("\n") + "\n";
}

export { isoDateOf };
