import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({ deleteDocument: vi.fn(async () => {}) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { deleteInstructorIfUnreferenced, deleteOrRetireEquipment, deleteOrRetireEquipmentType, deleteOrRetireLocation, instructorReferences } from "@/lib/services/retire";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("delete or retire: gone when nothing ever used it, retired otherwise", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
  });

  it("locations: the fixture's (on a course) is retired, a fresh one is deleted", async () => {
    const used = (await repos.tenant.location.list(ctx))[0]!;
    const lt = (await repos.tenant.locationType.list(ctx))[0]!;
    const fresh = await repos.tenant.location.insert(ctx, { locationTypeId: lt.id, name: "Slipway", active: true });
    const r1 = await deleteOrRetireLocation(repos, ctx, used.id);
    expect(r1.outcome).toBe("retired");
    expect((await repos.tenant.location.findById(ctx, used.id))!.active).toBe(false);
    const r2 = await deleteOrRetireLocation(repos, ctx, fresh.id);
    expect(r2.outcome).toBe("deleted");
    expect(await repos.tenant.location.findById(ctx, fresh.id)).toBeNull();
    expect((await deleteOrRetireLocation(repos, ctx, "nope")).outcome).toBe("not_found");
    const audit = await repos.tenant.auditLog.list(ctx);
    expect(audit.some((a) => a.entity === "location" && a.action === "delete")).toBe(true);
    expect(audit.some((a) => a.entity === "location" && a.action === "deactivate")).toBe(true);
  });

  it("equipment units and types follow the same rule", async () => {
    const unit = (await repos.tenant.equipment.list(ctx))[0]!; // the fixture course uses it
    const type = (await repos.tenant.equipmentType.list(ctx))[0]!;
    const spare = await repos.tenant.equipment.insert(ctx, { equipmentTypeId: type.id, name: "Spare", identifier: "S1", status: "available" });
    expect((await deleteOrRetireEquipment(repos, ctx, unit.id)).outcome).toBe("retired");
    expect((await repos.tenant.equipment.findById(ctx, unit.id))!.status).toBe("retired");
    expect((await deleteOrRetireEquipment(repos, ctx, spare.id)).outcome).toBe("deleted");
    // The type still has a unit and course-type rules pointing at it: retired.
    const t1 = await deleteOrRetireEquipmentType(repos, ctx, type.id);
    expect(t1.outcome).toBe("retired");
    if (t1.outcome === "retired") expect(t1.because).toMatch(/unit/);
    const emptyType = await repos.tenant.equipmentType.insert(ctx, { name: "Buoys", inventoryTracked: false, active: true });
    expect((await deleteOrRetireEquipmentType(repos, ctx, emptyType.id)).outcome).toBe("deleted");
  });

  it("instructors: a rostered person is never deleted here; a never-used one goes with their certs and login", async () => {
    const rostered = (await repos.tenant.instructor.list(ctx))[0]!;
    expect(await instructorReferences(repos, ctx, rostered.id)).toEqual(expect.arrayContaining([expect.stringMatching(/rostered on 1 course/)]));
    const kept = await deleteInstructorIfUnreferenced(repos, ctx, rostered.id);
    expect(kept.outcome).toBe("retired");
    expect(await repos.tenant.instructor.findById(ctx, rostered.id)).not.toBeNull();

    const grade = (await repos.tenant.qualificationType.list(ctx))[0]!;
    const user = await repos.control.createUser({ email: "fresh@alpha.test", name: "Fresh" });
    await repos.control.createMembership({ userId: user.id, organisationId: ctx.organisationId, role: "instructor" });
    const fresh = await repos.tenant.instructor.insert(ctx, { name: "Fresh", email: "fresh@alpha.test", employmentType: "volunteer", status: "active", userId: user.id });
    await repos.tenant.qualification.insert(ctx, { instructorId: fresh.id, qualificationTypeId: grade.id, certNo: "X", issueDate: "2025-01-01", expiryDate: null, verified: false, docKey: `${ctx.organisationId}/docs/x.pdf` });
    expect(await instructorReferences(repos, ctx, fresh.id)).toEqual([]);
    const gone = await deleteInstructorIfUnreferenced(repos, ctx, fresh.id);
    expect(gone.outcome).toBe("deleted");
    expect(await repos.tenant.instructor.findById(ctx, fresh.id)).toBeNull();
    expect((await repos.tenant.qualification.list(ctx)).some((q) => q.instructorId === fresh.id)).toBe(false);
    expect(await repos.control.membershipFor(user.id, ctx.organisationId)).toBeNull();
  });
});
