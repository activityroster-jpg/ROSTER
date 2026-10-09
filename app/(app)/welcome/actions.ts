"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { isPwnedPassword, PWNED_MESSAGE } from "@/lib/security/pwned";
import { firstIssue, passwordSchema } from "@/lib/validation/actions";

const schema = z.object({ name: z.string().trim().min(2, "Enter your name").max(120), password: passwordSchema });

/** First-time account setup after an invitation link: name and password for the signed-in user. */
export async function createAccountAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (await isPwnedPassword(parsed.data.password)) return { ok: false, error: PWNED_MESSAGE };
  const h = new Headers(await headers());
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: h }).catch(() => null);
  if (!session?.user) return { ok: false, error: "Your link has expired. Open the invitation email again." };
  try {
    await auth.api.updateUser({ body: { name: parsed.data.name }, headers: h });
    await auth.api.setPassword({ body: { newPassword: parsed.data.password }, headers: h });
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/already/i.test(msg)) return { ok: true };
    return { ok: false, error: "That didn't save. Try again." };
  }
}
