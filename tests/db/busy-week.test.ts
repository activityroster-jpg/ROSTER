import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getBoard } from "@/lib/services/board";
import { getWeekRota } from "@/lib/services/schedule";
import { findProblems } from "@/lib/services/problems";
import { loadOverrides } from "@/lib/services/session-staff";
import { getPayrollLines } from "@/lib/services/finance";
import { dropHoursForSessions } from "@/lib/services/cancel";
import { addDays } from "@/lib/services/schedule";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * A busy imported week, like a centre that uploads its season: 20 one-day
 * courses a day, 140 sessions in one week, every one staffed. Cloudflare D1
 * refuses a statement with more than 100 bound parameters, and the test
 * database now refuses them too, so any read that puts the whole week's
 * session ids in one query fails here (the Roster page crashed this way in
 * production on 8 October 2026).
 */
describe("a busy week: more sessions than D1 takes in one query", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  const monday = "2026-10-12";
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Harbour", slug: "harbour", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const t = repos.tenant;
    const roleId = (await t.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const courseTypeId = (await t.courseType.list(ctx))[0]!.id;
    const instructorId = (await t.instructor.list(ctx))[0]!.id;
    const courses = [], sessions = [], staff = [], hours = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d);
      for (let n = 0; n < 20; n++) {
        const courseId = crypto.randomUUID();
        const id = crypto.randomUUID();
        const h = 8 + (n % 10);
        courses.push({ id: courseId, courseTypeId, name: `Course ${d}-${n}`, capacity: 6, ratio: 6, status: "scheduled" as const });
        sessions.push({ id, courseId, date, slot: h < 12 ? ("AM" as const) : ("PM" as const), startAt: new Date(`${date}T${String(h).padStart(2, "0")}:00:00.000Z`), endAt: new Date(`${date}T${String(h + 1).padStart(2, "0")}:00:00.000Z`) });
        staff.push({ courseId, instructorId, roleTypeId: roleId, status: "assigned" as const, isOverride: false, overrideNote: null, overriddenBy: null });
        hours.push({ instructorId, courseSessionId: id, scheduledMinutes: 60, actualMinutes: null, rate: 20, ratePence: 2000, payUnit: "hour" as const, source: "roster" as const, approved: false });
        sessionIds.push(id);
      }
    }
    await t.course.insertMany(ctx, courses);
    await t.courseSession.insertMany(ctx, sessions);
    await t.courseStaff.insertMany(ctx, staff);
    await t.hoursRecord.insertMany(ctx, hours);
  }, 60_000);

  it("the roster board loads", async () => {
    const board = await getBoard(repos, ctx, monday);
    expect(board.days.flatMap((d) => d.sessions).length).toBe(140);
  });

  it("the print view loads", async () => {
    const rota = await getWeekRota(repos, ctx, monday);
    expect(rota.reduce((n, d) => n + d.sessions.length, 0)).toBe(140);
  });

  it("the problems list loads", async () => {
    await expect(findProblems(repos, ctx, { from: monday, to: addDays(monday, 7) })).resolves.toBeTruthy();
  });

  it("per-day staffing loads for every session", async () => {
    await expect(loadOverrides(repos, ctx, sessionIds)).resolves.toEqual([]);
  });

  it("payroll for the week loads", async () => {
    const { lines } = await getPayrollLines(repos, ctx, { from: monday, to: addDays(monday, 6) });
    expect(lines.length).toBeGreaterThan(0);
  });

  it("pay lines for the whole week can be dropped", async () => {
    expect(await dropHoursForSessions(repos, ctx, sessionIds)).toBe(140);
  });
});
