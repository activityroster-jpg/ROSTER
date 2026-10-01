"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export type SetPwResult = { ok: boolean; error?: string };

/** Set a password for the signed-in user (first-time setup after a magic-link
 *  sign-in). Fails gracefully if they already have one. */
export async function setMyPasswordAction(password: string): Promise<SetPwResult> {
  if (!password || password.length < 8) return { ok: false, error: "Use at least 8 characters." };
  try {
    const auth = await getAuth();
    await auth.api.setPassword({ body: { newPassword: password }, headers: new Headers(await headers()) });
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message || "Could not set a password";
    return { ok: false, error: /already/i.test(msg) ? "You already have a password set — use “Forgot password” on sign-in to change it." : msg };
  }
}
