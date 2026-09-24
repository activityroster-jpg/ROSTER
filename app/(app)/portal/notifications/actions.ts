"use server";

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
