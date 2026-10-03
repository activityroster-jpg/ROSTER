"use server";

import { isPwnedPassword, PWNED_MESSAGE } from "@/lib/security/pwned";
import { passwordSchema } from "@/lib/validation/actions";
import { firstIssue } from "@/lib/validation/actions";

/** Length and breached-password check before a reset goes to Better Auth. */
export async function passwordAcceptableAction(password: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (await isPwnedPassword(parsed.data)) return { ok: false, error: PWNED_MESSAGE };
  return { ok: true };
}
