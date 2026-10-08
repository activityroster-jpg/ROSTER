import { and, eq, gte, isNull } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { courseStaff as courseStaffTable, courseSession as courseSessionTable, hoursRecord as hoursRecordTable, type HoursRecord } from "@/lib/db/schema";
import { durationMinutes } from "@/lib/domain";
import { payRatesByInstructor, pickPayRate } from "./pay-rates";
import { writeAudit } from "./audit";
import { liveSessions } from "@/lib/domain/sessions";
import { effectiveStaffBySession, type CourseAssignmentLike, type SessionOverrideLike } from "@/lib/domain/session-staff";
import { runAtomic } from "@/lib/db/batch";
import { sessionStaffOverride as overrideTable } from "@/lib/db/schema";

/**
 * Hours come from the ROSTER. Every (assignment × session) has an hours record
 * with the scheduled minutes, stamped with the instructor's pay rate and the
 * centre's pay source at the time. Clock-outs write actual minutes onto the same
 * record; the office picks roster or clock per line (or by the centre default)
 * and can override anything during payroll review. Approved lines are never
 * touched by a sync.
 */

const toMs = (v: Date | number) => (v instanceof Date ? v.getTime() : Number(v));

export interface SyncResult { created: number; updated: number; removed: number }

/** Reconcile hours records for one course with its current sessions and staff. */
export async function syncHoursForCourse(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<SyncResult> {
  const plan = await planHoursForCourse(repos, ctx, courseId);
  await runAtomic(repos.db, plan.statements);
  return plan.result;
}

/**
 * Work out the hours-record changes for one course without making them, so a
 * caller can write them in the same batch as the roster change that caused
 * them (audit follow-up: all-or-nothing saves). `staffOverride` replaces the
 * course's assignments as read from the database: pass the list as it will be
 * after the change (for example with the new assignment added).
 */
export async function planHoursForCourse(
  repos: Repositories,
  ctx: AnyTenantContext,
  courseId: string,
  opts: { staffOverride?: readonly CourseAssignmentLike[]; adjustOverrides?: (rows: SessionOverrideLike[]) => SessionOverrideLike[] } = {},
): Promise<{ statements: PromiseLike<unknown>[]; result: SyncResult }> {
  const t = repos.tenant;
  const [allSessions, dbStaff, settingsRows, rates] = await Promise.all([
    t.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId)),
    opts.staffOverride ? Promise.resolve(null) : t.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId)),
    t.orgSettings.list(ctx),
    payRatesByInstructor(repos, ctx),
  ]);
  const staff: readonly CourseAssignmentLike[] = opts.staffOverride ?? dbStaff ?? [];
  const out: SyncResult = { created: 0, updated: 0, removed: 0 };
  const statements: PromiseLike<unknown>[] = [];
  // Cancelled sessions earn nothing new; what the cancellation decided about their lines stands (lib/services/cancel).
  const sessions = liveSessions(allSessions);
  if (allSessions.length === 0) return { statements, result: out };
  const paySource = settingsRows[0]?.paySource ?? "roster";

  const [existing, storedOverrides] = await Promise.all([
    t.hoursRecord.listIn(ctx, hoursRecordTable.courseSessionId, allSessions.map((s) => s.id)),
    t.sessionStaffOverride.listIn(ctx, overrideTable.courseSessionId, allSessions.map((s) => s.id)),
  ]);
  const overrides = opts.adjustOverrides ? opts.adjustOverrides(storedOverrides) : storedOverrides;
  const byKey = new Map<string, HoursRecord>();
  for (const r of existing) if (r.courseSessionId) byKey.set(`${r.instructorId}|${r.courseSessionId}`, r);
  // Who is on each session: the course's people minus per-day skips, plus per-day adds.
  const members = effectiveStaffBySession(sessions, staff, overrides);

  const wanted = new Set<string>();
  for (const s of sessions) {
    for (const a of members.get(s.id) ?? []) {
      if (a.status === "declined") continue;
      const rate = pickPayRate(rates.get(a.instructorId) ?? [], a.roleTypeId);
      const key = `${a.instructorId}|${s.id}`;
      if (wanted.has(key)) continue;
      wanted.add(key);
      const scheduled = durationMinutes({ startAt: toMs(s.startAt), endAt: toMs(s.endAt) });
      const row = byKey.get(key);
      if (!row) {
        // A parallel sync may have got there first: the unique key then means nothing to add.
        statements.push(t.hoursRecord.insertStatement(ctx, {
          instructorId: a.instructorId,
          courseSessionId: s.id,
          scheduledMinutes: scheduled,
          actualMinutes: null,
          rate: rate?.rate ?? null,
          ratePence: rate?.ratePence ?? null,
          payUnit: rate?.unit ?? "hour",
          source: paySource,
          approved: false,
        }).onConflictDoNothing());
        out.created++;
      } else if (!row.approved) {
        const patch: Partial<HoursRecord> = {};
        if (row.scheduledMinutes !== scheduled) patch.scheduledMinutes = scheduled;
        // Fill in a rate the record never had (set after the person was rostered).
        if (row.rate == null && rate) { patch.rate = rate.rate; patch.ratePence = rate.ratePence; patch.payUnit = rate.unit; }
        if (Object.keys(patch).length) { statements.push(t.hoursRecord.updateStatement(ctx, row.id, patch)); out.updated++; }
      } else if (row.approvedMinutes != null && !row.rosterChangedAt && (row.approvedMinutes !== scheduled || (row.approvedDate && row.approvedDate !== s.date))) {
        // Approved and frozen, but the roster moved under it: flag for review (audit A8-5).
        statements.push(t.hoursRecord.updateStatement(ctx, row.id, { rosterChangedAt: new Date() }));
        out.updated++;
      }
    }
  }
  // Records for people no longer on the course: drop them unless the office
  // has approved or edited them, or the clock recorded real time.
  for (const [key, row] of byKey) {
    if (wanted.has(key)) continue;
    if (row.approved) {
      if (!row.rosterChangedAt) { statements.push(t.hoursRecord.updateStatement(ctx, row.id, { rosterChangedAt: new Date() })); out.updated++; }
      continue;
    }
    if (row.actualMinutes != null || row.overrideMinutes != null || row.overridePay != null) continue;
    statements.push(t.hoursRecord.deleteStatement(ctx, row.id));
    out.removed++;
  }
  return { statements, result: out };
}

