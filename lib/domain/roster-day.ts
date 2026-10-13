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

export interface HeldTicket { instructorId: string; qualificationTypeId: string; expiryDate: string | null }

/**
 * Before a day is confirmed: the people on it in an instructor-type place
 * with no expiry date on any of their tickets, so the app can't warn when
 * their qualification lapses. (An RYA instructor's tickets share one
 * validity, so one dated ticket is enough.) Places with no instructor type
 * are not checked. Pure.
 */
export function missingExpiry(
  staff: readonly { instructorId: string; roleTypeId: string }[],
  placeType: ReadonlyMap<string, string | null>,
  held: readonly HeldTicket[],
): string[] {
  const byPerson = new Map<string, HeldTicket[]>();
  for (const h of held) byPerson.set(h.instructorId, [...(byPerson.get(h.instructorId) ?? []), h]);
  const out = new Set<string>();
  for (const m of staff) {
    const typeId = placeType.get(m.roleTypeId);
    if (!typeId) continue;
    if (!(byPerson.get(m.instructorId) ?? []).some((h) => h.expiryDate)) out.add(m.instructorId);
  }
  return [...out];
}
