import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createCourseWithSessions } from "@/lib/services/courses";
import { getKitRules, setCourseTypeKit, suggestedKit } from "@/lib/services/kit";
import { equipmentContextForCourse, setCourseEquipment } from "@/lib/services/course-resources";
import { equipmentSummary } from "@/lib/domain/kit";
import { maintenanceDetail } from "@/lib/domain/problems";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("kit rules and equipment warnings", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let courseTypeId: string;
  let picoId: string;
  let ribId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Kit", slug: "kit", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    picoId = (await repos.tenant.equipmentType.insert(ctx, { name: "Pico", inventoryTracked: false, quantity: 12, active: true })).id;
    ribId = (await repos.tenant.equipmentType.insert(ctx, { name: "RIB", inventoryTracked: true, quantity: null, active: true })).id;
  });

  it("are off by default: rules can be saved but a new course gets no kit until they are switched on", async () => {
    const saved = await setCourseTypeKit(repos, ctx, courseTypeId, [{ equipmentTypeId: picoId, quantity: 1, perStudents: 2 }, { equipmentTypeId: "not-ours", quantity: 1 }]);
    expect(saved.ok && saved.rules).toEqual([{ equipmentTypeId: picoId, quantity: 1, perStudents: 2 }]);
    expect((await getKitRules(repos, ctx)).get(courseTypeId)).toHaveLength(1);
    expect(await suggestedKit(repos, ctx, courseTypeId, 7)).toEqual([]);
    const { courseId: off } = await createCourseWithSessions(repos, ctx, { courseTypeId, name: "Off", capacity: 7, sessions: [{ date: "2027-05-01", slot: "AM" }] });
    expect((await repos.tenant.courseEquipment.list(ctx)).filter((k) => k.courseId === off)).toHaveLength(0);

    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    expect(st.useKitRules).toBe(false);
    await repos.tenant.orgSettings.update(ctx, st.id, { useKitRules: true });
    const { courseId: on } = await createCourseWithSessions(repos, ctx, { courseTypeId, name: "On", capacity: 7, sessions: [{ date: "2027-05-02", slot: "AM" }] });
    expect((await repos.tenant.courseEquipment.list(ctx)).filter((k) => k.courseId === on).map((k) => [k.equipmentTypeId, k.quantity])).toEqual([[picoId, 4]]);
  });

  it("warn when picking: units on an overlapping course, and bulk kit others need at the same time", async () => {
    const rib = await repos.tenant.equipment.insert(ctx, { equipmentTypeId: ribId, name: "RIB 1", identifier: null, status: "available" });
    const { courseId: a } = await createCourseWithSessions(repos, ctx, { courseTypeId, name: "Stage 2", sessions: [{ date: "2027-06-05", slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    const { courseId: b } = await createCourseWithSessions(repos, ctx, { courseTypeId, name: "Taster", sessions: [{ date: "2027-06-05", slot: "AM", startTime: "10:00", endTime: "11:00" }] });
    const { courseId: c } = await createCourseWithSessions(repos, ctx, { courseTypeId, name: "Evening", sessions: [{ date: "2027-06-05", slot: "EV", startTime: "18:00", endTime: "20:00" }] });
    expect((await setCourseEquipment(repos, ctx, b, { unitIds: [rib.id], bulk: [{ equipmentTypeId: picoId, quantity: 10 }] })).ok).toBe(true);
    expect(await equipmentContextForCourse(repos, ctx, a)).toEqual({ unitBusy: { [rib.id]: "Taster" }, typeOthers: { [ribId]: 1, [picoId]: 10 } });
    expect(await equipmentContextForCourse(repos, ctx, c)).toEqual({ unitBusy: {}, typeOthers: {} });
  });

  it("maintenance reads plainly and the page counts each type", () => {
    expect(maintenanceDetail({ name: "Safety boat 2", maintenanceNote: "outboard", backOn: "2026-10-14" })).toBe("Safety boat 2 is in maintenance (outboard), back 14 Oct");
    expect(maintenanceDetail({ name: "Pico 3" })).toBe("Pico 3 is in maintenance");
    expect(equipmentSummary(
      [{ id: "p", name: "Picos", quantity: 12, inventoryTracked: false }, { id: "r", name: "RIBs", quantity: null, inventoryTracked: true }, { id: "x", name: "Kayaks", quantity: null, inventoryTracked: false }],
      [{ equipmentTypeId: "r", status: "available" }, { equipmentTypeId: "r", status: "maintenance" }, { equipmentTypeId: "r", status: "retired" }],
    )).toEqual(["Picos: 12", "RIBs: 2 (1 available, 1 in maintenance)"]);
  });
});
