import type { Jurisdiction } from "@/lib/db/schema";
import { createRepositories, type Repositories } from "@/lib/db/repositories";
import { seedOrganisationDefaults } from "@/lib/seed/seed";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database } from "@/lib/db/client";

const H = 60 * 60 * 1000;

/**
 * Create a fully-populated organisation for tests: control-plane org + owner +
 * membership, the RYA defaults, and at least one row in EVERY tenant table so
 * the isolation test has something to try (and fail) to reach cross-tenant.
 */
export async function seedFullOrg(
  db: Database,
  opts: { name: string; slug: string; jurisdiction: Jurisdiction },
): Promise<{ repos: Repositories; organisationId: string; slug: string; ctx: SystemTenantContext }> {
  const repos = createRepositories(db);

  const org = await repos.control.createOrganisation({
    name: opts.name,
    slug: opts.slug,
    jurisdiction: opts.jurisdiction,
    plan: "rostering",
    status: "active",
    subscriptionStatus: "active",
  });
  const owner = await repos.control.createUser({ name: `${opts.name} Owner`, email: `owner@${opts.slug}.test` });
  await repos.control.createMembership({ userId: owner.id, organisationId: org.id, role: "admin" });

  const ctx: SystemTenantContext = {
    organisationId: org.id,
    slug: org.slug,
    system: true,
    reason: "test-fixture",
  };

  await seedOrganisationDefaults(repos.tenant, ctx, opts.jurisdiction);
  const t = repos.tenant;

  // Grab some seeded config ids to build the operational graph.
  const [courseTypes, grades, complianceTypes, equipmentTypes, roles, locationTypes] = await Promise.all([
    t.courseType.list(ctx),
    t.qualificationType.list(ctx),
    t.complianceType.list(ctx),
    t.equipmentType.list(ctx),
    t.roleType.list(ctx),
    t.locationType.list(ctx),
  ]);

  const courseType = courseTypes[0]!;
  const grade = grades[0]!;
  const complianceType = complianceTypes[0]!;
  const equipmentType = equipmentTypes[0]!;
  const role = roles.find((r) => r.countsTowardRatio) ?? roles[0]!;
  const locationType = locationTypes[0]!;

  // Course type detail rows
  await t.courseTypeStaffing.insert(ctx, {
    courseTypeId: courseType.id,
    qualificationTypeId: grade.id,
    minCount: 1,
  });
  await t.courseTypeEquipment.insert(ctx, {
    courseTypeId: courseType.id,
    equipmentTypeId: equipmentType.id,
    quantity: 2,
  });

  // People
  const instructor = await t.instructor.insert(ctx, {
    name: `Instructor ${opts.slug}`,
    email: `inst@${opts.slug}.test`,
    phone: "0000",
    employmentType: "employed",
    status: "active",
  });
  await t.qualification.insert(ctx, {
    instructorId: instructor.id,
    qualificationTypeId: grade.id,
    certNo: "CERT-1",
    issueDate: "2024-01-01",
    expiryDate: null,
    verified: true,
  });
  // Give the instructor every compliance check the org requires, so the fixture
  // instructor is genuinely fit-to-roster (mandatory checks all current).
  for (const ct of complianceTypes) {
    await t.complianceItem.insert(ctx, {
      instructorId: instructor.id,
      complianceTypeId: ct.id,
      expiryDate: ct.expiryTracked ? "2030-01-01" : null,
      verified: true,
    });
  }
  void complianceType;

  // Resources
  const equipment = await t.equipment.insert(ctx, {
    equipmentTypeId: equipmentType.id,
    name: `Boat-${opts.slug}`,
    identifier: "B1",
    status: "available",
  });
  const location = await t.location.insert(ctx, {
    locationTypeId: locationType.id,
    name: `Lake ${opts.slug}`,
    active: true,
  });

  // Scheduling
  const course = await t.course.insert(ctx, {
    courseTypeId: courseType.id,
    name: `Course ${opts.slug}`,
    capacity: courseType.defaultCapacity,
    ratio: courseType.studentsPerInstructor,
    status: "scheduled",
  });
  const start = Date.UTC(2026, 0, 5, 9, 0, 0);
  const session = await t.courseSession.insert(ctx, {
    courseId: course.id,
    date: "2026-01-05",
    slot: "AM",
    startAt: new Date(start),
    endAt: new Date(start + 3 * H),
  });
  await t.courseStaff.insert(ctx, {
    courseId: course.id,
    instructorId: instructor.id,
    roleTypeId: role.id,
    status: "assigned",
  });
  await t.courseEquipment.insert(ctx, {
    courseId: course.id,
    equipmentId: equipment.id,
    quantity: 1,
  });
  await t.courseLocation.insert(ctx, { courseId: course.id, locationId: location.id });

  // Ops
  await t.availability.insert(ctx, {
    instructorId: instructor.id,
    date: "2026-01-05",
    slot: "AM",
    status: "available",
  });
  await t.payRate.insert(ctx, { instructorId: instructor.id, rate: 25, unit: "hour" });
  await t.hoursRecord.insert(ctx, {
    instructorId: instructor.id,
    courseSessionId: session.id,
    scheduledMinutes: 180,
    actualMinutes: 180,
    rate: 25,
    approved: false,
  });
  await t.notification.insert(ctx, {
    instructorId: instructor.id,
    channel: "in_app",
    title: "Welcome",
    body: "Your schedule is ready",
  });
  await t.auditLog.insert(ctx, {
    actorUserId: owner.id,
    action: "seed",
    entity: "organisation",
    entityId: org.id,
    after: JSON.stringify({ seeded: true }),
  });

  return { repos, organisationId: org.id, slug: org.slug, ctx };
}
