/**
 * The instructor onboarding tracker: which steps a centre follows for each new
 * instructor. Some steps tick themselves from the person's record (signed up,
 * licences, courses, pay rate, first aid, vetting, availability); the rest are
 * ticked by the office. Pure: no DB, no framework.
 */

export const TRACKER_STEP_KEYS = [
  "app", "licences", "courses", "pay", "first-aid", "vetting", "availability",
  "contract", "induction", "safeguarding", "kit", "payroll",
] as const;
export type TrackerStepKey = (typeof TRACKER_STEP_KEYS)[number];

export interface TrackerStepDef {
  key: TrackerStepKey;
  label: string;
  /** Ticks itself from the person's record; the office can't tick it by hand. */
  auto: boolean;
  /** Ticked for a new centre unless it chooses otherwise. */
  recommended: boolean;
  /** Only offered when the centre uses pay & payroll. */
  needsPay?: boolean;
  /** When it ticks itself (auto) or what it is for (manual). */
  hint: string;
}

/** Built-in steps, in the order they show. Manual labels match the original checklist so old ticks carry over. */
export const TRACKER_STEPS: readonly TrackerStepDef[] = [
  { key: "app", label: "Added to the app", auto: true, recommended: true, hint: "Ticks itself when they accept their invite and sign in." },
  { key: "licences", label: "Licences they hold set", auto: true, recommended: true, hint: "Ticks itself once a licence or instructor qualification is on their profile." },
  { key: "courses", label: "Courses they can teach set", auto: true, recommended: true, hint: "Ticks itself once at least one course they can teach is ticked." },
  { key: "pay", label: "Pay rate set", auto: true, recommended: true, needsPay: true, hint: "Ticks itself when a pay rate applies to them: their own, or your standard rate." },
  { key: "first-aid", label: "First aid certificate added", auto: true, recommended: true, hint: "Ticks itself when a first aid certificate is recorded for them." },
  { key: "vetting", label: "DBS or vetting check recorded", auto: true, recommended: true, hint: "Ticks itself when their DBS, PVG, AccessNI or Garda vetting check is recorded." },
  { key: "availability", label: "Set their availability in the app", auto: true, recommended: true, hint: "Ticks itself the first time they mark when they're free." },
  { key: "contract", label: "Contract signed", auto: false, recommended: false, hint: "Ticked by the office." },
  { key: "induction", label: "Induction & site tour", auto: false, recommended: false, hint: "Ticked by the office." },
  { key: "safeguarding", label: "Safeguarding training", auto: false, recommended: false, hint: "Ticked by the office." },
  { key: "kit", label: "Kit issued", auto: false, recommended: false, hint: "Ticked by the office." },
  { key: "payroll", label: "Added to payroll", auto: false, recommended: false, hint: "Ticked by the office." },
];

export const MAX_CUSTOM_STEPS = 12;
export const MAX_STEP_LABEL = 60;

export interface TrackerConfig {
  /** Whether each instructor's page shows the tracker. */
  on: boolean;
  /** Built-in steps the centre follows. */
  steps: TrackerStepKey[];
  /** The centre's own steps, ticked by the office. */
  custom: string[];
}

/**
 * Centres that never chose keep the checklist every profile had before
 * (10 Oct 2026): contract, induction, safeguarding, first aid, kit, payroll,
 * all ticked by hand.
 */
export const LEGACY_TRACKER: TrackerConfig = {
  on: true,
  steps: ["contract", "induction", "safeguarding", "kit", "payroll"],
  custom: ["First Aid confirmed"],
};

/** What a new centre is offered: the recommended steps (pay only when it uses pay & payroll). */
export function recommendedTracker(payOn: boolean): TrackerConfig {
  return { on: true, steps: TRACKER_STEPS.filter((s) => s.recommended && (payOn || !s.needsPay)).map((s) => s.key), custom: [] };
}

/** Trim, drop blanks and repeats (including any that repeat a built-in label), cap the count. */
export function cleanCustomSteps(labels: readonly string[]): string[] {
  const builtIn = new Set(TRACKER_STEPS.map((s) => s.label.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.replace(/\s+/g, " ").trim().slice(0, MAX_STEP_LABEL);
    const k = label.toLowerCase();
    if (!label || seen.has(k) || builtIn.has(k)) continue;
    seen.add(k);
    out.push(label);
    if (out.length >= MAX_CUSTOM_STEPS) break;
  }
  return out;
}

export interface TrackerStep {
  key: string;
  label: string;
  auto: boolean;
  hint: string;
}

/** The steps one centre follows, in display order. Pay drops out when pay & payroll is off. */
export function trackerSteps(config: TrackerConfig, payOn: boolean): TrackerStep[] {
  if (!config.on) return [];
  const chosen = new Set(config.steps);
  const builtIn = TRACKER_STEPS.filter((s) => chosen.has(s.key) && (payOn || !s.needsPay)).map((s) => ({ key: s.key, label: s.label, auto: s.auto, hint: s.hint }));
  const custom = cleanCustomSteps(config.custom).map((label) => ({ key: `custom:${label.toLowerCase()}`, label, auto: false, hint: "Ticked by the office." }));
  return [...builtIn, ...custom];
}

/** The manual steps' labels: the office ticks these, and each has a row per instructor. */
export function manualLabels(config: TrackerConfig, payOn: boolean): string[] {
  return trackerSteps(config, payOn).filter((s) => !s.auto).map((s) => s.label);
}

/** What the record says about one person, for the steps that tick themselves. */
export interface TrackerFacts {
  /** Has a login linked (accepted the invite). */
  linked: boolean;
  licences: number;
  courses: number;
  /** A pay rate applies to them: their own, or a centre-wide one. */
  payRate: boolean;
  firstAid: boolean;
  vetting: boolean;
  /** Has marked their own availability at least once (not the office, not leave). */
  availabilitySet: boolean;
}

/** Whether an automatic step is done for this person. */
export function autoStepDone(key: string, f: TrackerFacts): boolean {
  switch (key) {
    case "app": return f.linked;
    case "licences": return f.licences > 0;
    case "courses": return f.courses > 0;
    case "pay": return f.payRate;
    case "first-aid": return f.firstAid;
    case "vetting": return f.vetting;
    case "availability": return f.availabilitySet;
    default: return false;
  }
}

/** A check type that is a first aid certificate: the seeded code, or one named after it. */
export function isFirstAidType(t: { code?: string | null; name: string }): boolean {
  return (t.code ?? "").toUpperCase() === "FIRST_AID" || /first[\s-]*aid/i.test(t.name);
}
