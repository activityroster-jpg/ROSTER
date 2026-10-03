import { z } from "zod";
import type { WorkingTimePack } from "@/lib/domain/working-time";

/**
 * Zod shape of a working-time rule pack. Everything Conor can edit in the Dev
 * Center passes through here before it is stored, so a typo can never put a
 * malformed pack in front of the checks.
 */
const time = z.string().regex(/^\d{2}:\d{2}$/, "Times are HH:MM, e.g. 07:00").nullable();
const hours = z.number().min(0).max(24).nullable();

const periodLimits = z.object({
  maxHoursPerDay: hours,
  maxHoursPerWeek: z.number().min(0).max(168).nullable(),
  maxHoursSchoolDay: hours.optional(),
  maxHoursSaturday: hours.optional(),
  maxHoursSunday: hours.optional(),
});

const ageBand = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minAge: z.number().int().min(0).max(25),
  maxAge: z.number().int().min(0).max(25),
  until: z.literal("schoolLeaving").optional(),
  from: z.literal("schoolLeaving").optional(),
  termTime: periodLimits,
  holiday: periodLimits,
  earliestStart: time,
  latestFinish: time,
  latestFinishNoSchoolNextDay: time.optional(),
  breakMinutes: z.number().min(0).max(240).nullable(),
  breakAfterHours: hours,
  dailyRestHours: hours,
  weeklyRestHours: z.number().min(0).max(168).nullable().optional(),
  weeklyRestDays: z.number().min(0).max(7).nullable().optional(),
  annualBreak: z.string().nullable(),
  paperwork: z.string().nullable(),
  unverified: z.array(z.string()),
  notes: z.string().optional(),
});

export const workingTimePackSchema = z.object({
  key: z.enum(["gb", "ni", "ie"]),
  name: z.string().min(1),
  version: z.string().min(1),
  verified: z.boolean(),
  schoolLeaving: z.enum(["gb", "ni", "ie"]),
  volunteersCovered: z.boolean(),
  citations: z.array(z.object({ label: z.string().min(1), url: z.string().url() })),
  bands: z.array(ageBand).min(1),
  adults: z.object({
    maxHoursPerWeekAveraged: z.number().min(0).max(168),
    breakMinutes: z.number().min(0).max(240),
    breakAfterHours: z.number().min(0).max(24),
    dailyRestHours: z.number().min(0).max(24),
    weeklyRestHours: z.number().min(0).max(168),
    notes: z.string(),
  }),
});

/** Parse pack JSON (from the Dev Center editor or the rule_pack table). */
export function parsePack(text: string): { ok: true; pack: WorkingTimePack } | { ok: false; error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "That is not valid JSON." }; }
  const r = workingTimePackSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `${i?.path.join(".") || "pack"}: ${i?.message ?? "invalid"}` };
  }
  const pack = r.data as WorkingTimePack;
  // A pack is only "verified" when no band still lists unverified figures.
  if (pack.verified && pack.bands.some((b) => b.unverified.length > 0)) {
    return { ok: false, error: "A pack can't be marked verified while a band still lists unverified figures. Clear each band's 'unverified' list first." };
  }
  return { ok: true, pack };
}
