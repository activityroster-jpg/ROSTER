"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/db/schema";
import { createBooking, setBookingStatus } from "@/lib/services/bookings";

type Result = { ok: boolean; error?: string };

export async function createBookingAction(input: {
  courseId: string;
  customerName: string;
  customerEmail?: string;
  headcount: number;
  amount?: number | null;
}): Promise<Result> {
  const { ctx, repos } = await requireTenant({ role: "admin" });

  const course = await repos.tenant.course.findById(ctx, input.courseId);
  if (!course) return { ok: false, error: "Pick a course" };
  const name = (input.customerName ?? "").trim();
  if (!name) return { ok: false, error: "Customer name is required" };
  const headcount = Number(input.headcount);
  if (!Number.isInteger(headcount) || headcount < 1 || headcount > 200) return { ok: false, error: "Invalid headcount" };
  const amount = input.amount == null || Number.isNaN(Number(input.amount)) ? null : Number(input.amount);
  if (amount != null && (amount < 0 || amount > 1_000_000)) return { ok: false, error: "Invalid amount" };

  await createBooking(repos, ctx, {
    courseId: input.courseId,
    customerName: name,
    customerEmail: input.customerEmail?.trim() || null,
    headcount,
    amount,
  });
  revalidatePath("/office/bookings");
  return { ok: true };
}

export async function setBookingStatusAction(bookingId: string, status: BookingStatus): Promise<Result> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  if (!(BOOKING_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const res = await setBookingStatus(repos, ctx, bookingId, status);
  if (!res) return { ok: false, error: "Not found" };
  revalidatePath("/office/bookings");
  return { ok: true };
}
