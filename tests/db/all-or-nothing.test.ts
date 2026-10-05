import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { cancelSessions } from "@/lib/services/cancel";
import { setDayStaff } from "@/lib/services/session-staff";
import { setPayRate } from "@/lib/services/pay-rates";
import { setAvailability } from "@/lib/services/availability";
import { getCourseStaffing, setCourseEquipment, setCourseStaffing } from "@/lib/services/course-resources";
import { isStale } from "@/lib/services/concurrency";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type Database from "better-sqlite3";

/**
 * D1 runs a batch as one transaction. Here the test database gets a batch that
 * does the same with SQLite, and can be told to fail at the end, as if the
 * connection dropped: then nothing from the save may remain.
 */
function withBatch(db: object, raw: Database.Database) {
  const state: { failNext: boolean; batches: number; afterNext: null | (() => Promise<void>) } = { failNext: false, batches: 0, afterNext: null };
  (db as { batch?: unknown }).batch = async (statements: PromiseLike<unknown>[]) => {
    state.batches++;
    raw.exec("BEGIN");
    try {
      for (const s of statements) await s;
      if (state.failNext) { state.failNext = false; throw new Error("connection dropped"); }
      raw.exec("COMMIT");
      if (state.afterNext) { const f = state.afterNext; state.afterNext = null; await f(); }
    } catch (e) {
      raw.exec("ROLLBACK");
      throw e;
    }
  };
  return state;
}

