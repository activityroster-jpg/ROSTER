"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { decideLeave } from "@/lib/services/leave";
import { cancelOpenShift, confirmOpenShift, createOpenShift } from "@/lib/services/openshifts";

type Result = { ok: boolean; error?: string };

export async function decideLeaveAction(leaveId: string, decision: "approved" | "declined"): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (decision !== "approved" && decision !== "declined") return { ok: false, error: "Invalid decision" };
  const res = await decideLeave(repos, ctx, leaveId, decision);
  if (!res) return { ok: false, error: "Not found" };
  revalidatePath("/office/leave");
  return { ok: true };
}

export async function createOpenShiftAction(courseSessionId: string, roleTypeId: string, note?: string): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const session = await repos.tenant.courseSession.findById(ctx, courseSessionId);
  const role = await repos.tenant.roleType.findById(ctx, roleTypeId);
  if (!session || !role) return { ok: false, error: "Pick a session and role" };
  await createOpenShift(repos, ctx, courseSessionId, roleTypeId, note ?? null);
  revalidatePath("/office/leave");
  return { ok: true };
}

export async function confirmOpenShiftAction(shiftId: string, override?: { note: string }): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const note = override?.note?.trim();
  if (override && !note) return { ok: false, error: "Add a reason to override the checks" };
  const res = await confirmOpenShift(repos, ctx, shiftId, override ? { override: true, overrideNote: note } : {});
  if (!res.ok) return { ok: false, error: res.reason === "blocked" ? `${res.detail}. Tick “confirm anyway” to override.` : res.detail };
  revalidatePath("/office/leave");
  revalidatePath("/office/courses");
  return { ok: true };
}

export async function cancelOpenShiftAction(shiftId: string): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  await cancelOpenShift(repos, ctx, shiftId);
  revalidatePath("/office/leave");
  return { ok: true };
}
