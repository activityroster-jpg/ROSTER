"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { confirmAssignment, declineAssignment } from "@/lib/services/roster";
import { declineSchema, firstIssue, idSchema } from "@/lib/validation/actions";

type Result = { ok: boolean; error?: string };

async function resolveMe() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  return { ctx, repos, me };
}

/** "I'll be there" for one rostered course. */
export async function confirmAssignmentAction(assignmentId: string): Promise<Result> {
  if (!idSchema.safeParse(assignmentId).success) return { ok: false, error: "Invalid request" };
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const r = await confirmAssignment(repos, ctx, me.id, assignmentId);
  revalidatePath("/portal");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** "I can't make it" with a short reason for the office. */
export async function declineAssignmentAction(assignmentId: string, note: string): Promise<Result> {
  const parsed = declineSchema.safeParse({ assignmentId, note });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid request") };
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const r = await declineAssignment(repos, ctx, me.id, parsed.data.assignmentId, parsed.data.note);
  revalidatePath("/portal");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
