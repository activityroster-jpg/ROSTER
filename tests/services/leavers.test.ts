import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { setDayStaff, sessionsForInstructor } from "@/lib/services/session-staff";
import { removeFromUpcoming, upcomingSessionsFor } from "@/lib/services/leavers";
import { addDays } from "@/lib/services/schedule";
import { todayIso } from "@/lib/domain/time";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("marking someone as left takes them off upcoming sessions", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseTypeId: string;
  let kimId: string;
  const today = todayIso();

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Leave", slug: "leave", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceAvailabilityChecks: false });
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    kimId = (await repos.tenant.instructor.insert(ctx, { name: "Kim", email: "kim@leave.test", employmentType: "freelance", status: "active" })).id;
  });

  const course = async (name: string, dates: string[]) => {
    const { courseId } = await createCourseWithSessions(repos, ctx, { name, courseTypeId, sessions: dates.map((date) => ({ date, slot: "AM", startTime: "09:00", endTime: "12:00" })) });
    return courseId;
  };

  it("lists, then removes, every session from today on; days already worked stay", async () => {
    const underway = await course("Week under way", [addDays(today, -2), addDays(today, -1), today, addDays(today, 1)]);
    const later = await course("Next month", [addDays(today, 30), addDays(today, 31)]);
    const taster = await course("Taster", [addDays(today, 5)]);
    expect((await assignStaff(repos, ctx, { courseId: underway, instructorId: kimId, roleTypeId: roleId, override: true })).ok).toBe(true);
    expect((await assignStaff(repos, ctx, { courseId: later, instructorId: kimId, roleTypeId: roleId, override: true })).ok).toBe(true);
    const tasterSession = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === taster)!;
    expect((await setDayStaff(repos, ctx, { sessionId: tasterSession.id, instructorId: kimId, roleTypeId: roleId, mode: "add", override: true })).ok).toBe(true);

    const upcoming = await upcomingSessionsFor(repos, ctx, kimId);
    expect(upcoming.map((u) => u.date)).toEqual([today, addDays(today, 1), addDays(today, 5), addDays(today, 30), addDays(today, 31)]);

    const r = await removeFromUpcoming(repos, ctx, kimId);
    expect(r).toEqual({ sessions: 5, courses: 3 });
    expect(await upcomingSessionsFor(repos, ctx, kimId)).toEqual([]);
    // Still on the two days already worked of the course under way.
    const left = (await sessionsForInstructor(repos, ctx, kimId)).map((s) => s.date).sort();
    expect(left).toEqual([addDays(today, -2), addDays(today, -1)]);
    // Off the future course entirely.
    expect((await repos.tenant.courseStaff.list(ctx)).some((a) => a.courseId === later && a.instructorId === kimId)).toBe(false);
  });
});
