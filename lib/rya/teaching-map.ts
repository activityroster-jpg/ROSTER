/**
 * RYA teaching map — which courses a held instructor qualification lets someone
 * teach. Used to auto-suggest "courses they can teach" from the licences an
 * instructor holds, in both the onboarding Team step and the Staff add form.
 *
 * Deliberately CONSERVATIVE: when we can't be confident, we return null so the
 * course is NOT pre-selected (the admin can still tick it manually). Assistant
 * grades, safety-boat and first-aid certificates, racing and Sailability are all
 * left for the admin to decide.
 */

/**
 * The discipline an instructor QUALIFICATION lets them teach, or null when we
 * can't be sure. Name-based, so it works anywhere we have the qualification name.
 */
export function qualTeachDiscipline(qualName: string): string | null {
  const n = qualName.toLowerCase();
  // Not lead-teaching licences → never auto-preselect courses.
  if (/assistant/.test(n)) return null;
  if (/safety boat/.test(n)) return null;
  if (/first aid/.test(n)) return null;
  // Only real teaching grades preselect (instructor / coach / trainer).
  if (!/instructor|coach|trainer/.test(n)) return null;
  if (/windsurf/.test(n)) return "windsurf";
  if (/paddleboard|\bsup\b/.test(n)) return "sup";
  if (/powerboat|personal watercraft|\bpwc\b/.test(n)) return "powerboat";
  if (/keelboat/.test(n)) return "keelboat";
  if (/cruising|yachtmaster/.test(n)) return "cruising";
  if (/shorebased/.test(n)) return "shorebased";
  if (/dinghy|sailing|racing/.test(n)) return "dinghy";
  return null;
}

/**
 * The discipline a COURSE belongs to, or null when uncertain. Uses the RYA
 * scheme/category first (most reliable), then the name. Racing and Sailability
 * return null on purpose — they need a specialist licence, so we don't preselect.
 */
export function courseTeachDiscipline(c: { name: string; scheme?: string | null; category?: string | null }): string | null {
  const scheme = (c.scheme ?? "").toLowerCase();
  const cat = (c.category ?? "").toLowerCase();
  const name = c.name.toLowerCase();
  const hay = `${scheme} ${cat} ${name}`;
  // Specialist / uncertain → don't preselect.
  if (/sailability/.test(hay)) return null;
  if (/racing|race coaching/.test(cat) || /club racing|race coaching/.test(name)) return null;
  if (/windsurf/.test(hay)) return "windsurf";
  if (/paddleboard|paddle|\bsup\b/.test(hay)) return "sup";
  if (/powerboat|safety boat|personal watercraft|pwc|jet ski/.test(hay)) return "powerboat";
  if (/keelboat/.test(hay)) return "keelboat";
  // Shorebased/theory BEFORE cruising, so "Day Skipper Theory" isn't caught by "skipper".
  if (/shorebased|theory|navigation|radio|vhf|src|diesel|sea survival|first aid/.test(hay)) return "shorebased";
  if (/cruising|yacht|competent crew|skipper/.test(hay)) return "cruising";
  if (/national sailing|youth sailing|onboard|dinghy/.test(hay)) return "dinghy";
  return null;
}

export interface CourseLike { id: string; name: string; scheme?: string | null; category?: string | null }

/** Distinct teachable disciplines from a set of held qualification names. */
export function disciplinesForQuals(qualNames: string[]): Set<string> {
  return new Set(qualNames.map(qualTeachDiscipline).filter((d): d is string => Boolean(d)));
}

/** Course ids teachable by the held qualifications, among the given courses. */
export function coursesForQuals(qualNames: string[], courses: CourseLike[]): Set<string> {
  const disciplines = disciplinesForQuals(qualNames);
  const out = new Set<string>();
  if (disciplines.size === 0) return out;
  for (const c of courses) {
    const d = courseTeachDiscipline(c);
    if (d && disciplines.has(d)) out.add(c.id);
  }
  return out;
}
