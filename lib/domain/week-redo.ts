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
