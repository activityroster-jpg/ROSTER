import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { confirmAssignment, confirmationSummary, declineAssignment, weekOf } from "@/lib/services/roster";
import { confirmDays, isDayConfirmed } from "@/lib/services/roster-days";
import { getWeekSchedule } from "@/lib/services/schedule";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("confirming roster days + staff accept / decline", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let courseId: string;
  let instructorId: string;
  let assignmentId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    const a = (await repos.tenant.courseStaff.list(ctx))[0]!;
    courseId = a.courseId;
    instructorId = a.instructorId;
    assignmentId = a.id;
  });

  it("weekOf gives the Monday", () => {
    expect(weekOf("2026-01-07")).toBe("2026-01-05");
    expect(weekOf("2026-01-05")).toBe("2026-01-05");
    expect(weekOf("2026-01-11")).toBe("2026-01-05");
  });

  it("confirming a day records it, tells everyone on it once, and does nothing the second time", async () => {
    expect(await isDayConfirmed(repos, ctx, "2026-01-05")).toBe(false);
    const r = await confirmDays(repos, ctx, ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-11"]);
    expect(r.days).toBe(7);
    expect(r.notified).toBe(1);
    expect(await isDayConfirmed(repos, ctx, "2026-01-09")).toBe(true);
    const notes = await repos.tenant.notification.list(ctx);
    expect(notes.some((n) => n.instructorId === instructorId && n.title.startsWith("Roster confirmed"))).toBe(true);
    const again = await confirmDays(repos, ctx, ["2026-01-05"]);
    expect(again.days).toBe(0);
  });

  it("summary only counts confirmed days", async () => {
    expect(await confirmationSummary(repos, ctx, "2026-01-01")).toEqual({ awaiting: 0, declined: 0, confirmed: 0 });
    const session = (await repos.tenant.courseSession.list(ctx))[0]!;
    await confirmDays(repos, ctx, [session.date]);
    expect(await confirmationSummary(repos, ctx, "2026-01-01")).toEqual({ awaiting: 1, declined: 0, confirmed: 0 });
    // Past sessions drop out of the summary.
    expect(await confirmationSummary(repos, ctx, "2026-02-01")).toEqual({ awaiting: 0, declined: 0, confirmed: 0 });
  });

  it("only the assigned instructor can confirm", async () => {
    const other = await repos.tenant.instructor.insert(ctx, { name: "Someone Else", email: "else@alpha.test", employmentType: "volunteer", status: "active" });
    const bad = await confirmAssignment(repos, ctx, other.id, assignmentId);
    expect(bad.ok).toBe(false);
    const good = await confirmAssignment(repos, ctx, instructorId, assignmentId);
    expect(good.ok).toBe(true);
    const row = await repos.tenant.courseStaff.findById(ctx, assignmentId);
    expect(row?.status).toBe("confirmed");
    expect(row?.confirmedAt).toBeTruthy();
  });

  it("declining needs a reason, drops the instructor from cover and hours, and can be undone", async () => {
    await confirmDays(repos, ctx, [(await repos.tenant.courseSession.list(ctx))[0]!.date]);
    // The fixture's hours row carries clock time; clear it so it behaves like a
    // plain rostered record (sync keeps anything the clock or the office touched).
    for (const h of (await repos.tenant.hoursRecord.list(ctx)).filter((h) => h.instructorId === instructorId)) {
      await repos.tenant.hoursRecord.update(ctx, h.id, { actualMinutes: null });
    }
    const before = await getWeekSchedule(repos, ctx, "2026-01-05");
    expect(before.coverageByCourse.get(courseId)!.ratio.ratioCountingStaff).toBe(1);

    const noReason = await declineAssignment(repos, ctx, instructorId, assignmentId, " ");
    expect(noReason.ok).toBe(false);

    const r = await declineAssignment(repos, ctx, instructorId, assignmentId, "Away that weekend");
    expect(r.ok).toBe(true);
    const row = await repos.tenant.courseStaff.findById(ctx, assignmentId);
    expect(row?.status).toBe("declined");
    expect(row?.declineNote).toBe("Away that weekend");

    const after = await getWeekSchedule(repos, ctx, "2026-01-05");
    expect(after.coverageByCourse.get(courseId)!.ratio.ratioCountingStaff).toBe(0);
    expect(await confirmationSummary(repos, ctx, "2026-01-01")).toEqual({ awaiting: 0, declined: 1, confirmed: 0 });
    const hours = (await repos.tenant.hoursRecord.list(ctx)).filter((h) => h.instructorId === instructorId && !h.approved);
    expect(hours.filter((h) => h.courseSessionId)).toHaveLength(0);

    const undo = await confirmAssignment(repos, ctx, instructorId, assignmentId);
    expect(undo.ok).toBe(true);
    expect((await repos.tenant.courseStaff.findById(ctx, assignmentId))?.status).toBe("confirmed");
    expect(await confirmationSummary(repos, ctx, "2026-01-01")).toEqual({ awaiting: 0, declined: 0, confirmed: 1 });
  });
});
