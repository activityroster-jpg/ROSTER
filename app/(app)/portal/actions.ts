"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { verifyPin } from "@/lib/auth/pin";
import { recordSecurityEvent } from "@/lib/security/events";
import { isPlatformAdminEmail } from "@/lib/platform/admin";
import { sendEmail } from "@/lib/mail";
import { deleteMyAccount } from "@/lib/services/account-deletion";
import { PIN_COOKIE } from "@/lib/auth/pin";
import { CENTRE_COOKIE } from "@/lib/auth/centre-cookie";
import { instructor as instructorTable } from "@/lib/db/schema";
import { confirmAssignment, declineAssignment } from "@/lib/services/roster";
import { declineSchema, firstIssue, idSchema } from "@/lib/validation/actions";

type Result = { ok: boolean; error?: string };

async function resolveMe() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  return { ctx, repos, me };
}

/** "I'll be there" for one rostered course. */
export async function confirmAssignmentAction(assignmentId: string): Promise<Result> {
  if (!idSchema.safeParse(assignmentId).success) return { ok: false, error: "Invalid request" };
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const r = await confirmAssignment(repos, ctx, me.id, assignmentId);
  revalidatePath("/portal");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** "I can't make it" with a short reason for the office. */
export async function declineAssignmentAction(assignmentId: string, note: string): Promise<Result> {
  const parsed = declineSchema.safeParse({ assignmentId, note });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid request") };
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const r = await declineAssignment(repos, ctx, me.id, parsed.data.assignmentId, parsed.data.note);
  revalidatePath("/portal");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * Delete my account, from the app's Settings. The PIN confirms it is the
 * person themselves (never a shared device left open). Everything personal
 * goes now; see lib/services/account-deletion for what stays and why.
 */
export async function deleteMyAccountAction(pin: string): Promise<Result> {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) return { ok: false, error: "Please sign in again." };
  const repos = await getRepositories();
  const sec = await repos.control.getUserSecurity(s.user.id);
  if (!sec?.pinHash || !(await verifyPin(String(pin ?? ""), sec.pinHash))) {
    await recordSecurityEvent("pin_failed", { userId: s.user.id, meta: { where: "delete_account" } });
    return { ok: false, error: "That PIN isn't right." };
  }
  const email = s.user.email;
  const r = await deleteMyAccount(repos, s.user.id, { isPlatformAdmin: await isPlatformAdminEmail(email) });
  if (!r.ok) return { ok: false, error: r.message };
  await recordSecurityEvent("account_deleted", { userId: s.user.id, meta: { centres: r.centres } }).catch(() => {});
  try {
    await sendEmail({ to: email, subject: "Your ActivityRoster account has been deleted", html: `<p>Hello,</p><p>Your ActivityRoster account (${email}) and your personal details have been deleted, as you asked from the app. Any centre you belonged to keeps only its past roster and pay records, without your name.</p><p>If this wasn't you, reply to this email straight away.</p>` });
  } catch { /* the deletion itself is what matters */ }
  const jar = await cookies();
  for (const name of [PIN_COOKIE, CENTRE_COOKIE]) jar.delete(name);
  return { ok: true };
}
