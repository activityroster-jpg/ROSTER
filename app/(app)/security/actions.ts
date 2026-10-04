"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { getRepositories } from "@/lib/cf/bindings";
import { notifySecurityChange, recordSecurityEvent } from "@/lib/security/events";
import { escapeHtml } from "@/lib/mail";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { firstIssue, twoFactorPrefsSchema } from "@/lib/validation/actions";

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

// --- Second step (two-factor) preferences — any signed-in user, self-scoped ----

type Result = { ok: boolean; error?: string };

async function me() {
  const h = new Headers(await headers());
  const s = await (await getAuth()).api.getSession({ headers: h });
  return s?.user ? { userId: s.user.id } : null;
}

/**
 * Record which second step this person wants, before Better Auth's enable /
 * verify dance. Called by the enrolment component for the signed-in user only.
 */
export async function setTwoFactorPrefsAction(input: { method: string }): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Please sign in again." };
  const parsed = twoFactorPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { control } = await getRepositories();
  await control.setTwoFactorPrefs(s.userId, parsed.data.method);
  return { ok: true };
}

/** After Better Auth confirms the second step, note it in the security log. */
export async function noteTwoFactorEnabledAction(): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  const prefs = await control.getTwoFactorPrefs(s.userId);
  await recordSecurityEvent("two_factor_enabled", { userId: s.userId, meta: { method: prefs?.method ?? "app" } });
  return { ok: true };
}

/** After Better Auth turns 2FA off, forget the chosen method and number. */
export async function clearTwoFactorPrefsAction(): Promise<Result> {
  const s = await me();
  if (!s) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  await control.setTwoFactorPrefs(s.userId, null);
  await recordSecurityEvent("two_factor_disabled", { userId: s.userId });
  return { ok: true };
}

/** Sign out every other device: ends all other sessions and forgets confirmed devices, so each one must sign in and re-confirm. */
export async function signOutEverywhereAction(): Promise<Result & { message?: string }> {
  const { ctx } = await requireTenant();
  const h = new Headers(await headers());
  const s = await (await getAuth()).api.getSession({ headers: h });
  const keep = (s?.session?.id as string | undefined) ?? null;
  const { control } = await getRepositories();
  const ended = await control.deleteOtherSessions(ctx.userId, keep);
  await control.forgetTrustedDevices(ctx.userId);
  await recordSecurityEvent("sessions_revoked", { userId: ctx.userId, organisationId: ctx.organisationId, meta: { ended } });
  await notifySecurityChange(ctx.userId, "All other devices were signed out", `<p>Every other device signed in to your ActivityRoster account has been signed out and will need to sign in again.</p>`);
  revalidatePath("/security");
  return { ok: true, message: ended ? `Signed out ${ended} other session${ended === 1 ? "" : "s"}` : "No other sessions were open" };
}

/** Superadmin only: end every session of another office user of this centre (lost phone, someone leaving). */
export async function signOutUserEverywhereAction(userId: string): Promise<Result & { message?: string }> {
  const { ctx } = await requireTenant({ owner: true });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId) || userId === ctx.userId) return { ok: false, error: "Not found" };
  const { control } = await getRepositories();
  const m = await control.membershipFor(userId, ctx.organisationId);
  if (!m || (m.role !== "admin" && m.role !== "owner")) return { ok: false, error: "Not an office user of this centre" };
  const ended = await control.deleteOtherSessions(userId, null);
  await control.forgetTrustedDevices(userId);
  await recordSecurityEvent("sessions_revoked", { userId, organisationId: ctx.organisationId, meta: { ended, by: ctx.userId } });
  await notifySecurityChange(userId, "You were signed out of every device", `<p>The superadmin of your centre signed your ActivityRoster account out of every device. Sign in again to carry on; if you did not expect this, contact your centre.</p>`).catch(() => {});
  revalidatePath("/security");
  return { ok: true, message: ended ? `Ended ${ended} session${ended === 1 ? "" : "s"}` : "No sessions were open" };
}
