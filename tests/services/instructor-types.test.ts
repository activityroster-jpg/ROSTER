import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({ deleteDocument: vi.fn(async () => {}) }));

import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { createInstructorType, setInstructorTypes, syncPlacesForType } from "@/lib/services/instructor-types";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { deleteDocument } from "@/lib/r2";
import { auditLog, instructorCourseType, qualification } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("instructor types on someone's profile", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let personId: string;
  const typeId = async (code: string) => (await repos.tenant.qualificationType.list(ctx)).find((q) => q.code === code)!.id;
  const courseId = async (name: string) => (await repos.tenant.courseType.list(ctx)).find((c) => c.name === name)!.id;
  const held = async () => (await repos.tenant.qualification.list(ctx, eq(qualification.instructorId, personId))).map((q) => q.qualificationTypeId);

  beforeEach(async () => {
    const { db } = createTestDb();
    ({ repos, ctx } = await seedFullOrg(db, { name: "Types", slug: "types", jurisdiction: "england" }));
    personId = (await repos.tenant.instructor.insert(ctx, { name: "Sam Types", email: null, phone: null, employmentType: "employed", status: "active" })).id;
  });

  it("adds ticked types, removes unticked ones with their uploaded copy, and the courses follow the course map", async () => {
    const [di, pbi, sbc] = await Promise.all([typeId("DI"), typeId("PBI"), typeId("SBC")]);
    const daySailing = await courseId("Day Sailing");
    const r1 = await setInstructorTypes(repos, ctx, { instructorId: personId, typeIds: [di, pbi], approvedCourseIds: [daySailing] });
    expect(r1).toEqual({ ok: true, added: 2, removed: 0, approvals: 1 });
    expect((await held()).sort()).toEqual([di, pbi].sort());

    const teaches = async () => ((await getTeachingMatrix(repos, ctx)).get(personId) ?? []).map((c) => c.name);
    expect(await teaches()).toEqual(expect.arrayContaining(["Start Sailing (Level 1)", "Day Sailing", "Powerboat Level 1"]));
    expect(await teaches()).not.toContain("Safety Boat Course"); // needs the Safety Boat certificate too

    // A copy was uploaded for the powerboat licence; unticking it removes the record and the file.
    const pbiRow = (await repos.tenant.qualification.list(ctx, eq(qualification.instructorId, personId))).find((q) => q.qualificationTypeId === pbi)!;
    await repos.tenant.qualification.update(ctx, pbiRow.id, { docKey: `org/${ctx.organisationId}/doc.pdf` });
    const r2 = await setInstructorTypes(repos, ctx, { instructorId: personId, typeIds: [di, sbc], approvedCourseIds: [] });
    expect(r2).toEqual({ ok: true, added: 1, removed: 1, approvals: 0 });
    expect(deleteDocument).toHaveBeenCalledWith(ctx, `org/${ctx.organisationId}/doc.pdf`);
    expect((await held()).sort()).toEqual([di, sbc].sort());
    expect(await repos.tenant.instructorCourseType.list(ctx, eq(instructorCourseType.instructorId, personId))).toEqual([]);
    expect(await teaches()).not.toContain("Day Sailing"); // the approval went with the save

    const audits = await repos.tenant.auditLog.list(ctx, eq(auditLog.action, "set_instructor_types"));
    expect(audits).toHaveLength(2);
  });

  it("leaves a retired type someone holds alone, and ignores ids that aren't this centre's", async () => {
    const [di, ai] = await Promise.all([typeId("DI"), typeId("AI")]);
    await setInstructorTypes(repos, ctx, { instructorId: personId, typeIds: [di, ai], approvedCourseIds: [] });
    await repos.tenant.qualificationType.update(ctx, ai, { active: false });
    const r = await setInstructorTypes(repos, ctx, { instructorId: personId, typeIds: [di, "not-a-type"], approvedCourseIds: ["not-a-course"] });
    expect(r).toEqual({ ok: true, added: 0, removed: 0, approvals: 0 });
    expect((await held()).sort()).toEqual([di, ai].sort());
  });

  it("gives a centre's own instructor type a place on courses, kept in step when renamed or retired", async () => {
    const own = await createInstructorType(repos, ctx, { name: "Kayak Coach", discipline: "kayak_coach" });
    const place = (await repos.tenant.roleType.list(ctx)).find((r) => r.id === own.placeId)!;
    expect(place).toMatchObject({ name: "Kayak Coach", qualificationTypeId: own.id, countsTowardRatio: true, active: true });
    await syncPlacesForType(repos, ctx, own.id, { name: "Kayak Lead", active: false });
    expect(await repos.tenant.roleType.findById(ctx, place.id)).toMatchObject({ name: "Kayak Lead", active: false });
    // A held certificate (no ladder) gets no place.
    expect((await createInstructorType(repos, ctx, { name: "Radio Licence", discipline: null })).placeId).toBeNull();
  });
});
