import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn(async () => {});
vi.mock("@/lib/mail", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...(a as [])), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { findProblems, problemsForCourse, problemsForInstructor, problemsSuffix, qualificationGap } from "@/lib/services/problems";
import { assignStaff } from "@/lib/services/assignment";
import { createCourseWithSessions } from "@/lib/services/courses";
import { setAvailability, availabilityHorizon } from "@/lib/services/availability";
import { decideLeave, requestLeave } from "@/lib/services/leave";
import { addDaysIso } from "@/lib/domain/availability";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("problems service", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let instructorId: string;
  let courseTypeId: string;
  let roleId: string;
  let inside: string; // a Wednesday inside the availability window

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    roleId = (await repos.tenant.roleType.list(ctx))[0]!.id;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceConflictChecks: true });
    inside = addDaysIso(availabilityHorizon(st).from, 2);
    sendEmail.mockClear();
  });

  it("finds a late Busy, approved leave and a clash created by moving a session, and clears when fixed", async () => {
    // Fixture instructor: a course on Wednesday morning, marked Free for it.
    const { courseId: a } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: inside, slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    await setAvailability(repos, ctx, instructorId, inside, "AM", "available");
    expect((await assignStaff(repos, ctx, { courseId: a, instructorId, roleTypeId: roleId })).ok).toBe(true);
    expect((await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) })).problems).toEqual([]);

    // Then they mark it Busy after the fact.
    await setAvailability(repos, ctx, instructorId, inside, "AM", "unavailable");
    let report = await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) });
    expect(report.problems.map((p) => p.kind)).toEqual(["busy"]);
    expect(report.blocks).toBe(1);
    expect(report.bySession[Object.keys(report.bySession)[0]!]![0]!.courseId).toBe(a);

    // A second course that afternoon; moving it onto the morning creates a clash the edit check reports.
    const { courseId: b } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: inside, slot: "PM", startTime: "13:00", endTime: "16:00" }] });
    await setAvailability(repos, ctx, instructorId, inside, "PM", "available");
    expect((await assignStaff(repos, ctx, { courseId: b, instructorId, roleTypeId: roleId })).ok).toBe(true);
    const sB = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === b)!;
    await repos.tenant.courseSession.update(ctx, sB.id, { slot: "AM", startAt: new Date(Date.parse(`${inside}T10:00:00Z`)), endAt: new Date(Date.parse(`${inside}T13:00:00Z`)) });
    const forB = await problemsForCourse(repos, ctx, b);
    expect(forB.some((p) => p.kind === "double-booked")).toBe(true);
    expect(problemsSuffix(forB)).toMatch(/double-booked/);

    // Approved leave shows as on-leave; the instructor's own view carries it.
    const leave = await requestLeave(repos, ctx, instructorId, { type: "annual", startDate: inside, endDate: inside, days: 1 });
    await decideLeave(repos, ctx, leave.id, "approved");
    report = await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) });
    expect(report.problems.filter((p) => p.kind === "on-leave").length).toBe(2);
    expect((await problemsForInstructor(repos, ctx, instructorId, { from: inside, to: addDaysIso(inside, 1) })).every((p) => p.instructorId === instructorId)).toBe(true);

    // Fixed: remove them from both courses.
    for (const row of await repos.tenant.courseStaff.list(ctx)) if (row.courseId === a || row.courseId === b) await repos.tenant.courseStaff.delete(ctx, row.id);
    expect((await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) })).problems).toEqual([]);
  });

  it("an unanswered slot is a warning, a decline needs cover, and a cancelled course is ignored", async () => {
    const newcomer = await repos.tenant.instructor.insert(ctx, { name: "Nia", email: "nia@alpha.test", employmentType: "employed", status: "active" });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: inside, slot: "PM" }] });
    const forced = await assignStaff(repos, ctx, { courseId, instructorId: newcomer.id, roleTypeId: roleId, override: true, overrideNote: "phoned" });
    expect(forced.ok).toBe(true);
    let report = await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) });
    expect(report.problems.map((p) => p.kind)).toEqual(["not-answered"]);
    expect(report.warns).toBe(1);
    const row = (await repos.tenant.courseStaff.list(ctx)).find((r) => r.courseId === courseId)!;
    await repos.tenant.courseStaff.update(ctx, row.id, { status: "declined" });
    report = await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) });
    expect(report.problems.map((p) => p.kind)).toEqual(["declined"]);
    await repos.tenant.course.update(ctx, courseId, { cancelledAt: new Date(), status: "cancelled" });
    expect((await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) })).problems).toEqual([]);
  });

  it("the qualification match blocks with an override and only judges people with something on file", async () => {
    expect(qualificationGap([], false, "t1")).toEqual({ known: false, qualified: true });
    expect(qualificationGap([{ courseTypeId: "t1" }], true, "t2")).toEqual({ known: true, qualified: false });
    const other = await repos.tenant.courseType.insert(ctx, { name: "Powerboat Level 2", scheme: "RYA Powerboat", audience: "adult", defaultCapacity: 3, studentsPerInstructor: 3, active: true });
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId: other.id, sessions: [{ date: inside, slot: "PM" }] });
    await setAvailability(repos, ctx, instructorId, inside, "PM", "available");
    // The fixture instructor holds a dinghy grade only: blocked for powerboat, override allowed.
    const blocked = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId: roleId });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) { expect(blocked.reason).toBe("not-qualified"); expect(blocked.detail).toMatch(/Powerboat Level 2/); }
    const forced = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId: roleId, override: true, overrideNote: "senior cover" });
    expect(forced.ok && forced.overridden).toBe(true);
    const report = await findProblems(repos, ctx, { from: inside, to: addDaysIso(inside, 1) });
    expect(report.problems.map((p) => p.kind)).toEqual(["not-qualified"]);
    // Someone with nothing recorded is never blocked for this.
    const blank = await repos.tenant.instructor.insert(ctx, { name: "Blank", email: "blank@alpha.test", employmentType: "volunteer", status: "active" });
    await setAvailability(repos, ctx, blank.id, inside, "PM", "available");
    expect((await assignStaff(repos, ctx, { courseId, instructorId: blank.id, roleTypeId: roleId })).ok).toBe(true);
  });
});
