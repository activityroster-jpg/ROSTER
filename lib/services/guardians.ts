import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { actorUserId } from "@/lib/tenant/context";
import { guardianLink as guardianLinkTable, type GuardianLink } from "@/lib/db/schema";
import { openToken } from "@/lib/security/token-crypto";
import { isUnder18 } from "@/lib/domain/age";
import { writeAudit } from "./audit";
import { isOfficeRole } from "@/lib/auth/rbac";

/**
 * Parent / guardian accounts (compliance P1-F): a read-only view of an
 * under-18 instructor's roster. The guardian becomes a `parent` member of the
 * centre (invited, active on first sign-in) and a guardian_link says whose
 * roster they may see, with the consent record the centre holds.
 */
export type InviteGuardianResult = { ok: true; email: string; userId: string; linkId: string } | { ok: false; error: string };

export async function inviteGuardian(repos: Repositories, ctx: AnyTenantContext, instructorId: string, consentNote: string): Promise<InviteGuardianResult> {
  const t = repos.tenant;
  const child = await t.instructor.findById(ctx, instructorId);
  if (!child) return { ok: false, error: "Instructor not found" };
  if (!isUnder18(child.dateOfBirth)) return { ok: false, error: "Guardian access is only for instructors under 18" };
  const email = ((await openToken(child.guardianEmail)) ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Add the parent or guardian's email under Guardian and emergency contacts first" };
  if (child.email && child.email.toLowerCase() === email) return { ok: false, error: "The guardian's email must be different from the young person's own" };

  const user = (await repos.control.userByEmail(email)) ?? (await repos.control.createUser({ name: child.guardianName || "Parent / guardian", email }));
  const membership = await repos.control.membershipFor(user.id, ctx.organisationId);
  if (!membership) await repos.control.createMembership({ userId: user.id, organisationId: ctx.organisationId, role: "parent" }, "invited");
  else if (membership.role !== "parent" && !isOfficeRole(membership.role)) return { ok: false, error: "That email already belongs to a team member here; a guardian account must be separate" };

  const existing = (await t.guardianLink.list(ctx, eq(guardianLinkTable.instructorId, instructorId))).find((l) => l.userId === user.id);
  const now = new Date();
  const link = existing
    ? (await t.guardianLink.update(ctx, existing.id, { status: "active", email, consentGivenAt: now, consentByUserId: actorUserId(ctx), consentNote: consentNote || null }))!
    : await t.guardianLink.insert(ctx, { instructorId, userId: user.id, email, status: "active", consentGivenAt: now, consentByUserId: actorUserId(ctx), consentNote: consentNote || null });
  await writeAudit(repos, ctx, { action: "invite_guardian", entity: "instructor", entityId: instructorId, after: { linkId: link.id, consentNote: consentNote || null } });
  return { ok: true, email, userId: user.id, linkId: link.id };
}

export async function revokeGuardian(repos: Repositories, ctx: AnyTenantContext, linkId: string): Promise<boolean> {
  const link = await repos.tenant.guardianLink.findById(ctx, linkId);
  if (!link) return false;
  await repos.tenant.guardianLink.update(ctx, linkId, { status: "revoked" });
  // If this guardian has no other active link in the centre, their parent membership ends too.
  const others = (await repos.tenant.guardianLink.list(ctx, eq(guardianLinkTable.userId, link.userId))).filter((l) => l.id !== linkId && l.status === "active");
  if (others.length === 0) {
    const m = await repos.control.membershipFor(link.userId, ctx.organisationId);
    if (m?.role === "parent") await repos.control.deleteMembership(link.userId, ctx.organisationId);
  }
  await writeAudit(repos, ctx, { action: "revoke_guardian", entity: "instructor", entityId: link.instructorId, after: { linkId } });
  return true;
}

/** Links for the staff page. */
export async function guardianLinksFor(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<GuardianLink[]> {
  return repos.tenant.guardianLink.list(ctx, eq(guardianLinkTable.instructorId, instructorId));
}

/** The children a signed-in parent may see. */
export async function childrenFor(repos: Repositories, ctx: AnyTenantContext, userId: string): Promise<GuardianLink[]> {
  return (await repos.tenant.guardianLink.list(ctx, eq(guardianLinkTable.userId, userId))).filter((l) => l.status === "active");
}
