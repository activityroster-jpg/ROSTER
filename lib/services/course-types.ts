import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, instructorCourseType } from "@/lib/db/schema";

export type DeleteCourseTypeOutcome =
  | { outcome: "not_found" }
  | { outcome: "retired"; name: string }
  | { outcome: "deleted"; name: string };

/**
 * Delete a course type, or retire it if anything still uses it. Courses and
 * instructor approvals RESTRICT-reference course types, and config is
 * deactivate-never-delete, so an in-use type is set inactive (history keeps
 * rendering) and only an unused one is actually removed. Tenant scoped.
 */
export async function deleteOrRetireCourseType(
  repos: Repositories,
  ctx: AnyTenantContext,
  id: string,
): Promise<DeleteCourseTypeOutcome> {
  const t = repos.tenant;
  const existing = await t.courseType.findById(ctx, id);
  if (!existing) return { outcome: "not_found" };

  const [usedByCourses, usedByApprovals] = await Promise.all([
    t.course.count(ctx, eq(courseTable.courseTypeId, id)),
    t.instructorCourseType.count(ctx, eq(instructorCourseType.courseTypeId, id)),
  ]);

  if (usedByCourses + usedByApprovals > 0) {
    await t.courseType.update(ctx, id, { active: false });
    return { outcome: "retired", name: existing.name };
  }
  await t.courseType.delete(ctx, id);
  return { outcome: "deleted", name: existing.name };
}

/**
 * File every course (and instructor approval) of one course type under another
 * — e.g. an imported "RYA Stage 1 Summer" under the centre's "Youth Stage 1" —
 * then delete the emptied type (or retire it if something still points at it).
 * Both types must belong to this centre. Tenant scoped.
 */
export async function moveCoursesToType(
  repos: Repositories,
  ctx: AnyTenantContext,
  fromId: string,
  toId: string,
): Promise<{ moved: number; from: string; to: string } | null> {
  const t = repos.tenant;
  if (fromId === toId) return null;
  const [from, to] = await Promise.all([t.courseType.findById(ctx, fromId), t.courseType.findById(ctx, toId)]);
  if (!from || !to) return null;

  const courses = await t.course.list(ctx, eq(courseTable.courseTypeId, fromId));
  for (const c of courses) await t.course.update(ctx, c.id, { courseTypeId: toId });

  const [fromApprovals, toApprovals] = await Promise.all([
    t.instructorCourseType.list(ctx, eq(instructorCourseType.courseTypeId, fromId)),
    t.instructorCourseType.list(ctx, eq(instructorCourseType.courseTypeId, toId)),
  ]);
  const already = new Set(toApprovals.map((a) => a.instructorId));
  for (const a of fromApprovals) {
    if (!already.has(a.instructorId)) await t.instructorCourseType.insert(ctx, { instructorId: a.instructorId, courseTypeId: toId });
    await t.instructorCourseType.delete(ctx, a.id);
  }

  await deleteOrRetireCourseType(repos, ctx, fromId);
  return { moved: courses.length, from: from.name, to: to.name };
}
