import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({ deleteDocument: vi.fn(async () => {}) }));
vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? "") }));
// Unsealing needs the Worker secret; in tests the sealed fields are passed through as-is.
vi.mock("@/lib/services/protected-contacts", () => ({
  readProtectedContacts: vi.fn(async (_r: unknown, _c: unknown, i: Record<string, string | null>) => ({
    guardianName: i.guardianName ?? "", guardianPhone: i.guardianPhone ?? "", guardianEmail: i.guardianEmail ?? "",
    emergencyName: i.emergencyName ?? "", emergencyPhone: i.emergencyPhone ?? "", emergencyRelationship: i.emergencyRelationship ?? "",
  })),
}));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { anonymisePerson, auditLogCsv, exportPerson, personExportToCsv, replayDeletions, setRestriction } from "@/lib/services/person-data";
import { assignStaff } from "@/lib/services/assignment";
import { notifyInstructor } from "@/lib/services/notifications";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext, TenantContext } from "@/lib/tenant/context";

describe("per-person data rights", () => {
  let repos: Repositories;
  let sys: SystemTenantContext;
  let ctx: TenantContext;
  let instructorId: string;
  let ownerId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; sys = seeded.ctx;
    ownerId = (await repos.control.userByEmail("owner@alpha.test"))!.id;
    ctx = { organisationId: sys.organisationId, slug: sys.slug, userId: ownerId, role: "admin" } as TenantContext;
    instructorId = (await repos.tenant.instructor.list(sys))[0]!.id;
    await repos.tenant.instructor.update(sys, instructorId, { dateOfBirth: "1990-05-05", phone: "07000 000000" });
  });

  it("exports everything about a person and records it", async () => {
    const data = await exportPerson(repos, ctx, instructorId);
    expect(data).not.toBeNull();
    expect(data!.person.name).toBeTruthy();
    expect(data!.person).not.toHaveProperty("organisationId");
    expect(data!.assignments.length).toBeGreaterThan(0);
    expect(data!.hours.length).toBeGreaterThan(0);
    const csv = personExportToCsv(data!);
    expect(csv).toMatch(/^Exported /);
    expect(csv).toMatch(/# Assignments/);
    expect((await repos.tenant.auditLog.list(sys)).some((a) => a.action === "export_person" && a.entityId === instructorId)).toBe(true);
  });

  it("restriction blocks rostering and notifications until lifted", async () => {
    await setRestriction(repos, ctx, instructorId, true, "Dispute over hours");
    const roleId = (await repos.tenant.roleType.list(sys))[0]!.id;
    const courseId = (await repos.tenant.course.list(sys))[0]!.id;
    const res = await assignStaff(repos, sys, { courseId, instructorId, roleTypeId: roleId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.detail).toMatch(/restricted/i);
    expect(await notifyInstructor(repos, sys, instructorId, { title: "x", body: "y" })).toBeNull();
    await setRestriction(repos, ctx, instructorId, false, null);
    expect((await repos.tenant.instructor.findById(sys, instructorId))!.restrictedAt).toBeNull();
    const actions = (await repos.tenant.auditLog.list(sys)).map((a) => a.action);
    expect(actions).toContain("restrict_instructor");
    expect(actions).toContain("unrestrict_instructor");
  });

  it("anonymises with linked records, logs it, and a replay re-applies it after a 'restore'", async () => {
    const before = (await repos.tenant.instructor.findById(sys, instructorId))!;
    const res = await anonymisePerson(repos, ctx, instructorId);
    expect(res.ok).toBe(true);
    const after = (await repos.tenant.instructor.findById(sys, instructorId))!;
    expect(after.name).toBe("Former staff member");
    expect(after.email).toBeNull(); expect(after.phone).toBeNull(); expect(after.dateOfBirth).toBeNull();
    expect(after.anonymisedAt).not.toBeNull();
    expect((await repos.tenant.qualification.list(sys)).filter((q) => q.instructorId === instructorId)).toHaveLength(0);
    expect((await repos.tenant.availability.list(sys)).filter((a) => a.instructorId === instructorId)).toHaveLength(0);
    // Roster and payroll history stay.
    expect((await repos.tenant.courseStaff.list(sys)).some((s) => s.instructorId === instructorId)).toBe(true);
    expect((await repos.tenant.hoursRecord.list(sys)).some((h) => h.instructorId === instructorId)).toBe(true);
    const log = await repos.tenant.deletionLog.list(sys);
    expect(log).toHaveLength(1);
    expect(log[0]!.subjectId).toBe(instructorId);
    expect(JSON.stringify(log[0])).not.toContain(before.name);
    // Second attempt is refused.
    expect((await anonymisePerson(repos, ctx, instructorId)).ok).toBe(false);
    // Simulate a restore: the old details come back.
    await repos.tenant.instructor.update(sys, instructorId, { name: before.name, email: before.email, phone: before.phone, anonymisedAt: null });
    const replay = await replayDeletions(repos, sys);
    expect(replay).toEqual({ checked: 1, reapplied: 1 });
    expect((await repos.tenant.instructor.findById(sys, instructorId))!.name).toBe("Former staff member");
    expect(await repos.tenant.deletionLog.list(sys)).toHaveLength(1);
  });

  it("exports the change log as CSV for a date range", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const csv = await auditLogCsv(repos, ctx, "2020-01-01", today);
    expect(csv.split("\n")[0]).toMatch(/^When \(UTC\),Actor user id,Action/);
    expect(csv.split("\n").length).toBeGreaterThan(2);
  });
});
