"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { SLOT_CODES, type SlotCode } from "@/lib/db/schema";

export type ActionState = { ok: boolean; error?: string; message?: string };

function isSlot(v: unknown): v is SlotCode {
  return typeof v === "string" && (SLOT_CODES as readonly string[]).includes(v);
}

/** Create a course with a first session (more sessions can be added later). */
export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const courseTypeId = String(formData.get("courseTypeId") ?? "");
  const name = (formData.get("name") as string) || undefined;
  const date = String(formData.get("date") ?? "");
  const slot = formData.get("slot");

  if (!courseTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isSlot(slot)) {
    return { ok: false, error: "Pick a course type, date and slot" };
  }

  try {
    await createCourseWithSessions(repos, ctx, {
      courseTypeId,
      name,
      sessions: [{ date, slot }],
    });
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
