"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";

export type VoteResult = { ok: boolean; voted?: boolean; error?: string };

/** "We need this too": add or take back this centre's vote. Counted on the board; which centres voted is never shown. */
export async function toggleFeatureVoteAction(requestId: string): Promise<VoteResult> {
  const { ctx, repos } = await requireTenant({ permission: "office.view", allowReadOnly: true });
  if (ctx.ghost) return { ok: false, error: "Ghost Mode is read-only." };
  const id = z.string().uuid().safeParse(requestId);
  if (!id.success) return { ok: false, error: "Unknown request" };
  const res = await new FeatureRequestRepository(repos.db).toggleVote(ctx, id.data);
  if (!res) return { ok: false, error: "You can't vote on that one." };
  revalidatePath("/office/requests");
  return { ok: true, voted: res.voted };
}
