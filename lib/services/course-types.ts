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
