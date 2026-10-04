"use server";

import { writeAudit } from "@/lib/services/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { markAllRead, markRead } from "@/lib/services/notifications";

type Result = { ok: boolean; error?: string };

async function me() {
  const { ctx, repos } = await requireTenant();
  const m = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  return { ctx, repos, m };
}

export async function markReadAction(id: string): Promise<Result> {
  const { ctx, repos, m } = await me();
  if (!m) return { ok: false, error: "No linked instructor profile" };
  // Confirm the notification belongs to this instructor before marking read.
  const n = await repos.tenant.notification.findById(ctx, id);
  if (!n || n.instructorId !== m.id) return { ok: false, error: "Not found" };
  await markRead(repos, ctx, id);
  revalidatePath("/portal/notifications");
  return { ok: true };
}

export async function markAllReadAction(): Promise<Result> {
  const { ctx, repos, m } = await me();
  if (!m) return { ok: false, error: "No linked instructor profile" };
  await markAllRead(repos, ctx, m.id);
  revalidatePath("/portal/notifications");
  return { ok: true };
}

/** Toggle whether this instructor also receives emails (in-app is always on). */
export async function setNotifyEmailAction(enabled: boolean): Promise<Result> {
  const { ctx, repos, m } = await me();
  if (!m) return { ok: false, error: "No linked instructor profile" };
  await repos.tenant.instructor.update(ctx, m.id, { notifyEmail: enabled });
  await writeAudit(repos, ctx, { action: "set_notify_email", entity: "instructor", entityId: m.id, after: { notifyEmail: enabled } });
  revalidatePath("/portal/notifications");
  return { ok: true };
}

/** Opt-in: let colleagues see my phone and email in the portal's Team contacts. Never offered to under-18s. */
export async function setShareContactAction(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const { isUnder18 } = await import("@/lib/domain/age");
  if (isUnder18(me.dateOfBirth) && on) return { ok: false, error: "Not available for under-18s" };
  await repos.tenant.instructor.update(ctx, me.id, { shareContact: Boolean(on) });
  await writeAudit(repos, ctx, { action: "set_share_contact", entity: "instructor", entityId: me.id, after: { on: Boolean(on) } });
  revalidatePath("/portal/settings"); revalidatePath("/portal");
  return { ok: true };
}
