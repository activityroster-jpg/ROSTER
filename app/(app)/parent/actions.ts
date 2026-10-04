"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { PARENT_DECISIONS, type ParentDecision } from "@/lib/db/schema";
import { recordParentDecision } from "@/lib/services/guardians";
import { idSchema } from "@/lib/validation/actions";

/** A parent approves, declines or withdraws permission for their own child. The link must belong to this parent. */
export async function parentDecideAction(linkId: string, decision: string): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "parent.view" });
  if (!idSchema.safeParse(linkId).success) return { ok: false, error: "Not found" };
  if (!(PARENT_DECISIONS as readonly string[]).includes(decision)) return { ok: false, error: "Choose approve, decline or withdraw" };
  const r = await recordParentDecision(repos, ctx, linkId, ctx.userId, decision as ParentDecision);
  revalidatePath("/parent");
  return r;
}
