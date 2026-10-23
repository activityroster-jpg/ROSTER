import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { planAutoRoster, type AutoInstructor, type AutoSession } from "@/lib/domain/auto-roster";
import { assignBlockMessage, assignStaff } from "./assignment";
import { setDayStaff } from "./session-staff";
import { getBoard } from "./board";
import { writeAudit } from "./audit";

export interface FillOptions {
  /** Only these people are placed (the example week rosters only its made-up people). */
  onlyInstructorIds?: ReadonlySet<string>;
  /** Only these courses' sessions are filled. */
  onlyCourseIds?: ReadonlySet<string>;
}

export interface FillResult {
  /** Roles filled. */
  filled: number;
  /** Roles still open afterwards (nobody suitable free, or a pick the checks refused). */
  stillOpen: number;
  /** Whether anything was open to begin with. */
  anyOpen: boolean;
  /** Why the normal assignment checks refused a pick (first twenty). */
  refused: string[];
}

/**
 * Auto-roster one week: fill its open roles from the people who are free,
 * through the normal assignment checks (no override), and log it. The roster
 * board's Auto-roster button and the example week both come through here.
 * One-day courses get the person on the course; a day of a multi-day course
 * gets them for that day only.
 */
export async function fillOpenRoles(repos: Repositories, ctx: AnyTenantContext, monday: string, opts: FillOptions = {}): Promise<FillResult> {
  const board = await getBoard(repos, ctx, monday, { problems: false });
  const load = new Map<string, number>();
  const sessions: AutoSession[] = [];
  for (const d of board.days) {
    for (const s of d.sessions) {
      if (s.status === "cancelled") continue;
      if (opts.onlyCourseIds && !opts.onlyCourseIds.has(s.courseId)) continue;
      const on = s.staff.filter((m) => m.status !== "declined").map((m) => m.instructorId);
      for (const id of on) load.set(id, (load.get(id) ?? 0) + 1);
      const open = (board.openRoles[s.sessionId] ?? []).map((r) => ({ roleTypeId: r.roleTypeId, missing: r.missing }));
      // Full sessions go in too (with nothing open): their people must not be put somewhere that clashes.
      sessions.push({ sessionId: s.sessionId, courseId: s.courseId, courseTypeId: board.sessionMeta[s.sessionId]?.courseTypeId ?? "", date: d.date, slot: s.slot, open, onSession: on, startAt: s.startAt, endAt: s.endAt });
    }
  }
  const people: AutoInstructor[] = board.instructors
    .filter((i) => !opts.onlyInstructorIds || opts.onlyInstructorIds.has(i.id))
    .map((i) => ({
      id: i.id, name: i.name, fit: i.fit, teaches: i.teaches, knownQualifications: i.knownQualifications, fills: i.fills,
      availability: Object.fromEntries(Object.entries(i.availability).map(([k, v]) => [k, v.status])),
      load: load.get(i.id) ?? 0,
    }));
  const plan = planAutoRoster(sessions, people, new Map(board.roles.map((r) => [r.id, r])));
  const anyOpen = sessions.some((s) => s.open.length > 0);
  const unfilled = plan.unfilled.reduce((n, u) => n + u.missing, 0);
  if (plan.picks.length === 0) return { filled: 0, stillOpen: unfilled, anyOpen, refused: [] };

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
  const stillOpen = unfilled + (plan.picks.length - filled);
  await writeAudit(repos, ctx, { action: "auto_roster", entity: "roster", entityId: monday, after: { week: monday, mode: "open", filled, stillOpen, refused: refused.slice(0, 20) } });
  return { filled, stillOpen, anyOpen, refused: refused.slice(0, 20) };
}
