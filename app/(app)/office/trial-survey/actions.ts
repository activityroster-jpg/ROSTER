"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { trialSurveySchema } from "@/lib/validation/trial-survey";
import { submitTrialSurvey, SurveyNotOpenError } from "@/lib/services/trial-survey";

export type SurveyState = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; trialEndsAt?: string };

/** Store a centre's trial-end survey answers and unlock it for another free month. Admins only; works while read-only or locked. */
export async function submitTrialSurveyAction(_prev: SurveyState, formData: FormData): Promise<SurveyState> {
  const { ctx, organisation, repos } = await requireTenant({ permission: "billing.manage", allowReadOnly: true });
  if (ctx.ghost) return { ok: false, error: "Ghost Mode is read-only." };
  const parsed = trialSurveySchema.safeParse(Object.fromEntries(["mostUseful", "leastUseful", "wouldChange", "missing", "featureRequest", "userCount", "otherFeedback", "contactOk", "contactEmail"].map((k) => [k, formData.get(k) ?? undefined])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: "Some answers need a little more. They're marked below.", fieldErrors };
  }
  const trialDays = (await new PlatformRepository(await getDb()).getPricing().catch(() => null))?.trialDays ?? 30;
  try {
    const r = await submitTrialSurvey(repos, { organisation, userId: ctx.userId, trialDays, answers: parsed.data });
    revalidatePath("/office", "layout");
    return { ok: true, trialEndsAt: r.trialEndsAt.toISOString() };
  } catch (e) {
    if (e instanceof SurveyNotOpenError) return { ok: false, error: e.message };
    throw e;
  }
}
