import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), queueEmails: vi.fn(async () => ({ queued: 0 })), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { getBoard } from "@/lib/services/board";
import { confirmDays } from "@/lib/services/roster-days";
import { applyWeekState, undoRedo, weekStateOf } from "@/lib/services/week-redo";
import { diffWeek } from "@/lib/domain/week-redo";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("diffWeek", () => {
  it("leaves people who stay alone and lists only who comes off and who goes on", () => {
    const before = { s1: [{ instructorId: "a", roleTypeId: "r" }, { instructorId: "b", roleTypeId: "r" }] };
    const after = { s1: [{ instructorId: "a", roleTypeId: "r" }, { instructorId: "c", roleTypeId: "r" }] };
    expect(diffWeek(before, after)).toEqual([{ sessionId: "s1", instructorId: "b", roleTypeId: "r", kind: "off" }, { sessionId: "s1", instructorId: "c", roleTypeId: "r", kind: "on" }]);
    expect(diffWeek(before, before)).toEqual([]);
  });
});

describe("redoing a week in one go, with undo", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let kim: string;
  let jo: string;
  const MON = "2027-09-06";
  const notes = async (id: string) => (await repos.tenant.notification.list(ctx)).filter((n) => n.instructorId === id).length;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Redo", slug: "redo", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceAvailabilityChecks: false });
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    kim = (await repos.tenant.instructor.insert(ctx, { name: "Kim", email: "kim@r.test", employmentType: "freelance", status: "active" })).id;
    jo = (await repos.tenant.instructor.insert(ctx, { name: "Jo", email: "jo@r.test", employmentType: "freelance", status: "active" })).id;
    const one = (await createCourseWithSessions(repos, ctx, { name: "Taster", courseTypeId, sessions: [{ date: MON, slot: "AM", startTime: "09:00", endTime: "12:00" }] })).courseId;
    const two = (await createCourseWithSessions(repos, ctx, { name: "Two day", courseTypeId, sessions: [{ date: MON, slot: "PM", startTime: "13:00", endTime: "16:00" }, { date: "2027-09-07", slot: "PM", startTime: "13:00", endTime: "16:00" }] })).courseId;
    for (const c of [one, two]) expect((await assignStaff(repos, ctx, { courseId: c, instructorId: kim, roleTypeId: roleId, override: true })).ok).toBe(true);
  });

  it("swaps people on and off in one write, tells only people who changed on confirmed days, and undoes", async () => {
    await confirmDays(repos, ctx, [MON]);
    const kimBefore = await notes(kim);
    const board = await getBoard(repos, ctx, MON);
    const before = weekStateOf(board);
    // New week: Jo instead of Kim on Monday's sessions; Tuesday unchanged.
    const target = Object.fromEntries(Object.entries(before).map(([id, ms]) => [id, board.days.find((d) => d.sessions.some((s) => s.sessionId === id))!.date === MON ? [{ instructorId: jo, roleTypeId: roleId }] : ms]));
    const r = await applyWeekState(repos, ctx, board, target, { action: "auto_roster_redo", after: { week: MON } });
    expect(r).toMatchObject({ added: 2, removed: 2 });
    const now = weekStateOf(await getBoard(repos, ctx, MON));
    const tue = Object.entries(now).find(([id]) => !Object.keys(target).filter((k) => target[k]![0]?.instructorId === jo).includes(id))![1];
    expect(tue.map((m) => m.instructorId)).toEqual([kim]); // Kim stays on Tuesday of the two-day course
    expect(Object.values(now).filter((ms) => ms.some((m) => m.instructorId === jo))).toHaveLength(2);
    // Monday is confirmed: Kim and Jo each get one message; nobody on Tuesday (pending) does.
    expect(await notes(kim)).toBe(kimBefore + 1);
    expect(await notes(jo)).toBe(1);

    const u = await undoRedo(repos, ctx, r.auditId!);
    expect(u).toMatchObject({ ok: true, added: 2, removed: 2 });
    expect(weekStateOf(await getBoard(repos, ctx, MON))).toEqual(before);
  });
});
