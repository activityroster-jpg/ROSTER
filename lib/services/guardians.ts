import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { actorUserId } from "@/lib/tenant/context";
import { guardianLink as guardianLinkTable, type GuardianLink, type ParentDecision } from "@/lib/db/schema";
import { sealToken } from "@/lib/security/token-crypto";
import { notifyInstructor } from "./notifications";
import { emailAdmins } from "./admin-mail";
import { escapeHtml } from "@/lib/mail";
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

/**
 * Parental approval (Conor, 4 Oct 2026). Where a parent stands for one young
 * person: "approved" (their own account said yes), "pending" (invited, no
 * answer yet), "declined" / "withdrawn", "none" (no parent invited yet), or
 * "not-needed" (18 or over). The newest active link counts.
 */
export type ParentApprovalState = "approved" | "pending" | "declined" | "withdrawn" | "none" | "not-needed";

export function parentApprovalFromLinks(dateOfBirth: string | null | undefined, links: readonly Pick<GuardianLink, "status" | "parentDecision" | "createdAt">[]): ParentApprovalState {
  if (!isUnder18(dateOfBirth)) return "not-needed";
  const active = links.filter((l) => l.status === "active").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (active.some((l) => l.parentDecision === "approved")) return "approved";
  const latest = active[0];
  if (!latest) return "none";
  return latest.parentDecision === "declined" ? "declined" : latest.parentDecision === "withdrawn" ? "withdrawn" : "pending";
}

export async function parentApprovalFor(repos: Repositories, ctx: AnyTenantContext, instructorId: string, dateOfBirth: string | null | undefined): Promise<ParentApprovalState> {
  if (!isUnder18(dateOfBirth)) return "not-needed";
  return parentApprovalFromLinks(dateOfBirth, await guardianLinksFor(repos, ctx, instructorId));
}

/** A parent's own answer, from their account. The link must be theirs. The centre's admins hear about it. */
export async function recordParentDecision(repos: Repositories, ctx: AnyTenantContext, linkId: string, parentUserId: string, decision: ParentDecision): Promise<{ ok: true } | { ok: false; error: string }> {
  const link = await repos.tenant.guardianLink.findById(ctx, linkId);
  if (!link || link.userId !== parentUserId || link.status !== "active") return { ok: false, error: "Not found" };
  const now = new Date();
  await repos.tenant.guardianLink.update(ctx, linkId, { parentDecision: decision, parentDecidedAt: now });
  const child = await repos.tenant.instructor.findById(ctx, link.instructorId);
  await writeAudit(repos, ctx, { action: "parent_decision", entity: "instructor", entityId: link.instructorId, after: { decision, linkId } });
  const who = child?.name ?? "A young person";
  const words = decision === "approved" ? "approved" : decision === "declined" ? "declined" : "withdrawn their approval for";
  await emailAdmins(repos, ctx, {
    subject: `Parental permission ${decision}: ${who}`,
    html: `<p>${escapeHtml(who)}'s parent or guardian has <strong>${words}</strong> ${decision === "withdrawn" ? "them" : "them"} working at the centre.</p>${decision === "approved" ? "<p>They can now be rostered.</p>" : "<p>They cannot be rostered until a parent approves (an admin can still override with a note).</p>"}`,
    path: `/office/staff/${link.instructorId}`,
    cta: "Open their profile",
  }).catch(() => {});
  if (child) await notifyInstructor(repos, ctx, child.id, { title: decision === "approved" ? "Your parent has approved you working here" : "Your parent's answer", body: decision === "approved" ? "The centre can now roster you." : "Your parent or guardian has not approved you working here yet. Talk to them, or to the centre.", email: false }).catch(() => {});
  return { ok: true };
}

/**
 * From the instructor app: a young person gives a parent's name and email at
 * sign-up. The parent is stored (sealed) on their record and invited to the
 * parent account to approve. One request; re-sending uses the office flow.
 */
export async function requestParentApprovalFromPortal(repos: Repositories, ctx: AnyTenantContext, instructorId: string, parentName: string, parentEmail: string): Promise<InviteGuardianResult> {
  const child = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!child) return { ok: false, error: "Profile not found" };
  if (!isUnder18(child.dateOfBirth)) return { ok: false, error: "Parental approval is only asked of instructors under 18" };
  const email = parentEmail.trim().toLowerCase();
  if (child.email && child.email.toLowerCase() === email) return { ok: false, error: "Please give your parent or guardian's own email, not yours" };
  await repos.tenant.instructor.update(ctx, instructorId, { guardianName: parentName.trim().slice(0, 120) || child.guardianName, guardianEmail: await sealToken(email) });
  return inviteGuardian(repos, ctx, instructorId, "Requested by the young person at sign-up; awaiting the parent's own approval");
}
