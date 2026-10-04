import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getCourseResources, getCourseStaffing, setCourseEquipment, setCourseLocations, setCourseStaffing, staffingViewFrom } from "@/lib/services/course-resources";
import { cleanRoleLines, derivedStaffRequired, staffingShortfallNote, suggestRoles } from "@/lib/domain/staffing";
import { findProblems } from "@/lib/services/problems";
import { createCourseWithSessions } from "@/lib/services/courses";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("staffing: one panel, staff required derived from the role lines", () => {
  const roles = [
    { id: "si", name: "Senior Instructor", countsTowardRatio: true, isSafetyCover: false, active: true },
    { id: "in", name: "Instructor", countsTowardRatio: true, isSafetyCover: false, active: true },
    { id: "sb", name: "Safety Boat", countsTowardRatio: false, isSafetyCover: true, active: true },
    { id: "old", name: "Retired role", countsTowardRatio: true, isSafetyCover: false, active: false },
  ];

  it("suggests the ratio's instructors plus safety cover, and derives the total", () => {
    expect(suggestRoles({ students: 12, ratio: 6, requiresSafetyBoat: true, roles })).toEqual([{ roleTypeId: "si", count: 2 }, { roleTypeId: "sb", count: 1 }]);
    expect(suggestRoles({ students: 0, ratio: 6, requiresSafetyBoat: false, roles })).toEqual([]);
    expect(cleanRoleLines([{ roleTypeId: "in", count: "2" }, { roleTypeId: "in", count: 1 }, { roleTypeId: "", count: 5 }, { roleTypeId: "sb", count: 0 }])).toEqual([{ roleTypeId: "in", count: 3 }]);
    expect(derivedStaffRequired([])).toBeNull();
    expect(derivedStaffRequired([{ roleTypeId: "in", count: 2 }, { roleTypeId: "sb", count: 1 }])).toBe(3);
    expect(staffingShortfallNote({ students: 12, ratio: 6, requiresSafetyBoat: true, roles }, [{ roleTypeId: "in", count: 1 }])).toMatch(/needs 2 ratio-counting instructors; you have 1; this course type needs safety-boat cover/);
    expect(staffingShortfallNote({ students: 12, ratio: 6, requiresSafetyBoat: false, roles }, [{ roleTypeId: "in", count: 2 }])).toBeNull();
    expect(staffingShortfallNote({ students: 12, ratio: 6, requiresSafetyBoat: true, roles }, [])).toBeNull(); // no lines: the ratio alone decides
  });

  it("builds the view with filled counts and falls back to the ratio when there are no lines", () => {
    const view = staffingViewFrom({ capacity: 10, ratio: 4, staffRequired: null }, { requiresSafetyBoat: false }, roles.map((r) => ({ ...r, code: r.id, organisationId: "o", createdAt: new Date(), updatedAt: new Date(), isFirstAider: false, sortOrder: 0 })) as never, [], [{ roleTypeId: "in", status: "assigned" }]);
    expect(view.required).toBe(3);
    expect(view.fromRoles).toBe(false);
    expect(view.assigned).toBe(1);
    const withLines = staffingViewFrom({ capacity: 10, ratio: 4, staffRequired: 2 }, { requiresSafetyBoat: false }, roles.map((r) => ({ ...r, code: r.id, organisationId: "o", createdAt: new Date(), updatedAt: new Date(), isFirstAider: false, sortOrder: 0 })) as never, [{ roleTypeId: "in", count: 2 }], [{ roleTypeId: "in", status: "confirmed" }, { roleTypeId: "in", status: "declined" }]);
    expect(withLines.lines).toEqual([{ roleTypeId: "in", roleName: "Instructor", count: 2, filled: 1 }]);
    expect(withLines.required).toBe(2);
    expect(withLines.fromRoles).toBe(true);
  });
});

