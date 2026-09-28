import { OPTIONAL_FEATURES, type CourseAudience, type OptionalFeature } from "@/lib/db/schema";

/** Human labels + one-liners for the optional capability areas. */
export const FEATURE_META: Record<OptionalFeature, { label: string; blurb: string; href: string }> = {
  equipment: { label: "Equipment & boats", blurb: "Track dinghies, yachts, safety boats and kit.", href: "/office/equipment" },
  locations: { label: "Locations & classrooms", blurb: "Rooms, launch areas and meeting points.", href: "/office/locations" },
  operatingAreas: { label: "Operating areas", blurb: "Define the water you run activities on.", href: "/office/locations" },
  payroll: { label: "Pay & payroll", blurb: "Pay rates, hours and payroll export.", href: "/office/finance" },
  documents: { label: "Documents & onboarding", blurb: "Store tickets, DBS and staff paperwork.", href: "/office/staff" },
};

/** Parse the JSON string on org_settings.enabledFeatures into a validated set. */
export function parseFeatures(raw: string | null | undefined): OptionalFeature[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is OptionalFeature => (OPTIONAL_FEATURES as readonly string[]).includes(x));
  } catch {
    return [];
  }
}

export function serializeFeatures(features: OptionalFeature[]): string {
  const uniq = [...new Set(features.filter((f) => (OPTIONAL_FEATURES as readonly string[]).includes(f)))];
  return JSON.stringify(uniq);
}

export function hasFeature(raw: string | null | undefined, feature: OptionalFeature): boolean {
  return parseFeatures(raw).includes(feature);
}

/** Youth / adult / all — labels and pill tones used across the app. */
export const AUDIENCE_META: Record<CourseAudience, { label: string; short: string; tone: "teal" | "amber" | "neutral" }> = {
  youth: { label: "Youth", short: "Youth", tone: "amber" },
  adult: { label: "Adult", short: "Adult", tone: "teal" },
  all: { label: "All ages", short: "All", tone: "neutral" },
};
