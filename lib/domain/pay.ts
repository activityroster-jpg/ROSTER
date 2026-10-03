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