describe("course resources and staffing against the database", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let courseId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    courseId = (await repos.tenant.course.list(ctx))[0]!.id;
  });

  it("locations and equipment are editable after creation; unknown ids are dropped", async () => {
    const lt = (await repos.tenant.locationType.list(ctx))[0]!;
    const extra = await repos.tenant.location.insert(ctx, { locationTypeId: lt.id, name: "Pontoon B", active: true });
    const before = await getCourseResources(repos, ctx, courseId);
    expect(before.locationIds).toHaveLength(1);
    const r = await setCourseLocations(repos, ctx, courseId, [extra.id, "not-ours"]);
    expect(r.ok).toBe(true);
    expect((await getCourseResources(repos, ctx, courseId)).locationIds).toEqual([extra.id]);

    const type = (await repos.tenant.equipmentType.list(ctx))[0]!;
    const unit = (await repos.tenant.equipment.list(ctx))[0]!;
    const r2 = await setCourseEquipment(repos, ctx, courseId, { unitIds: [unit.id, unit.id, "nope"], bulk: [{ equipmentTypeId: type.id, quantity: 4 }, { equipmentTypeId: "nope", quantity: 2 }] });
    expect(r2.ok).toBe(true);
    let res = await getCourseResources(repos, ctx, courseId);
    expect(res.unitIds).toEqual([unit.id]);
    expect(res.bulk).toEqual([{ equipmentTypeId: type.id, quantity: 4 }]);
    // Change the quantity in place, drop the unit.
    await setCourseEquipment(repos, ctx, courseId, { unitIds: [], bulk: [{ equipmentTypeId: type.id, quantity: 6 }] });
    res = await getCourseResources(repos, ctx, courseId);
    expect(res.unitIds).toEqual([]);
    expect(res.bulk).toEqual([{ equipmentTypeId: type.id, quantity: 6 }]);
    expect((await repos.tenant.courseEquipment.list(ctx)).filter((e) => e.courseId === courseId)).toHaveLength(1);
    expect((await repos.tenant.auditLog.list(ctx)).some((a) => a.action === "set_course_equipment")).toBe(true);
  });

  it("the staffing panel saves students and role lines and derives staff required", async () => {
    const roles = await repos.tenant.roleType.list(ctx);
    const counting = roles.find((r) => r.countsTowardRatio) ?? roles[0]!;
    const view = await getCourseStaffing(repos, ctx, courseId);
    expect(view).not.toBeNull();
    const r = await setCourseStaffing(repos, ctx, courseId, { students: 9, roles: [{ roleTypeId: counting.id, count: 2 }, { roleTypeId: "nope", count: 3 }] });
    expect(r.ok).toBe(true);
    const course = (await repos.tenant.course.findById(ctx, courseId))!;
    expect(course.capacity).toBe(9);
    expect(course.staffRequired).toBe(2);
    const after = (await getCourseStaffing(repos, ctx, courseId))!;
    expect(after.lines).toEqual([{ roleTypeId: counting.id, roleName: counting.name, count: 2, filled: 1 }]);
    expect(after.fromRoles).toBe(true);
    // Clearing the lines hands the decision back to the ratio.
    await setCourseStaffing(repos, ctx, courseId, { students: 9, roles: [] });
    expect((await repos.tenant.course.findById(ctx, courseId))!.staffRequired).toBeNull();
    expect((await repos.tenant.courseRoleRequirement.list(ctx)).filter((x) => x.courseId === courseId)).toEqual([]);
  });

  it("the problems list flags a slot that needs more of an equipment type than the centre owns, unless the check is off", async () => {
    const type = (await repos.tenant.equipmentType.list(ctx))[0]!;
    await repos.tenant.equipmentType.update(ctx, type.id, { quantity: 5 });
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const { courseId: a } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2027-05-01", slot: "AM" }] });
    const { courseId: b } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: "2027-05-01", slot: "AM" }, { date: "2027-05-02", slot: "AM" }] });
    await setCourseEquipment(repos, ctx, a, { unitIds: [], bulk: [{ equipmentTypeId: type.id, quantity: 3 }] });
    await setCourseEquipment(repos, ctx, b, { unitIds: [(await repos.tenant.equipment.list(ctx))[0]!.id], bulk: [{ equipmentTypeId: type.id, quantity: 2 }] });
    let report = await findProblems(repos, ctx, { from: "2027-05-01", to: "2027-05-03" });
    const short = report.problems.filter((p) => p.kind === "equipment-short");
    expect(short).toHaveLength(1); // Saturday AM: 3 + 2 + 1 tracked unit = 6 of 5; Sunday is fine
    expect(short[0]).toMatchObject({ date: "2027-05-01", slot: "AM", severity: "warn" });
    expect(short[0]!.detail).toMatch(/need 6 × .*; you have 5/);
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, st.id, { checkEquipmentQuantities: false });
    report = await findProblems(repos, ctx, { from: "2027-05-01", to: "2027-05-03" });
    expect(report.problems.filter((p) => p.kind === "equipment-short")).toEqual([]);
  });
});
