import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { moveSession } from "@/lib/services/session-move";
import { isRealIsoDate } from "@/lib/domain/time";
import { hoursRecord as hoursRecordTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("moving a staffed session", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let kimId: string;
  let aId: string;
  let aSession: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Move", slug: "move", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceAvailabilityChecks: false });
    const roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    kimId = (await repos.tenant.instructor.insert(ctx, { name: "Kim", email: "kim@move.test", employmentType: "freelance", status: "active" })).id;
    aId = (await createCourseWithSessions(repos, ctx, { name: "Stage 1", courseTypeId, sessions: [{ date: "2027-07-05", slot: "AM", startTime: "09:00", endTime: "12:00" }] })).courseId;
    const bId = (await createCourseWithSessions(repos, ctx, { name: "Stage 2", courseTypeId, sessions: [{ date: "2027-07-06", slot: "AM", startTime: "09:00", endTime: "12:00" }] })).courseId;
    for (const c of [aId, bId]) expect((await assignStaff(repos, ctx, { courseId: c, instructorId: kimId, roleTypeId: roleId, override: true })).ok).toBe(true);
    aSession = (await repos.tenant.courseSession.list(ctx)).find((s) => s.courseId === aId)!.id;
  });

  const to = (date: string, start: string, end: string) => ({ courseId: aId, sessionId: aSession, date, slot: "AM" as const, startAt: new Date(`${date}T${start}:00.000Z`), endAt: new Date(`${date}T${end}:00.000Z`) });

  it("asks first when someone on it would clash, and saves only when confirmed", async () => {
    const r = await moveSession(repos, ctx, to("2027-07-06", "10:00", "11:00"), false);
    expect(r.ok).toBe(false);
    expect("clashes" in r && r.clashes[0]).toMatch(/Kim is on Stage 2 then/);
    expect((await repos.tenant.courseSession.findById(ctx, aSession))!.date).toBe("2027-07-05");
    expect((await moveSession(repos, ctx, to("2027-07-06", "10:00", "11:00"), true)).ok).toBe(true);
    expect((await repos.tenant.courseSession.findById(ctx, aSession))!.date).toBe("2027-07-06");
  });

  it("a clear move saves at once, with the pay line on the new length", async () => {
    expect((await moveSession(repos, ctx, to("2027-07-07", "13:00", "17:00"), false)).ok).toBe(true);
    const line = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.courseSessionId, aSession)))[0]!;
    expect(line.scheduledMinutes).toBe(240);
  });

  it("real dates only", () => {
    expect(isRealIsoDate("2027-02-28")).toBe(true);
    expect(isRealIsoDate("2028-02-29")).toBe(true);
    expect(isRealIsoDate("2027-02-31")).toBe(false);
    expect(isRealIsoDate("2027-13-01")).toBe(false);
  });
});
