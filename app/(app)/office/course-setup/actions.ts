"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import { deleteOrRetireCourseType } from "@/lib/services/course-types";
import { COURSE_AUDIENCES } from "@/lib/db/schema";

export type CourseTypeResult = { ok: boolean; error?: string; message?: string };

const fields = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  scheme: z.string().trim().max(120).optional().transform((v) => v || null),
  audience: z.enum(COURSE_AUDIENCES),
  defaultCapacity: z.coerce.number().int().min(1).max(500),
  studentsPerInstructor: z.coerce.number().int().min(1).max(100),
});

export interface CourseTypeInput {
  name: string;
  scheme?: string;
  audience: string;
  defaultCapacity: number | string;
  studentsPerInstructor: number | string;
}

function revalidate() {
  revalidatePath("/office/course-setup");
  revalidatePath("/office/courses");
  revalidatePath("/office/settings");
}

/** Edit a course type's fields in place. */
export async function updateCourseTypeAction(id: string, input: CourseTypeInput): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = fields.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the values" };
  const updated = await repos.tenant.courseType.update(ctx, id, parsed.data);
  if (!updated) return { ok: false, error: "Course type not found" };
  await writeAudit(repos, ctx, { action: "update", entity: "course_type", entityId: id, after: parsed.data });
  revalidate();
  return { ok: true, message: "Saved" };
}

/** Add a new course type to the catalogue. */
export async function addCourseTypeAction(input: CourseTypeInput): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = fields.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the values" };
  const created = await repos.tenant.courseType.insert(ctx, { ...parsed.data, active: true });
  await writeAudit(repos, ctx, { action: "create", entity: "course_type", entityId: created.id, after: parsed.data });
  revalidate();
  return { ok: true, message: `${parsed.data.name} added` };
}

/**
 * Delete a course type. If any course or instructor approval still uses it,
 * it's retired instead (deactivate-never-delete) so history keeps rendering.
 */
export async function deleteCourseTypeAction(id: string): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const res = await deleteOrRetireCourseType(repos, ctx, id);
  if (res.outcome === "not_found") return { ok: false, error: "Course type not found" };

  if (res.outcome === "retired") {
    await writeAudit(repos, ctx, { action: "deactivate", entity: "course_type", entityId: id });
    revalidate();
    return { ok: true, message: `${res.name} is used by existing courses, so it's been retired — it won't appear for new courses but old ones still show it.` };
  }
  await writeAudit(repos, ctx, { action: "delete", entity: "course_type", entityId: id, before: { name: res.name } });
  revalidate();
  return { ok: true, message: `${res.name} deleted` };
}

/** Bring a retired course type back. */
export async function reactivateCourseTypeAction(id: string): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const updated = await repos.tenant.courseType.update(ctx, id, { active: true });
  if (!updated) return { ok: false, error: "Course type not found" };
  await writeAudit(repos, ctx, { action: "reactivate", entity: "course_type", entityId: id });
  revalidate();
  return { ok: true };
}
