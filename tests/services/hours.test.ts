import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { assignStaff } from "@/lib/services/assignment";
import { syncHoursForCourse } from "@/lib/services/hours";
import { getPayrollLines } from "@/lib/services/finance";
import { setPayRate } from "@/lib/services/pay-rates";
import { createCourseWithSessions } from "@/lib/services/courses";
import { hoursRecord as hoursRecordTable } from "@/lib/db/schema";
import { linePay, markFirstOfDay } from "@/lib/domain";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

describe("hours from the roster", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseTypeId: string;
  let newcomerId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Hours", slug: "hours", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    newcomerId = (await repos.tenant.instructor.insert(ctx, { name: "New Hand", email: null, employmentType: "freelance", status: "active" })).id;
  });

  it("assigning creates one hours line per session with the instructor's rate; removing cleans up", async () => {
    await setPayRate(repos, ctx, { instructorId: newcomerId, roleTypeId: null, unit: "session", rate: 40 });
    const { courseId } = await createCourseWithSessions(repos, ctx, {
      courseTypeId,
      sessions: [
        { date: "2026-06-01", slot: "AM", startTime: "09:00", endTime: "12:00" },
        { date: "2026-06-02", slot: "AM", startTime: "09:00", endTime: "12:30" },
      ],
    });
    const res = await assignStaff(repos, ctx, { courseId, instructorId: newcomerId, roleTypeId: roleId });
    expect(res.ok).toBe(true);

    const recs = await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, newcomerId));
    expect(recs).toHaveLength(2);
    expect(recs.map((r) => r.scheduledMinutes).sort()).toEqual([180, 210]);
    expect(recs.every((r) => r.rate === 40 && r.payUnit === "session" && r.source === "roster")).toBe(true);

    const { lines } = await getPayrollLines(repos, ctx, { instructorId: newcomerId });
    expect(lines.map((l) => l.pay)).toEqual([40, 40]);

    // Taken off the course → unapproved, unclocked lines go.
    const staff = (await repos.tenant.courseStaff.list(ctx)).find((a) => a.instructorId === newcomerId)!;
    await repos.tenant.courseStaff.delete(ctx, staff.id);
    await syncHoursForCourse(repos, ctx, courseId);
    expect(await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, newcomerId))).toHaveLength(0);
  });

  it("a rate set later fills in unpriced lines; approved lines are never changed", async () => {
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2026-06-03", slot: "PM", startTime: "13:00", endTime: "16:00" }] });
    await assignStaff(repos, ctx, { courseId, instructorId: newcomerId, roleTypeId: roleId });
    let rec = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, newcomerId)))[0]!;
    expect(rec.rate).toBeNull();
    expect((await getPayrollLines(repos, ctx, { instructorId: newcomerId })).lines[0]!.pay).toBeNull();

    await setPayRate(repos, ctx, { instructorId: newcomerId, roleTypeId: null, unit: "hour", rate: 20 });
    await syncHoursForCourse(repos, ctx, courseId);
    rec = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, newcomerId)))[0]!;
    expect(rec.rate).toBe(20);
    expect((await getPayrollLines(repos, ctx, { instructorId: newcomerId })).lines[0]!.pay).toBe(60);

    // Approve, then change the session: the line keeps its minutes.
    await repos.tenant.hoursRecord.update(ctx, rec.id, { approved: true });
    const session = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId)!;
    await repos.tenant.courseSession.update(ctx, session.id, { endAt: new Date(session.endAt.getTime() + 60 * 60 * 1000) });
    await syncHoursForCourse(repos, ctx, courseId);
    rec = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, newcomerId)))[0]!;
    expect(rec.scheduledMinutes).toBe(180);
  });

  it("payroll review: office overrides win, and 'pay on clock' uses clocked minutes", async () => {
    await setPayRate(repos, ctx, { instructorId: newcomerId, roleTypeId: null, unit: "hour", rate: 10 });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2026-06-04", slot: "AM", startTime: "09:00", endTime: "11:00" }] });
    await assignStaff(repos, ctx, { courseId, instructorId: newcomerId, roleTypeId: roleId });
    const rec = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, newcomerId)))[0]!;
    expect((await getPayrollLines(repos, ctx, { instructorId: newcomerId })).lines[0]!.pay).toBe(20);

    await repos.tenant.hoursRecord.update(ctx, rec.id, { actualMinutes: 150, source: "clock" });
    expect((await getPayrollLines(repos, ctx, { instructorId: newcomerId })).lines[0]!.pay).toBe(25);

    await repos.tenant.hoursRecord.update(ctx, rec.id, { overrideMinutes: 90 });
    expect((await getPayrollLines(repos, ctx, { instructorId: newcomerId })).lines[0]!.pay).toBe(15);

    await repos.tenant.hoursRecord.update(ctx, rec.id, { overridePay: 99 });
    expect((await getPayrollLines(repos, ctx, { instructorId: newcomerId })).lines[0]!.pay).toBe(99);
  });

  it("'Busy' availability blocks an assignment unless overridden", async () => {
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2026-06-05", slot: "AM" }] });
    await repos.tenant.availability.insert(ctx, { instructorId: newcomerId, date: "2026-06-05", weekday: null, slot: "AM", status: "unavailable" });
    const blocked = await assignStaff(repos, ctx, { courseId, instructorId: newcomerId, roleTypeId: roleId });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("unavailable");
    const forced = await assignStaff(repos, ctx, { courseId, instructorId: newcomerId, roleTypeId: roleId, override: true, overrideNote: "only option" });
    expect(forced.ok && forced.overridden).toBe(true);
  });
});

describe("pay rules", () => {
  it("pays per hour, per session, or once per day", () => {
    expect(linePay({ unit: "hour", rate: 15, payableMinutes: 90, firstOfDay: true })).toBe(22.5);
    expect(linePay({ unit: "session", rate: 40, payableMinutes: 90, firstOfDay: false })).toBe(40);
    expect(linePay({ unit: "day", rate: 100, payableMinutes: 90, firstOfDay: true })).toBe(100);
    expect(linePay({ unit: "day", rate: 100, payableMinutes: 90, firstOfDay: false })).toBe(0);
    expect(linePay({ unit: "hour", rate: null, payableMinutes: 90, firstOfDay: true })).toBeNull();
    expect(markFirstOfDay([{ instructorId: "a", date: "2026-01-01" }, { instructorId: "a", date: "2026-01-01" }, { instructorId: "b", date: "2026-01-01" }, { instructorId: "a", date: "2026-01-02" }])).toEqual([true, false, true, true]);
  });
});
