import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { SlotCode } from "@/lib/db/schema";
import { writeAudit } from "./audit";

export interface NewCourseSession {
  date: string; // YYYY-MM-DD
  slot: SlotCode;
}

export interface CreateCourseInput {
  courseTypeId: string;
  name?: string;
  capacity?: number;
  ratio?: number;
  locationId?: string;
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

  const course = await t.course.insert(ctx, {
    courseTypeId: courseType.id,
    name: input.name ?? courseType.name,
    capacity: input.capacity ?? courseType.defaultCapacity,
    ratio: input.ratio ?? courseType.studentsPerInstructor,
    status: "scheduled",
  });

  for (const s of input.sessions) {
    const slot = slotByCode.get(s.slot);
    const startTime = slot?.startTime ?? "09:00";
    const endTime = slot?.endTime ?? "12:00";
    await t.courseSession.insert(ctx, {
      courseId: course.id,
      date: s.date,
      slot: s.slot,
      startAt: new Date(instant(s.date, startTime)),
      endAt: new Date(instant(s.date, endTime)),
    });
  }

  if (input.locationId) {
    await t.courseLocation.insert(ctx, { courseId: course.id, locationId: input.locationId });
  }

  await writeAudit(repos, ctx, {
    action: "create",
    entity: "course",
    entityId: course.id,
    after: { name: course.name, sessions: input.sessions.length },
  });

  return { courseId: course.id };
}
