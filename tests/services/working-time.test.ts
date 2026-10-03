import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { assignStaff } from "@/lib/services/assignment";
import { checkWorkingTime, registerToCsv, termRangesOf, youngWorkerRegister } from "@/lib/services/working-time";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * The fixture course has one 3-hour session on Monday 5 January 2026, 09:00–12:00
 * UTC. With no term dates set every week counts as term time, so for a GB
 * school-age child (15, still at school) that is a school day capped at 2 hours.
 */
describe("working-time checks on assignment", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseId: string;

  const addInstructor = (name: string, dateOfBirth: string | null) =>
    repos.tenant.instructor.insert(ctx, { name, email: `${name.toLowerCase()}@a.test`, employmentType: "employed", status: "active", dateOfBirth });
  const setMode = async (mode: "warn" | "block_override" | "block") => {
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { workingTimeMode: mode });
  };

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    roleId = (await repos.tenant.roleType.list(ctx))[0]!.id;
    courseId = (await repos.tenant.course.list(ctx))[0]!.id;
  });

  it("blocks a school-age child on a 3-hour school day (default: block with override)", async () => {
    const kid = await addInstructor("Kid", "2010-06-01");
    const res = await assignStaff(repos, ctx, { courseId, instructorId: kid.id, roleTypeId: roleId });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("working-time");
      expect(res.noOverride).toBeFalsy();
      expect(res.detail).toMatch(/school day/i);
    }
    const over = await assignStaff(repos, ctx, { courseId, instructorId: kid.id, roleTypeId: roleId, override: true, overrideNote: "Parent and LA permit agreed" });
    expect(over.ok).toBe(true);
    if (over.ok) expect(over.overridden).toBe(true);
    const audit = await repos.tenant.auditLog.list(ctx);
    expect(audit.some((a) => a.action === "assign_staff_override")).toBe(true);
  });

  it("warn mode assigns but returns the finding as a warning", async () => {
    await setMode("warn");
    const kid = await addInstructor("Kid", "2010-06-01");
    const res = await assignStaff(repos, ctx, { courseId, instructorId: kid.id, roleTypeId: roleId });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.overridden).toBe(false);
      expect(res.warnings.join(" ")).toMatch(/school day/i);
    }
  });

  it("block mode refuses even with an override", async () => {
    await setMode("block");
    const kid = await addInstructor("Kid", "2010-06-01");
    const res = await assignStaff(repos, ctx, { courseId, instructorId: kid.id, roleTypeId: roleId, override: true, overrideNote: "please" });
    expect(res.ok).toBe(false);
    if (!res.ok) { expect(res.reason).toBe("working-time"); expect(res.noOverride).toBe(true); }
  });

  it("a 16–17-year-old within the limits, an adult and someone with no DOB are all fine", async () => {
    for (const [name, dob] of [["Teen", "2009-03-01"], ["Adult", "1990-01-01"], ["Nodob", null]] as const) {
      const who = await addInstructor(name, dob);
      const res = await assignStaff(repos, ctx, { courseId, instructorId: who.id, roleTypeId: roleId });
      expect(res.ok, name).toBe(true);
      if (res.ok) expect(res.warnings.filter((w) => /over|before|after/.test(w))).toEqual([]);
    }
  });

  it("term dates switch a week to the holiday caps", async () => {
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    // Term runs later in January, so 5 January is a holiday week: 8h/day allowed.
    await repos.tenant.orgSettings.update(ctx, st.id, { termDates: JSON.stringify([{ from: "2026-01-12", to: "2026-03-27", label: "Spring" }]) });
    const kid = await addInstructor("Kid", "2010-06-01");
    const check = await checkWorkingTime(repos, ctx, { instructorId: kid.id, courseId });
    expect(check.active).toBe(true);
    expect(check.blocks).toEqual([]);
  });

  it("term-date JSON that is malformed is ignored rather than crashing", () => {
    expect(termRangesOf({ termDates: "not json" })).toEqual([]);
    expect(termRangesOf({ termDates: JSON.stringify([{ from: "2026-01-01" }, { from: "2026-01-01", to: "2026-02-01" }]) })).toEqual([{ from: "2026-01-01", to: "2026-02-01", label: undefined }]);
    expect(termRangesOf(null)).toEqual([]);
  });

  it("the young-worker register lists the child's sessions and logs the view", async () => {
    await setMode("warn");
    const kid = await addInstructor("Kid", "2010-06-01");
    await assignStaff(repos, ctx, { courseId, instructorId: kid.id, roleTypeId: roleId });
    const rows = await youngWorkerRegister(repos, ctx, "2026-01-01", "2026-01-31");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-01-05", instructor: "Kid", age: 15, hours: 3, status: "assigned" });
    const csv = registerToCsv(rows);
    expect(csv.split("\n")[0]).toMatch(/^Date,Instructor,Age on day/);
    const audit = await repos.tenant.auditLog.list(ctx);
    expect(audit.some((a) => a.action === "view_young_worker_register")).toBe(true);
  });
});
