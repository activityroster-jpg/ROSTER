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
import { escapeHtml, sendEmail } from "@/lib/mail";
import { apexDomain } from "@/lib/config";
import { issueCalendarToken, revokeCalendarToken } from "@/lib/services/calendar-feed";

type Result = { ok: boolean; error?: string };

/** Make (or replace) my private calendar link. The link is returned once and never stored. */
export async function createMyCalendarFeedAction(): Promise<Result & { url?: string }> {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const token = await issueCalendarToken(repos, ctx, me.id);
  if (!token) return { ok: false, error: "Couldn't make a link" };
  await recordSecurityEvent("calendar_feed_reset", { userId: ctx.userId, organisationId: ctx.organisationId });
  revalidatePath("/portal/settings");
  return { ok: true, url: `https://${apexDomain()}/api/calendar/${token}.ics` };
}

/** Switch my calendar link off; calendars that use it stop updating. */
export async function revokeMyCalendarFeedAction(): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  await revokeCalendarToken(repos, ctx, me.id);
  revalidatePath("/portal/settings");
  return { ok: true };
}

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
});

/** My date of birth (optional; only the centre sees it). */
export async function setMyDetailsAction(input: { dateOfBirth: string }): Promise<Result & { message?: string }> {
  const { ctx, repos } = await requireTenant();
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { dateOfBirth } = parsed.data;
  const age = ageOn(dateOfBirth);
  if (age == null || age < 13 || age > 100) return { ok: false, error: "Check the date of birth" };
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  if (me.dateOfBirth !== dateOfBirth) {
    await repos.tenant.instructor.update(ctx, me.id, { dateOfBirth });
    await writeAudit(repos, ctx, { action: "update_profile", entity: "instructor", entityId: me.id, after: { dateOfBirth: "set by the instructor" } });
  }
  revalidatePath("/portal/welcome"); revalidatePath("/portal/settings"); revalidatePath("/portal");
  return { ok: true, message: "Saved" };
}
