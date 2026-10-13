/**
 * Short form of a role name for tight spaces (the printed rota). A place that
 * is an instructor type uses the type's code ("PBI", "SWI", "KBI"); any other
 * place the initials of its words: "Assistant Instructor" → "AI", "Senior
 * Instructor" → "SI", "Instructor" → "I", "Volunteer" → "V". Pure.
 */
export function roleAbbrev(name: string, code?: string | null): string {
  if (code && code.trim()) return code.trim().toUpperCase();
  const words = name.replace(/\(.*?\)/g, " ").split(/[\s/&-]+/).filter((w) => /[A-Za-z0-9]/.test(w));
  if (words.length === 0) return name.trim().slice(0, 3).toUpperCase();
  const initials = words.map((w) => w[0]!.toUpperCase()).join("");
  return initials;
}

/** "Morning: Conor   Afternoon: Conor   Evening: Conor" collapses to "Conor (all day)" when it's one person. */
export function welfareLine(bySlot: Partial<Record<"AM" | "PM" | "EV", string>>, labels: Record<"AM" | "PM" | "EV", string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" }): string {
  const slots = (["AM", "PM", "EV"] as const).filter((s) => bySlot[s]);
  if (slots.length === 0) return "";
  const names = new Set(slots.map((s) => bySlot[s]!.trim()));
  if (names.size === 1 && slots.length >= 2) return `${[...names][0]} (all day)`;
  return slots.map((s) => `${labels[s]}: ${bySlot[s]}`).join("   ");
}
