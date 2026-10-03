"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { retryEmail } from "@/lib/mail/queue";
import { idSchema } from "@/lib/validation/actions";

type Result = { ok: boolean; error?: string; message?: string };

export async function retryEmailAction(id: string): Promise<Result> {
  await requirePlatformAdmin();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const r = await retryEmail(await getDb(), getEnv(), pid.data);
  revalidatePath("/admin/email");
  if ("error" in r) return { ok: false, error: r.error };
  return r.sent ? { ok: true, message: "Sent" } : { ok: false, error: r.error ?? "Still failing" };
}

export async function discardEmailAction(id: string): Promise<Result> {
  await requirePlatformAdmin();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  await new PlatformRepository(await getDb()).setEmailStatus(pid.data, "failed", "Discarded by a platform admin");
  revalidatePath("/admin/email");
  return { ok: true, message: "Discarded" };
}
