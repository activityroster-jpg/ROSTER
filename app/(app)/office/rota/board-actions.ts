"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { assignStaff, assignBlockMessage, notifyRosterChange } from "@/lib/services/assignment";
import { clearDayStaff, setDayStaff } from "@/lib/services/session-staff";
import { syncHoursForCourse } from "@/lib/services/hours";
import { writeAudit } from "@/lib/services/audit";
import { courseSession as courseSessionTable } from "@/lib/db/schema";
import { idSchema } from "@/lib/validation/actions";

type Result = { ok: boolean; error?: string; message?: string };

function refresh() {
  revalidatePath("/office/rota");
  revalidatePath("/office/courses");
  revalidatePath("/office");
  revalidatePath("/portal");
}

/**
 * Put someone on a session from the board: on the whole course (the default
 * for a one-day course) or on this day only. Both run the usual checks; an
 * override is recorded (no reason asked; the warnings it overrode are logged).
 */
export async function boardAssignAction(input: { sessionId: string; courseId: string; instructorId: string; roleTypeId: string; scope: "course" | "day"; override?: boolean; note?: string | null }): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (![input.sessionId, input.courseId, input.instructorId, input.roleTypeId].every((v) => idSchema.safeParse(v).success)) return { ok: false, error: "Invalid request" };
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null;
  if (input.scope === "day") {
    const r = await setDayStaff(repos, ctx, { sessionId: input.sessionId, instructorId: input.instructorId, roleTypeId: input.roleTypeId, mode: "add", override: Boolean(input.override), note });
    if (!r.ok) return { ok: false, error: r.error };
    refresh();
    return { ok: true, message: r.overridden ? `Added for this day (overriding: ${r.warnings.join("; ")})` : "Added for this day" };
  }
  const r = await assignStaff(repos, ctx, { courseId: input.courseId, instructorId: input.instructorId, roleTypeId: input.roleTypeId, override: Boolean(input.override), overrideNote: note ?? undefined });
  if (!r.ok) return { ok: false, error: `${assignBlockMessage(r.reason, r.detail)}${r.noOverride ? "" : ". Tick override to push it through."}` };
  refresh();
  return { ok: true, message: r.warnings.length ? `Assigned — ⚠ ${r.warnings.join("; ")}` : r.overridden ? "Assigned (override recorded)" : "Assigned" };
}

/** Take someone off: the whole course (removes the assignment) or this day only (a skip, or undoing a day add). */
export async function boardRemoveAction(input: { sessionId: string; courseId: string; instructorId: string; roleTypeId: string; assignmentId: string | null; scope: "course" | "day" }): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (![input.sessionId, input.courseId, input.instructorId].every((v) => idSchema.safeParse(v).success)) return { ok: false, error: "Invalid request" };
  if (input.scope === "day") {
    const r = input.assignmentId
      ? await setDayStaff(repos, ctx, { sessionId: input.sessionId, instructorId: input.instructorId, roleTypeId: input.roleTypeId, mode: "skip" })
      : await clearDayStaff(repos, ctx, input.sessionId, input.instructorId);
    if (!r.ok) return { ok: false, error: r.error };
    refresh();
    return { ok: true, message: input.assignmentId ? "Taken off this day (still on the rest of the course)" : "Taken off this day" };
  }
  if (!input.assignmentId || !idSchema.safeParse(input.assignmentId).success) return { ok: false, error: "They're only on this day; remove them from the day instead" };
  const assignment = await repos.tenant.courseStaff.findById(ctx, input.assignmentId);
  if (!assignment || assignment.courseId !== input.courseId) return { ok: false, error: "Assignment not found" };
  await repos.tenant.courseStaff.delete(ctx, input.assignmentId);
  await writeAudit(repos, ctx, { action: "remove_staff", entity: "course", entityId: input.courseId, after: { assignmentId: input.assignmentId, from: "board" } });
  await syncHoursForCourse(repos, ctx, input.courseId);
  const [course, sessions] = await Promise.all([repos.tenant.course.findById(ctx, input.courseId), repos.tenant.courseSession.list(ctx, eq(courseSessionTable.courseId, input.courseId))]);
  await notifyRosterChange(repos, ctx, assignment.instructorId, course?.name ?? "a course", sessions.map((s) => s.date), "removed");
  refresh();
  return { ok: true, message: "Removed from the course" };
}
