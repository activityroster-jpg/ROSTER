import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { REVENUE_STATUSES, type Booking, type BookingStatus } from "@/lib/db/schema";
import { weekStart } from "./schedule";
import { writeAudit } from "./audit";

const isRevenue = (s: BookingStatus) => (REVENUE_STATUSES as readonly string[]).includes(s);

export interface BookingInput {
  courseId: string;
  customerName: string;
  customerEmail?: string | null;
  headcount: number;
  amount?: number | null; // if omitted, priced from the course / course type
}

export interface BookingRow {
  id: string;
  courseId: string;
  courseName: string;
  customerName: string;
  headcount: number;
  amount: number;
  status: BookingStatus;
  countsAsRevenue: boolean;
}

/** Per-head price for a course: its own price, else the course type default, else 0. */
async function courseUnitPrice(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<number> {
  const course = await repos.tenant.course.findById(ctx, courseId);
  if (!course) return 0;
  if (course.price != null) return course.price;
  const type = await repos.tenant.courseType.findById(ctx, course.courseTypeId);
  return type?.defaultPrice ?? 0;
}

/** Create a booking. Amount defaults to per-head price × headcount. Audited. */
export async function createBooking(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: BookingInput,
): Promise<Booking> {
  const amount = input.amount != null
    ? input.amount
    : (await courseUnitPrice(repos, ctx, input.courseId)) * input.headcount;

  const row = await repos.tenant.booking.insert(ctx, {
    courseId: input.courseId,
    customerName: input.customerName,
    customerEmail: input.customerEmail ?? null,
    headcount: input.headcount,
    amount: Math.round(amount * 100) / 100,
    status: "provisional",
    paidAt: null,
    notes: null,
  });
  await writeAudit(repos, ctx, { action: "booking_create", entity: "booking", entityId: row.id, after: { ...input, amount: row.amount } });
  return row;
}

/** Change a booking's status (records paidAt when marked paid). Audited. */
export async function setBookingStatus(
  repos: Repositories,
  ctx: AnyTenantContext,
  bookingId: string,
  status: BookingStatus,
): Promise<Booking | null> {
  const updated = await repos.tenant.booking.update(ctx, bookingId, {
    status,
    paidAt: status === "paid" ? new Date() : null,
  });
  if (updated) await writeAudit(repos, ctx, { action: "booking_status", entity: "booking", entityId: bookingId, after: { status } });
  return updated;
}

/** All bookings with course names, newest first. */
export async function listBookings(repos: Repositories, ctx: AnyTenantContext): Promise<BookingRow[]> {
  const [bookings, courses] = await Promise.all([
    repos.tenant.booking.list(ctx),
    repos.tenant.course.list(ctx),
  ]);
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Course"]));
  return bookings
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((b) => ({
      id: b.id,
      courseId: b.courseId,
      courseName: courseName.get(b.courseId) ?? "Course",
      customerName: b.customerName,
      headcount: b.headcount,
      amount: b.amount,
      status: b.status,
      countsAsRevenue: isRevenue(b.status),
    }));
}

export interface RevenueSummary {
  total: number;
  outstanding: number; // provisional (not yet earned)
  byWeek: Map<string, number>; // week (Monday ISO) → revenue
}

/**
 * Revenue from bookings, bucketed by the week of the course's earliest session.
 * Only REVENUE_STATUSES count towards `total`. Tenant scoped.
 */
export async function getRevenueSummary(repos: Repositories, ctx: AnyTenantContext): Promise<RevenueSummary> {
  const [bookings, sessions] = await Promise.all([
    repos.tenant.booking.list(ctx),
    repos.tenant.courseSession.list(ctx),
  ]);

  // earliest session date per course
  const firstDate = new Map<string, string>();
  for (const s of sessions) {
    const cur = firstDate.get(s.courseId);
    if (!cur || s.date < cur) firstDate.set(s.courseId, s.date);
  }

  let total = 0;
  let outstanding = 0;
  const byWeek = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    if (b.status === "provisional") { outstanding += b.amount; continue; }
    total += b.amount;
    const date = firstDate.get(b.courseId);
    const week = date ? weekStart(new Date(`${date}T00:00:00.000Z`)) : "unscheduled";
    byWeek.set(week, (byWeek.get(week) ?? 0) + b.amount);
  }
  return { total: Math.round(total * 100) / 100, outstanding: Math.round(outstanding * 100) / 100, byWeek };
}
