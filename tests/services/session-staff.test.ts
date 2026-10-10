import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));
vi.mock("@/lib/security/token-crypto", () => ({ openToken: vi.fn(async (v: string | null) => v), sealToken: vi.fn(async (v: string) => v), isSealed: () => false }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { effectiveStaff, effectiveStaffBySession, sessionsFor } from "@/lib/domain/session-staff";
import { clearDayStaff, sessionsForInstructor, setDayStaff, staffBySession } from "@/lib/services/session-staff";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { getWeekRota } from "@/lib/services/schedule";
import { getPayrollLines } from "@/lib/services/finance";
import { setPayRate } from "@/lib/services/pay-rates";
import { findProblems } from "@/lib/services/problems";
import { setAvailability } from "@/lib/services/availability";
import { claimOpenShift, confirmOpenShift, createOpenShift } from "@/lib/services/openshifts";
import { getDaySheet } from "@/lib/services/emergency";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext, TenantContext } from "@/lib/tenant/context";

describe("per-day staffing: pure rules", () => {
  const course = [
    { id: "a1", courseId: "c", instructorId: "sam", roleTypeId: "in", status: "confirmed" },
    { id: "a2", courseId: "c", instructorId: "jo", roleTypeId: "in", status: "declined" },
  ];
  it("skips take one person off a day, adds put one on, and nobody appears twice", () => {
    const out = effectiveStaff(course, [
      { courseSessionId: "s1", instructorId: "sam", roleTypeId: "in", mode: "skip" },
      { courseSessionId: "s1", instructorId: "kim", roleTypeId: "sb", mode: "add" },
      { courseSessionId: "s1", instructorId: "jo", roleTypeId: "in", mode: "add" }, // already on the course: ignored
    ]);
    expect(out.map((m) => [m.instructorId, m.source, m.status])).toEqual([["jo", "course", "declined"], ["kim", "day", "assigned"]]);
    const by = effectiveStaffBySession([{ id: "s1", courseId: "c" }, { id: "s2", courseId: "c" }], course, [{ courseSessionId: "s1", instructorId: "sam", roleTypeId: "in", mode: "skip" }]);
    expect(by.get("s1")!.map((m) => m.instructorId)).toEqual(["jo"]);
    expect(by.get("s2")!.map((m) => m.instructorId)).toEqual(["sam", "jo"]);
    expect(sessionsFor("sam", [{ id: "s1", courseId: "c" }, { id: "s2", courseId: "c" }], course, [{ courseSessionId: "s1", instructorId: "sam", roleTypeId: "in", mode: "skip" }]).map((s) => s.id)).toEqual(["s2"]);
    expect(sessionsFor("jo", [{ id: "s1", courseId: "c" }], course, [])).toEqual([]); // declined
  });
});

describe("per-day staffing against the database", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseTypeId: string;
  let samId: string;
  let kimId: string;
  let courseId: string;
  let monId: string;
  let wedId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Days", slug: "days", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceConflictChecks: true });
    samId = (await repos.tenant.instructor.list(ctx))[0]!.id;
    kimId = (await repos.tenant.instructor.insert(ctx, { name: "Kim", email: "kim@days.test", employmentType: "freelance", status: "active" })).id;
    await setPayRate(repos, ctx, { instructorId: samId, roleTypeId: null, unit: "session", rate: 50 });
    await setPayRate(repos, ctx, { instructorId: kimId, roleTypeId: null, unit: "session", rate: 40 });
    ({ courseId } = await createCourseWithSessions(repos, ctx, { name: "Stage 3 week", courseTypeId, sessions: [
      { date: "2027-06-07", slot: "AM", startTime: "09:00", endTime: "12:00" },
      { date: "2027-06-09", slot: "AM", startTime: "09:00", endTime: "12:00" },
    ] }));
    const sessions = (await repos.tenant.courseSession.list(ctx)).filter((s) => s.courseId === courseId);
    monId = sessions.find((s) => s.date === "2027-06-07")!.id;
    wedId = sessions.find((s) => s.date === "2027-06-09")!.id;
    for (const d of ["2027-06-07", "2027-06-09"]) { await setAvailability(repos, ctx, samId, d, "AM", "available"); await setAvailability(repos, ctx, kimId, d, "AM", "available"); }
    expect((await assignStaff(repos, ctx, { courseId, instructorId: samId, roleTypeId: roleId })).ok).toBe(true);
  });

  it("Wednesday differs: Sam skipped, Kim added for the day; roster, hours, app view and emergency sheet all follow", async () => {
    expect((await setDayStaff(repos, ctx, { sessionId: wedId, instructorId: samId, roleTypeId: roleId, mode: "skip" })).ok).toBe(true);
    expect((await setDayStaff(repos, ctx, { sessionId: wedId, instructorId: kimId, roleTypeId: roleId, mode: "add" })).ok).toBe(true);
    // Refusals: skipping someone not on the course, adding someone already on it.
    expect((await setDayStaff(repos, ctx, { sessionId: monId, instructorId: kimId, roleTypeId: roleId, mode: "skip" })).ok).toBe(false);
    expect((await setDayStaff(repos, ctx, { sessionId: monId, instructorId: samId, roleTypeId: roleId, mode: "add" })).ok).toBe(false);

    const by = await staffBySession(repos, ctx, [{ id: monId, courseId }, { id: wedId, courseId }]);
    expect(by.get(monId)!.map((m) => m.instructorId)).toEqual([samId]);
    expect(by.get(wedId)!.map((m) => [m.instructorId, m.source])).toEqual([[kimId, "day"]]);
    expect((await sessionsForInstructor(repos, ctx, samId)).map((s) => s.id).sort()).toEqual([monId].concat((await repos.tenant.courseSession.list(ctx)).filter((s) => s.courseId !== courseId).map((s) => s.id)).sort());

    const rota = await getWeekRota(repos, ctx, "2027-06-07");
    const wed = rota.find((d) => d.date === "2027-06-09")!.sessions[0]!;
    expect(wed.staff.map((m) => [m.name, m.dayOnly ?? false])).toEqual([["Kim", true]]);
    expect(rota.find((d) => d.date === "2027-06-07")!.sessions[0]!.staff.map((m) => m.dayOnly ?? false)).toEqual([false]);

    const { lines } = await getPayrollLines(repos, ctx, { from: "2027-06-01", to: "2027-06-30" });
    expect(lines.map((l) => [l.date, l.instructorName, l.pay]).sort()).toEqual([["2027-06-07", `Instructor days`, 50], ["2027-06-09", "Kim", 40]]);

    const sheet = await getDaySheet(repos, ctx, "2027-06-09");
    expect(sheet.sessions[0]!.staff.map((p) => p.name)).toEqual(["Kim"]);
    expect(sheet.contactsShown).toBe(true);
    // An office admin with the roster but without "Emergency & guardian contacts" sees who is on duty, not their contacts.
    const rosterOnly = { organisationId: ctx.organisationId, slug: ctx.slug, userId: "office-1", role: "admin", features: ["roster"] } as unknown as TenantContext;
    await repos.tenant.instructor.update(ctx, kimId, { emergencyName: "Kim's mum", emergencyPhone: "07700 900000" });
    const limited = await getDaySheet(repos, rosterOnly, "2027-06-09");
    expect(limited.contactsShown).toBe(false);
    expect(limited.sessions[0]!.staff.map((p) => [p.name, p.emergencyName, p.emergencyPhone])).toEqual([["Kim", null, null]]);
    const withContacts = await getDaySheet(repos, { ...rosterOnly, features: ["roster", "protected"] } as unknown as TenantContext, "2027-06-09");
    expect(withContacts.sessions[0]!.staff.map((p) => p.emergencyName)).toEqual(["Kim's mum"]);

    // Undo the skip: Sam is back on Wednesday beside Kim, and gets paid for it again.
    expect((await clearDayStaff(repos, ctx, wedId, samId)).ok).toBe(true);
    expect((await staffBySession(repos, ctx, [{ id: wedId, courseId }])).get(wedId)!.map((m) => m.instructorId).sort()).toEqual([samId, kimId].sort());
    expect((await getPayrollLines(repos, ctx, { from: "2027-06-09", to: "2027-06-09" })).lines).toHaveLength(2);
  });

  it("a day add runs the day's checks (clash, Busy) with an override, and the problems list sees per-day staffing", async () => {
    const { courseId: other } = await createCourseWithSessions(repos, ctx, { name: "Taster", courseTypeId, sessions: [{ date: "2027-06-09", slot: "AM", startTime: "10:00", endTime: "11:00" }] });
    const otherId = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === other)!.id;
    // Sam is on Stage 3 that morning: adding him to the taster clashes.
    const clash = await setDayStaff(repos, ctx, { sessionId: otherId, instructorId: samId, roleTypeId: roleId, mode: "add" });
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.error).toMatch(/another session in the same slot/);
    const forced = await setDayStaff(repos, ctx, { sessionId: otherId, instructorId: samId, roleTypeId: roleId, mode: "add", override: true, note: "ten minutes' handover" });
    expect(forced.ok && forced.overridden).toBe(true);
    const report = await findProblems(repos, ctx, { from: "2027-06-09", to: "2027-06-10" });
    expect(report.problems.some((p) => p.kind === "double-booked" && p.instructorId === samId)).toBe(true);
    // Skip Sam on Stage 3 that day: the clash is gone.
    await setDayStaff(repos, ctx, { sessionId: wedId, instructorId: samId, roleTypeId: roleId, mode: "skip" });
    expect((await findProblems(repos, ctx, { from: "2027-06-09", to: "2027-06-10" })).problems.filter((p) => p.kind === "double-booked")).toEqual([]);
    // Busy blocks a day add too.
    await setAvailability(repos, ctx, kimId, "2027-06-07", "AM", "unavailable");
    const busy = await setDayStaff(repos, ctx, { sessionId: monId, instructorId: kimId, roleTypeId: roleId, mode: "add" });
    expect(busy.ok).toBe(false);
    if (!busy.ok) expect(busy.error).toMatch(/busy/i);
  });

  it("an open shift is filled for that day only, not the whole course", async () => {
    const shift = await createOpenShift(repos, ctx, wedId, roleId, "Need a second pair of hands");
    expect(await claimOpenShift(repos, ctx, shift.id, kimId)).not.toBeNull();
    const r = await confirmOpenShift(repos, ctx, shift.id);
    expect(r.ok).toBe(true);
    const by = await staffBySession(repos, ctx, [{ id: monId, courseId }, { id: wedId, courseId }]);
    expect(by.get(monId)!.map((m) => m.instructorId)).toEqual([samId]);
    expect(by.get(wedId)!.map((m) => [m.instructorId, m.source]).sort()).toEqual([[samId, "course"], [kimId, "day"]].sort());
    expect((await repos.tenant.courseStaff.list(ctx)).filter((a) => a.courseId === courseId && a.instructorId === kimId)).toEqual([]);
  });
});
