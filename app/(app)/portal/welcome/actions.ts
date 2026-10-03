"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { isPwnedPassword, PWNED_MESSAGE } from "@/lib/security/pwned";
import { firstIssue, passwordSchema } from "@/lib/validation/actions";

export type SetPwResult = { ok: boolean; error?: string };

/** Set a password for the signed-in user (first-time setup after a magic-link
 *  sign-in). Fails gracefully if they already have one. */
export async function setMyPasswordAction(password: string): Promise<SetPwResult> {
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { ok: false, error: firstIssue(pw.error) };
  if (await isPwnedPassword(password)) return { ok: false, error: PWNED_MESSAGE };
  try {
    const auth = await getAuth();
    await auth.api.setPassword({ body: { newPassword: password }, headers: new Headers(await headers()) });
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message || "Could not set a password";
    return { ok: false, error: /already/i.test(msg) ? "You already have a password set — change it from Settings." : msg };
  }
}
