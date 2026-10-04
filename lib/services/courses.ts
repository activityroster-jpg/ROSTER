import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { SlotCode } from "@/lib/db/schema";
import { writeAudit } from "./audit";
import { runAtomic } from "@/lib/db/batch";

export interface NewCourseSession {
  date: string; // YYYY-MM-DD
  slot: SlotCode;
  /** Optional explicit times (centres on the "set times" style). When present
   * they override the slot's configured times; the slot code is still stored. */
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
}

export interface CreateCourseInput {
  courseTypeId: string;
  name?: string;
  capacity?: number;
  ratio?: number;
  locationId?: string;
  /** Locations to attach (validated against this centre). */
  locationIds?: string[];
  /** Equipment units to attach (validated against this centre). */
  equipmentIds?: string[];
  /** Staff the course needs, by role — e.g. 2× Instructor, 1× Safety Boat. */
  roleRequirements?: { roleTypeId: string; count: number }[];
  sessions: NewCourseSession[];
}

/** Combine a date + a slot's configured time into an absolute epoch-ms instant. */
function instant(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00.000Z`);
}

/**
 * Create a course and its sessions in one go, taking defaults (capacity, ratio)
 * from the course type and session times from the org's slot config. A course is
 * just its sessions — a 2-day course and a 4-evening course are both modelled
 * here. All writes are tenant scoped and audited.
 */
export async function createCourseWithSessions(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: CreateCourseInput,
): Promise<{ courseId: string }> {
  const t = repos.tenant;
  const courseType = await t.courseType.findById(ctx, input.courseTypeId);
  if (!courseType) throw new Error("Course type not found");

  const slots = await t.sessionSlot.list(ctx);
  const slotByCode = new Map(slots.map((s) => [s.code, s]));

  // Validate everything first (all reads, tenant scoped), then write the course,
  // its sessions, places, kit and role lines in one atomic batch.
  const locIds: string[] = [];
  for (const locationId of new Set([...(input.locationId ? [input.locationId] : []), ...(input.locationIds ?? [])])) {
    if (await t.location.findById(ctx, locationId)) locIds.push(locationId);
  }
  const unitIds: string[] = [];
  for (const equipmentId of new Set(input.equipmentIds ?? [])) {
    if (await t.equipment.findById(ctx, equipmentId)) unitIds.push(equipmentId);
  }
  // Staff needed by role; merge duplicate roles and record the total as the
  // course's staff requirement so the assigned/required pill reflects it.
  const needByRole = new Map<string, number>();
  for (const r of input.roleRequirements ?? []) {
    const n = Math.max(1, Math.min(50, Math.round(Number(r.count) || 0)));
    if (!r.roleTypeId) continue;
    if (!(await t.roleType.findById(ctx, r.roleTypeId))) continue;
    needByRole.set(r.roleTypeId, (needByRole.get(r.roleTypeId) ?? 0) + n);
  }
  const totalNeeded = [...needByRole.values()].reduce((a, b) => a + b, 0);

  const courseId = crypto.randomUUID();
  const course = {
    id: courseId,
    courseTypeId: courseType.id,
    name: input.name ?? courseType.name,
    capacity: input.capacity ?? courseType.defaultCapacity,
    ratio: input.ratio ?? courseType.studentsPerInstructor,
    status: "scheduled" as const,
    staffRequired: totalNeeded > 0 ? totalNeeded : null,
  };
  const statements: PromiseLike<unknown>[] = [t.course.insertStatement(ctx, course)];
  for (const s of input.sessions) {
    const slot = slotByCode.get(s.slot);
    const startTime = s.startTime ?? slot?.startTime ?? "09:00";
    const endTime = s.endTime ?? slot?.endTime ?? "12:00";
    statements.push(t.courseSession.insertStatement(ctx, {
      courseId,
      date: s.date,
      slot: s.slot,
      startAt: new Date(instant(s.date, startTime)),
      endAt: new Date(instant(s.date, endTime)),
    }));
  }
  for (const locationId of locIds) statements.push(t.courseLocation.insertStatement(ctx, { courseId, locationId }));
  for (const equipmentId of unitIds) statements.push(t.courseEquipment.insertStatement(ctx, { courseId, equipmentId, quantity: 1 }));
  for (const [roleTypeId, count] of needByRole) statements.push(t.courseRoleRequirement.insertStatement(ctx, { courseId, roleTypeId, count }));
  await runAtomic(repos.db, statements);

  await writeAudit(repos, ctx, {
    action: "create",
    entity: "course",
    entityId: courseId,
    after: { name: course.name, sessions: input.sessions.length, roles: totalNeeded, locations: locIds.length, equipment: unitIds.length },
  });

  return { courseId };
}
