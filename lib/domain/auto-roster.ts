import type { EffectiveStatus } from "./availability";

/**
 * Auto-roster: fill a week's open roles from the people who are free, spreading
 * the work evenly. Pure: the caller gathers the week (open roles, who is on
 * what, availability, fit, qualifications) and applies the picks through the
 * usual assignment checks. Nothing is forced: a role nobody suitable is free
 * for stays open and is reported.
 */
export interface AutoSession {
  sessionId: string;
  courseId: string;
  courseTypeId: string;
  date: string;
  slot: string;
  /** Roles still to fill on this session (empty for a full session, which still counts for clashes). */
  open: { roleTypeId: string; missing: number }[];
  /** Everyone already on the session (any role), so nobody is added twice or put somewhere that clashes. */
  onSession: string[];
  /** Wall-clock start and end (ms): two sessions clash when they share a slot or their times overlap. */
  startAt?: number;
  endAt?: number;
}

export interface AutoInstructor {
  id: string;
  name: string;
  /** False when licence checks are on and a mandatory check is missing or expired. */
  fit: boolean;
  /** Course type ids they can teach; with nothing recorded nobody is ruled out. */
  teaches: string[];
  knownQualifications: boolean;
  /** Effective availability per `${date}|${slot}`; a missing key counts as not asked. */
  availability: Record<string, EffectiveStatus>;
  /** Sessions already on their plate this week: the planner evens this out. */
  load: number;
}

export interface AutoPick { sessionId: string; courseId: string; instructorId: string; roleTypeId: string; date: string; slot: string }
export interface AutoUnfilled { sessionId: string; roleTypeId: string; missing: number; date: string; slot: string }
export interface AutoPlan {
  picks: AutoPick[];
  unfilled: AutoUnfilled[];
  /** True when every open role found someone. */
  complete: boolean;
}

/** Free first, then Maybe, then people nobody has asked yet; Busy never. */
const AVAIL_RANK: Record<EffectiveStatus, number> = { available: 0, tentative: 1, unasked: 2, unavailable: 99 };

export function planAutoRoster(sessions: readonly AutoSession[], instructors: readonly AutoInstructor[]): AutoPlan {
  const load = new Map(instructors.map((i) => [i.id, i.load]));
  // Where each person is this week (already, or put there by this run), to stop clashes: same slot, or overlapping times that day.
  const taken = new Map<string, AutoSession[]>();
  const mark = (id: string, s: AutoSession) => { const l = taken.get(id) ?? []; l.push(s); taken.set(id, l); };
  const clashes = (a: AutoSession, b: AutoSession) =>
    a.date === b.date && (a.slot === b.slot || (a.startAt != null && a.endAt != null && b.startAt != null && b.endAt != null && a.startAt < b.endAt && b.startAt < a.endAt));
  const busyFor = (id: string, s: AutoSession) => (taken.get(id) ?? []).some((t) => clashes(t, s));
  for (const s of sessions) for (const id of s.onSession) mark(id, s);

  const picks: AutoPick[] = [];
  const unfilled: AutoUnfilled[] = [];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot) || a.sessionId.localeCompare(b.sessionId));
  for (const s of ordered) {
    const key = `${s.date}|${s.slot}`;
    const onThis = new Set(s.onSession);
    for (const role of s.open) {
      let missing = role.missing;
      while (missing > 0) {
        const candidates = instructors
          .filter((i) => i.fit && !onThis.has(i.id) && !busyFor(i.id, s))
          .filter((i) => !i.knownQualifications || i.teaches.includes(s.courseTypeId))
          .map((i) => ({ i, avail: AVAIL_RANK[i.availability[key] ?? "unasked"] }))
          .filter((c) => c.avail < AVAIL_RANK.unavailable)
          .sort((a, b) =>
            (load.get(a.i.id) ?? 0) - (load.get(b.i.id) ?? 0)
            || a.avail - b.avail
            || Number(!a.i.knownQualifications) - Number(!b.i.knownQualifications)
            || a.i.name.localeCompare(b.i.name));
        const best = candidates[0];
        if (!best) break;
        picks.push({ sessionId: s.sessionId, courseId: s.courseId, instructorId: best.i.id, roleTypeId: role.roleTypeId, date: s.date, slot: s.slot });
        onThis.add(best.i.id);
        mark(best.i.id, s);
        load.set(best.i.id, (load.get(best.i.id) ?? 0) + 1);
        missing--;
      }
      if (missing > 0) unfilled.push({ sessionId: s.sessionId, roleTypeId: role.roleTypeId, missing, date: s.date, slot: s.slot });
    }
  }
  return { picks, unfilled, complete: unfilled.length === 0 };
}
