import type { Repositories } from "@/lib/db/repositories";
import { actorUserId, isGhostContext, type AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, sessionStaffOverride as overrideTable } from "@/lib/db/schema";
import { planAutoRoster, type AutoInstructor, type AutoSession } from "@/lib/domain/auto-roster";
import { diffWeek, planUndo, type WeekChange, type WeekState } from "@/lib/domain/week-redo";
import { todayIso } from "@/lib/domain/time";
import { runAtomic } from "@/lib/db/batch";
import { getBoard, type BoardData } from "./board";
import { syncHoursForCourse } from "./hours";
import { notifyInstructors } from "./notifications";
import { confirmedDays } from "./roster-days";

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Who is on each live session of the week now (declined people aren't counted as on). */
export function weekStateOf(board: BoardData): WeekState {
  const out: WeekState = {};
  for (const d of board.days) for (const s of d.sessions) {
    if (s.status === "cancelled") continue;
    out[s.sessionId] = s.staff.filter((m) => m.status !== "declined").map((m) => ({ instructorId: m.instructorId, roleTypeId: m.roleTypeId }));
  }
  return out;
}

export interface ApplyResult { added: number; removed: number; notified: number; auditId: string | null }

/**
 * Make the week match `target` in one all-or-nothing write: people come off
 * (off a one-day course; skipped for that day of a longer one; a one-day add
 * removed) and go on (on a one-day course; added for that day of a longer
 * one, or a skip undone). Anyone whose shifts didn't change is left alone and
 * hears nothing; on confirmed days the people who changed are told, once each.
 * Pay lines then follow the roster. The change-log entry keeps the week as it
 * was, so it can be undone.
 */
export async function applyWeekState(
  repos: Repositories,
  ctx: AnyTenantContext,
  board: BoardData,
  target: WeekState,
  audit: { action: string; after: Record<string, unknown> },
): Promise<ApplyResult> {
  const t = repos.tenant;
  const before = weekStateOf(board);
  const changes = diffWeek(before, target);
  if (!changes.length) return { added: 0, removed: 0, notified: 0, auditId: null };
  const sessionIds = [...new Set(changes.map((c) => c.sessionId))];
  const overrides = await t.sessionStaffOverride.listIn(ctx, overrideTable.courseSessionId, sessionIds);
  const sessionOf = new Map(board.days.flatMap((d) => d.sessions.map((s) => [s.sessionId, { s, date: d.date }] as const)));
  const ops: PromiseLike<unknown>[] = [];
  const touched = new Set<string>();
  for (const c of changes) {
    const at = sessionOf.get(c.sessionId);
    if (!at) continue;
    const { s } = at;
    const multiDay = board.sessionMeta[c.sessionId]?.multiDay ?? true;
    const override = overrides.find((o) => o.courseSessionId === c.sessionId && o.instructorId === c.instructorId);
    touched.add(s.courseId);
    if (c.kind === "off") {
      const member = s.staff.find((m) => m.instructorId === c.instructorId && m.roleTypeId === c.roleTypeId);
      if (!member) continue;
      if (member.dayOnly && override) ops.push(t.sessionStaffOverride.deleteStatement(ctx, override.id));
      else if (member.assignmentId && !multiDay) ops.push(t.courseStaff.deleteStatement(ctx, member.assignmentId));
      else if (member.assignmentId) ops.push(t.sessionStaffOverride.insertStatement(ctx, { courseSessionId: c.sessionId, instructorId: c.instructorId, roleTypeId: c.roleTypeId, mode: "skip", note: "Auto-roster: week redone" }));
    } else {
      if (override?.mode === "skip") ops.push(t.sessionStaffOverride.deleteStatement(ctx, override.id));
      else if (!multiDay) ops.push(t.courseStaff.insertStatement(ctx, { courseId: s.courseId, instructorId: c.instructorId, roleTypeId: c.roleTypeId, status: "assigned" }));
      else ops.push(t.sessionStaffOverride.insertStatement(ctx, { courseSessionId: c.sessionId, instructorId: c.instructorId, roleTypeId: c.roleTypeId, mode: "add", note: "Auto-roster" }));
    }
  }
  // The log row gets a known id, so the run can be undone from it.
  const auditId = crypto.randomUUID();
  const entry = isGhostContext(ctx) ? null : t.auditLog.insertStatement(ctx, {
    id: auditId, actorUserId: actorUserId(ctx), action: audit.action, entity: "roster", entityId: board.monday,
    before: JSON.stringify({ week: before }),
    // The changes themselves are kept so an undo can reverse exactly these and nothing else.
    after: JSON.stringify({ ...audit.after, added: changes.filter((c) => c.kind === "on").length, removed: changes.filter((c) => c.kind === "off").length, changes }),
  });
  await runAtomic(repos.db, [...ops, ...(entry ? [entry] : [])]);
  for (const courseId of touched) await syncHoursForCourse(repos, ctx, courseId);

  // Tell people on confirmed days, once each, only about what changed for them.
  const confirmed = await confirmedDays(repos, ctx);
  const courses = new Map((await t.course.listIn(ctx, courseTable.id, [...touched])).map((c) => [c.id, c.name ?? "Course"]));
  const per = new Map<string, { on: string[]; off: string[] }>();
  for (const c of changes) {
    const at = sessionOf.get(c.sessionId);
    if (!at || !confirmed.has(at.date)) continue;
    const e = per.get(c.instructorId) ?? { on: [], off: [] };
    (c.kind === "on" ? e.on : e.off).push(`${fmtDay(at.date)} · ${courses.get(at.s.courseId) ?? "Course"}`);
    per.set(c.instructorId, e);
  }
  const items = [...per].map(([instructorId, e]) => ({ instructorId, input: {
    title: e.on.length ? "Roster change: new shifts" : "Roster change: you're off some shifts",
    body: [e.on.length ? `You're now on ${e.on.length} shift${e.on.length === 1 ? "" : "s"}.` : "", e.off.length ? `You're no longer on ${e.off.join(", ")}.` : ""].filter(Boolean).join(" "),
    email: true,
    detailLines: e.on,
  } }));
  const notified = await notifyInstructors(repos, ctx, items);
  return { added: changes.filter((c) => c.kind === "on").length, removed: changes.filter((c) => c.kind === "off").length, notified, auditId: entry ? auditId : null };
}

/** The new week for "Redo the whole week": every place open, filled from scratch by the planner. Nothing is written. */
export function planRedo(board: BoardData): { target: WeekState; open: number } {
  const sessions: AutoSession[] = [];
  for (const d of board.days) for (const s of d.sessions) {
    if (s.status === "cancelled") continue;
    const needs = board.sessionMeta[s.sessionId]?.needs ?? [];
    sessions.push({ sessionId: s.sessionId, courseId: s.courseId, courseTypeId: board.sessionMeta[s.sessionId]?.courseTypeId ?? "", date: d.date, slot: s.slot, open: needs.filter((n) => n.count > 0).map((n) => ({ roleTypeId: n.roleTypeId, missing: n.count })), onSession: [], startAt: s.startAt, endAt: s.endAt });
  }
  const people: AutoInstructor[] = board.instructors.map((i) => ({
    id: i.id, name: i.name, fit: i.fit, teaches: i.teaches, knownQualifications: i.knownQualifications, fills: i.fills,
    availability: Object.fromEntries(Object.entries(i.availability).map(([k, v]) => [k, v.status])),
    load: 0,
  }));
  const plan = planAutoRoster(sessions, people, new Map(board.roles.map((r) => [r.id, r])));
  const target: WeekState = Object.fromEntries(sessions.map((s) => [s.sessionId, [] as WeekState[string]]));
  for (const p of plan.picks) target[p.sessionId]!.push({ instructorId: p.instructorId, roleTypeId: p.roleTypeId });
  return { target, open: plan.unfilled.reduce((n, u) => n + u.missing, 0) };
}

/** Redo the whole week in one go. */
export async function redoWeek(repos: Repositories, ctx: AnyTenantContext, monday: string) {
  const board = await getBoard(repos, ctx, monday);
  const { target, open } = planRedo(board);
  const r = await applyWeekState(repos, ctx, board, target, { action: "auto_roster_redo", after: { week: monday, open } });
  return { ...r, open };
}

export interface UndoPreview { sessions: number; off: number; on: number; changedSince: number; past: number; gone: number }

/** Work out an undo from its change-log entry, against the week as it is now. Nothing is written. */
type PreparedUndo = { error: string } | { error?: undefined; board: BoardData; plan: ReturnType<typeof planUndo>; preview: UndoPreview; monday: string };

async function prepareUndo(repos: Repositories, ctx: AnyTenantContext, auditId: string): Promise<PreparedUndo> {
  const row = await repos.tenant.auditLog.findById(ctx, auditId);
  if (!row || row.action !== "auto_roster_redo" || !row.entityId || !row.before || !row.after) return { error: "That Auto-roster run can't be undone" };
  const week = (JSON.parse(row.before) as { week?: WeekState }).week;
  const changes = (JSON.parse(row.after) as { changes?: WeekChange[] }).changes;
  if (!week) return { error: "That Auto-roster run can't be undone" };
  // Runs saved before the changes were recorded can't be told apart from later edits, so they aren't undone.
  if (!changes) return { error: "This Auto-roster run was saved before undo could tell its changes from later ones, so it can't be undone safely. Change the sessions by hand instead." };
  const board = await getBoard(repos, ctx, row.entityId);
  const dateOf = new Map(board.days.flatMap((d) => d.sessions.map((s) => [s.sessionId, d.date] as const)));
  const today = todayIso();
  const plan = planUndo(week, changes, weekStateOf(board), (id) => (dateOf.get(id) ?? "") >= today);
  const moves = diffWeek(weekStateOf(board), plan.target);
  const preview: UndoPreview = { sessions: Object.keys(plan.target).length, off: moves.filter((m) => m.kind === "off").length, on: moves.filter((m) => m.kind === "on").length, changedSince: plan.changedSince, past: plan.past, gone: plan.gone };
  return { board, plan, preview, monday: row.entityId };
}

/** What an undo would do now, for the confirmation before it runs. */
export async function previewUndoRedo(repos: Repositories, ctx: AnyTenantContext, auditId: string): Promise<{ ok: true; preview: UndoPreview } | { ok: false; error: string }> {
  const p = await prepareUndo(repos, ctx, auditId);
  return p.error !== undefined ? { ok: false, error: p.error } : { ok: true, preview: p.preview };
}

/**
 * Undo a "Redo the whole week": reverse only what that run changed, on
 * sessions still exactly as it left them and not yet happened. Anything
 * changed since, or already worked, is left alone (and counted in the result).
 */
export async function undoRedo(repos: Repositories, ctx: AnyTenantContext, auditId: string): Promise<{ ok: true; added: number; removed: number; notified: number; preview: UndoPreview } | { ok: false; error: string }> {
  const p = await prepareUndo(repos, ctx, auditId);
  if (p.error !== undefined) return { ok: false, error: p.error };
  if (!p.preview.sessions) return { ok: true, added: 0, removed: 0, notified: 0, preview: p.preview };
  const r = await applyWeekState(repos, ctx, p.board, p.plan.target, { action: "auto_roster_undo", after: { week: p.monday, undid: auditId } });
  return { ok: true, added: r.added, removed: r.removed, notified: r.notified, preview: p.preview };
}
