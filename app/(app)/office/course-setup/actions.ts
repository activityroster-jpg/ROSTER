"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import { deleteOrRetireCourseType, moveCoursesToType } from "@/lib/services/course-types";
import { COURSE_AUDIENCES } from "@/lib/db/schema";
import { normaliseDefaultSchedule } from "@/lib/domain";
import { DEFAULT_COURSE_TYPES } from "@/lib/seed/catalogue";
import { setCourseTypeKit } from "@/lib/services/kit";

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
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
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
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
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
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
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
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const updated = await repos.tenant.courseType.update(ctx, id, { active: true });
  if (!updated) return { ok: false, error: "Course type not found" };
  await writeAudit(repos, ctx, { action: "reactivate", entity: "course_type", entityId: id });
  revalidate();
  return { ok: true };
}

/**
 * Bring the RYA course list back when a centre has retired or unlisted
 * everything (usually by accident in the setup wizard). Reactivates and lists
 * every existing type and re-adds any RYA default that is missing entirely.
 */
export async function restoreCourseTypesAction(): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const existing = await repos.tenant.courseType.list(ctx);
  let restored = 0;
  for (const t of existing) {
    if (t.active && t.listed) continue;
    await repos.tenant.courseType.update(ctx, t.id, { active: true, listed: true });
    restored++;
  }
  const have = new Set(existing.map((t) => t.name.trim().toLowerCase()));
  let added = 0;
  for (const ct of DEFAULT_COURSE_TYPES) {
    if (have.has(ct.name.trim().toLowerCase())) continue;
    await repos.tenant.courseType.insert(ctx, { ...ct, active: true });
    added++;
  }
  await writeAudit(repos, ctx, { action: "restore_defaults", entity: "course_type", after: { restored, added } });
  revalidate();
  const n = restored + added;
  return { ok: true, message: n ? `${n} course type${n === 1 ? "" : "s"} back on your list` : "Your course list was already complete" };
}

/** Put a one-off course type on the regular list (or take one off it). */
export async function setCourseTypeListedAction(id: string, listed: boolean): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const updated = await repos.tenant.courseType.update(ctx, id, { listed: listed === true, active: true });
  if (!updated) return { ok: false, error: "Course type not found" };
  await writeAudit(repos, ctx, { action: listed ? "list" : "unlist", entity: "course_type", entityId: id });
  revalidate();
  return { ok: true, message: listed ? `${updated.name} added to your course list` : `${updated.name} removed from your list` };
}

/** Move all courses of one type under another (fixing imported near-duplicates). */
export async function moveCoursesToTypeAction(fromId: string, toId: string): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (typeof fromId !== "string" || typeof toId !== "string" || !fromId || !toId) return { ok: false, error: "Pick a course type" };
  const res = await moveCoursesToType(repos, ctx, fromId, toId);
  if (!res) return { ok: false, error: "Course type not found" };
  await writeAudit(repos, ctx, { action: "merge", entity: "course_type", entityId: fromId, after: { into: toId, moved: res.moved } });
  revalidate();
  return { ok: true, message: `Moved ${res.moved} course${res.moved === 1 ? "" : "s"} from “${res.from}” to “${res.to}”` };
}

/** Set (or clear, with an empty list) a course type's default schedule. */
export async function setCourseTypeScheduleAction(id: string, sessions: unknown): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const clean = normaliseDefaultSchedule(sessions);
  if (Array.isArray(sessions) && sessions.length > 0 && clean.length !== sessions.length) {
    return { ok: false, error: "Each session needs a day and an end time after its start" };
  }
  const updated = await repos.tenant.courseType.update(ctx, id, { defaultSchedule: clean.length ? JSON.stringify(clean) : null });
  if (!updated) return { ok: false, error: "Course type not found" };
  await writeAudit(repos, ctx, { action: "update_schedule", entity: "course_type", entityId: id, after: { sessions: clean } });
  revalidate();
  return { ok: true, message: `Default schedule saved for ${updated.name}` };
}

const kitRulesSchema = z.object({
  courseTypeId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  rules: z.array(z.object({
    equipmentTypeId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    quantity: z.coerce.number().int().min(0).max(100),
    perStudents: z.coerce.number().int().min(0).max(50).nullable().optional(),
  })).max(30),
});

/** Save one course type's kit rules (used only when Settings → "Use kit rules" is on). */
export async function setKitRulesAction(input: { courseTypeId: string; rules: { equipmentTypeId: string; quantity: number; perStudents?: number | null }[] }): Promise<CourseTypeResult> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = kitRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the kit lines" };
  const r = await setCourseTypeKit(repos, ctx, parsed.data.courseTypeId, parsed.data.rules);
  if (!r.ok) return { ok: false, error: r.error };
  revalidate();
  return { ok: true, message: r.rules.length ? "Kit rules saved" : "Kit rules cleared" };
}