/**
 * A corrected pay rate applied to the lines it should have priced: every
 * unapproved line of this instructor dated on or after `fromIso` whose pay the
 * office hasn't overridden takes the rate for its role (audit A8-3). Approved
 * lines keep the pay they were approved at.
 */
export async function applyRateToUnapprovedLines(repos: Repositories, ctx: AnyTenantContext, instructorId: string, fromIso: string): Promise<number> {
  const t = repos.tenant;
  const [records, rates, staff] = await Promise.all([
    t.hoursRecord.list(ctx, and(eq(hoursRecordTable.instructorId, instructorId), eq(hoursRecordTable.approved, false))),
    payRatesByInstructor(repos, ctx),
    t.courseStaff.list(ctx, eq(courseStaffTable.instructorId, instructorId)),
  ]);
  const sessionIds = records.map((r) => r.courseSessionId).filter((x): x is string => Boolean(x));
  const sessions = sessionIds.length ? await t.courseSession.listIn(ctx, courseSessionTable.id, sessionIds, gte(courseSessionTable.date, fromIso)) : [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const roleByCourse = new Map(staff.map((a) => [a.courseId, a.roleTypeId]));
  let n = 0;
  for (const r of records) {
    const s = r.courseSessionId ? sessionById.get(r.courseSessionId) : undefined;
    if (!s || r.overridePay != null) continue;
    const rate = pickPayRate(rates.get(instructorId) ?? [], roleByCourse.get(s.courseId) ?? null);
    if (!rate) continue;
    if (r.ratePence === rate.ratePence && r.payUnit === rate.unit) continue;
    await t.hoursRecord.update(ctx, r.id, { rate: rate.rate, ratePence: rate.ratePence, payUnit: rate.unit });
    n++;
  }
  if (n) await writeAudit(repos, ctx, { action: "apply_pay_rate", entity: "hours_record", after: { instructorId, from: fromIso, lines: n } });
  return n;
}

/** Freeze what the roster says for a line being approved, or clear the snapshot and any change flag when it is re-opened. */
export async function markApproval(repos: Repositories, ctx: AnyTenantContext, recordId: string, approved: boolean): Promise<boolean> {
  const t = repos.tenant;
  const row = await t.hoursRecord.findById(ctx, recordId);
  if (!row) return false;
  if (!approved) {
    await t.hoursRecord.update(ctx, recordId, { approved: false, approvedAt: null, approvedMinutes: null, approvedDate: null, rosterChangedAt: null });
    return true;
  }
  const session = row.courseSessionId ? await t.courseSession.findById(ctx, row.courseSessionId) : null;
  await t.hoursRecord.update(ctx, recordId, { approved: true, approvedAt: new Date(), approvedMinutes: row.scheduledMinutes, approvedDate: session?.date ?? null, rosterChangedAt: null });
  return true;
}

/**
 * Lines whose session no longer exists (deleted before the cancel workflow
 * existed) and that nobody approved, edited or clocked: nothing to pay, so they go.
 */
export async function purgeOrphanHours(repos: Repositories, ctx: AnyTenantContext): Promise<number> {
  const rows = await repos.tenant.hoursRecord.list(ctx, isNull(hoursRecordTable.courseSessionId));
  let n = 0;
  for (const r of rows) {
    if (r.approved || r.actualMinutes != null || r.overrideMinutes != null || r.overridePay != null) continue;
    await repos.tenant.hoursRecord.delete(ctx, r.id);
    n++;
  }
  return n;
}

/** Sync every course (the "Rebuild from roster" button, and a safe backfill). */
export async function rebuildHoursFromRoster(repos: Repositories, ctx: AnyTenantContext): Promise<SyncResult> {
  const courses = await repos.tenant.course.list(ctx);
  const total: SyncResult = { created: 0, updated: 0, removed: await purgeOrphanHours(repos, ctx) };
  for (const c of courses) {
    const r = await syncHoursForCourse(repos, ctx, c.id);
    total.created += r.created; total.updated += r.updated; total.removed += r.removed;
  }
  return total;
}
