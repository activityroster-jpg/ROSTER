import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { assignStaff } from "@/lib/services/assignment";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

const H = 60 * 60 * 1000;

describe("assignStaff", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let roleId: string;
  let courseId: string;
  let fixtureInstructorId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    const roles = await repos.tenant.roleType.list(ctx);
    roleId = (roles.find((r) => r.countsTowardRatio) ?? roles[0]!).id;
    courseId = (await repos.tenant.course.list(ctx))[0]!.id;
    fixtureInstructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
  });

  it("blocks an instructor missing a mandatory compliance check", async () => {
    const newInstructor = await repos.tenant.instructor.insert(ctx, {
      name: "Unchecked",
      email: "u@a.test",
      employmentType: "freelance",
      status: "active",
    });
    const res = await assignStaff(repos, ctx, { courseId, instructorId: newInstructor.id, roleTypeId: roleId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-fit");
  });

  it("allows an admin override of a fit block, recording it to the audit log", async () => {
    const newInstructor = await repos.tenant.instructor.insert(ctx, {
      name: "Unchecked",
      email: "u2@a.test",
      employmentType: "freelance",
      status: "active",
    });
    const res = await assignStaff(repos, ctx, {
      courseId,
      instructorId: newInstructor.id,
      roleTypeId: roleId,
      override: true,
      overrideNote: "Cover confirmed verbally; cert in post",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.overridden).toBe(true);

    const audit = await repos.tenant.auditLog.list(ctx);
    expect(audit.some((a) => a.action === "assign_staff_override")).toBe(true);
  });

  it("blocks a double-booking on overlapping sessions", async () => {
    // A second course whose single session overlaps the fixture course's
    // 2026-01-05 AM session, then assign the already-fit fixture instructor.
    const courseType = (await repos.tenant.courseType.list(ctx))[0]!;
    const second = await repos.tenant.course.insert(ctx, {
      courseTypeId: courseType.id,
      name: "Clasher",
      capacity: 2,
      ratio: 2,
      status: "scheduled",
    });
    const start = Date.UTC(2026, 0, 5, 10, 0, 0); // overlaps 09:00–12:00
    await repos.tenant.courseSession.insert(ctx, {
      courseId: second.id,
      date: "2026-01-05",
      slot: "AM",
      startAt: new Date(start),
      endAt: new Date(start + 2 * H),
    });

    const res = await assignStaff(repos, ctx, { courseId: second.id, instructorId: fixtureInstructorId, roleTypeId: roleId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("conflict");
  });

  it("assigns a fit instructor with no clash", async () => {
    // A course on a different day — no conflict with the fixture assignment.
    const courseType = (await repos.tenant.courseType.list(ctx))[0]!;
    const other = await repos.tenant.course.insert(ctx, {
      courseTypeId: courseType.id,
      name: "Clear day",
      capacity: 2,
      ratio: 2,
      status: "scheduled",
    });
    const start = Date.UTC(2026, 0, 12, 9, 0, 0);
    await repos.tenant.courseSession.insert(ctx, {
      courseId: other.id,
      date: "2026-01-12",
      slot: "AM",
      startAt: new Date(start),
      endAt: new Date(start + 3 * H),
    });
    const res = await assignStaff(repos, ctx, { courseId: other.id, instructorId: fixtureInstructorId, roleTypeId: roleId });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.overridden).toBe(false);
  });
});
