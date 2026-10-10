import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { assignStaff } from "@/lib/services/assignment";
import { applyRateToUnapprovedLines, markApproval, syncHoursForCourse } from "@/lib/services/hours";
import { getPayrollLines, payrollLinesToCsv, payrollSummaryToCsv, summariseByInstructor } from "@/lib/services/finance";
import { setPayRate } from "@/lib/services/pay-rates";
import { createCourseWithSessions } from "@/lib/services/courses";
import { resolvePayrollFilter, payrollQuerySchema } from "@/lib/validation/payroll";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("payroll review: rate changes, approval snapshots, volunteers, holiday pay, unique keys", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseTypeId: string;
  let workerId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Pay", slug: "pay", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceAvailabilityChecks: false });
    workerId = (await repos.tenant.instructor.insert(ctx, { name: "Worker", email: null, employmentType: "freelance", status: "active" })).id;
  });

  it("a corrected rate reaches unapproved lines from a date; approved lines keep their pay; pence are stored", async () => {
    await setPayRate(repos, ctx, { instructorId: workerId, roleTypeId: null, unit: "hour", rate: 10 });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [
      { date: "2027-03-01", slot: "AM", startTime: "09:00", endTime: "11:00" },
      { date: "2027-03-08", slot: "AM", startTime: "09:00", endTime: "11:00" },
      { date: "2027-03-15", slot: "AM", startTime: "09:00", endTime: "11:00" },
    ] });
    expect((await assignStaff(repos, ctx, { courseId, instructorId: workerId, roleTypeId: roleId })).ok).toBe(true);
    let { lines } = await getPayrollLines(repos, ctx, { from: "2027-03-01", to: "2027-03-31" });
    expect(lines.map((l) => l.pay)).toEqual([20, 20, 20]);
    const rows = await repos.tenant.hoursRecord.list(ctx);
    expect(rows.filter((r) => r.instructorId === workerId).every((r) => r.ratePence === 1000)).toBe(true);

    // Approve the first line, then correct the rate from the 8th.
    const first = lines.find((l) => l.date === "2027-03-01")!;
    expect(await markApproval(repos, ctx, first.recordId, true)).toBe(true);
    await setPayRate(repos, ctx, { instructorId: workerId, roleTypeId: null, unit: "hour", rate: 12.5 });
    expect(await applyRateToUnapprovedLines(repos, ctx, workerId, "2027-03-08")).toBe(2);
    ({ lines } = await getPayrollLines(repos, ctx, { from: "2027-03-01", to: "2027-03-31" }));
    expect(lines.map((l) => [l.date, l.pay])).toEqual([["2027-03-01", 20], ["2027-03-08", 25], ["2027-03-15", 25]]);
    expect(lines[1]!.rate).toBe(12.5);
    expect((await repos.tenant.hoursRecord.findById(ctx, lines[1]!.recordId))!.ratePence).toBe(1250);
    // Running it again changes nothing.
    expect(await applyRateToUnapprovedLines(repos, ctx, workerId, "2027-03-01")).toBe(0);
  });

  it("an approved line is flagged when its session moves or the person is taken off, and re-approval clears it", async () => {
    await setPayRate(repos, ctx, { instructorId: workerId, roleTypeId: null, unit: "session", rate: 40 });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2027-04-03", slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    await assignStaff(repos, ctx, { courseId, instructorId: workerId, roleTypeId: roleId });
    const line = (await getPayrollLines(repos, ctx, { from: "2027-04-01", to: "2027-04-30" })).lines[0]!;
    await markApproval(repos, ctx, line.recordId, true);
    let row = (await repos.tenant.hoursRecord.findById(ctx, line.recordId))!;
    expect([row.approved, row.approvedMinutes, row.approvedDate, row.rosterChangedAt]).toEqual([true, 180, "2027-04-03", null]);

    // The session grows by an hour: the approved line is frozen but flagged.
    const session = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId)!;
    await repos.tenant.courseSession.update(ctx, session.id, { endAt: new Date(Date.parse("2027-04-03T13:00:00Z")) });
    await syncHoursForCourse(repos, ctx, courseId);
    row = (await repos.tenant.hoursRecord.findById(ctx, line.recordId))!;
    expect(row.scheduledMinutes).toBe(180);
    expect(row.rosterChangedAt).not.toBeNull();
    let { lines } = await getPayrollLines(repos, ctx, { from: "2027-04-01", to: "2027-04-30" });
    expect(lines[0]!.changedSinceApproval).toBe(true);
    expect(summariseByInstructor(lines)[0]!.changedSinceApproval).toBe(1);
    expect(payrollLinesToCsv(lines).split("\n")[1]).toMatch(/,yes,yes,/);

    // Re-open and approve again: the snapshot refreshes and the flag clears.
    await markApproval(repos, ctx, line.recordId, false);
    await syncHoursForCourse(repos, ctx, courseId);
    await markApproval(repos, ctx, line.recordId, true);
    row = (await repos.tenant.hoursRecord.findById(ctx, line.recordId))!;
    expect([row.approvedMinutes, row.rosterChangedAt]).toEqual([240, null]);

    // Taken off the course after approval: the line stays (frozen) and is flagged again.
    for (const a of await repos.tenant.courseStaff.list(ctx)) if (a.courseId === courseId) await repos.tenant.courseStaff.delete(ctx, a.id);
    await syncHoursForCourse(repos, ctx, courseId);
    row = (await repos.tenant.hoursRecord.findById(ctx, line.recordId))!;
    expect(row.rosterChangedAt).not.toBeNull();
    ({ lines } = await getPayrollLines(repos, ctx, { from: "2027-04-01", to: "2027-04-30" }));
    expect(lines).toHaveLength(1);
  });

  it("volunteers are hidden unless asked for; holiday pay is a separate figure for workers only", async () => {
    const volunteer = await repos.tenant.instructor.insert(ctx, { name: "Vol", email: null, employmentType: "volunteer", status: "active" });
    await setPayRate(repos, ctx, { instructorId: workerId, roleTypeId: null, unit: "hour", rate: 20 });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2027-05-01", slot: "AM", startTime: "09:00", endTime: "10:00" }] });
    await assignStaff(repos, ctx, { courseId, instructorId: workerId, roleTypeId: roleId });
    await assignStaff(repos, ctx, { courseId, instructorId: volunteer.id, roleTypeId: roleId });
    const range = { from: "2027-05-01", to: "2027-05-31" };
    expect((await getPayrollLines(repos, ctx, range)).lines.map((l) => l.instructorName)).toEqual(["Worker"]);
    const both = (await getPayrollLines(repos, ctx, { ...range, includeVolunteers: true })).lines;
    expect(both.map((l) => [l.instructorName, l.volunteer])).toEqual([["Vol", true], ["Worker", false]]);
    // The query parser: a named person is always shown; the flag opens up the whole-centre view.
    expect(resolvePayrollFilter(payrollQuerySchema.parse({ volunteers: "1" })).includeVolunteers).toBe(true);
    expect(resolvePayrollFilter(payrollQuerySchema.parse({})).includeVolunteers).toBe(false);
    expect(resolvePayrollFilter(payrollQuerySchema.parse({ instructor: volunteer.id })).includeVolunteers).toBe(true);

    expect(both.every((l) => l.holidayPay === null)).toBe(true);
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { holidayPayPercent: 12.07 });
    const withHoliday = (await getPayrollLines(repos, ctx, { ...range, includeVolunteers: true })).lines;
    expect(withHoliday.find((l) => l.instructorName === "Worker")!.holidayPay).toBe(2.41); // 12.07% of £20
    expect(withHoliday.find((l) => l.instructorName === "Vol")!.holidayPay).toBeNull();
    const summary = summariseByInstructor(withHoliday);
    expect(summary.find((r) => r.instructorName === "Worker")!.holidayPay).toBe(2.41);
    expect(payrollSummaryToCsv(summary).split("\n")[0]).toContain("Holiday pay");
  });

  it("the database keeps one assignment per person per role per course and one hours line per person per session", async () => {
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2027-06-01", slot: "AM" }] });
    expect((await assignStaff(repos, ctx, { courseId, instructorId: workerId, roleTypeId: roleId })).ok).toBe(true);
    const again = await assignStaff(repos, ctx, { courseId, instructorId: workerId, roleTypeId: roleId });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.detail).toMatch(/already on this course/);
    await expect(repos.tenant.courseStaff.insert(ctx, { courseId, instructorId: workerId, roleTypeId: roleId, status: "assigned" })).rejects.toThrow();
    const session = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId)!;
    await expect(repos.tenant.hoursRecord.insert(ctx, { instructorId: workerId, courseSessionId: session.id, scheduledMinutes: 60, approved: false })).rejects.toThrow();
    // A second sync adds nothing.
    const r = await syncHoursForCourse(repos, ctx, courseId);
    expect(r.created).toBe(0);
  });
});
