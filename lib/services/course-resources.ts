import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  courseEquipment as courseEquipmentTable,
  courseLocation as courseLocationTable,
  courseRoleRequirement as courseRoleRequirementTable,
  courseStaff as courseStaffTable,
  type Course,
  type CourseStaff,
  type CourseType,
} from "@/lib/db/schema";
import { courseRoleRequirement as courseRoleRequirementSchema, roleType as roleTypeSchema } from "@/lib/db/schema";
type CourseRoleRequirement = typeof courseRoleRequirementSchema.$inferSelect;
type RoleType = typeof roleTypeSchema.$inferSelect;
import { cleanRoleLines, derivedStaffRequired, staffingShortfallNote, suggestRoles, type RoleLine, type StaffingRole } from "@/lib/domain/staffing";
import { auditStatement } from "./audit";
import { runAtomic } from "@/lib/db/batch";

type Result = { ok: true } | { ok: false; error: string };

/** What a course uses: places, tracked units, and bulk kit by type and quantity. */
export interface CourseResources {
  locationIds: string[];
  unitIds: string[];
  bulk: { equipmentTypeId: string; quantity: number }[];
}

export async function getCourseResources(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<CourseResources> {
  const [locs, equip] = await Promise.all([
    repos.tenant.courseLocation.list(ctx, eq(courseLocationTable.courseId, courseId)),
    repos.tenant.courseEquipment.list(ctx, eq(courseEquipmentTable.courseId, courseId)),
  ]);
  return {
    locationIds: [...new Set(locs.map((l) => l.locationId))],
    unitIds: [...new Set(equip.filter((e) => e.equipmentId).map((e) => e.equipmentId!))],
    bulk: equip.filter((e) => !e.equipmentId && e.equipmentTypeId).map((e) => ({ equipmentTypeId: e.equipmentTypeId!, quantity: e.quantity })),
  };
}

/** Replace a course's locations. Ids must be this centre's (findById is tenant scoped); unknown ones are dropped. Audited. */
export async function setCourseLocations(repos: Repositories, ctx: AnyTenantContext, courseId: string, locationIds: readonly string[]): Promise<Result> {
  const t = repos.tenant;
  // Every change and its log entry in one batch: the course never ends up with half the old list and half the new.
  const ops: PromiseLike<unknown>[] = [];
  if (!(await t.course.findById(ctx, courseId))) return { ok: false, error: "Course not found" };
  const wanted: string[] = [];
  for (const id of new Set(locationIds)) if (await t.location.findById(ctx, id)) wanted.push(id);
  const existing = await t.courseLocation.list(ctx, eq(courseLocationTable.courseId, courseId));
  const have = new Set(existing.map((e) => e.locationId));
  for (const row of existing) if (!wanted.includes(row.locationId)) ops.push(t.courseLocation.deleteStatement(ctx, row.id));
  for (const id of wanted) if (!have.has(id)) ops.push(t.courseLocation.insertStatement(ctx, { courseId, locationId: id }));
  const audit = auditStatement(repos, ctx, { action: "set_course_locations", entity: "course", entityId: courseId, after: { locationIds: wanted } });
  await runAtomic(repos.db, [...ops, ...(audit ? [audit] : [])]);
  return { ok: true };
}

/** Replace a course's equipment: tracked units one row each, bulk kit as a type + quantity. Audited. */
export async function setCourseEquipment(repos: Repositories, ctx: AnyTenantContext, courseId: string, input: { unitIds: readonly string[]; bulk: readonly { equipmentTypeId: string; quantity: number }[] }): Promise<Result> {
  const t = repos.tenant;
  // Every change and its log entry in one batch: the course never ends up with half the old list and half the new.
  const ops: PromiseLike<unknown>[] = [];
  if (!(await t.course.findById(ctx, courseId))) return { ok: false, error: "Course not found" };
  const units: string[] = [];
  for (const id of new Set(input.unitIds)) if (await t.equipment.findById(ctx, id)) units.push(id);
  const bulk = new Map<string, number>();
  for (const b of input.bulk) {
    const n = Math.max(0, Math.min(1000, Math.round(Number(b.quantity) || 0)));
    if (n === 0 || bulk.has(b.equipmentTypeId)) continue;
    if (await t.equipmentType.findById(ctx, b.equipmentTypeId)) bulk.set(b.equipmentTypeId, n);
  }
  const existing = await t.courseEquipment.list(ctx, eq(courseEquipmentTable.courseId, courseId));
  const keepUnit = new Set<string>();
  const keepBulk = new Set<string>();
  for (const row of existing) {
    if (row.equipmentId) {
      if (units.includes(row.equipmentId) && !keepUnit.has(row.equipmentId)) keepUnit.add(row.equipmentId);
      else ops.push(t.courseEquipment.deleteStatement(ctx, row.id));
    } else if (row.equipmentTypeId && bulk.has(row.equipmentTypeId) && !keepBulk.has(row.equipmentTypeId)) {
      keepBulk.add(row.equipmentTypeId);
      if (row.quantity !== bulk.get(row.equipmentTypeId)) ops.push(t.courseEquipment.updateStatement(ctx, row.id, { quantity: bulk.get(row.equipmentTypeId)! }));
    } else {
      ops.push(t.courseEquipment.deleteStatement(ctx, row.id));
    }
  }
  for (const id of units) if (!keepUnit.has(id)) ops.push(t.courseEquipment.insertStatement(ctx, { courseId, equipmentId: id, equipmentTypeId: null, quantity: 1 }));
  for (const [typeId, qty] of bulk) if (!keepBulk.has(typeId)) ops.push(t.courseEquipment.insertStatement(ctx, { courseId, equipmentId: null, equipmentTypeId: typeId, quantity: qty }));
  const audit = auditStatement(repos, ctx, { action: "set_course_equipment", entity: "course", entityId: courseId, after: { units, bulk: [...bulk].map(([equipmentTypeId, quantity]) => ({ equipmentTypeId, quantity })) } });
  await runAtomic(repos.db, [...ops, ...(audit ? [audit] : [])]);
  return { ok: true };
}

/** The staffing panel's data for one course. */
export interface StaffingView {
  students: number;
  ratio: number;
  requiresSafetyBoat: boolean;
  roles: StaffingRole[];
  lines: { roleTypeId: string; roleName: string; count: number; filled: number }[];
  /** Derived: the role lines' total, or what the ratio implies when there are none. */
  required: number;
  /** True when `required` comes from role lines the admin set. */
  fromRoles: boolean;
  suggested: RoleLine[];
  note: string | null;
  assigned: number;
}

export function staffingViewFrom(
  course: Pick<Course, "capacity" | "ratio" | "staffRequired">,
  courseType: Pick<CourseType, "requiresSafetyBoat"> | null | undefined,
  roles: readonly RoleType[],
  requirements: readonly Pick<CourseRoleRequirement, "roleTypeId" | "count">[],
  assignments: readonly Pick<CourseStaff, "roleTypeId" | "status">[],
): StaffingView {
  const staffingRoles: StaffingRole[] = roles.map((r) => ({ id: r.id, name: r.name, countsTowardRatio: Boolean(r.countsTowardRatio), isSafetyCover: Boolean(r.isSafetyCover), active: Boolean(r.active) }));
  const input = { students: course.capacity, ratio: course.ratio, requiresSafetyBoat: Boolean(courseType?.requiresSafetyBoat), roles: staffingRoles };
  const lines = cleanRoleLines(requirements).map((l) => ({
    roleTypeId: l.roleTypeId,
    roleName: roles.find((r) => r.id === l.roleTypeId)?.name ?? "Role",
    count: l.count,
    filled: assignments.filter((a) => a.roleTypeId === l.roleTypeId && a.status !== "declined").length,
  }));
  const fromLines = derivedStaffRequired(lines);
  const suggested = suggestRoles(input);
  const live = assignments.filter((a) => a.status !== "declined").length;
  return {
    students: course.capacity,
    ratio: course.ratio,
    requiresSafetyBoat: input.requiresSafetyBoat,
    roles: staffingRoles,
    lines,
    required: fromLines ?? derivedStaffRequired(suggested) ?? 0,
    fromRoles: fromLines !== null,
    suggested,
    note: staffingShortfallNote(input, lines),
    assigned: live,
  };
}

export async function getCourseStaffing(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<StaffingView | null> {
  const t = repos.tenant;
  const course = await t.course.findById(ctx, courseId);
  if (!course) return null;
  const [ct, roles, reqs, staff] = await Promise.all([
    t.courseType.findById(ctx, course.courseTypeId),
    t.roleType.list(ctx),
    t.courseRoleRequirement.list(ctx, eq(courseRoleRequirementTable.courseId, courseId)),
    t.courseStaff.list(ctx, eq(courseStaffTable.courseId, courseId)),
  ]);
  return staffingViewFrom(course, ct, roles, reqs, staff);
}

/**
 * Save the staffing panel: students booked and the role lines. Staff required
 * is derived from the lines (null when there are none, so the ratio decides).
 * Audited.
 */
export async function setCourseStaffing(repos: Repositories, ctx: AnyTenantContext, courseId: string, input: { students: number; roles: readonly { roleTypeId: string; count: number }[] }): Promise<Result> {
  const t = repos.tenant;
  // Every change and its log entry in one batch: the course never ends up with half the old list and half the new.
  const ops: PromiseLike<unknown>[] = [];
  const course = await t.course.findById(ctx, courseId);
  if (!course) return { ok: false, error: "Course not found" };
  const lines: RoleLine[] = [];
  for (const l of cleanRoleLines(input.roles)) if (await t.roleType.findById(ctx, l.roleTypeId)) lines.push(l);
  const existing = await t.courseRoleRequirement.list(ctx, eq(courseRoleRequirementTable.courseId, courseId));
  const seen = new Set<string>();
  for (const row of existing) {
    const want = lines.find((l) => l.roleTypeId === row.roleTypeId);
    if (!want || seen.has(row.roleTypeId)) { ops.push(t.courseRoleRequirement.deleteStatement(ctx, row.id)); continue; }
    seen.add(row.roleTypeId);
    if (row.count !== want.count) ops.push(t.courseRoleRequirement.updateStatement(ctx, row.id, { count: want.count }));
  }
  for (const l of lines) if (!seen.has(l.roleTypeId)) ops.push(t.courseRoleRequirement.insertStatement(ctx, { courseId, roleTypeId: l.roleTypeId, count: l.count }));
  const students = Math.max(0, Math.min(500, Math.round(input.students)));
  ops.push(t.course.updateStatement(ctx, courseId, { capacity: students, staffRequired: derivedStaffRequired(lines) }));
  const audit = auditStatement(repos, ctx, { action: "set_staffing", entity: "course", entityId: courseId, after: { students, roles: lines, staffRequired: derivedStaffRequired(lines) } });
  await runAtomic(repos.db, [...ops, ...(audit ? [audit] : [])]);
  return { ok: true };
}
