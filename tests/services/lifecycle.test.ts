import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { setCourseStaffing, setCourseLocations } from "@/lib/services/course-resources";
import { setAvailability } from "@/lib/services/availability";
import { assignStaff } from "@/lib/services/assignment";
import { publishWeek, confirmAssignment, weekOf } from "@/lib/services/roster";
import { getWeekRota } from "@/lib/services/schedule";
import { syncHoursForCourse, markApproval } from "@/lib/services/hours";
import { getPayrollLines } from "@/lib/services/finance";
import { setPayRate } from "@/lib/services/pay-rates";
import { findProblems, problemsForCourse } from "@/lib/services/problems";
import { cancelSessions, canDeleteCourse, restoreSessions } from "@/lib/services/cancel";
import { fmtWallTime } from "@/lib/domain/time";

/**
 * One course from creation to payroll (audit Part E phase 2, "lifecycle" test):
 * create → staffing → availability → assign → publish → confirm → move a session
 * → problems → cancel a day → payroll → restore → delete refused. Times are
 * wall-clock throughout: what was typed is what every reader shows.
 */
describe("course lifecycle, end to end", () => {
  it("runs the whole path and every step leaves the right trace", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Life", slug: "life", jurisdiction: "england" });
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceConflictChecks: true, requireParentApproval: false, enforceRatioChecks: false });
    const roles = await repos.tenant.roleType.list(ctx);
    const roleId = roles.find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    const location = (await repos.tenant.location.list(ctx))[0]!;

    // 1. Create: two mornings in May 2027, typed as 09:30–12:15.
    const { courseId } = await createCourseWithSessions(repos, ctx, { name: "Stage 1 weekend", courseTypeId, sessions: [
      { date: "2027-05-01", slot: "AM", startTime: "09:30", endTime: "12:15" },
      { date: "2027-05-02", slot: "AM", startTime: "09:30", endTime: "12:15" },
    ] });
    expect((await setCourseStaffing(repos, ctx, courseId, { students: 6, roles: [{ roleTypeId: roleId, count: 1 }] })).ok).toBe(true);
    expect((await setCourseLocations(repos, ctx, courseId, [location.id])).ok).toBe(true);

    // 2. Availability + assign: Busy by default inside the window would block, but these dates are beyond it (not asked yet), so only the explicit answers matter.
    await setAvailability(repos, ctx, instructorId, "2027-05-01", "AM", "available");
    await setAvailability(repos, ctx, instructorId, "2027-05-02", "AM", "available");
    await setPayRate(repos, ctx, { instructorId, roleTypeId: null, unit: "hour", rate: 20 });
    const assigned = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId: roleId });
    expect(assigned.ok).toBe(true);
    expect((await findProblems(repos, ctx, { from: "2027-05-01", to: "2027-05-03" })).problems).toEqual([]);

    // 3. The roster shows the typed times, not a shifted clock.
    const rota = await getWeekRota(repos, ctx, weekOf("2027-05-01"));
    const sat = rota.find((d) => d.date === "2027-05-01")!;
    expect(sat.sessions).toHaveLength(1);
    expect([fmtWallTime(sat.sessions[0]!.startAt), fmtWallTime(sat.sessions[0]!.endAt)]).toEqual(["09:30", "12:15"]);
    expect(sat.sessions[0]!.staff.map((m) => m.status)).toEqual(["assigned"]);

    // 4. Publish and confirm.
    const pub = await publishWeek(repos, ctx, "2027-05-01");
    expect(pub.instructorsNotified).toBe(1);
    const a = (await repos.tenant.courseStaff.list(ctx)).find((x) => x.courseId === courseId)!;
    expect((await confirmAssignment(repos, ctx, instructorId, a.id)).ok).toBe(true);

    // 5. Payroll lines follow the roster: 2h45 at £20 = £55 each, times as typed.
    let { lines } = await getPayrollLines(repos, ctx, { from: "2027-05-01", to: "2027-05-31" });
    expect(lines.map((l) => [l.date, l.start, l.finish, l.pay])).toEqual([["2027-05-01", "09:30", "12:15", 55], ["2027-05-02", "09:30", "12:15", 55]]);

    // 6. Move Sunday onto Saturday afternoon over a second course: the edit re-check names the clash.
    const { courseId: other } = await createCourseWithSessions(repos, ctx, { name: "Taster", courseTypeId, sessions: [{ date: "2027-05-01", slot: "PM", startTime: "13:00", endTime: "16:00" }] });
    await setAvailability(repos, ctx, instructorId, "2027-05-01", "PM", "available");
    expect((await assignStaff(repos, ctx, { courseId: other, instructorId, roleTypeId: roleId })).ok).toBe(true);
    const sunday = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId && s.date === "2027-05-02")!;
    await repos.tenant.courseSession.update(ctx, sunday.id, { date: "2027-05-01", slot: "PM", startAt: new Date(Date.parse("2027-05-01T14:00:00Z")), endAt: new Date(Date.parse("2027-05-01T17:00:00Z")) });
    await syncHoursForCourse(repos, ctx, courseId);
    const after = await problemsForCourse(repos, ctx, courseId);
    expect(after.map((p) => p.kind)).toContain("double-booked");

    // 7. Approve Saturday morning's line, then cancel that day with "pay as rostered": the line is kept and flagged.
    ({ lines } = await getPayrollLines(repos, ctx, { from: "2027-05-01", to: "2027-05-31" }));
    const satLine = lines.find((l) => l.courseName === "Stage 1 weekend" && l.start === "09:30")!;
    await markApproval(repos, ctx, satLine.recordId, true);
    const satSession = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId && s.slot === "AM")!;
    const cancelled = await cancelSessions(repos, ctx, { courseId, sessionIds: [satSession.id], reason: "No wind forecast", pay: { rule: "rostered" } });
    expect(cancelled).toMatchObject({ cancelled: 1, courseCancelled: false, notified: 1 });
    const rotaAfter = await getWeekRota(repos, ctx, weekOf("2027-05-01"));
    expect(rotaAfter.find((d) => d.date === "2027-05-01")!.sessions.filter((s) => s.courseId === courseId)).toHaveLength(1); // the moved one only
    const approvedRow = (await repos.tenant.hoursRecord.findById(ctx, satLine.recordId))!;
    expect(approvedRow.approved).toBe(true);
    expect(approvedRow.note).toMatch(/cancelled after this line was approved/);

    // 8. Delete is refused while people are rostered; restore brings the day back.
    expect((await canDeleteCourse(repos, ctx, courseId)).ok).toBe(false);
    expect((await restoreSessions(repos, ctx, courseId, [satSession.id])).restored).toBe(1);
    expect((await repos.tenant.courseSession.findById(ctx, satSession.id))!.cancelledAt).toBeNull();

    // 9. The change log tells the story in order.
    const actions = (await repos.tenant.auditLog.list(ctx)).map((x) => x.action);
    for (const expected of [/^create$/, /^set_staffing$/, /^set_course_locations$/, /^set_availability$/, /pay_rate/, /^assign_staff$/, /publish/, /^confirm_assignment$/, /cancel/, /^restore_session/]) {
      expect(actions.some((a) => expected.test(a)), `audit should contain ${expected}`).toBe(true);
    }
  });
});
