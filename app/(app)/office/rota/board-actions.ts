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
import { weekStart } from "@/lib/services/schedule";
import { fillOpenRoles } from "@/lib/services/auto-roster";
import { previewUndoRedo, redoWeek, undoRedo, type UndoPreview } from "@/lib/services/week-redo";

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
  if (!r.ok) return { ok: false, error: `${assignBlockMessage(r.reason, r.detail)}${r.noOverride ? "" : ". Press “Assign anyway” to push it through."}` };
  refresh();
  return { ok: true, message: r.warnings.length ? `Assigned — ⚠ ${r.warnings.join("; ")}` : r.overridden ? "Assigned (override recorded)" : "Assigned" };
}

/**
 * Several picks in one go ("Assign all"): each runs the same checks as a
 * single assign, in order; one refusal doesn't stop the rest. Returns what
 * happened to each so the panel can say who went on and who didn't.
 */
export async function boardAssignManyAction(input: { sessionId: string; courseId: string; scope: "course" | "day"; items: { instructorId: string; roleTypeId: string; override?: boolean; note?: string | null }[] }): Promise<Result & { results?: { instructorId: string; ok: boolean; message: string }[] }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (![input.sessionId, input.courseId].every((v) => idSchema.safeParse(v).success) || !Array.isArray(input.items) || input.items.length === 0 || input.items.length > 20) return { ok: false, error: "Invalid request" };
  const results: { instructorId: string; ok: boolean; message: string }[] = [];
  for (const it of input.items) {
    if (!idSchema.safeParse(it.instructorId).success || !idSchema.safeParse(it.roleTypeId).success) { results.push({ instructorId: it.instructorId, ok: false, message: "Invalid request" }); continue; }
    const note = typeof it.note === "string" ? it.note.trim().slice(0, 300) || null : null;
    if (input.scope === "day") {
      const r = await setDayStaff(repos, ctx, { sessionId: input.sessionId, instructorId: it.instructorId, roleTypeId: it.roleTypeId, mode: "add", override: Boolean(it.override), note });
      results.push({ instructorId: it.instructorId, ok: r.ok, message: r.ok ? (r.overridden ? "added (override recorded)" : "added") : r.error ?? "not added" });
    } else {
      const r = await assignStaff(repos, ctx, { courseId: input.courseId, instructorId: it.instructorId, roleTypeId: it.roleTypeId, override: Boolean(it.override), overrideNote: note ?? undefined });
      results.push({ instructorId: it.instructorId, ok: r.ok, message: r.ok ? (r.warnings.length ? `assigned — ⚠ ${r.warnings.join("; ")}` : r.overridden ? "assigned (override recorded)" : "assigned") : assignBlockMessage(r.reason, r.detail) });
    }
  }
  refresh();
  const done = results.filter((r) => r.ok).length;
  return { ok: done > 0, results, message: `${done} of ${results.length} assigned`, error: done === 0 ? "Nobody could be assigned" : undefined };
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

/**
 * Auto-roster one week: fill every open role from the people who are Free (then
 * Maybe), spreading sessions evenly, through the same checks as assigning by
 * hand. Never forces anything: roles nobody suitable is free for stay open and
 * are counted back. One-day courses get the person on the course; a day of a
 * multi-day course gets them for that day only.
 */
export async function autoRosterAction(input: { monday: string; mode?: "open" | "redo" }): Promise<Result & { filled?: number; open?: number; cleared?: number; undoId?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (typeof input?.monday !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.monday)) return { ok: false, error: "Invalid week" };
  const redo = input.mode === "redo";
  const monday = weekStart(new Date(`${input.monday}T00:00:00Z`));

  // "Redo the whole week": the new week is worked out first, then saved in one
  // go (people who stay where they are aren't touched or told), with an undo.
  if (redo) {
    const r = await redoWeek(repos, ctx, monday);
    refresh();
    const changed = r.added + r.removed;
    const msg = changed === 0
      ? "Week redone: nothing needed to change."
      : `Week redone: ${r.removed} taken off, ${r.added} put on${r.open ? `; ${r.open} place${r.open === 1 ? "" : "s"} still open (not enough suitable people free)` : "; every place covered"}.${r.notified ? ` ${r.notified} ${r.notified === 1 ? "person" : "people"} on confirmed days told.` : ""}`;
    return { ok: true, message: msg, filled: r.added, open: r.open, cleared: r.removed, ...(r.auditId && changed ? { undoId: r.auditId } : {}) };
  }

  const { filled, stillOpen, anyOpen } = await fillOpenRoles(repos, ctx, monday);
  if (filled === 0 && stillOpen === 0 && !anyOpen) return { ok: true, message: "Every role is already filled.", filled: 0, open: 0 };
  if (filled === 0) return { ok: true, message: `Nobody suitable is free for the ${stillOpen} open role${stillOpen === 1 ? "" : "s"}; nothing was changed.`, filled: 0, open: stillOpen };
  refresh();
  const msg = stillOpen === 0
    ? `Filled ${filled} role${filled === 1 ? "" : "s"}. Every role is now covered.`
    : `Filled ${filled} role${filled === 1 ? "" : "s"}; ${stillOpen} still open — not enough suitable people free. Those stay marked open on the board.`;
  return { ok: true, message: msg, filled, open: stillOpen };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Left as they are: 1 session changed since the redo, 2 already worked." */
function leftAlone(p: UndoPreview): string {
  const parts = [p.changedSince ? `${plural(p.changedSince, "session")} changed since the redo` : "", p.past ? `${plural(p.past, "session")} already happened` : "", p.gone ? `${plural(p.gone, "session")} no longer on the roster` : ""].filter(Boolean);
  return parts.length ? ` Left as they are: ${parts.join(", ")}.` : "";
}

/** What undoing a "Redo the whole week" would do now, shown before it runs. */
export async function previewUndoAutoRosterAction(auditId: string): Promise<Result & { canUndo?: boolean }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!idSchema.safeParse(auditId).success) return { ok: false, error: "That run can't be undone" };
  const r = await previewUndoRedo(repos, ctx, auditId);
  if (!r.ok) return { ok: false, error: r.error };
  const p = r.preview;
  if (!p.sessions) return { ok: true, canUndo: false, message: `Nothing to undo: every session this run changed has been changed again since, or has already happened.${leftAlone(p)}` };
  return { ok: true, canUndo: true, message: `Undo only what this run changed: ${plural(p.sessions, "session")} put back as they were (${plural(p.off, "person", "people")} off, ${plural(p.on, "person", "people")} back on).${leftAlone(p)} People whose shifts change on confirmed days are told.` };
}

/** Undo a "Redo the whole week" run: only what it changed, where nothing has changed since, from today on. */
export async function undoAutoRosterAction(auditId: string): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!idSchema.safeParse(auditId).success) return { ok: false, error: "That run can't be undone" };
  const r = await undoRedo(repos, ctx, auditId);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  if (!r.preview.sessions) return { ok: true, message: `Nothing to undo: every session this run changed has been changed again since, or has already happened.${leftAlone(r.preview)}` };
  return { ok: true, message: `Undone: ${plural(r.preview.sessions, "session")} back as they were (${r.removed} taken off, ${r.added} put back).${leftAlone(r.preview)}` };
}
