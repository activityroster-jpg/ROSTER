import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { cleanFeatures, FEATURE_LABEL, featuresOf, parseFeatures, type OfficeFeature } from "@/lib/auth/rbac";
import { writeAudit } from "./audit";

/**
 * Office access (decided 4 Oct 2026): the superadmin (owner) invites office
 * admins and ticks, per person, which parts of the office they can reach. A
 * new office admin starts with nothing ticked. Only the owner may do any of
 * this; the owner's own access cannot be changed here (transfer is a Dev
 * Center action). Every change is in the centre's change log.
 */
export interface OfficeMember {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin";
  status: string;
  features: OfficeFeature[];
  since: Date;
}

export async function listOfficeMembers(repos: Repositories, ctx: AnyTenantContext): Promise<OfficeMember[]> {
  const rows = await repos.control.officeMembersForOrg(ctx.organisationId);
  return rows
    .filter((r) => r.role === "owner" || r.role === "admin")
    .map((r) => ({ userId: r.userId, name: r.name, email: r.email, role: r.role as "owner" | "admin", status: r.status, features: featuresOf({ role: r.role, features: parseFeatures(r.features) }), since: r.createdAt }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "owner" ? -1 : 1));
}

export type InviteOfficeAdminResult = { ok: true; email: string; userId: string; alreadyMember: boolean } | { ok: false; error: string };

/** Make (or re-invite) an office admin. Access starts as INVITED and becomes active when they arrive signed in, like instructors. */
export async function inviteOfficeAdmin(repos: Repositories, ctx: AnyTenantContext, input: { name: string; email: string; features: unknown }): Promise<InviteOfficeAdminResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter their name" };
  const features = cleanFeatures(input.features);
  const user = (await repos.control.userByEmail(email)) ?? (await repos.control.createUser({ name, email }));
  const existing = await repos.control.membershipFor(user.id, ctx.organisationId);
  if (existing?.role === "owner") return { ok: false, error: "That is the superadmin's account" };
  if (existing?.role === "admin") {
    await repos.control.setMembershipFeatures(user.id, ctx.organisationId, features);
  } else if (existing) {
    // An instructor who now also runs the office: upgrade the same membership so one login does both.
    await repos.control.setMembershipRole(user.id, ctx.organisationId, "admin");
    await repos.control.setMembershipFeatures(user.id, ctx.organisationId, features);
  } else {
    await repos.control.createMembership({ userId: user.id, organisationId: ctx.organisationId, role: "admin", features }, "invited");
  }
  await writeAudit(repos, ctx, { action: "grant_office_access", entity: "membership", entityId: user.id, after: { email, name, features: features.map((f) => FEATURE_LABEL[f].label) } });
  return { ok: true, email, userId: user.id, alreadyMember: Boolean(existing) };
}

export async function setOfficeFeatures(repos: Repositories, ctx: AnyTenantContext, userId: string, input: unknown): Promise<{ ok: true; features: OfficeFeature[] } | { ok: false; error: string }> {
  const m = await repos.control.membershipFor(userId, ctx.organisationId);
  if (!m || m.role !== "admin") return { ok: false, error: "Not an office admin of this centre" };
  const features = cleanFeatures(input);
  await repos.control.setMembershipFeatures(userId, ctx.organisationId, features);
  await writeAudit(repos, ctx, { action: "set_office_features", entity: "membership", entityId: userId, after: { features: features.map((f) => FEATURE_LABEL[f].label) } });
  return { ok: true, features };
}

/** Take office access away. If the person also has an instructor record they keep the instructor app; otherwise the membership goes. */
export async function removeOfficeAccess(repos: Repositories, ctx: AnyTenantContext, userId: string, hasInstructorRecord: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await repos.control.membershipFor(userId, ctx.organisationId);
  if (!m || m.role !== "admin") return { ok: false, error: "Not an office admin of this centre" };
  if (hasInstructorRecord) {
    await repos.control.setMembershipRole(userId, ctx.organisationId, "instructor");
    await repos.control.setMembershipFeatures(userId, ctx.organisationId, []).catch(() => {});
  } else {
    await repos.control.deleteMembership(userId, ctx.organisationId);
  }
  await writeAudit(repos, ctx, { action: "revoke_office_access", entity: "membership", entityId: userId, after: { keptInstructorApp: hasInstructorRecord } });
  return { ok: true };
}
