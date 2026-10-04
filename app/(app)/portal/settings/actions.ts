"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { writeAudit } from "@/lib/services/audit";
import { isPwnedPassword, PWNED_MESSAGE } from "@/lib/security/pwned";
import { recordSecurityEvent } from "@/lib/security/events";
import { firstIssue, passwordSchema, profileSchema } from "@/lib/validation/actions";
import { z } from "zod";
import { ageOn } from "@/lib/domain/age";
import { guardianLinksFor, requestParentApprovalFromPortal } from "@/lib/services/guardians";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { apexDomain } from "@/lib/config";

type Result = { ok: boolean; error?: string };

/** Update my own name and phone number (the instructor record this centre holds). */
export async function updateMyProfileAction(input: { name: string; phone: string }): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { name, phone } = parsed.data;
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  await repos.tenant.instructor.update(ctx, me.id, { name, phone: phone || null });
  await writeAudit(repos, ctx, { action: "update_profile", entity: "instructor", entityId: me.id, before: { name: me.name, phone: me.phone }, after: { name, phone: phone || null } });
  revalidatePath("/portal/settings");
  revalidatePath("/portal");
  return { ok: true };
}

/** Change my password (needs the current one). */
export async function changeMyPasswordAction(currentPassword: string, newPassword: string): Promise<Result> {
  const { ctx } = await requireTenant();
  const pw = passwordSchema.safeParse(newPassword);
  if (!pw.success) return { ok: false, error: firstIssue(pw.error) };
  if (typeof currentPassword !== "string" || !currentPassword) return { ok: false, error: "Enter your current password." };
  if (await isPwnedPassword(newPassword)) return { ok: false, error: PWNED_MESSAGE };
  try {
    const auth = await getAuth();
    await auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: false }, headers: new Headers(await headers()) });
  } catch (err) {
    const msg = (err as Error).message || "";
    return { ok: false, error: /invalid|incorrect|password/i.test(msg) ? "That current password isn't right." : msg || "Could not change your password" };
  }
  await recordSecurityEvent("password_changed", { userId: ctx.userId });
  return { ok: true };
}

const detailsSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
  parentName: z.string().trim().max(120).optional().default(""),
  parentEmail: z.string().trim().toLowerCase().max(200).optional().default(""),
});

/**
 * My date of birth and, under 18, the parent or guardian to invite. The
 * invite email says who asked and why, and the parent can decline.
 */
export async function setMyDetailsAction(input: { dateOfBirth: string; parentName?: string; parentEmail?: string }): Promise<Result & { message?: string }> {
  const { ctx, repos, organisation } = await requireTenant();
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { dateOfBirth, parentName, parentEmail } = parsed.data;
  const age = ageOn(dateOfBirth);
  if (age == null || age < 13 || age > 100) return { ok: false, error: "Check the date of birth" };
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  if (me.dateOfBirth !== dateOfBirth) {
    await repos.tenant.instructor.update(ctx, me.id, { dateOfBirth });
    await writeAudit(repos, ctx, { action: "update_profile", entity: "instructor", entityId: me.id, after: { dateOfBirth: "set by the instructor" } });
  }
  revalidatePath("/portal/welcome"); revalidatePath("/portal/settings"); revalidatePath("/portal");
  if (age >= 18) return { ok: true, message: "Saved" };
  const already = (await guardianLinksFor(repos, ctx, me.id)).some((l) => l.status === "active");
  if (already) return { ok: true, message: "Saved" };
  if (!parentEmail || !z.string().email().safeParse(parentEmail).success) return { ok: false, error: "Enter your parent or guardian's email so we can ask them to approve" };
  const r = await requestParentApprovalFromPortal(repos, ctx, me.id, parentName, parentEmail);
  if (!r.ok) return r;
  // The parent gets a plain explanation first, then the sign-in link.
  const apex = apexDomain();
  await sendEmail({
    to: r.email,
    subject: `${me.name} has asked you to approve them working at ${organisation.name}`,
    html: `<p>Hello${parentName ? ` ${escapeHtml(parentName)}` : ""},</p><p><strong>${escapeHtml(me.name)}</strong> has joined <strong>${escapeHtml(organisation.name)}</strong> on ActivityRoster as a young instructor and gave your email as their parent or guardian.</p><p>The centre asks a parent or guardian to approve a young person working before rostering them. A separate email gives you a sign-in link to a small account where you can approve or decline, and see their roster. Only their name, roster and your own email are involved; nothing else about you is stored.</p><p>If you'd rather not, do nothing: you will not be contacted again about this unless the centre asks. How the centre looks after young people: <a href="https://${apex}/privacy/young-people">${apex}/privacy/young-people</a>.</p>`,
  }).catch(() => {});
  try {
    const auth = await getAuth();
    await auth.api.signInMagicLink({ body: { email: r.email, callbackURL: `https://${organisation.slug}.${apex}/parent` }, headers: new Headers(await headers()) });
  } catch (err) { console.error("[parent-invite] magic link failed:", (err as Error).message); }
  return { ok: true, message: `Saved. We've emailed ${r.email} to approve.` };
}
