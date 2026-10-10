import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), queueEmails: vi.fn(async () => ({ queued: 0 })), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0, dead: [] })) }));

import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { getWeekAvailabilityMatrix, markLeaveBusy, setAvailability, setAvailabilityBulk } from "@/lib/services/availability";
import { assignStaff } from "@/lib/services/assignment";
import { findProblems } from "@/lib/services/problems";
import { publishWeek } from "@/lib/services/roster";
import { addDays, weekStart } from "@/lib/services/schedule";
import { effectiveAvailability, horizonFor, indexAvailability, managedByOffice } from "@/lib/domain/availability";
import { availability as availabilityTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * Office-managed staff: no sign-up needed. The office keeps their availability
 * (free unless marked busy), they aren't asked to confirm, and the office can
 * set many people's availability at once.
 */
describe("who keeps availability: the rule", () => {
  it("a person's own setting wins, else the centre's, else the staff themselves", () => {
    expect(managedByOffice({ managedBy: null }, { staffManagedBy: "office" })).toBe(true);
    expect(managedByOffice({ managedBy: "staff" }, { staffManagedBy: "office" })).toBe(false);
    expect(managedByOffice({ managedBy: "office" }, { staffManagedBy: "staff" })).toBe(true);
    expect(managedByOffice({ managedBy: null }, null)).toBe(false);
  });

  it("an unanswered slot is Free (assumed) for office-managed people; answers and the usual week still apply", () => {
    const h = horizonFor("2026-10-08", 4);
    const office = indexAvailability([{ date: "2026-10-13", weekday: null, slot: "AM", status: "unavailable" }, { date: null, weekday: 0, slot: "AM", status: "unavailable" }], { assumeFree: true });
    expect(effectiveAvailability(office, h, "2026-10-14", "AM")).toEqual({ status: "available", source: "assumed" });
    expect(effectiveAvailability(office, h, "2026-10-13", "AM")).toEqual({ status: "unavailable", source: "set" });
    expect(effectiveAvailability(office, h, "2026-10-18", "AM")).toEqual({ status: "unavailable", source: "pattern" }); // a Sunday
    expect(effectiveAvailability(office, h, "2027-03-01", "AM")).toEqual({ status: "available", source: "assumed" }); // beyond the window too
    const self = indexAvailability([]);
    expect(effectiveAvailability(self, h, "2026-10-14", "AM")).toEqual({ status: "unavailable", source: "default" });
  });
});

describe("office-managed staff in a centre", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseTypeId: string;
  const nextMonday = addDays(weekStart(new Date()), 7);

  beforeEach(async () => {
    const { db } = createTestDb();
    ({ repos, ctx } = await seedFullOrg(db, { name: "Office", slug: "office", jurisdiction: "england" }));
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { enforceAvailabilityChecks: true, staffManagedBy: "office" });
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
  });

  const person = (name: string, extra: { managedBy?: "staff" | "office" | null } = {}) =>
    repos.tenant.instructor.insert(ctx, { name, email: `${name.toLowerCase()}@office.test`, employmentType: "volunteer", status: "active", ...extra });

  it("shows them free on the grid, lets them be rostered and auto-confirms them, with nothing in the problems list", async () => {
    const ana = await person("Ana");
    const matrix = await getWeekAvailabilityMatrix(repos, ctx, nextMonday);
    const row = matrix.rows.find((r) => r.instructorId === ana.id)!;
    expect(row.officeManaged).toBe(true);
    expect(row.cells[`${nextMonday}|AM`]).toBe("available");
    expect(row.sources[`${nextMonday}|AM`]).toBe("assumed");
    expect(matrix.availableCounts[`${nextMonday}|AM`]).toBeGreaterThanOrEqual(1);
    expect(matrix.staffManagedBy).toBe("office");

    const { courseId } = await createCourseWithSessions(repos, ctx, { name: "Taster", courseTypeId, sessions: [{ date: nextMonday, slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    const r = await assignStaff(repos, ctx, { courseId, instructorId: ana.id, roleTypeId: roleId });
    expect(r.ok).toBe(true);
    const row2 = (await repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId)))[0]!;
    expect(row2.status).toBe("confirmed");
    const problems = await findProblems(repos, ctx, { from: nextMonday, to: addDays(nextMonday, 1) });
    expect(problems.problems.filter((p) => p.instructorId === ana.id)).toEqual([]);
  });

  it("marked busy still blocks, and a person who keeps their own availability still counts as busy until they answer", async () => {
    const ben = await person("Ben");
    const cat = await person("Cat", { managedBy: "staff" });
    await setAvailability(repos, ctx, ben.id, nextMonday, "AM", "unavailable", { setBy: "office" });
    const { courseId } = await createCourseWithSessions(repos, ctx, { name: "Stage 1", courseTypeId, sessions: [{ date: nextMonday, slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    const b = await assignStaff(repos, ctx, { courseId, instructorId: ben.id, roleTypeId: roleId });
    expect(b.ok).toBe(false);
    const c = await assignStaff(repos, ctx, { courseId, instructorId: cat.id, roleTypeId: roleId });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toBe("unavailable");
  });

  it("publishing confirms office-managed people, asks the others, and names anyone with no app or email", async () => {
    const dee = await person("Dee");
    await repos.tenant.instructor.update(ctx, dee.id, { email: null });
    const eve = await person("Eve", { managedBy: "staff" });
    await setAvailability(repos, ctx, eve.id, nextMonday, "AM", "available");
    const { courseId } = await createCourseWithSessions(repos, ctx, { name: "Kids club", courseTypeId, sessions: [{ date: nextMonday, slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    // Put Dee on as "assigned" directly (as before the centre switched to office-managed).
    await repos.tenant.courseStaff.insert(ctx, { courseId, instructorId: dee.id, roleTypeId: roleId, status: "assigned" });
    expect((await assignStaff(repos, ctx, { courseId, instructorId: eve.id, roleTypeId: roleId })).ok).toBe(true);

    const r = await publishWeek(repos, ctx, nextMonday);
    expect(r.instructorsNotified).toBe(2);
    expect(r.askedToConfirm).toBe(1);
    expect(r.unreachable).toEqual(["Dee"]);
    const statuses = Object.fromEntries((await repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId))).map((a) => [a.instructorId, a.status]));
    expect(statuses[dee.id]).toBe("confirmed");
    expect(statuses[eve.id]).toBe("assigned");
  });

  it("sets and clears many people's slots at once, keeps approved leave, and ignores another centre's people", async () => {
    const people = [await person("Fin"), await person("Gus"), await person("Hal")];
    await markLeaveBusy(repos, ctx, people[0]!.id, nextMonday, nextMonday);
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(nextMonday, d));
    const entries = people.flatMap((p) => days.flatMap((date) => (["AM", "PM", "EV"] as const).map((slot) => ({ instructorId: p.id, date, slot, status: "unavailable" as const }))));
    entries.push({ instructorId: "someone-elses-person", date: nextMonday, slot: "AM", status: "unavailable" });

    const r = await setAvailabilityBulk(repos, ctx, entries);
    expect(r.keptLeave).toBe(3); // Fin's leave day: AM, PM and EV stay as leave
    expect(r.set).toBe(3 * 21 - 3);
    const rows = await repos.tenant.availability.list(ctx, eq(availabilityTable.setBy, "office"));
    expect(rows.length).toBe(60);
    expect((await repos.tenant.availability.list(ctx, eq(availabilityTable.setBy, "leave"))).length).toBe(3);

    // Clear Gus's whole week again: back to free (office-managed).
    const cleared = await setAvailabilityBulk(repos, ctx, days.flatMap((date) => (["AM", "PM", "EV"] as const).map((slot) => ({ instructorId: people[1]!.id, date, slot, status: null }))));
    expect(cleared.cleared).toBe(21);
    const matrix = await getWeekAvailabilityMatrix(repos, ctx, nextMonday);
    expect(matrix.rows.find((x) => x.instructorId === people[1]!.id)!.cells[`${nextMonday}|PM`]).toBe("available");
    expect(matrix.rows.find((x) => x.instructorId === people[2]!.id)!.cells[`${nextMonday}|PM`]).toBe("unavailable");

    // Usual week: Hal is never in on Sundays.
    await setAvailabilityBulk(repos, ctx, (["AM", "PM", "EV"] as const).map((slot) => ({ instructorId: people[2]!.id, weekday: 0, slot, status: "unavailable" as const })));
    const sunday = addDays(nextMonday, 13);
    const m2 = await getWeekAvailabilityMatrix(repos, ctx, addDays(nextMonday, 7));
    expect(m2.rows.find((x) => x.instructorId === people[2]!.id)!.sources[`${sunday}|AM`]).toBe("pattern");
  });

  it("refuses more than the per-request maximum", async () => {
    const a = await person("Ivy");
    const many = Array.from({ length: 8001 }, (_, i) => ({ instructorId: a.id, date: addDays(nextMonday, i % 28), slot: "AM" as const, status: "unavailable" as const }));
    await expect(setAvailabilityBulk(repos, ctx, many)).rejects.toThrow(/Too many/);
  });
});
