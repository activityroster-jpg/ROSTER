import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import { instructor as instructorTable } from "@/lib/db/schema";
import type { SystemTenantContext } from "@/lib/tenant/context";
import { anonymisePerson } from "./person-data";

export type DeleteAccountResult =
  | { ok: true; centres: number }
  | { ok: false; reason: "not_found" | "owner" | "platform_admin"; message: string };

/**
 * Self-service account deletion from the instructor app (App Store guideline
 * 5.1.1 and UK GDPR article 17). Everything personal goes now: the login,
 * its sessions, devices and notification tokens, and in every centre the
 * person belongs to, their profile, certificates, checks, availability, notes
 * and documents (the same anonymisation the office uses). Roster and pay
 * history stays under "Former staff member", because centres must keep
 * working-time and pay records for the statutory period.
 *
 * The owner of a live centre cannot delete themselves (the centre would lose
 * its owner): they hand it over or close the centre first.
 */
export async function deleteMyAccount(
  repos: Repositories,
  userId: string,
  opts: { isPlatformAdmin?: boolean } = {},
): Promise<DeleteAccountResult> {
  const control = repos.control;
  const me = await control.userById(userId);
  if (!me) return { ok: false, reason: "not_found", message: "Please sign in again." };
  if (opts.isPlatformAdmin) return { ok: false, reason: "platform_admin", message: "A platform admin account cannot be deleted from the app." };

  const memberships = await control.membershipsForUser(userId);
  const owned = memberships.find((m) => m.role === "owner" && m.orgStatus === "active");
  if (owned) return { ok: false, reason: "owner", message: `You own ${owned.name}. Hand the centre to another admin (Instructors → Office access) or close it under Billing, then delete your account.` };

  let centres = 0;
  for (const m of memberships) {
    const ctx: SystemTenantContext = { organisationId: m.organisationId, slug: m.slug, system: true, reason: `account deletion by ${userId}` };
    const mine = await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, userId));
    for (const i of mine) {
      if (i.anonymisedAt) continue;
      await anonymisePerson(repos, ctx, i.id); // removes this centre's membership too
    }
    await control.deleteMembership(userId, m.organisationId); // office-only memberships, or anything left
    centres++;
  }
  await control.deleteOrphanUser(userId); // the login, sessions, accounts, devices, push tokens
  return { ok: true, centres };
}