describe("saves are all or nothing", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let batch: ReturnType<typeof withBatch>;
  let raw: Database.Database;
  let courseId: string;
  let roleId: string;
  let samId: string;
  let kimId: string;

  const counts = async () => ({
    staff: (await repos.tenant.courseStaff.list(ctx)).length,
    hours: (await repos.tenant.hoursRecord.list(ctx)).length,
    audit: (raw.prepare("SELECT COUNT(*) AS n FROM audit_log").get() as { n: number }).n,
    overrides: (await repos.tenant.sessionStaffOverride.list(ctx)).length,
    cancelled: (await repos.tenant.courseSession.list(ctx)).filter((s) => s.cancelledAt).length,
    kit: (await repos.tenant.courseEquipment.list(ctx)).length,
  });

  beforeEach(async () => {
    const t = createTestDb();
    raw = t.raw;
    const seeded = await seedFullOrg(t.db, { name: "Batch", slug: "batch", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    batch = withBatch(t.db, raw);
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { requireParentApproval: false });
    samId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    kimId = (await repos.tenant.instructor.insert(ctx, { name: "Kim", email: "kim@batch.test", employmentType: "freelance", status: "active" })).id;
    await setPayRate(repos, ctx, { instructorId: samId, roleTypeId: null, unit: "session", rate: 50 });
    ({ courseId } = await createCourseWithSessions(repos, ctx, { name: "Stage 2", courseTypeId, sessions: [
      { date: "2027-07-05", slot: "AM", startTime: "09:00", endTime: "12:00" },
      { date: "2027-07-06", slot: "AM", startTime: "09:00", endTime: "12:00" },
    ] }));
    for (const d of ["2027-07-05", "2027-07-06"]) { await setAvailability(repos, ctx, samId, d, "AM", "available"); await setAvailability(repos, ctx, kimId, d, "AM", "available"); }
  });

  it("assigning: a dropped connection leaves no assignment, no pay lines and no log entry; a retry then does all three", async () => {
    const before = await counts();
    batch.failNext = true;
    await expect(assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId })).rejects.toThrow("connection dropped");
    expect(await counts()).toEqual(before);

    expect((await assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId })).ok).toBe(true);
    const after = await counts();
    expect([after.staff - before.staff, after.hours - before.hours, after.audit - before.audit]).toEqual([1, 2, 1]);
    // A double tap is refused cleanly by the unique key, with nothing half-written.
    const again = await assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId });
    expect(again.ok).toBe(false);
    expect(await counts()).toEqual(after);
  });

  it("cancelling: either every day and every pay line changes, or nothing does", async () => {
    expect((await assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId })).ok).toBe(true);
    const before = await counts();
    batch.failNext = true;
    await expect(cancelSessions(repos, ctx, { courseId, reason: "Gale", pay: { rule: "none" } })).rejects.toThrow("connection dropped");
    expect(await counts()).toEqual(before);
    expect((await repos.tenant.course.findById(ctx, courseId))!.status).not.toBe("cancelled");

    const r = await cancelSessions(repos, ctx, { courseId, reason: "Gale", pay: { rule: "none" } });
    expect([r.cancelled, r.courseCancelled]).toEqual([2, true]);
    expect((await counts()).cancelled).toBe(2);
  });

  it("per-day staffing and course kit: nothing half-written when the save fails", async () => {
    expect((await assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId })).ok).toBe(true);
    const sessionId = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId && s.date === "2027-07-06")!.id;
    const before = await counts();
    batch.failNext = true;
    await expect(setDayStaff(repos, ctx, { sessionId, instructorId: samId, roleTypeId: roleId, mode: "skip" })).rejects.toThrow("connection dropped");
    expect(await counts()).toEqual(before);

    const units = (await repos.tenant.equipment.list(ctx)).slice(0, 2).map((u) => u.id);
    batch.failNext = true;
    await expect(setCourseEquipment(repos, ctx, courseId, { unitIds: units, bulk: [] })).rejects.toThrow("connection dropped");
    expect(await counts()).toEqual(before);
    expect((await setCourseEquipment(repos, ctx, courseId, { unitIds: units, bulk: [] })).ok).toBe(true);
    expect((await counts()).kit - before.kit).toBe(units.length);
  });

  it("a save is refused when someone else changed the course after the form was opened", async () => {
    expect(isStale(new Date(2000), 1000)).toBe(true);
    expect(isStale(new Date(1000), 1000)).toBe(false);
    expect(isStale(new Date(2000), null)).toBe(false);

    const opened = (await getCourseStaffing(repos, ctx, courseId))!.version!;
    const first = await setCourseStaffing(repos, ctx, courseId, { students: 8, roles: [{ roleTypeId: roleId, count: 2 }], expectedVersion: opened });
    expect(first.ok).toBe(true);
    // The same person saving again with the version they got back: fine.
    const second = await setCourseStaffing(repos, ctx, courseId, { students: 9, roles: [{ roleTypeId: roleId, count: 2 }], expectedVersion: first.ok ? first.version : null });
    expect(second.ok).toBe(true);
    // A second admin still holding the page as it was when first opened: refused, nothing written.
    const stale = await setCourseStaffing(repos, ctx, courseId, { students: 4, roles: [], expectedVersion: opened });
    expect(stale.ok).toBe(false);
    expect(stale.ok ? "" : stale.error).toMatch(/changed this at \d\d:\d\d, after you opened it|changed in another window/);
    expect((await repos.tenant.course.findById(ctx, courseId))!.capacity).toBe(9);
    // Locations use the same course version.
    const loc = (await repos.tenant.location.list(ctx))[0]!;
    const { setCourseLocations } = await import("@/lib/services/course-resources");
    expect((await setCourseLocations(repos, ctx, courseId, [loc.id], { expectedVersion: opened })).ok).toBe(false);
  });

  it("two admins booking the same person at the same moment: the second assignment is taken back out", async () => {
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceConflictChecks: true });
    const { courseId: other } = await createCourseWithSessions(repos, ctx, { name: "Taster", courseTypeId, sessions: [{ date: "2027-07-05", slot: "AM", startTime: "10:00", endTime: "11:00" }] });
    const before = await counts();
    // While this save is landing, another admin puts Sam on the overlapping taster.
    batch.afterNext = async () => {
      await repos.tenant.courseStaff.insert(ctx, { courseId: other, instructorId: samId, roleTypeId: roleId, status: "assigned", isOverride: false, overrideNote: null, overriddenBy: null });
    };
    const r = await assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.detail).toMatch(/at the same time/);
    const onStage2 = (await repos.tenant.courseStaff.list(ctx)).filter((a) => a.courseId === courseId && a.instructorId === samId);
    expect(onStage2).toHaveLength(0);
    // No pay lines left behind for the undone assignment.
    const stage2Sessions = (await repos.tenant.courseSession.list(ctx)).filter((s) => s.courseId === courseId).map((s) => s.id);
    expect((await repos.tenant.hoursRecord.list(ctx)).filter((h) => h.instructorId === samId && stage2Sessions.includes(h.courseSessionId ?? ""))).toHaveLength(0);
    expect((await counts()).staff - before.staff).toBe(1); // just the other admin's taster booking
  });
});
