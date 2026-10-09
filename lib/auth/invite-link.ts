import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getEnv } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { InviteKind } from "@/lib/mail/invite-email";
import { inviteNoteKey, type InviteNote } from "./invite-note";
import { inviteDailyCap, takeInviteSlot } from "@/lib/services/invite-cap";

/** "queued": the centre's daily invite cap was reached; the hourly tick sends it the next day. */
export type InviteResult = "sent" | "queued" | "failed";

/** What the office is told when an invitation was queued. */
export const QUEUED_NOTE = "today's invite limit for your centre is used up, so the invite will go out automatically tomorrow";

/** The centre's sign-in page with the address filled in, for an expired link or the reminder. */
export function centreSignInUrl(slug: string, email: string, kind: InviteKind): string {
  return `https://${slug}.${apexDomain()}/sign-in?next=${kind === "office" ? "/office" : "/portal"}&email=${encodeURIComponent(email)}`;
}

/**
 * Send an invitation: a one-time sign-in link wrapped in the invitation email
 * (centre and inviter named, what happens next) rather than the plain sign-in
 * email. Better Auth builds the link; a short-lived note in KV tells its
 * sendMagicLink hook that this one is an invitation. Records when it went out,
 * which starts the one-day reminder clock. Best effort: "failed" if the email
 * could not be sent. Over the centre's daily cap (fair use) it is queued.
 */
export async function sendInvite(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: { email: string; userId?: string | null; kind: InviteKind; centreName: string; slug: string; callbackPath: string; inviterName?: string | null },
): Promise<InviteResult> {
  const inviterName = input.inviterName !== undefined ? input.inviterName : "userId" in ctx && ctx.userId ? ((await repos.control.userById(ctx.userId))?.name ?? null) : null;
  let allowed = true;
  try { allowed = await takeInviteSlot(repos.control, ctx.organisationId, await inviteDailyCap(repos.db)); } catch { /* counter unavailable: send */ }
  if (!allowed) {
    if (input.userId) await repos.control.queueInvite(input.userId, ctx.organisationId, inviterName);
    return "queued";
  }
  const note: InviteNote = { kind: input.kind, centreName: input.centreName, inviterName, signInUrl: centreSignInUrl(input.slug, input.email, input.kind) };
  try {
    try { await getEnv().TENANT_CACHE.put(inviteNoteKey(input.email), JSON.stringify(note), { expirationTtl: 600 }); } catch { /* falls back to the plain sign-in email */ }
    const auth = await getAuth();
    await auth.api.signInMagicLink({
      body: {
        email: input.email,
        callbackURL: `https://${input.slug}.${apexDomain()}${input.callbackPath}`,
        // Used twice or expired: the centre's sign-in page, address filled in, saying what happened.
        errorCallbackURL: centreSignInUrl(input.slug, input.email, input.kind),
      },
      headers: new Headers(await headers()),
    });
    if (input.userId) await repos.control.noteInviteSent(input.userId, ctx.organisationId, inviterName);
    return "sent";
  } catch (err) {
    console.error("[invite] email failed:", (err as Error).message);
    return "failed";
  }
}

/**
 * Hourly: send invitations a centre's daily cap held back, oldest first, until
 * each centre's allowance for the day runs out again. A failed send stays
 * queued and is tried next hour.
 */
export async function sweepQueuedInvites(repos: Repositories): Promise<{ queued: number; sent: number; held: number; failed: number }> {
  const rows = await repos.control.queuedInvites();
  const full = new Set<string>();
  let sent = 0, held = 0, failed = 0;
  for (const r of rows) {
    if (full.has(r.organisationId)) { held++; continue; }
    const ctx: AnyTenantContext = { organisationId: r.organisationId, slug: r.slug, system: true, reason: "queued invite" };
    const kind: InviteKind = r.role === "admin" ? "office" : "instructor";
    const res = await sendInvite(repos, ctx, { email: r.email, userId: r.userId, kind, centreName: r.centreName, slug: r.slug, callbackPath: kind === "office" ? "/welcome?next=/office" : "/welcome?next=/portal/welcome", inviterName: r.invitedByName });
    if (res === "sent") sent++;
    else if (res === "queued") { full.add(r.organisationId); held++; }
    else failed++;
  }
  return { queued: rows.length, sent, held, failed };
}
