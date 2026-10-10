import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { TenantRepository } from "@/lib/db/repositories/base";
import { getBoard } from "@/lib/services/board";
import { getPayrollLines } from "@/lib/services/finance";
import { assignStaff } from "@/lib/services/assignment";
import { coursePageScope } from "@/lib/services/course-list";
import { coverageForCourses } from "@/lib/services/schedule";
import { getCourseAvailabilityStates } from "@/lib/services/availability";
import { courseSession as courseSessionTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * A busy centre in its third season: two years of daily courses (about 1,400
 * sessions, with staff, pay lines and availability). Each page and each
 * assignment must read a small slice, never the whole history (audit
 * follow-up: bounded reads). Rows returned by every repository read are
 * counted per table.
 */
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe("a big centre: pages read a slice, not the whole history", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let instructorId: string;
  let courseTypeId: string;
  const today = iso(Date.now());
  const rowsRead = new Map<string, number>();
  let spy: ReturnType<typeof vi.spyOn> | null = null;

  const watch = () => {
    rowsRead.clear();
    const original = TenantRepository.prototype.list;
    spy = vi.spyOn(TenantRepository.prototype, "list").mockImplementation(async function (this: TenantRepository<never>, ...args: Parameters<typeof original>) {
      const rows = await original.apply(this, args);
      const name = String((this as unknown as { table: { [k: symbol]: string } }).table[Symbol.for("drizzle:Name")] ?? "?");
      rowsRead.set(name, (rowsRead.get(name) ?? 0) + rows.length);
      return rows;
    });
  };
  afterEach(() => { spy?.mockRestore(); spy = null; });

  beforeAll(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Big", slug: "big", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const t = repos.tenant;
    roleId = (await t.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    courseTypeId = (await t.courseType.list(ctx))[0]!.id;
    instructorId = (await t.instructor.list(ctx))[0]!.id;
    const st = (await t.orgSettings.list(ctx))[0]!;
    await t.orgSettings.update(ctx, st.id, { enforceConflictChecks: true, enforceAvailabilityChecks: false });
    // 700 days of history and future: one two-session course a day.
    const start = Date.now() - 600 * DAY;
    const courses = [], sessions = [], staff = [], hours = [];
    for (let d = 0; d < 700; d++) {
      const date = iso(start + d * DAY);
      const courseId = crypto.randomUUID();
      courses.push({ id: courseId, courseTypeId, name: `Course ${d}`, capacity: 6, ratio: 6, status: "scheduled" as const });
      for (const [slot, h] of [["AM", 9], ["PM", 13]] as const) {
        const id = crypto.randomUUID();
        sessions.push({ id, courseId, date, slot, startAt: new Date(`${date}T${String(h).padStart(2, "0")}:00:00.000Z`), endAt: new Date(`${date}T${String(h + 3).padStart(2, "0")}:00:00.000Z`) });
        hours.push({ instructorId, courseSessionId: id, scheduledMinutes: 180, actualMinutes: null, rate: 20, ratePence: 2000, payUnit: "hour" as const, source: "roster" as const, approved: false });
      }
      staff.push({ courseId, instructorId, roleTypeId: roleId, status: "assigned" as const, isOverride: false, overrideNote: null, overriddenBy: null });
    }
    await t.course.insertMany(ctx, courses);
    await t.courseSession.insertMany(ctx, sessions);
    await t.courseStaff.insertMany(ctx, staff);
    await t.hoursRecord.insertMany(ctx, hours);
    expect(await t.courseSession.count(ctx)).toBeGreaterThanOrEqual(1400);
  }, 120_000);

  it("the roster board reads one week", async () => {
    const monday = iso(Date.now() - ((new Date().getUTCDay() + 6) % 7) * DAY);
    watch();
    await getBoard(repos, ctx, monday);
    expect(rowsRead.get("course_session") ?? 0).toBeLessThan(100);
    expect(rowsRead.get("course") ?? 0).toBeLessThan(100);
    expect(rowsRead.get("course_staff") ?? 0).toBeLessThan(100);
    expect(rowsRead.get("availability") ?? 0).toBeLessThan(500);
  });

  it("payroll for a month reads that month", async () => {
    watch();
    const { lines } = await getPayrollLines(repos, ctx, { from: today.slice(0, 8) + "01", to: today.slice(0, 8) + "28" });
    expect(lines.length).toBeGreaterThan(0);
    expect(rowsRead.get("hours_record") ?? 0).toBeLessThan(80);
    expect(rowsRead.get("course_session") ?? 0).toBeLessThan(80);
  });

  it("the Courses page reads upcoming courses only", async () => {
    watch();
    const scope = await coursePageScope(repos, ctx, { view: "upcoming", today });
    expect(scope.pastCount).toBeGreaterThan(500);
    await coverageForCourses(repos, ctx, scope.ids);
    const sessions = await repos.tenant.courseSession.listIn(ctx, courseSessionTable.courseId, scope.ids);
    await getCourseAvailabilityStates(repos, ctx, sessions);
    expect(scope.ids.length).toBeLessThan(110);
    expect(rowsRead.get("course_session") ?? 0).toBeLessThan(250);
    expect(rowsRead.get("course_staff") ?? 0).toBeLessThan(120);
  });

  it("assigning someone reads the weeks around the course, not every session", async () => {
    const t = repos.tenant;
    const kim = await t.instructor.insert(ctx, { name: "Kim", email: "kim@big.test", employmentType: "freelance", status: "active" });
    const future = (await t.courseSession.list(ctx)).find((s) => s.date > today)!;
    watch();
    const r = await assignStaff(repos, ctx, { courseId: future.courseId, instructorId: kim.id, roleTypeId: roleId });
    expect(r.ok).toBe(true);
    expect(rowsRead.get("course_session") ?? 0).toBeLessThan(300);
  });
});
