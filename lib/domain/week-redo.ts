/** Who is on each session of a week: session id → people and the place each fills. */
export type WeekState = Record<string, { instructorId: string; roleTypeId: string }[]>;

export interface WeekChange { sessionId: string; instructorId: string; roleTypeId: string; kind: "on" | "off" }

/**
 * What has to change to turn one week into another: per session, the people
 * to take off and the people to put on. Someone in both, in the same place,
 * is left alone. Someone who only changes place on a session is kept where
 * they are (a place swap isn't worth a message). Sessions missing from the
 * target are left as they are. Pure.
 */
export function diffWeek(before: WeekState, target: WeekState): WeekChange[] {
  const out: WeekChange[] = [];
  for (const [sessionId, want] of Object.entries(target)) {
    const have = before[sessionId] ?? [];
    const haveIds = new Set(have.map((m) => m.instructorId));
    const wantIds = new Set(want.map((m) => m.instructorId));
    for (const m of have) if (!wantIds.has(m.instructorId)) out.push({ sessionId, ...m, kind: "off" });
    for (const m of want) if (!haveIds.has(m.instructorId)) out.push({ sessionId, ...m, kind: "on" });
  }
  return out;
}

export interface UndoPlan {
  /** The sessions to put back, each as it was before the redo. */
  target: WeekState;
  /** Sessions the redo changed that are left alone, and why. */
  changedSince: number;
  past: number;
  gone: number;
}

const memberKey = (m: { instructorId: string; roleTypeId: string }) => `${m.instructorId}|${m.roleTypeId}`;
const sameMembers = (a: WeekState[string], b: WeekState[string]) => {
  const x = a.map(memberKey).sort(), y = b.map(memberKey).sort();
  return x.length === y.length && x.every((k, i) => k === y[i]);
};

/**
 * Undoing a redo reverses only what the redo itself did. A session the redo
 * changed is put back as it was only when it is still exactly as the redo
 * left it and hasn't happened yet. One changed since (by hand or another run),
 * one in the past, or one no longer on the roster is left alone and counted.
 * Sessions the redo didn't touch are never part of the undo. Pure.
 */
export function planUndo(before: WeekState, changes: WeekChange[], now: WeekState, isUpcoming: (sessionId: string) => boolean): UndoPlan {
  const target: WeekState = {};
  let changedSince = 0, past = 0, gone = 0;
  for (const sessionId of new Set(changes.map((c) => c.sessionId))) {
    const was = before[sessionId] ?? [];
    const mine = changes.filter((c) => c.sessionId === sessionId);
    const off = new Set(mine.filter((c) => c.kind === "off").map(memberKey));
    const redoLeft = [...was.filter((m) => !off.has(memberKey(m))), ...mine.filter((c) => c.kind === "on").map(({ instructorId, roleTypeId }) => ({ instructorId, roleTypeId }))];
    const current = now[sessionId];
    if (!current) gone++;
    else if (!isUpcoming(sessionId)) past++;
    else if (!sameMembers(current, redoLeft)) changedSince++;
    else target[sessionId] = was;
  }
  return { target, changedSince, past, gone };
}
