import { eq, inArray } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { courseStaff as courseStaffTable, courseSession as courseSessionTable, hoursRecord as hoursRecordTable, type HoursRecord } from "@/lib/db/schema";
import { durationMinutes } from "@/lib/domain";
import { payRatesByInstructor, pickPayRate } from "./pay-rates";

/**
 * Hours come from the ROSTER. Every (assignment × session) has an hours record
 * with the scheduled minutes, stamped with the instructor's pay rate and the
 * centre's pay source at the time. Clock-outs write actual minutes onto the same
 * record; the office picks rota or clock per line (or by the centre default)
 * and can override anything during payroll review. Approved lines are never
 * touched by a sync.
 */

const toMs = (v: Date | number) => (v instanceof Date ? v.getTime() : Number(v));

export interface SyncResult { created: number; updated: number; removed: number }

/** Reconcile hours records for one course with its current sessions and staff. */
export async function syncHoursForCourse(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<SyncResult> {
  const t = repos.tenant;
  const [sessions, staff, settingsRows, rates] = await Promise.all([
    t.courseSession.list(ctx, eq(courseSessionTable.courseId, courseId)),
    t.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId)),
    t.orgSettings.list(ctx),
    payRatesByInstructor(repos, ctx),
  ]);
  const out: SyncResult = { created: 0, updated: 0, removed: 0 };
  if (sessions.length === 0) return out;
  const paySource = settingsRows[0]?.paySource ?? "roster";

  const existing = await t.hoursRecord.list(ctx, inArray(hoursRecordTable.courseSessionId, sessions.map((s) => s.id)));
  const byKey = new Map<string, HoursRecord>();
  for (const r of existing) if (r.courseSessionId) byKey.set(`${r.instructorId}|${r.courseSessionId}`, r);

  const wanted = new Set<string>();
  for (const a of staff) {
    if (a.status === "declined") continue;
    const rate = pickPayRate(rates.get(a.instructorId) ?? [], a.roleTypeId);
    for (const s of sessions) {
      const key = `${a.instructorId}|${s.id}`;
      wanted.add(key);
      const scheduled = durationMinutes({ startAt: toMs(s.startAt), endAt: toMs(s.endAt) });
      const row = byKey.get(key);
      if (!row) {
        await t.hoursRecord.insert(ctx, {
          instructorId: a.instructorId,
          courseSessionId: s.id,
          scheduledMinutes: scheduled,
          actualMinutes: null,
          rate: rate?.rate ?? null,
          payUnit: rate?.unit ?? "hour",
          source: paySource,
          approved: false,
        });
        out.created++;
      } else if (!row.approved) {
        const patch: Partial<HoursRecord> = {};
        if (row.scheduledMinutes !== scheduled) patch.scheduledMinutes = scheduled;
        // Fill in a rate the record never had (set after the person was rostered).
        if (row.rate == null && rate) { patch.rate = rate.rate; patch.payUnit = rate.unit; }
        if (Object.keys(patch).length) { await t.hoursRecord.update(ctx, row.id, patch); out.updated++; }
      }
    }
  }
  // Records for people no longer on the course: drop them unless the office
  // has approved or edited them, or the clock recorded real time.
  for (const [key, row] of byKey) {
    if (wanted.has(key)) continue;
    if (row.approved || row.actualMinutes != null || row.overrideMinutes != null || row.overridePay != null) continue;
    await t.hoursRecord.delete(ctx, row.id);
    out.removed++;
  }
  return out;
}

/** Sync every course (the "Rebuild from rota" button, and a safe backfill). */
export async function rebuildHoursFromRoster(repos: Repositories, ctx: AnyTenantContext): Promise<SyncResult> {
  const courses = await repos.tenant.course.list(ctx);
  const total: SyncResult = { created: 0, updated: 0, removed: 0 };
  for (const c of courses) {
    const r = await syncHoursForCourse(repos, ctx, c.id);
    total.created += r.created; total.updated += r.updated; total.removed += r.removed;
  }
  return total;
}
