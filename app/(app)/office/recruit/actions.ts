"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant, type RequiredTenant } from "@/lib/tenant/require";
import { jobInputSchema, recruitProfileSchema } from "@/lib/validation/jobs";
import { postingAccess } from "@/lib/domain/jobs";
import { closeJob, createJob, deleteDraft, dismissHiringCard, editJob, publishJob, renewJob, retryJob, saveCentreDetails } from "@/lib/services/jobs";

export type RecruitResult = { ok: boolean; error?: string; message?: string; id?: string };

const idSchema = z.string().uuid();

/** Centre admins with the Staff feature (and the owner); posting needs a paying plan or an active trial. */
async function tenantThatCanPost(): Promise<RequiredTenant | { error: string }> {
  const t = await requireTenant({ permission: "staff.edit" });
  const access = postingAccess({ orgStatus: t.organisation.status, subscriptionStatus: t.organisation.subscriptionStatus ?? null, trialKind: t.trial.kind, readOnly: Boolean(t.ctx.readOnly) });
  if (access.kind !== "post") return { error: access.reason };
  return t;
}

function done(message?: string, id?: string): RecruitResult {
  revalidatePath("/office/recruit");
  return { ok: true, message, id };
}

function firstIssue(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Check the details and try again.";
}

export async function saveJobAction(id: string | null, input: unknown, publishNow = false): Promise<RecruitResult> {
  const t = await tenantThatCanPost();
  if ("error" in t) return { ok: false, error: t.error };
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  let jobId: string;
  if (id) {
    if (!idSchema.safeParse(id).success) return { ok: false, error: "That job wasn't found." };
    const res = await editJob(t.repos, t.ctx, id, parsed.data);
    if (!res.ok) return { ok: false, error: res.error };
    jobId = id;
  } else {
    jobId = (await createJob(t.repos, t.ctx, parsed.data, t.ctx.userId)).id;
  }
  if (publishNow) {
    const pub = await publishJob(t.repos, t.ctx, jobId, t.organisation);
    if (!pub.ok) {
      revalidatePath("/office/recruit");
      return { ok: false, error: `Saved as a draft, but not published: ${pub.error}`, id: jobId };
    }
    return done("Publishing to Boaty Jobs. It usually goes live within a couple of minutes.", jobId);
  }
  return done(id ? "Saved." : "Saved as a draft.", jobId);
}

type JobOp = "publish" | "close" | "renew" | "retry" | "delete";

export async function jobOpAction(id: string, op: JobOp): Promise<RecruitResult> {
  const t = await tenantThatCanPost();
  if ("error" in t) return { ok: false, error: t.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "That job wasn't found." };
  const res =
    op === "publish" ? await publishJob(t.repos, t.ctx, id, t.organisation)
    : op === "close" ? await closeJob(t.repos, t.ctx, id)
    : op === "renew" ? await renewJob(t.repos, t.ctx, id, t.organisation)
    : op === "retry" ? await retryJob(t.repos, t.ctx, id)
    : op === "delete" ? await deleteDraft(t.repos, t.ctx, id)
    : { ok: false as const, error: "Unknown action" };
  if (!res.ok) return { ok: false, error: res.error };
  const message: Record<JobOp, string> = {
    publish: "Publishing to Boaty Jobs. It usually goes live within a couple of minutes.",
    close: "Closed. It comes off Boaty Jobs within a couple of minutes.",
    renew: "Renewing for another 60 days.",
    retry: "Trying Boaty Jobs again.",
    delete: "Draft deleted.",
  };
  return done(message[op]);
}

export async function saveCentreDetailsAction(input: unknown): Promise<RecruitResult> {
  const t = await tenantThatCanPost();
  if ("error" in t) return { ok: false, error: t.error };
  const parsed = recruitProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await saveCentreDetails(t.repos, t.ctx, parsed.data);
  return done("Centre details saved. Any live jobs are updated on Boaty Jobs too.");
}

/** The seasonal dashboard card ("Hiring for the season?"). Hidden until next season. */
export async function dismissHiringCardAction(): Promise<RecruitResult> {
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
  if (ctx.readOnly) return { ok: true };
  await dismissHiringCard(repos, ctx);
  revalidatePath("/office");
  return { ok: true };
}
