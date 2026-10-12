/**
 * Who is already on another course at the same time as a target course's
 * sessions, and where. Feeds the "qualified but not free" section of the
 * people pickers, so the office can tell "on Youth Stage 3 (Mon AM)" from
 * "said they're busy". Pure, and indexed once so a page with hundreds of
 * courses and thousands of sessions stays cheap.
 */
export interface OtherSession { courseId: string; courseName: string; date: string; slot: string; instructorIds: readonly string[] }

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const when = (date: string, slot: string) => `${DAY[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? ""} ${slot}`.trim();

/** Sessions grouped by `${date}|${slot}`, each group in date order. Build once per page. */
export type SlotIndex = Map<string, OtherSession[]>;
export function indexSessions(sessions: readonly OtherSession[]): SlotIndex {
  const index: SlotIndex = new Map();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))) {
    const k = `${s.date}|${s.slot}`;
    index.set(k, [...(index.get(k) ?? []), s]);
  }
  return index;
}

/** instructorId → "Course name (Mon AM)" for the first clash found, in date order. */
export function elsewhereFor(target: readonly { date: string; slot: string }[], others: readonly OtherSession[] | SlotIndex, excludeCourseId?: string): Map<string, string> {
  const index = others instanceof Map ? others : indexSessions(others);
  const out = new Map<string, string>();
  const keys = [...new Set(target.map((s) => `${s.date}|${s.slot}`))].sort();
  for (const k of keys) {
    for (const o of index.get(k) ?? []) {
      if (excludeCourseId && o.courseId === excludeCourseId) continue;
      for (const id of o.instructorIds) if (!out.has(id)) out.set(id, `${o.courseName} (${when(o.date, o.slot)})`);
    }
  }
  return out;
}
