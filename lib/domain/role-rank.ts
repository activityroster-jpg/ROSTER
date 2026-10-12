/**
 * Seniority of a role by its name, so staffing rows and role pickers list the
 * higher levels first (Chief Instructor, Senior Instructor, Instructor,
 * Assistant Instructor, then safety and support roles). Pure; a role name
 * nothing here recognises sits with the ordinary instructors.
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

/** Highest-ranked first; ties keep their given order. */
export function bySeniority<T extends { roleName?: string; name?: string }>(roles: readonly T[]): T[] {
  return roles
    .map((r, i) => ({ r, i, rank: roleRank(r.roleName ?? r.name ?? "") }))
    .sort((a, b) => b.rank - a.rank || a.i - b.i)
    .map((x) => x.r);
}
