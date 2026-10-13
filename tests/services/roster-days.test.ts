import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { setDayStaff } from "@/lib/services/session-staff";
import { confirmDays, confirmedDays, isDayConfirmed, undoDayConfirmation } from "@/lib/services/roster-days";
import { diffDayShifts } from "@/lib/domain/roster-day";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("diffDayShifts", () => {
  it("first confirmation tells everyone; after an undo only changes", () => {
    expect(diffDayShifts(null, { a: ["s1"], b: ["s2"] })).toEqual({ a: { shifts: ["s1"], removed: false }, b: { shifts: ["s2"], removed: false } });
    expect(diffDayShifts({ a: ["s1"], b: ["s2"] }, { a: ["s1"], c: ["s2"] })).toEqual({ b: { shifts: [], removed: true }, c: { shifts: ["s2"], removed: false } });
    expect(diffDayShifts({ a: ["s1@9-12"] }, { a: ["s1@10-13"] })).toEqual({ a: { shifts: ["s1@10-13"], removed: false } });
  });
});

describe("confirming roster days", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let kim: string;
  let jo: string;
  let courseId: string;
  const DAY = "2027-08-02";
  const titles = async (id: string) => (await repos.tenant.notification.list(ctx)).filter((n) => n.instructorId === id).map((n) => n.title);

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Days", slug: "days2", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceAvailabilityChecks: false });
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    kim = (await repos.tenant.instructor.insert(ctx, { name: "Kim", email: "kim@d.test", employmentType: "freelance", status: "active" })).id;
    jo = (await repos.tenant.instructor.insert(ctx, { name: "Jo", email: "jo@d.test", employmentType: "freelance", status: "active" })).id;
    courseId = (await createCourseWithSessions(repos, ctx, { name: "Stage 1", courseTypeId, sessions: [{ date: DAY, slot: "AM", startTime: "09:00", endTime: "12:00" }] })).courseId;
  });

  it("assigning on a pending day tells nobody; confirming tells everyone on it", async () => {
    expect((await assignStaff(repos, ctx, { courseId, instructorId: kim, roleTypeId: roleId, override: true })).ok).toBe(true);
    expect(await titles(kim)).toEqual([]);
    const r = await confirmDays(repos, ctx, [DAY]);
    expect(r).toMatchObject({ days: 1, notified: 1 });
    expect((await titles(kim)).some((t) => t.startsWith("Roster confirmed"))).toBe(true);
    expect(await isDayConfirmed(repos, ctx, DAY)).toBe(true);
  });

  it("a change to a confirmed day reaches the person straight away, and the day stays confirmed", async () => {
    await confirmDays(repos, ctx, [DAY]);
    expect((await assignStaff(repos, ctx, { courseId, instructorId: jo, roleTypeId: roleId, override: true })).ok).toBe(true);
    expect((await titles(jo)).some((t) => /Stage 1/.test(t))).toBe(true);
    expect(await isDayConfirmed(repos, ctx, DAY)).toBe(true);
  });

  it("undo is silent; confirming again tells only the people whose shifts changed", async () => {
    expect((await assignStaff(repos, ctx, { courseId, instructorId: kim, roleTypeId: roleId, override: true })).ok).toBe(true);
    await confirmDays(repos, ctx, [DAY]);
    const kimBefore = (await titles(kim)).length;
    expect((await undoDayConfirmation(repos, ctx, DAY)).ok).toBe(true);
    expect(await isDayConfirmed(repos, ctx, DAY)).toBe(false);
    // While pending: Jo is added for the day; nobody is told yet.
    const session = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === courseId)!;
    expect((await setDayStaff(repos, ctx, { sessionId: session.id, instructorId: jo, roleTypeId: roleId, mode: "add", override: true })).ok).toBe(true);
    expect(await titles(jo)).toEqual([]);
    const r = await confirmDays(repos, ctx, [DAY]);
    expect(r.notified).toBe(1);
    expect((await titles(jo)).some((t) => t.startsWith("Roster confirmed"))).toBe(true);
    expect((await titles(kim)).length).toBe(kimBefore);
  });

  it("weeks published before days existed count as confirmed until a day is undone", async () => {
    await repos.tenant.rosterWeek.insert(ctx, { weekStart: "2027-08-02", publishedAt: new Date(), publishedByUserId: null });
    expect((await confirmedDays(repos, ctx)).has("2027-08-04")).toBe(true);
    await undoDayConfirmation(repos, ctx, "2027-08-04");
    const days = await confirmedDays(repos, ctx);
    expect(days.has("2027-08-04")).toBe(false);
    expect(days.has("2027-08-03")).toBe(true);
  });
});
