import { getEnv } from "@/lib/cf/bindings";
import type { InviteKind } from "@/lib/mail/invite-email";

/** A short-lived note (KV, ten minutes) that the next sign-in link for this address is an invitation. See lib/auth/invite-link. */
export interface InviteNote { kind: InviteKind; centreName: string; inviterName: string | null; signInUrl: string }

export const inviteNoteKey = (email: string) => `invite-note:${email.trim().toLowerCase()}`;

/** Read and remove the note, so only the one email it was meant for uses it. */
export async function readInviteNote(email: string): Promise<InviteNote | null> {
  try {
    const kv = getEnv().TENANT_CACHE;
    const raw = await kv.get(inviteNoteKey(email));
    if (!raw) return null;
    await kv.delete(inviteNoteKey(email));
    return JSON.parse(raw) as InviteNote;
  } catch { return null; }
}
