"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable, type SlotCode } from "@/lib/db/schema";
import { availabilityHorizon, setAvailability, setAvailabilityMany, setAvailabilityNote, setAvailabilityPattern, type AvailabilityStatus } from "@/lib/services/availability";
import { inHorizon } from "@/lib/domain/availability";
import { availabilityBulkSchema, availabilityEntrySchema, availabilityNoteSchema, availabilityPatternSchema, firstIssue } from "@/lib/validation/actions";
import type { Repositories } from "@/lib/db/repositories";
import type { TenantContext } from "@/lib/tenant/context";
import { courseStaff as courseStaffTable } from "@/lib/db/schema";
import { emailAdmins } from "@/lib/services/admin-mail";
import { escapeHtml } from "@/lib/mail";
import { liveSessions } from "@/lib/domain/sessions";

export interface SetAvailabilityInput {
  date: string;
  slot: SlotCode;
  status: AvailabilityStatus | null;
}

type Result = { ok: boolean; error?: string };

/** An instructor may only edit their OWN availability: their record comes from the session, never from the client. */
async function me(repos: Repositories, ctx: TenantContext) {
  return (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0] ?? null;
}

async function windowOf(repos: Repositories, ctx: TenantContext) {
  return availabilityHorizon((await repos.tenant.orgSettings.list(ctx))[0]);
}

/** Set many slots at once (copy last week, mark the week free, reset to usual). Max 50 entries, all inside the window. */
export async function setAvailabilityBulkAction(entries: SetAvailabilityInput[]): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const parsed = availabilityBulkSchema.safeParse(entries);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid slot") };
  const who = await me(repos, ctx);
  if (!who) return { ok: false, error: "No linked instructor profile" };
  const horizon = await windowOf(repos, ctx);
  if (parsed.data.some((e) => !inHorizon(horizon, e.date))) return { ok: false, error: `Your centre asks ${horizon.weeksAhead} week${horizon.weeksAhead === 1 ? "" : "s"} ahead; those dates aren't open yet` };
  await setAvailabilityMany(repos, ctx, who.id, parsed.data);
  revalidatePath("/portal/availability");
  return { ok: true };
}

/** Set the signed-in instructor's own availability for a date + slot (inside the window). */
export async function setAvailabilityAction(input: SetAvailabilityInput): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const parsed = availabilityEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid slot") };
  const who = await me(repos, ctx);
  if (!who) return { ok: false, error: "No linked instructor profile" };
  const horizon = await windowOf(repos, ctx);
  if (!inHorizon(horizon, parsed.data.date)) return { ok: false, error: `Your centre asks ${horizon.weeksAhead} week${horizon.weeksAhead === 1 ? "" : "s"} ahead; that date isn't open yet` };
  await setAvailability(repos, ctx, who.id, parsed.data.date, parsed.data.slot, parsed.data.status);
  if (parsed.data.status === "unavailable") await tellOfficeIfRostered(repos, ctx, who.id, who.name, parsed.data.date, parsed.data.slot);
  revalidatePath("/portal/availability");
  return { ok: true };
}

/** A Busy added over an existing assignment: the office hears straight away (and it shows in the problems list). */
async function tellOfficeIfRostered(repos: Repositories, ctx: TenantContext, instructorId: string, name: string, date: string, slot: string): Promise<void> {
  try {
    const [mine, sessions] = await Promise.all([repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, instructorId)), repos.tenant.courseSession.list(ctx).then(liveSessions)]);
    const courseIds = new Set(mine.filter((a) => a.status !== "declined").map((a) => a.courseId));
    const hit = sessions.filter((s) => courseIds.has(s.courseId) && s.date === date && s.slot === slot);
    if (hit.length === 0) return;
    const courses = await repos.tenant.course.list(ctx);
    const names = [...new Set(hit.map((s) => courses.find((c) => c.id === s.courseId)?.name ?? "a course"))];
    await emailAdmins(repos, ctx, {
      subject: `${name} is now Busy for ${date} ${slot} but rostered on ${names[0]}`,
      html: `<p><strong>${escapeHtml(name)}</strong> has just marked <strong>${date} ${slot}</strong> as Busy, and is rostered on <strong>${escapeHtml(names.join(", "))}</strong> then. It is on the problems list until you find cover or they change their answer.</p>`,
      path: "/office/rota?week=" + date,
      cta: "Open the roster",
    });
  } catch (err) {
    console.error("[availability] office notice failed:", (err as Error).message);
  }
}

/** Set one slot of the signed-in instructor's usual week (weekday 0 = Sunday … 6 = Saturday). */
export async function setAvailabilityPatternAction(input: { weekday: number; slot: SlotCode; status: AvailabilityStatus | null }): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const parsed = availabilityPatternSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid slot") };
  const who = await me(repos, ctx);
  if (!who) return { ok: false, error: "No linked instructor profile" };
  await setAvailabilityPattern(repos, ctx, who.id, parsed.data.weekday, parsed.data.slot, parsed.data.status);
  revalidatePath("/portal/availability");
  return { ok: true };
}

/** Leave (or clear) a short note against one day. */
export async function setAvailabilityNoteAction(input: { date: string; note: string }): Promise<Result> {
  const { ctx, repos } = await requireTenant();
  const parsed = availabilityNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Invalid note") };
  const who = await me(repos, ctx);
  if (!who) return { ok: false, error: "No linked instructor profile" };
  await setAvailabilityNote(repos, ctx, who.id, parsed.data.date, parsed.data.note || null);
  revalidatePath("/portal/availability");
  return { ok: true };
}
