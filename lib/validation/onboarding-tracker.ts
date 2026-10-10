import { z } from "zod";
import { LEGACY_TRACKER, MAX_CUSTOM_STEPS, MAX_STEP_LABEL, TRACKER_STEP_KEYS, cleanCustomSteps, type TrackerConfig } from "@/lib/domain/onboarding-tracker";

/** The tracker as the wizard and Settings send it. Unknown step keys are refused. */
export const trackerConfigSchema = z.object({
  on: z.boolean(),
  steps: z.array(z.enum(TRACKER_STEP_KEYS)).max(TRACKER_STEP_KEYS.length),
  custom: z.array(z.string().max(MAX_STEP_LABEL * 2)).max(MAX_CUSTOM_STEPS * 2),
});

/** Validate and tidy a submitted tracker (repeats removed, labels trimmed). */
export function cleanTrackerConfig(input: unknown): { ok: true; config: TrackerConfig } | { ok: false; error: string } {
  const parsed = trackerConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the onboarding steps" };
  return { ok: true, config: { on: parsed.data.on, steps: [...new Set(parsed.data.steps)], custom: cleanCustomSteps(parsed.data.custom) } };
}

/** The stored setting (JSON). Empty or unreadable = the centre never chose, so it keeps the original checklist. */
export function parseTrackerConfig(raw: string | null | undefined): TrackerConfig {
  if (!raw) return LEGACY_TRACKER;
  try {
    const r = cleanTrackerConfig(JSON.parse(raw));
    return r.ok ? r.config : LEGACY_TRACKER;
  } catch {
    return LEGACY_TRACKER;
  }
}
