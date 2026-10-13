/** Who is on a roster day and in which shifts: instructor id → shift keys. */
export type DayShifts = Record<string, string[]>;

/**
 * Who to tell when a day is confirmed. With nothing kept from before (the
 * first confirmation) everyone on the day hears, with their shifts. When the
 * day was confirmed before and put back to pending, only the people whose
 * shifts changed hear: anyone still on it gets their shifts for the day, and
 * anyone taken off entirely is told they're off. Pure.
 */
export function diffDayShifts(before: DayShifts | null, now: DayShifts): Record<string, { shifts: string[]; removed: boolean }> {
  const out: Record<string, { shifts: string[]; removed: boolean }> = {};
  if (!before) {
    for (const [id, keys] of Object.entries(now)) if (keys.length) out[id] = { shifts: [...keys].sort(), removed: false };
    return out;
  }
  for (const id of new Set([...Object.keys(before), ...Object.keys(now)])) {
    const was = [...(before[id] ?? [])].sort();
    const is = [...(now[id] ?? [])].sort();
    if (was.length === is.length && was.every((k, i) => k === is[i])) continue;
    out[id] = is.length ? { shifts: is, removed: false } : { shifts: [], removed: true };
  }
  return out;
}
