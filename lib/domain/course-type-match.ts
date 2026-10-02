/**
 * Match an imported course name (from a spreadsheet or booking system) to one
 * of the centre's course types. Booking systems rarely use exactly the same
 * names ("RYA Stage 1 – Summer Week" vs "Stage 1"), so we compare normalised
 * word sets rather than raw strings. Pure — no DB, no I/O.
 */

const STOP = new Set([
  "rya", "course", "courses", "the", "a", "an", "of", "for", "with", "and", "to", "in", "on", "at",
  "day", "days", "weekend", "week", "session", "sessions", "booking", "programme", "program",
  "mon", "tue", "wed", "thu", "fri", "sat", "sun", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december",
  "am", "pm", "morning", "afternoon", "evening", "summer", "spring", "autumn", "winter", "half", "term",
]);

const ALIAS: Record<string, string> = { lvl: "level", lv: "level", stg: "stage", pb: "powerboat", kids: "youth", junior: "youth", juniors: "youth" };

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Normalised word list: lowercased, punctuation/stop-words/dates/times removed. */
export function courseNameTokens(name: string): string[] {
  const cleaned = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ") // times
    .replace(/\b\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b/g, " ") // dates
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ");
  const out: string[] = [];
  for (const raw of cleaned.split(" ")) {
    if (!raw) continue;
    if (/^\d{4}$/.test(raw)) continue; // years
    if (/^\d+(st|nd|rd|th)$/.test(raw)) continue;
    const w = ALIAS[raw] ?? raw;
    if (STOP.has(w)) continue;
    out.push(stem(w));
  }
  return out;
}

/** 0–1 similarity between an imported name and a course type name. */
export function courseTypeScore(importedName: string, typeName: string): number {
  const a = courseNameTokens(importedName);
  const b = courseNameTokens(typeName);
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  // Levels/stages must agree: "Stage 1" is never "Stage 2".
  const digitsA = [...A].filter((w) => /^\d+$/.test(w));
  const digitsB = [...B].filter((w) => /^\d+$/.test(w));
  if (digitsB.some((d) => !A.has(d))) return 0;
  if (digitsA.length && digitsB.length === 0) return 0;
  if (a.join(" ") === b.join(" ")) return 1;
  const shared = [...B].filter((w) => A.has(w)).length;
  // Every word of the type name appears in the imported name → strong match;
  // more specific (longer) type names win ties.
  if (shared === B.size) return Math.min(0.95, 0.8 + 0.03 * B.size);
  return (2 * shared) / (A.size + B.size);
}

export const COURSE_TYPE_MATCH_THRESHOLD = 0.6;

/** Review choices besides an existing type id. */
export const TYPE_NEW = "__new"; // add the imported name to the regular list
export const TYPE_ONEOFF = "__oneoff"; // a one-off type, kept off the list

/** Best-matching course type for an imported name, or null if nothing is close enough. */
export function suggestCourseType<T extends { id: string; name: string }>(
  importedName: string,
  types: readonly T[],
): { type: T; score: number } | null {
  let best: { type: T; score: number } | null = null;
  for (const t of types) {
    const score = courseTypeScore(importedName, t.name);
    if (score < COURSE_TYPE_MATCH_THRESHOLD) continue;
    if (!best || score > best.score || (score === best.score && t.name.length > best.type.name.length)) best = { type: t, score };
  }
  return best;
}
