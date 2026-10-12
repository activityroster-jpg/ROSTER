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
import { getBoard } from "@/lib/services/board";
import { weekStart } from "@/lib/services/schedule";
import { planAutoRoster, type AutoInstructor, type AutoSession } from "@/lib/domain/auto-roster";

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
export async function autoRosterAction(input: { monday: string }): Promise<Result & { filled?: number; open?: number }> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (typeof input?.monday !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.monday)) return { ok: false, error: "Invalid week" };
  const monday = weekStart(new Date(`${input.monday}T00:00:00Z`));
  const board = await getBoard(repos, ctx, monday);

  const load = new Map<string, number>();
  const sessions: AutoSession[] = [];
  for (const d of board.days) {
    for (const s of d.sessions) {
      const on = s.staff.filter((m) => m.status !== "declined").map((m) => m.instructorId);
      for (const id of on) load.set(id, (load.get(id) ?? 0) + 1);
      const open = (board.openRoles[s.sessionId] ?? []).map((r) => ({ roleTypeId: r.roleTypeId, missing: r.missing }));
      if (open.length && s.status !== "cancelled") sessions.push({ sessionId: s.sessionId, courseId: s.courseId, courseTypeId: board.sessionMeta[s.sessionId]?.courseTypeId ?? "", date: d.date, slot: s.slot, open, onSession: on });
    }
  }
  const people: AutoInstructor[] = board.instructors.map((i) => ({
    id: i.id, name: i.name, fit: i.fit, teaches: i.teaches, knownQualifications: i.knownQualifications,
    availability: Object.fromEntries(Object.entries(i.availability).map(([k, v]) => [k, v.status])),
    load: load.get(i.id) ?? 0,
  }));
  const plan = planAutoRoster(sessions, people);
  if (plan.picks.length === 0) {
    return sessions.length === 0
      ? { ok: true, message: "Every role is already filled.", filled: 0, open: 0 }
      : { ok: true, message: `Nobody suitable is free for the ${plan.unfilled.reduce((n, u) => n + u.missing, 0)} open role${plan.unfilled.length === 1 ? "" : "s"}; nothing was changed.`, filled: 0, open: plan.unfilled.reduce((n, u) => n + u.missing, 0) };
  }

  // Apply through the normal checks (no override): a pick the checks refuse is left open.
  let filled = 0;
  const refused: string[] = [];
  for (const p of plan.picks) {
    const multiDay = board.sessionMeta[p.sessionId]?.multiDay ?? true;
    const r = multiDay
      ? await setDayStaff(repos, ctx, { sessionId: p.sessionId, instructorId: p.instructorId, roleTypeId: p.roleTypeId, mode: "add" })
      : await assignStaff(repos, ctx, { courseId: p.courseId, instructorId: p.instructorId, roleTypeId: p.roleTypeId });
    if (r.ok) filled++;
    else refused.push("error" in r ? r.error : assignBlockMessage(r.reason, r.detail));
  }
  const stillOpen = plan.unfilled.reduce((n, u) => n + u.missing, 0) + (plan.picks.length - filled);
  await writeAudit(repos, ctx, { action: "auto_roster", entity: "roster", entityId: monday, after: { week: monday, filled, stillOpen, refused: refused.slice(0, 20) } });
  refresh();
  const msg = stillOpen === 0
    ? `Filled ${filled} role${filled === 1 ? "" : "s"}. Every role is now covered.`
    : `Filled ${filled} role${filled === 1 ? "" : "s"}; ${stillOpen} still open — not enough suitable people free. Those stay marked open on the board.`;
  return { ok: true, message: msg, filled, open: stillOpen };
}
