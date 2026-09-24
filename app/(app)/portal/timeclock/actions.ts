"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { clockIn, clockOut } from "@/lib/services/timeclock";

type Result = { ok: boolean; error?: string };

async function resolveMe() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  return { ctx, repos, me };
}

/** Clock the signed-in instructor in, optionally against one of their sessions. */
export async function clockInAction(courseSessionId?: string | null): Promise<Result> {
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };

  // If a session is supplied it must belong to this tenant.
  let sessionId: string | null = null;
  if (courseSessionId) {
    const session = await repos.tenant.courseSession.findById(ctx, courseSessionId);
    if (!session) return { ok: false, error: "Unknown session" };
    sessionId = session.id;
  }

  await clockIn(repos, ctx, me.id, sessionId);
  revalidatePath("/portal/timeclock");
  return { ok: true };
}

/** Clock the signed-in instructor out of their open entry. */
export async function clockOutAction(): Promise<Result> {
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  await clockOut(repos, ctx, me.id);
  revalidatePath("/portal/timeclock");
  return { ok: true };
}
