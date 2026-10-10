import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { assignStaff } from "@/lib/services/assignment";
import { repriceUnapprovedLines } from "@/lib/services/hours";
import { clearPayRate, listCentreRates, setPayRate } from "@/lib/services/pay-rates";
import { createCourseWithSessions } from "@/lib/services/courses";
import { hoursRecord as hoursRecordTable } from "@/lib/db/schema";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * Settings → Pay rates: standard rates by role (and role on a course), people's
 * own rates and their course rates, all feeding the payroll lines.
 */
describe("pay rates from Settings", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let typeA: string;
  let typeB: string;
  let amyId: string;

  beforeEach(async () => {
    ({ repos, ctx } = await seedFullOrg(createTestDb().db, { name: "Pay", slug: "pay", jurisdiction: "england" }));
    roleId = (await repos.tenant.roleType.list(ctx)).find((r) => r.countsTowardRatio)!.id;
    const types = await repos.tenant.courseType.list(ctx);
    typeA = types[0]!.id;
    typeB = types[1]!.id;
    amyId = (await repos.tenant.instructor.insert(ctx, { name: "Amy", email: null, employmentType: "freelance", status: "active" })).id;
  });

  const rosterOn = async (courseTypeId: string, date: string) => {
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date, slot: "AM", startTime: "09:00", endTime: "12:00" }] });
    const r = await assignStaff(repos, ctx, { courseId, instructorId: amyId, roleTypeId: roleId, override: true });
    expect(r.ok).toBe(true);
    return courseId;
  };
  const amysLines = async () => (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, amyId))).map((l) => [l.rate, l.payUnit]);

  it("someone with no rate of their own is paid the role's standard rate, or the role's rate on that course", async () => {
    await setPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, unit: "hour", rate: 15 });
    await setPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, courseTypeId: typeB, unit: "day", rate: 95 });
    await rosterOn(typeA, "2027-05-03");
    await rosterOn(typeB, "2027-05-04");
    expect((await amysLines()).sort()).toEqual([[15, "hour"], [95, "day"]]);
    expect(await listCentreRates(repos, ctx)).toHaveLength(2);
  });

  it("their own rate beats the standard ones, and their course rate beats their own", async () => {
    await setPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, unit: "hour", rate: 15 });
    await setPayRate(repos, ctx, { instructorId: amyId, roleTypeId: null, unit: "hour", rate: 18 });
    await setPayRate(repos, ctx, { instructorId: amyId, roleTypeId: null, courseTypeId: typeB, unit: "session", rate: 60 });
    await rosterOn(typeA, "2027-05-03");
    await rosterOn(typeB, "2027-05-04");
    expect((await amysLines()).sort()).toEqual([[18, "hour"], [60, "session"]]);
  });

  it("lines with no rate pick one up when it's set; dated re-pricing leaves earlier and approved lines alone", async () => {
    await rosterOn(typeA, "2027-05-03");
    await rosterOn(typeA, "2027-05-10");
    expect(await amysLines()).toEqual([[null, "hour"], [null, "hour"]]);

    await setPayRate(repos, ctx, { instructorId: null, roleTypeId: null, unit: "hour", rate: 12 }); // everyone else
    expect(await repriceUnapprovedLines(repos, ctx, { instructorIds: null, onlyUnpriced: true })).toBe(2);
    expect(await amysLines()).toEqual([[12, "hour"], [12, "hour"]]);

    // Approve the first line, then raise the rate from the 5th.
    const first = (await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, amyId)))[0]!;
    await repos.tenant.hoursRecord.update(ctx, first.id, { approved: true });
    await setPayRate(repos, ctx, { instructorId: amyId, roleTypeId: null, unit: "hour", rate: 14 });
    expect(await repriceUnapprovedLines(repos, ctx, { instructorIds: [amyId], fromIso: "2027-05-05" })).toBe(1);
    const lines = await repos.tenant.hoursRecord.list(ctx, eq(hoursRecordTable.instructorId, amyId));
    expect(lines.find((l) => l.id === first.id)!.rate).toBe(12);
    expect(lines.find((l) => l.id !== first.id)!.rate).toBe(14);
  });

  it("setting the same rate again updates it, and clearing removes it", async () => {
    await setPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, courseTypeId: typeA, unit: "hour", rate: 15 });
    await setPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, courseTypeId: typeA, unit: "session", rate: 50 });
    const rates = await listCentreRates(repos, ctx);
    expect(rates.map((r) => [r.rate, r.unit])).toEqual([[50, "session"]]);
    expect(await clearPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, courseTypeId: typeA })).toBe(true);
    expect(await listCentreRates(repos, ctx)).toEqual([]);
    expect(await clearPayRate(repos, ctx, { instructorId: null, roleTypeId: roleId, courseTypeId: typeA })).toBe(false);
  });
});
