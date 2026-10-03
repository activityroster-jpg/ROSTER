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

export interface GeoFix { lat: number; lng: number; accuracy?: number | null }

/** Validate a client-supplied position; anything odd is dropped, never trusted. */
function cleanFix(fix: GeoFix | null | undefined): { lat: number; lng: number; accuracyM: number | null } | null {
  if (!fix) return null;
  const lat = Number(fix.lat), lng = Number(fix.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const acc = fix.accuracy == null ? null : Math.round(Number(fix.accuracy));
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, accuracyM: acc != null && Number.isFinite(acc) && acc >= 0 ? Math.min(acc, 100_000) : null };
}

/** Clock the signed-in instructor in, optionally against one of their sessions (with approximate location from the app). */
export async function clockInAction(courseSessionId?: string | null, fix?: GeoFix | null): Promise<Result> {
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };

  // If a session is supplied it must belong to this tenant.
  let sessionId: string | null = null;
  if (courseSessionId) {
    const session = await repos.tenant.courseSession.findById(ctx, courseSessionId);
    if (!session) return { ok: false, error: "Unknown session" };
    sessionId = session.id;
  }

  await clockIn(repos, ctx, me.id, sessionId, Date.now(), cleanFix(fix));
  revalidatePath("/portal/timeclock");
  return { ok: true };
}

/** Clock the signed-in instructor out of their open entry. */
export async function clockOutAction(fix?: GeoFix | null): Promise<Result> {
  const { ctx, repos, me } = await resolveMe();
  if (!me) return { ok: false, error: "No linked instructor profile" };
  await clockOut(repos, ctx, me.id, Date.now(), cleanFix(fix));
  revalidatePath("/portal/timeclock");
  return { ok: true };
}
