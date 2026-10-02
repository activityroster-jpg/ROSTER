"use server";

import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { getRepositories } from "@/lib/cf/bindings";

const schema = z.object({ recoveryEmail: z.string().trim().email().max(200) });

export type RecoveryState = { ok: boolean; error?: string; message?: string };

/** Set the signed-in admin's account-recovery email. Admin-only, self-scoped. */
export async function setRecoveryEmailAction(_prev: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const { ctx } = await requireTenant({ role: "admin", skipMfaGate: true });
  const parsed = schema.safeParse({ recoveryEmail: formData.get("recoveryEmail") });
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };
  const { control } = await getRepositories();
  await control.setRecoveryEmail(ctx.userId, parsed.data.recoveryEmail.toLowerCase());
  return { ok: true, message: "Recovery email saved" };
}
