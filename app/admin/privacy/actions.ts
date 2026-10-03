"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PRIVACY_REQUEST_STATUSES, type PrivacyRequestStatus } from "@/lib/db/schema";
import { idSchema } from "@/lib/validation/actions";

export async function setPrivacyRequestStatusAction(id: string, status: string, notes?: string): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();
  const pid = idSchema.safeParse(id);
  if (!pid.success || !(PRIVACY_REQUEST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid request" };
  const repo = new PlatformRepository(await getDb());
  await repo.setPrivacyRequestStatus(pid.data, status as PrivacyRequestStatus, notes === undefined ? undefined : String(notes).slice(0, 2000));
  revalidatePath("/admin/privacy");
  return { ok: true };
}
