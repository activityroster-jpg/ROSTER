/**
 * Age rules. Pure: no DB, no I/O. Dates of birth are ISO strings (YYYY-MM-DD);
 * "today" is passed in so the rules are testable and timezone-explicit.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(s: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = ISO.exec(s ?? "");
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Whole years old on `on` (UTC calendar), or null when the date is missing/invalid. */
export function ageOn(dob: string | null | undefined, on: Date = new Date()): number | null {
  const b = parseIsoDate(dob);
  if (!b) return null;
  let age = on.getUTCFullYear() - b.y;
  const beforeBirthday = on.getUTCMonth() + 1 < b.m || (on.getUTCMonth() + 1 === b.m && on.getUTCDate() < b.d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** True only when a date of birth is known and the person is under 18 on `on`. */
export function isUnder18(dob: string | null | undefined, on: Date = new Date()): boolean {
  const a = ageOn(dob, on);
  return a !== null && a < 18;
}

/** The date the person turns 18 (YYYY-MM-DD), or null. */
export function eighteenthBirthday(dob: string | null | undefined): string | null {
  const b = parseIsoDate(dob);
  if (!b) return null;
  return `${String(b.y + 18).padStart(4, "0")}-${String(b.m).padStart(2, "0")}-${String(b.d).padStart(2, "0")}`;
}

/** Plausible for a staff member: 13 to 90 years old today. */
export function plausibleStaffDob(dob: string, on: Date = new Date()): boolean {
  const a = ageOn(dob, on);
  return a !== null && a >= 13 && a <= 90;
}
