import { orgSettingsSchema } from "./entities";

/**
 * General settings are saved one card at a time (audit follow-up, 5 Oct): each
 * card posts only its own fields and only those columns are written, so two
 * office admins saving different cards never undo each other's changes.
 */
export const SETTINGS_SECTIONS = ["basics", "digest", "young", "security", "checks"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

type Get = (name: string) => FormDataEntryValue | null;

const num = (v: FormDataEntryValue | null, fallback?: number): number | undefined => {
  if (v === null || String(v).trim() === "") return fallback;
  return Number(v);
};
const on = (v: FormDataEntryValue | null): boolean => v === "on";

function termDatesField(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string" || !v.trim()) return [];
  try { return JSON.parse(v); } catch { return "invalid"; }
}

/** The raw values one card posts, keyed by column. */
function rawFor(section: SettingsSection, get: Get): Record<string, unknown> {
  switch (section) {
    case "basics":
      return {
        alertLeadDays: num(get("alertLeadDays")),
        availabilityWeeksAhead: num(get("availabilityWeeksAhead"), 4),
        currency: get("currency"),
        holidayPayPercent: String(get("holidayPayPercent") ?? "").trim() === "" ? null : Number(get("holidayPayPercent")),
        privacyNoticeUrl: String(get("privacyNoticeUrl") ?? "").trim(),
      };
    case "digest":
      return { dailyDigestEnabled: on(get("dailyDigestEnabled")), dailyDigestHour: num(get("dailyDigestHour"), 6) };
    case "young":
      return { workingTimeMode: get("workingTimeMode") ?? "block_override", requireParentApproval: on(get("requireParentApproval")), termDates: termDatesField(get("termDates")) };
    case "security":
      return { idleTimeoutMinutes: num(get("idleTimeoutMinutes"), 30) };
    case "checks":
      return {
        enforceLicenceChecks: on(get("enforceLicenceChecks")),
        enforceRatioChecks: on(get("enforceRatioChecks")),
        enforceConflictChecks: on(get("enforceConflictChecks")),
        enforceAvailabilityChecks: on(get("enforceAvailabilityChecks")),
        checkEquipmentQuantities: on(get("checkEquipmentQuantities")),
      };
  }
}

export type SettingsPatch = Record<string, string | number | boolean | null>;

/** Validate one card's fields and turn them into the columns to write. */
export function settingsPatch(section: string, get: Get): { ok: true; patch: SettingsPatch } | { ok: false; error: string } {
  if (!(SETTINGS_SECTIONS as readonly string[]).includes(section)) return { ok: false, error: "Unknown settings section" };
  const raw = rawFor(section as SettingsSection, get);
  const parsed = orgSettingsSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the settings values" };
  const patch: SettingsPatch = {};
  for (const key of Object.keys(raw)) {
    const v = (parsed.data as Record<string, unknown>)[key];
    if (key === "termDates") {
      const terms = (v ?? []) as { from: string; to: string; label?: string }[];
      patch.termDates = JSON.stringify(terms.map((r) => ({ from: r.from, to: r.to, ...(r.label ? { label: r.label } : {}) })));
    } else if (key === "privacyNoticeUrl") {
      patch.privacyNoticeUrl = (v as string | undefined) || null;
    } else if (v !== undefined) {
      patch[key] = v as string | number | boolean | null;
    }
  }
  return { ok: true, patch };
}
