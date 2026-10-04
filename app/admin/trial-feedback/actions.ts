"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { idSchema } from "@/lib/validation/actions";
import { ExtraTrialError, grantExtraTrial } from "@/lib/services/trial-survey";

export type ExtraTrialResult = { ok: boolean; error?: string; trialEndsAt?: string };

/** "Activate 30-day trial" on a centre's trial-end feedback. Platform owner only; once per set of answers. */
export async function activateExtraTrialAction(feedbackId: string): Promise<ExtraTrialResult> {
  const { email } = await requirePlatformAdmin();
  if (!idSchema.safeParse(feedbackId).success) return { ok: false, error: "Feedback not found" };
  const repos = await getRepositories();
  const trialDays = (await new PlatformRepository(repos.db).getPricing().catch(() => null))?.trialDays ?? 30;
  try {
    const r = await grantExtraTrial(repos, getEnv(), { feedbackId, grantedBy: email, trialDays });
    revalidatePath("/admin/trial-feedback");
    revalidatePath(`/admin/trial-feedback/${feedbackId}`);
    revalidatePath("/admin");
    return { ok: true, trialEndsAt: r.trialEndsAt.toISOString() };
  } catch (e) {
    if (e instanceof ExtraTrialError) return { ok: false, error: e.message };
    throw e;
  }
}
