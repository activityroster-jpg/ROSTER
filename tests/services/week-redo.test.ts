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
import { diffWeek, planUndo } from "@/lib/domain/week-redo";
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

describe("planUndo", () => {
  const before = { s1: [{ instructorId: "kim", roleTypeId: "r" }], s2: [{ instructorId: "kim", roleTypeId: "r" }], s3: [], s4: [{ instructorId: "kim", roleTypeId: "r" }] };
  const changes = [
    { sessionId: "s1", instructorId: "kim", roleTypeId: "r", kind: "off" as const }, { sessionId: "s1", instructorId: "jo", roleTypeId: "r", kind: "on" as const },
    { sessionId: "s2", instructorId: "kim", roleTypeId: "r", kind: "off" as const }, { sessionId: "s2", instructorId: "jo", roleTypeId: "r", kind: "on" as const },
    { sessionId: "s4", instructorId: "kim", roleTypeId: "r", kind: "off" as const },
  ];
  it("puts back only sessions still as the redo left them, upcoming and still on the roster", () => {
    const now = { s1: [{ instructorId: "jo", roleTypeId: "r" }], s2: [{ instructorId: "sam", roleTypeId: "r" }], s3: [{ instructorId: "sam", roleTypeId: "r" }] };
    const plan = planUndo(before, changes, now, (id) => id !== "s9");
    // s1 is as the redo left it → back to Kim. s2 was changed by hand since → left alone.
    // s3 was never touched by the redo → never part of the undo. s4 is gone from the roster.
    expect(plan.target).toEqual({ s1: [{ instructorId: "kim", roleTypeId: "r" }] });
    expect(plan).toMatchObject({ changedSince: 1, past: 0, gone: 1 });
  });
  it("leaves sessions that have already happened", () => {
    const now = { s1: [{ instructorId: "jo", roleTypeId: "r" }], s2: [{ instructorId: "jo", roleTypeId: "r" }], s4: [] };
    const plan = planUndo(before, changes, now, (id) => id === "s2");
    expect(plan.target).toEqual({ s2: [{ instructorId: "kim", roleTypeId: "r" }] });
    expect(plan.past).toBe(2);
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

  it("undo keeps changes made by hand since the redo, on any session", async () => {
    const board = await getBoard(repos, ctx, MON);
    const before = weekStateOf(board);
    const [first, second, third] = Object.keys(before);
    // The redo swaps Kim for Jo on the first session only.
    const target = { [first!]: [{ instructorId: jo, roleTypeId: roleId }] };
    const r = await applyWeekState(repos, ctx, board, target, { action: "auto_roster_redo", after: { week: MON } });
    // Later, by hand: Jo also put on the second session, which the redo never touched.
    const now = weekStateOf(await getBoard(repos, ctx, MON));
    const hand = { ...now, [second!]: [...now[second!]!, { instructorId: jo, roleTypeId: roleId }] };
    await applyWeekState(repos, ctx, await getBoard(repos, ctx, MON), hand, { action: "assign_by_hand", after: {} });
    const u = await undoRedo(repos, ctx, r.auditId!);
    expect(u).toMatchObject({ ok: true, added: 1, removed: 1 });
    const after = weekStateOf(await getBoard(repos, ctx, MON));
    expect(after[first!]!.map((m) => m.instructorId)).toEqual([kim]);
    expect(after[second!]!.map((m) => m.instructorId).sort()).toEqual([jo, kim].sort()); // the hand change survives
    if (third) expect(after[third]).toEqual(before[third]);
  });

  it("undo leaves a session alone once it has been changed again since the redo", async () => {
    const board = await getBoard(repos, ctx, MON);
    const before = weekStateOf(board);
    const first = Object.keys(before)[0]!;
    const r = await applyWeekState(repos, ctx, board, { [first]: [{ instructorId: jo, roleTypeId: roleId }] }, { action: "auto_roster_redo", after: { week: MON } });
    // By hand, Kim is added back alongside Jo.
    await applyWeekState(repos, ctx, await getBoard(repos, ctx, MON), { [first]: [{ instructorId: jo, roleTypeId: roleId }, { instructorId: kim, roleTypeId: roleId }] }, { action: "assign_by_hand", after: {} });
    const u = await undoRedo(repos, ctx, r.auditId!);
    expect(u).toMatchObject({ ok: true, added: 0, removed: 0 });
    if (u.ok) expect(u.preview).toMatchObject({ sessions: 0, changedSince: 1 });
    expect(weekStateOf(await getBoard(repos, ctx, MON))[first]!.map((m) => m.instructorId).sort()).toEqual([jo, kim].sort());
  });

  it("refuses to undo a run saved before its changes were recorded", async () => {
    const row = await repos.tenant.auditLog.insert(ctx, { action: "auto_roster_redo", entity: "roster", entityId: MON, before: JSON.stringify({ week: {} }), after: JSON.stringify({ week: MON }) });
    const u = await undoRedo(repos, ctx, row.id);
    expect(u.ok).toBe(false);
  });
});
