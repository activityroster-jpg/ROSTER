import { z } from "zod";

/**
 * How a centre wants its rota PDF laid out. Chosen during onboarding and
 * changeable under Office → Settings → Rota PDF. Stored as JSON on
 * org_settings.rotaTemplate; anything missing falls back to the defaults.
 */
export const ROTA_RANGES = ["day", "week", "month"] as const;
export type RotaRange = (typeof ROTA_RANGES)[number];
export const ROTA_ORIENTATIONS = ["vertical", "horizontal"] as const;
export type RotaOrientation = (typeof ROTA_ORIENTATIONS)[number];
export const ROTA_FIELDS = [
  { key: "times", label: "Start and finish times" },
  { key: "locations", label: "Locations / classrooms" },
  { key: "instructors", label: "Instructors" },
  { key: "roles", label: "Their role (Senior Instructor, Safety Boat…)" },
  { key: "equipment", label: "Equipment (boats, RIBs…)" },
] as const;
export type RotaField = (typeof ROTA_FIELDS)[number]["key"];

export interface RotaTemplateSettings {
  range: RotaRange;
  orientation: RotaOrientation;
  fields: Record<RotaField, boolean>;
}

export const rotaTemplateSchema = z.object({
  range: z.enum(ROTA_RANGES),
  orientation: z.enum(ROTA_ORIENTATIONS),
  fields: z.object({ times: z.boolean(), locations: z.boolean(), instructors: z.boolean(), roles: z.boolean(), equipment: z.boolean() }),
});

export const DEFAULT_ROTA_TEMPLATE: RotaTemplateSettings = {
  range: "week",
  orientation: "vertical",
  fields: { times: true, locations: true, instructors: true, roles: false, equipment: false },
};

/** Parse the stored JSON; partial or broken values fall back field by field. */
export function parseRotaTemplate(json: string | null | undefined): RotaTemplateSettings {
  let raw: unknown = {};
  try { raw = json ? JSON.parse(json) : {}; } catch { raw = {}; }
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<RotaTemplateSettings> & { fields?: Partial<RotaTemplateSettings["fields"]> };
  return {
    range: (ROTA_RANGES as readonly string[]).includes(String(r.range)) ? (r.range as RotaRange) : DEFAULT_ROTA_TEMPLATE.range,
    orientation: (ROTA_ORIENTATIONS as readonly string[]).includes(String(r.orientation)) ? (r.orientation as RotaOrientation) : DEFAULT_ROTA_TEMPLATE.orientation,
    fields: { ...DEFAULT_ROTA_TEMPLATE.fields, ...Object.fromEntries(Object.entries(r.fields ?? {}).filter(([k, v]) => k in DEFAULT_ROTA_TEMPLATE.fields && typeof v === "boolean")) },
  };
}

/**
 * Staff appear by first name only; when two people on the document share a
 * first name, each gets the initial of their surname ("Sam J", "Sam P").
 */
export function shortNames(fullNames: Iterable<string>): Map<string, string> {
  const unique = [...new Set([...fullNames].map((n) => n.trim()).filter(Boolean))];
  const first = (n: string) => n.split(/\s+/)[0]!;
  const counts = new Map<string, number>();
  for (const n of unique) counts.set(first(n).toLowerCase(), (counts.get(first(n).toLowerCase()) ?? 0) + 1);
  const out = new Map<string, string>();
  for (const n of unique) {
    const parts = n.split(/\s+/);
    const f = parts[0]!;
    if ((counts.get(f.toLowerCase()) ?? 0) > 1 && parts.length > 1) {
      const initial = parts[parts.length - 1]![0]!.toUpperCase();
      out.set(n, `${f} ${initial}`);
    } else {
      out.set(n, f);
    }
  }
  // Two people who share first name AND surname initial: fall back to the full surname for both.
  const seen = new Map<string, string[]>();
  for (const [full, short] of out) seen.set(short, [...(seen.get(short) ?? []), full]);
  for (const [, fulls] of seen) if (fulls.length > 1) for (const full of fulls) out.set(full, full);
  return out;
}

/** The dates a range covers, starting from `from` (a Monday for weeks, the 1st for months). */
export function rangeBounds(range: RotaRange, fromIso: string): { from: string; days: number; title: string } {
  const d = new Date(`${fromIso}T00:00:00Z`);
  if (range === "day") {
    return { from: fromIso, days: 1, title: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) };
  }
  if (range === "month") {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    return { from: first.toISOString().slice(0, 10), days, title: first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
  }
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  const monday = d.toISOString().slice(0, 10);
  const end = new Date(d); end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (x: Date, y: boolean) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}), timeZone: "UTC" });
  return { from: monday, days: 7, title: `Week of ${fmt(d, false)} – ${fmt(end, true)}` };
}
