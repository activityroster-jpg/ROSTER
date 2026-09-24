"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable, LEAVE_TYPES, type LeaveType } from "@/lib/db/schema";
import { requestLeave, type LeaveInput } from "@/lib/services/leave";
import { claimOpenShift } from "@/lib/services/openshifts";

type Result = { ok: boolean; error?: string };

async function resolveMe() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  return { ctx, repos, me };
}

export async function requestLeaveAction(input: LeaveInput): Promise<Result> {
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };

  if (!(LEAVE_TYPES as readonly string[]).includes(input.type)) return { ok: false, error: "Invalid type" };
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(input.startDate) || !dateRe.test(input.endDate)) return { ok: false, error: "Invalid dates" };
  if (input.endDate < input.startDate) return { ok: false, error: "End date is before start date" };
  const days = Number(input.days);
  if (!Number.isFinite(days) || days <= 0 || days > 365) return { ok: false, error: "Invalid number of days" };

  await requestLeave(repos, ctx, me.id, {
    type: input.type as LeaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    days,
    reason: input.reason ?? null,
  });
  revalidatePath("/portal/leave");
  return { ok: true };
}

export async function claimOpenShiftAction(shiftId: string): Promise<Result> {
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  const res = await claimOpenShift(repos, ctx, shiftId, me.id);
  if (!res) return { ok: false, error: "This shift is no longer available" };
  revalidatePath("/portal/leave");
  return { ok: true };
}
