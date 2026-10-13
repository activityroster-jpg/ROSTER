import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { SlotCode } from "@/lib/db/schema";
import { clashModeFor, hasConflict, type ResourceBooking } from "@/lib/domain";
import { runAtomic } from "@/lib/db/batch";
import { auditStatement } from "./audit";
import { planHoursForCourse } from "./hours";
import { sessionsForInstructor, staffBySession } from "./session-staff";

const ms = (v: Date | number) => (v instanceof Date ? v.getTime() : Number(v));

export interface SessionMove { courseId: string; sessionId: string; date: string; slot: SlotCode; startAt: Date; endAt: Date }
export type MoveResult =
  | { ok: true; before: { date: string } }
  | { ok: false; error: string }
  | { ok: false; clashes: string[] };

/**
 * Who on this session would clash at the new date and time: each "Sam is on
 * Youth Stage 3 then". Uses the centre's clash rule (same slot, or times that
 * overlap), whatever the clash setting, because this is a warning before saving.
 */
export async function clashesForMove(repos: Repositories, ctx: AnyTenantContext, move: SessionMove): Promise<string[]> {
  const t = repos.tenant;
  const session = await t.courseSession.findById(ctx, move.sessionId);
  if (!session) return [];
  const [settings, staffMap] = await Promise.all([t.orgSettings.list(ctx).then((r) => r[0]), staffBySession(repos, ctx, [session])]);
  const people = (staffMap.get(session.id) ?? []).filter((m) => m.status !== "declined");
  if (!people.length) return [];
  const mode = clashModeFor(settings?.slotStyle);
  const instructors = await t.instructor.list(ctx);
  const nameOf = new Map(instructors.map((i) => [i.id, i.name]));
  const out: string[] = [];
  for (const p of people) {
    const others = (await sessionsForInstructor(repos, ctx, p.instructorId)).filter((s) => s.id !== session.id && s.date === move.date);
    const bookings: ResourceBooking[] = others.map((s) => ({ sessionId: s.id, resourceId: p.instructorId, startAt: ms(s.startAt), endAt: ms(s.endAt), courseId: s.courseId, date: s.date, slot: s.slot }));
    const candidate = { sessionId: session.id, resourceId: p.instructorId, startAt: move.startAt.getTime(), endAt: move.endAt.getTime(), date: move.date, slot: move.slot };
    if (!hasConflict(candidate, bookings, mode)) continue;
    const hit = others.find((s) => hasConflict(candidate, [{ sessionId: s.id, resourceId: p.instructorId, startAt: ms(s.startAt), endAt: ms(s.endAt), courseId: s.courseId, date: s.date, slot: s.slot }], mode));
    const course = hit ? await t.course.findById(ctx, hit.courseId) : null;
    out.push(`${nameOf.get(p.instructorId) ?? "Someone"} is on ${course?.name ?? "another course"} then`);
  }
  return out;
}

/**
 * Move one session to a new date and time. When someone on it would clash at
 * the new time the office is asked first (pass `confirmed` to go ahead). The
 * new times, their pay lines and the change-log entry are one all-or-nothing write.
 */
export async function moveSession(repos: Repositories, ctx: AnyTenantContext, move: SessionMove, confirmed: boolean): Promise<MoveResult> {
  const t = repos.tenant;
  const session = await t.courseSession.findById(ctx, move.sessionId);
  if (!session || session.courseId !== move.courseId) return { ok: false, error: "Session not found" };
  if (!confirmed) {
    const clashes = await clashesForMove(repos, ctx, move);
    if (clashes.length) return { ok: false, clashes };
  }
  const patch = { date: move.date, slot: move.slot, startAt: move.startAt, endAt: move.endAt };
  const hours = await planHoursForCourse(repos, ctx, move.courseId, { adjustSessions: (rows) => rows.map((s) => (s.id === session.id ? { ...s, ...patch } : s)) });
  const audit = auditStatement(repos, ctx, {
    action: "update_session",
    entity: "course",
    entityId: move.courseId,
    before: { sessionId: session.id, date: session.date, slot: session.slot },
    after: { sessionId: session.id, date: move.date, slot: move.slot, startAt: move.startAt.toISOString(), endAt: move.endAt.toISOString(), clashConfirmed: confirmed },
  });
  await runAtomic(repos.db, [t.courseSession.updateStatement(ctx, session.id, patch), ...hours.statements, ...(audit ? [audit] : [])]);
  return { ok: true, before: { date: session.date } };
}
