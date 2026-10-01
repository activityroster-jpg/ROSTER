import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { CallScheduler, type AvailabilityRow, type BookingRow } from "@/components/admin/CallScheduler";

export const dynamic = "force-dynamic";

export default async function AdminCallsPage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());

  let availability: AvailabilityRow[] = [];
  let bookings: BookingRow[] = [];
  try {
    availability = (await platform.listAvailability()).map((w) => ({
      id: w.id, dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute,
    }));
  } catch {
    // table may not exist until the migration is applied
  }
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    bookings = (await platform.listBookings(since)).map((b) => ({
      id: b.id,
      startAtIso: (b.startAt instanceof Date ? b.startAt : new Date(Number(b.startAt))).toISOString(),
      name: b.name, email: b.email, centre: b.centre, notes: b.notes, status: b.status,
    }));
  } catch {
    // ignore
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Discovery calls</h1>
      <p className="mb-6 text-sm text-slate-500">
        Set the weekly windows you&apos;re available for 30-minute calls (all times <strong>GMT</strong>). Prospects book
        open slots at <span className="font-medium text-navy">/book</span>; already-booked and past slots are hidden automatically.
      </p>
      <CallScheduler availability={availability} bookings={bookings} />
    </div>
  );
}
