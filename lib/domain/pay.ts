/**
 * Pay rules as pure functions. A centre pays each instructor one of three ways:
 *   - per hour: payable minutes × rate
 *   - per session: a flat rate for each rostered session
 *   - per day: a flat rate for each day worked (paid on the first session of
 *     the day; the rest of that day's sessions pay 0)
 */
export type PayUnit = "hour" | "day" | "session";

export const PAY_UNIT_LABEL: Record<PayUnit, string> = { hour: "per hour", session: "per session", day: "per day" };

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PayLineInput {
  unit: PayUnit;
  /** Null when the instructor has no rate yet → pay is unknown, not zero. */
  rate: number | null;
  payableMinutes: number;
  /** For day rates: is this the first session of that instructor's day? */
  firstOfDay: boolean;
}

/** Pay for one line, or null when no rate is set. */
export function linePay(i: PayLineInput): number | null {
  if (i.rate == null || !Number.isFinite(i.rate)) return null;
  switch (i.unit) {
    case "hour": return round2((Math.max(0, i.payableMinutes) / 60) * i.rate);
    case "session": return round2(i.rate);
    case "day": return i.firstOfDay ? round2(i.rate) : 0;
  }
}

/** Mark the first line of each instructor-day, in the order given (sort by date, start first). */
export function markFirstOfDay<T extends { instructorId: string; date: string | null }>(lines: readonly T[]): boolean[] {
  const seen = new Set<string>();
  return lines.map((l) => {
    const key = `${l.instructorId}|${l.date ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * One stored pay rate. `instructorId` null = a centre rate (for everyone);
 * `roleTypeId` / `courseTypeId` null = any role / any course.
 */
export interface PayRateRule {
  instructorId: string | null;
  roleTypeId: string | null;
  courseTypeId: string | null;
  unit: PayUnit;
  rate: number;
  ratePence?: number | null;
}

/** Where a resolved rate came from, for the screens that explain it. */
export type PayRateSource = "person-course" | "person-role" | "person" | "centre-course" | "centre-role" | "centre";

/**
 * The rate that applies to one person, in one role, on one kind of course:
 * the most specific rate that fits wins. A person's own rates always beat the
 * centre's; within each, a course rate beats a role rate, which beats the
 * general one. So, in order:
 *   1. their rate for this course          4. the centre's rate for this role on this course
 *   2. their rate for this role             5. the centre's rate for this course
 *   3. their own rate (any course)          6. the centre's rate for this role, then the centre's general rate
 * Null when nothing fits: pay shows as unknown, never zero (volunteers).
 */
export function resolvePayRate(
  rules: readonly PayRateRule[],
  who: { instructorId: string; roleTypeId: string | null; courseTypeId: string | null },
): { unit: PayUnit; rate: number; ratePence: number; source: PayRateSource } | null {
  let best: { rule: PayRateRule; score: number } | null = null;
  for (const r of rules) {
    if (r.instructorId && r.instructorId !== who.instructorId) continue;
    if (r.roleTypeId && r.roleTypeId !== who.roleTypeId) continue;
    if (r.courseTypeId && r.courseTypeId !== who.courseTypeId) continue;
    // Person outranks everything centre-wide; then course; then role.
    const score = (r.instructorId ? 4 : 0) + (r.courseTypeId ? 2 : 0) + (r.roleTypeId ? 1 : 0);
    if (!best || score > best.score) best = { rule: r, score };
  }
  if (!best) return null;
  const { rule } = best;
  const source: PayRateSource = rule.instructorId
    ? rule.courseTypeId ? "person-course" : rule.roleTypeId ? "person-role" : "person"
    : rule.courseTypeId ? "centre-course" : rule.roleTypeId ? "centre-role" : "centre";
  return { unit: rule.unit, rate: rule.rate, ratePence: rule.ratePence != null ? rule.ratePence : Math.round(rule.rate * 100), source };
}
