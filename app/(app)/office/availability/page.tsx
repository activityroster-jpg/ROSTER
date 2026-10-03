import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getWeekAvailabilityMatrix } from "@/lib/services/availability";
import { addDays, weekStart } from "@/lib/services/schedule";
import { Card } from "@/components/ui";
import { AvailabilityMatrix } from "@/components/office/AvailabilityMatrix";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function fmtWeek(mondayIso: string): string {
  const sun = addDays(mondayIso, 6);
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${d(mondayIso)} – ${d(sun)}`;
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const thisMonday = weekStart(new Date());
  const sp = await searchParams;
  const requested = typeof sp.week === "string" && ISO.test(sp.week) ? weekStart(new Date(`${sp.week}T00:00:00Z`)) : thisMonday;
  const monday = requested;
  const prev = addDays(monday, -7);
  const next = addDays(monday, 7);
  const isThisWeek = monday === thisMonday;
  const { days, rows, availableCounts } = await getWeekAvailabilityMatrix(repos, ctx, monday);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Availability</h1>
        <GuideLink topic="availability" />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Who&apos;s available — submitted by instructors in their app. Hover a <span className="font-medium text-navy">●</span> to see what they&apos;re rostered on, or <span className="font-medium text-navy">click any slot</span> to fill an open shift with that instructor.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/office/availability?week=${prev}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">← Previous</Link>
        <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">{fmtWeek(monday)}{isThisWeek ? " · this week" : ""}</span>
        <Link href={`/office/availability?week=${next}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">Next →</Link>
        {!isThisWeek ? <Link href="/office/availability" className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal hover:underline">Jump to this week</Link> : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-starboard/15 px-2.5 py-0.5 font-medium text-starboard">✓ Free</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-0.5 font-medium text-amber">~ Maybe</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-port/15 px-2.5 py-0.5 font-medium text-port">✕ Busy</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-400">— Not set</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 font-medium text-navy">● Rostered</span>
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm text-slate-400">No instructors yet. Add staff first, then they can submit availability from their app.</p></Card>
      ) : (
        <AvailabilityMatrix days={days} rows={rows} availableCounts={availableCounts} />
      )}
      <p className="mt-2 text-xs text-slate-400">The number under each slot is how many instructors are free then. Click a slot to fill an open shift with that instructor.</p>
    </div>
  );
}
