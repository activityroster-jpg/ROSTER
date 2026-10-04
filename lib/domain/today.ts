/**
 * The Today strip (audit A1-1, option B): what an admin opening the app at
 * 08:00 on a sailing day wants first. Pure: pass today's roster day.
 */

export interface TodaySession {
  sessionId: string;
  courseName: string;
  startAt: number;
  endAt: number;
  coverageOk: boolean;
  staff: { instructorId: string; name: string; status: "assigned" | "confirmed" | "declined" }[];
}

export interface TodaySummary {
  sessions: number;
  /** Distinct people on the water today (not declined). */
  people: number;
  /** Sessions short of cover or safety boat, or with nobody on them. */
  uncovered: number;
  /** People who said they can't make a session today. */
  declined: number;
  /** Assigned but not yet confirmed (published weeks only make sense here; the caller decides). */
  unconfirmed: number;
  /** First and last session times, for the headline. */
  firstStart: number | null;
  lastEnd: number | null;
  /** Names who have declined, for the strip. */
  declinedNames: string[];
}

export function summariseToday(sessions: readonly TodaySession[]): TodaySummary {
  const people = new Set<string>();
  const declined = new Set<string>();
  let uncovered = 0;
  let unconfirmed = 0;
  for (const s of sessions) {
    const live = s.staff.filter((m) => m.status !== "declined");
    if (!s.coverageOk || live.length === 0) uncovered++;
    for (const m of s.staff) {
      if (m.status === "declined") declined.add(m.name);
      else { people.add(m.instructorId); if (m.status === "assigned") unconfirmed++; }
    }
  }
  const starts = sessions.map((s) => s.startAt);
  const ends = sessions.map((s) => s.endAt);
  return {
    sessions: sessions.length,
    people: people.size,
    uncovered,
    declined: declined.size,
    unconfirmed,
    firstStart: starts.length ? Math.min(...starts) : null,
    lastEnd: ends.length ? Math.max(...ends) : null,
    declinedNames: [...declined].sort(),
  };
}
