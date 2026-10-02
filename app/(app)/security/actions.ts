"use server";

import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { getRepositories } from "@/lib/cf/bindings";
import { notifySecurityChange, recordSecurityEvent } from "@/lib/security/events";
import { escapeHtml } from "@/lib/mail";

const schema = z.object({ recoveryEmail: z.string().trim().email().max(200) });

export type RecoveryState = { ok: boolean; error?: string; message?: string };

/** Set the signed-in admin's account-recovery email. Admin-only, self-scoped. */
export async function setRecoveryEmailAction(_prev: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const { ctx } = await requireTenant({ role: "admin", skipMfaGate: true });
  const parsed = schema.safeParse({ recoveryEmail: formData.get("recoveryEmail") });
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };
  const { control } = await getRepositories();
  const next = parsed.data.recoveryEmail.toLowerCase();
  const previous = (await control.userById(ctx.userId))?.recoveryEmail ?? null;
  await control.setRecoveryEmail(ctx.userId, next);
  await recordSecurityEvent("recovery_email_set", { userId: ctx.userId, organisationId: ctx.organisationId, meta: { changed: previous !== next } });
  // Tell the account email, the new recovery address and (if different) the old one.
  await notifySecurityChange(ctx.userId, "Your ActivityRoster recovery email was changed", `<p>The recovery email on your account is now <strong>${escapeHtml(next)}</strong>.</p>`, previous && previous !== next ? [previous] : []);
  return { ok: true, message: "Recovery email saved" };
}
