"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { SLOT_CODES, type SlotCode } from "@/lib/db/schema";
import { normaliseTime, timeToSlot } from "@/lib/import/parse";

export type ActionState = { ok: boolean; error?: string; message?: string };

function isSlot(v: unknown): v is SlotCode {
  return typeof v === "string" && (SLOT_CODES as readonly string[]).includes(v);
}

/** Create a course with a first session (more sessions can be added later). The
 * form works two ways: an AM/PM/EV slot, or explicit start/end times (centres on
 * the "set times" style). With times, the slot code is derived for storage. */
export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const courseTypeId = String(formData.get("courseTypeId") ?? "");
  const name = (formData.get("name") as string) || undefined;
  const date = String(formData.get("date") ?? "");
  if (!courseTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Pick a course type and date" };
  }

  const rawStart = normaliseTime(String(formData.get("startTime") ?? ""));
  const rawEnd = normaliseTime(String(formData.get("endTime") ?? ""));
  const slotField = formData.get("slot");

  let session: { date: string; slot: SlotCode; startTime?: string; endTime?: string };
  if (rawStart) {
    // Set-times mode: derive the slot bucket from the start time.
    if (rawEnd && rawEnd <= rawStart) return { ok: false, error: "End time must be after start time" };
    session = { date, slot: timeToSlot(rawStart), startTime: rawStart, endTime: rawEnd || undefined };
  } else if (isSlot(slotField)) {
    session = { date, slot: slotField };
  } else {
    return { ok: false, error: "Set a start time, or pick a slot" };
  }

  try {
    await createCourseWithSessions(repos, ctx, { courseTypeId, name, sessions: [session] });
    revalidatePath("/office/courses");
    revalidatePath("/office");
    return { ok: true, message: "Course created" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Assign an instructor to a course, enforcing fit + conflict (override allowed). */
export async function assignStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const res = await assignStaff(repos, ctx, {
    courseId: String(formData.get("courseId") ?? ""),
    instructorId: String(formData.get("instructorId") ?? ""),
    roleTypeId: String(formData.get("roleTypeId") ?? ""),
    override: formData.get("override") === "on",
    overrideNote: (formData.get("overrideNote") as string) || undefined,
  });

  if (!res.ok) {
    return { ok: false, error: `${res.reason === "not-fit" ? "Not fit to roster" : res.reason === "conflict" ? "Scheduling conflict" : "Invalid"}: ${res.detail}` };
  }
  revalidatePath("/office/courses");
  revalidatePath("/office");
  return { ok: true, message: res.overridden ? "Assigned with override (recorded)" : "Assigned" };
}
