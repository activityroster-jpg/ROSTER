import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getEnv } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import type { InviteKind } from "@/lib/mail/invite-email";
import { inviteNoteKey, type InviteNote } from "./invite-note";

/** The centre's sign-in page with the address filled in, for an expired link or the reminder. */
export function centreSignInUrl(slug: string, email: string, kind: InviteKind): string {
  return `https://${slug}.${apexDomain()}/sign-in?next=${kind === "office" ? "/office" : "/portal"}&email=${encodeURIComponent(email)}`;
}

/**
 * Send an invitation: a one-time sign-in link wrapped in the invitation email
 * (centre and inviter named, what happens next) rather than the plain sign-in
 * email. Better Auth builds the link; a short-lived note in KV tells its
 * sendMagicLink hook that this one is an invitation. Records when it went out,
 * which starts the one-day reminder clock. Best effort: returns false if the
 * email could not be sent.
 */
export async function sendInvite(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: { email: string; userId?: string | null; kind: InviteKind; centreName: string; slug: string; callbackPath: string },
): Promise<boolean> {
  const inviterName = "userId" in ctx && ctx.userId ? ((await repos.control.userById(ctx.userId))?.name ?? null) : null;
  const note: InviteNote = { kind: input.kind, centreName: input.centreName, inviterName, signInUrl: centreSignInUrl(input.slug, input.email, input.kind) };
  try {
    try { await getEnv().TENANT_CACHE.put(inviteNoteKey(input.email), JSON.stringify(note), { expirationTtl: 600 }); } catch { /* falls back to the plain sign-in email */ }
    const auth = await getAuth();
    await auth.api.signInMagicLink({ body: { email: input.email, callbackURL: `https://${input.slug}.${apexDomain()}${input.callbackPath}` }, headers: new Headers(await headers()) });
    if (input.userId) await repos.control.noteInviteSent(input.userId, ctx.organisationId, inviterName);
    return true;
  } catch (err) {
    console.error("[invite] email failed:", (err as Error).message);
    return false;
  }
}
