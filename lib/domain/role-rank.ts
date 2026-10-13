/**
 * Seniority of a role, so staffing rows and role pickers list the higher
 * levels first (Chief Instructor, Senior Instructor, Instructor, Assistant
 * Instructor, then support roles). A place that is an instructor type goes by
 * its rank on the ladder (Assistant 10 → 50, Dinghy Instructor 20 → 60,
 * Senior Instructor 40 → 80, Coach/Assessor 50 → 90, on the same scale as the
 * names below); any other place goes by its name. Pure; a role name nothing
 * here recognises sits with the ordinary instructors.
 */
const RULES: [RegExp, number][] = [
  [/\b(principal|chief|head)\b/i, 100],
  [/course director/i, 95],
  [/master instructor|idc staff/i, 90],
  [/master scuba diver trainer/i, 85],
  [/senior/i, 80],
  [/\bchief\b/i, 78],
  [/divemaster/i, 55],
  [/assistant|trainee/i, 50],
  [/instructor|coach|trainer/i, 70],
  [/safety|boat|skipper|driver|crew/i, 30],
  [/first aid/i, 25],
  [/volunteer|helper/i, 10],
];

export function roleRank(name: string): number {
  for (const [re, rank] of RULES) if (re.test(name)) return rank;
  return 40;
}

/** An instructor type's ladder rank on the name scale above. */
export function typeSeniority(typeRank: number): number {
  return 40 + typeRank;
}

/** Highest-ranked first; ties keep their given order. `rank` is the place's instructor-type rank (0 or absent for an untyped place). */
export function bySeniority<T extends { roleName?: string; name?: string; rank?: number }>(roles: readonly T[]): T[] {
  return roles
    .map((r, i) => ({ r, i, rank: r.rank ? typeSeniority(r.rank) : roleRank(r.roleName ?? r.name ?? "") }))
    .sort((a, b) => b.rank - a.rank || a.i - b.i)
    .map((x) => x.r);
}
