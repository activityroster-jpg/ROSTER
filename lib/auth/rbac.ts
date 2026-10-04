import type { MembershipRole } from "@/lib/db/schema";

/**
 * The permission matrix (compliance P1-F). Roles are coarse on purpose; a
 * centre grants them from the staff page. Anything not listed here is
 * admin-only, which is also what `requireTenant({ role: "admin" })` means.
 */
export const PERMISSIONS = [
  "office.view",        // open the office at all (dashboard, change log is admin-only)
  "rota.view",          // roster, emergency sheet, rota PDF
  "roster.edit",        // courses, assignments, availability grid, leave and cover, publishing
  "staff.view",         // instructors list and profiles (no pay, no data tools)
  "staff.edit",         // edit profiles, certs, invites
  "protected.view",     // guardian and emergency contacts, young-worker register
  "finance.view",       // payroll, pay rates
  "settings.edit",      // settings, billing, course setup, exports, data tools
  "parent.view",        // the /parent read-only rota
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<MembershipRole, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS.filter((p) => p !== "parent.view")),
  senior_instructor: new Set<Permission>(["office.view", "rota.view", "roster.edit", "staff.view"]),
  welfare_officer: new Set<Permission>(["office.view", "rota.view", "staff.view", "protected.view"]),
  instructor: new Set<Permission>(),
  parent: new Set<Permission>(["parent.view"]),
};

export function can(role: MembershipRole, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export const OFFICE_ROLES: readonly MembershipRole[] = ["admin", "senior_instructor", "welfare_officer"];
export const isOfficeRole = (role: MembershipRole): boolean => OFFICE_ROLES.includes(role);

/** Where a role lands after signing in. */
export function landingFor(role: MembershipRole): string {
  if (isOfficeRole(role)) return "/office";
  if (role === "parent") return "/parent";
  return "/portal";
}

export const ROLE_LABEL: Record<MembershipRole, string> = {
  admin: "Admin", senior_instructor: "Senior instructor", welfare_officer: "Welfare officer", instructor: "Instructor", parent: "Parent / guardian",
};
/** Roles a centre admin may grant to a team member from the staff page. */
export const GRANTABLE_ROLES: readonly MembershipRole[] = ["instructor", "senior_instructor", "welfare_officer"];
