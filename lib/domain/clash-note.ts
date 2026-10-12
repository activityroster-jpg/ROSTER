/**
 * Who is already on another course at the same time as a target course's
 * sessions, and where. Feeds the "qualified but not free" section of the
 * people pickers, so the office can tell "on Youth Stage 3 (Mon AM)" from
 * "said they're busy". Pure.
 */
export interface OtherSession { courseId: string; courseName: string; date: string; slot: string; instructorIds: readonly string[] }

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const when = (date: string, slot: string) => `${DAY[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? ""} ${slot}`.trim();

/** instructorId → "Course name (Mon AM)" for the first clash found, in date order. */
export function elsewhereFor(target: readonly { date: string; slot: string }[], others: readonly OtherSession[]): Map<string, string> {
  const keys = new Set(target.map((s) => `${s.date}|${s.slot}`));
  const out = new Map<string, string>();
  const sorted = [...others].sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
  for (const o of sorted) {
    if (!keys.has(`${o.date}|${o.slot}`)) continue;
    for (const id of o.instructorIds) if (!out.has(id)) out.set(id, `${o.courseName} (${when(o.date, o.slot)})`);
  }
  return out;
}
