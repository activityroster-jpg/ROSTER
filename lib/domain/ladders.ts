/**
 * How instructor types are grouped on screen: by ladder (the `discipline` of a
 * qualification type), in a fixed order, with held certificates and examiners
 * (no ladder) last. Pure.
 */

const GROUPS: { key: string; label: string; disciplines: string[] }[] = [
  { key: "dinghy", label: "Dinghy and multihull", disciplines: ["dinghy"] },
  { key: "keelboat", label: "Keelboat", disciplines: ["keelboat"] },
  { key: "racing", label: "Racing coaches", disciplines: ["racing_coach"] },
  { key: "sailability", label: "Sailability", disciplines: ["sailability"] },
  { key: "windsurf", label: "Windsurfing", disciplines: ["windsurf"] },
  { key: "sup", label: "Paddleboarding", disciplines: ["sup"] },
  { key: "powerboat", label: "Powerboat", disciplines: ["powerboat"] },
  { key: "pwc", label: "Personal watercraft", disciplines: ["pwc"] },
  { key: "cruising", label: "Sail cruising", disciplines: ["cruising"] },
  { key: "motor", label: "Motor cruising", disciplines: ["motor_cruising"] },
  { key: "shorebased", label: "Shorebased", disciplines: ["shorebased", "src", "sea_survival", "radar", "diesel"] },
  { key: "first_aid", label: "First aid", disciplines: ["first_aid"] },
  { key: "inland", label: "Inland waterways", disciplines: ["inland"] },
  { key: "diving", label: "Diving", disciplines: ["diving", "freediving"] },
];
const HELD = { key: "held", label: "Certificates and examiners" };

/** The group a ladder belongs to; a ladder nothing here knows gets its own group, named from it. */
export function ladderGroup(discipline: string | null | undefined): { key: string; label: string } {
  if (!discipline) return HELD;
  const g = GROUPS.find((x) => x.disciplines.includes(discipline));
  if (g) return { key: g.key, label: g.label };
  const label = discipline.replace(/_/g, " ");
  return { key: discipline, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

/** Types grouped by ladder, groups in the fixed order (unknown ladders after the known, certificates last), lowest rank first in each. */
export function groupByLadder<T extends { discipline: string | null; rank: number; name: string }>(types: readonly T[]): { key: string; label: string; types: T[] }[] {
  const out = new Map<string, { key: string; label: string; types: T[] }>();
  for (const t of types) {
    const g = ladderGroup(t.discipline);
    const entry = out.get(g.key) ?? { ...g, types: [] };
    entry.types.push(t);
    out.set(g.key, entry);
  }
  const order = (key: string) => (key === HELD.key ? 1000 : (() => { const i = GROUPS.findIndex((g) => g.key === key); return i === -1 ? 500 : i; })());
  return [...out.values()]
    .sort((a, b) => order(a.key) - order(b.key) || a.label.localeCompare(b.label))
    .map((g) => ({ ...g, types: [...g.types].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)) }));
}
