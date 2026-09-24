import { requireTenant } from "@/lib/tenant/require";
import { getRevenueSummary, listBookings } from "@/lib/services/bookings";
import { BookingsAdmin } from "@/components/office/BookingsAdmin";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const money = (n: number) => `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BookingsPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const [rows, revenue, courses] = await Promise.all([
    listBookings(repos, ctx),
    getRevenueSummary(repos, ctx),
    repos.tenant.course.list(ctx),
  ]);

  const courseOptions = courses
    .filter((c) => c.status !== "cancelled")
    .map((c) => ({ id: c.id, label: c.name ?? "Course" }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Bookings</h1>
      <p className="mb-6 text-sm text-slate-500">Customer bookings and course revenue.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">Earned revenue</p><p className="mt-1 text-3xl font-semibold text-navy">{money(revenue.total)}</p><p className="text-xs text-slate-500">Confirmed &amp; paid</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Provisional</p><p className="mt-1 text-3xl font-semibold text-amber">{money(revenue.outstanding)}</p><p className="text-xs text-slate-500">Not yet confirmed</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Bookings</p><p className="mt-1 text-3xl font-semibold text-navy">{rows.length}</p><p className="text-xs text-slate-500">All time</p></Card>
      </div>

      <Card className="p-0">
        <BookingsAdmin rows={rows} courses={courseOptions} />
      </Card>
    </div>
  );
}
