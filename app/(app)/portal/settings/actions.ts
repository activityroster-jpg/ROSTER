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

type Result = { ok: boolean; error?: string };

/** Update my own name and phone number (the instructor record this centre holds). */
export async function updateMyProfileAction(input: { name: string; phone: string }): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const name = String(input?.name ?? "").trim().slice(0, 120);
  const phone = String(input?.phone ?? "").trim().slice(0, 40);
  if (name.length < 2) return { ok: false, error: "Enter your name" };
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
  if (typeof newPassword !== "string" || newPassword.length < 10) return { ok: false, error: "Use at least 10 characters." };
  if (!currentPassword) return { ok: false, error: "Enter your current password." };
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
