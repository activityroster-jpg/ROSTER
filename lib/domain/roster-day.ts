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
 * Before a day is confirmed: the people on it whose ticket for their place has
 * no expiry date recorded, so the app can't warn when it lapses. The ticket is
 * the place's instructor type when they hold it; someone placed on the
 * strength of a higher type is flagged only when none of their types has a
 * date. Places with no instructor type are not checked. Pure.
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
    const mine = byPerson.get(m.instructorId) ?? [];
    const exact = mine.find((h) => h.qualificationTypeId === typeId);
    if (exact ? !exact.expiryDate : !mine.some((h) => h.expiryDate)) out.add(m.instructorId);
  }
  return [...out];
}
