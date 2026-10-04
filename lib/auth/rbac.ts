import type { MembershipRole } from "@/lib/db/schema";

/**
 * Four kinds of user, nothing else (decided 4 October 2026):
 *
 *   owner       the superadmin: set the centre up and pays. One per centre;
 *               ActivityRoster transfers it from the Dev Center. Everything.
 *   admin       an office admin. Which parts of the office they can reach is a
 *               set of FEATURES the owner ticks per person; a new office admin
 *               starts with none.
 *   instructor  the instructor app. Senior instructors and volunteers are
 *               instructors: "senior" is a qualification, not access.
 *   parent      a read-only roster of their under-18 child, and the parental
 *               permission answer.
 *
 * The legacy roles senior_instructor and welfare_officer were migrated to
 * instructor (migration 0059) and are no longer granted; they stay in the enum
 * so an old row cannot fail to type.
 */
export const OFFICE_FEATURES = ["roster", "staff", "protected", "payroll", "settings", "billing", "exports"] as const;
export type OfficeFeature = (typeof OFFICE_FEATURES)[number];

export const FEATURE_LABEL: Record<OfficeFeature, { label: string; hint: string }> = {
  roster: { label: "Roster & courses", hint: "Courses, the roster, availability, leave and cover, equipment, locations, course setup, imports and booking systems." },
  staff: { label: "Staff", hint: "The instructor list and profiles, certs, invitations." },
  protected: { label: "Emergency & guardian contacts", hint: "Emergency contacts, parents and guardians, the young-worker register. Every view is logged." },
  payroll: { label: "Payroll", hint: "Pay rates, hours, the payroll page and the time clock." },
  settings: { label: "Settings", hint: "Centre settings, onboarding and the change log." },
  billing: { label: "Billing", hint: "The plan, payments and invoices." },
  exports: { label: "Exports & data tools", hint: "Whole-centre and per-person exports, restriction and anonymisation." },
};

export const PERMISSIONS = [
  "office.view",      // open the office at all
  "rota.view",        // roster, emergency sheet, roster PDF
  "roster.edit",      // courses, assignments, availability grid, leave and cover, publishing, equipment, locations, course setup
  "staff.view",       // instructors list and profiles (no pay, no data tools)
  "staff.edit",       // edit profiles, certs, invites
  "protected.view",   // guardian and emergency contacts, young-worker register
  "finance.view",     // payroll, pay rates, time clock
  "settings.edit",    // settings, onboarding, change log
  "billing.manage",   // plan, payments, invoices, the trial survey
  "data.export",      // exports, restriction, anonymisation
  "parent.view",      // the /parent read-only roster
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Which office feature unlocks each permission for an office admin. */
const FEATURE_FOR: Record<Exclude<Permission, "office.view" | "parent.view">, OfficeFeature> = {
  "rota.view": "roster", "roster.edit": "roster",
  "staff.view": "staff", "staff.edit": "staff",
  "protected.view": "protected",
  "finance.view": "payroll",
  "settings.edit": "settings",
  "billing.manage": "billing",
  "data.export": "exports",
};

export interface Grant { role: MembershipRole; features?: readonly string[] | null }

/** May this member do this? The owner may do everything in the office; an office admin only what their features unlock. */
export function can(who: MembershipRole | Grant, permission: Permission): boolean {
  const role = typeof who === "string" ? who : who.role;
  const features = typeof who === "string" ? [] : (who.features ?? []);
  if (permission === "parent.view") return role === "parent";
  if (role === "owner") return true;
  if (role === "admin") return permission === "office.view" || features.includes(FEATURE_FOR[permission]);
  return false;
}

/** The parts of the office this member can reach, for menus and the access list. */
export function featuresOf(who: Grant): OfficeFeature[] {
  if (who.role === "owner") return [...OFFICE_FEATURES];
  if (who.role === "admin") return OFFICE_FEATURES.filter((f) => (who.features ?? []).includes(f));
  return [];
}

export const OFFICE_ROLES: readonly MembershipRole[] = ["owner", "admin"];
export const isOfficeRole = (role: MembershipRole): boolean => OFFICE_ROLES.includes(role);

/** Where a role lands after signing in. */
export function landingFor(role: MembershipRole): string {
  if (isOfficeRole(role)) return "/office";
  if (role === "parent") return "/parent";
  return "/portal";
}

export const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "Superadmin", admin: "Office admin", instructor: "Instructor", parent: "Parent / guardian",
  senior_instructor: "Instructor", welfare_officer: "Instructor",
};

/** Validate a client-supplied feature list: unknown names are dropped. */
export function cleanFeatures(input: unknown): OfficeFeature[] {
  if (!Array.isArray(input)) return [];
  return OFFICE_FEATURES.filter((f) => input.includes(f));
}
export function parseFeatures(json: string | null | undefined): OfficeFeature[] {
  try { return cleanFeatures(JSON.parse(json || "[]")); } catch { return []; }
}
