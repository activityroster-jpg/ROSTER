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
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const thisMonday = weekStart(new Date());
  const sp = await searchParams;
  const requested = typeof sp.week === "string" && ISO.test(sp.week) ? weekStart(new Date(`${sp.week}T00:00:00Z`)) : thisMonday;
  const monday = requested;
  const prev = addDays(monday, -7);
  const next = addDays(monday, 7);
  const isThisWeek = monday === thisMonday;
  const { days, rows, availableCounts, horizon, staffManagedBy } = await getWeekAvailabilityMatrix(repos, ctx, monday);
  const officeMode = staffManagedBy === "office";
  const anyAsked = rows.some((r) => !r.officeManaged);
  const beyondWindow = monday >= horizon.to && anyAsked;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Availability</h1>
        <GuideLink topic={officeMode ? "office-managed" : "availability"} />
      </div>
      {officeMode ? (
        <p className="mb-4 text-sm text-slate-500">
          The office keeps availability here, so staff don&apos;t need to sign up. Everyone counts as <span className="font-medium text-starboard">free</span> unless you mark them busy: use a brush to paint the days people can&apos;t work, click a name for their whole week, or set their usual week on their page in Staff. <a href="/office/settings#staff-managed-by" className="text-teal hover:underline">Change this in Settings</a>.
        </p>
      ) : (
        <p className="mb-4 text-sm text-slate-500">
          Who&apos;s free — from the instructor app, their usual week, or entered here by the office. A slot is Busy until it&apos;s marked Free or Maybe. Hover a <span className="font-medium text-navy">●</span> to see what they&apos;re rostered on, or <span className="font-medium text-navy">click any slot</span> to set their availability or fill an open shift. Running it all from the office instead? <a href="/office/settings#staff-managed-by" className="text-teal hover:underline">Staff don&apos;t have to sign up</a>.
        </p>
      )}
      {beyondWindow ? (
        <p className="mb-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-navy">
          Instructors haven&apos;t been asked about this week yet: they can set availability {horizon.weeksAhead} week{horizon.weeksAhead === 1 ? "" : "s"} ahead. <Link href="/office/settings#availability-window" className="font-medium text-teal hover:underline">Lengthen the window in Settings</Link> to ask further out. You can still enter availability for anyone by clicking a slot.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/office/availability?week=${prev}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">← Previous</Link>
        <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">{fmtWeek(monday)}{isThisWeek ? " · this week" : ""}</span>
        <Link href={`/office/availability?week=${next}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">Next →</Link>
        {!isThisWeek ? <Link href="/office/availability" className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal hover:underline">Jump to this week</Link> : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-starboard/15 px-2.5 py-0.5 font-medium text-starboard">✓ Free</span>
        {rows.some((r) => r.officeManaged) ? <span className="inline-flex items-center gap-1 rounded-full bg-starboard/[0.06] px-2.5 py-0.5 font-medium text-starboard/70">✓ Free (office-managed, not marked busy)</span> : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-0.5 font-medium text-amber">~ Maybe</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-port/15 px-2.5 py-0.5 font-medium text-port">✕ Busy</span>
        {anyAsked ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-400">· Busy (not answered yet)</span> : null}
        {anyAsked ? <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 font-medium text-slate-300 ring-1 ring-slate-200">? Not asked yet</span> : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 font-medium text-slate-500 ring-1 ring-slate-200"><span className="text-[9px] uppercase">usual</span> from their usual week</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 font-medium text-slate-500 ring-1 ring-slate-200">✎ has a note</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 font-medium text-navy">● Rostered</span>
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm text-slate-400">No instructors yet. <Link href="/office/staff" className="text-teal hover:underline">Add your staff</Link> first{officeMode ? "; they don't need to sign up." : ", then they can submit availability from their app."}</p></Card>
      ) : (
        <AvailabilityMatrix days={days} rows={rows} availableCounts={availableCounts} staffManagedBy={staffManagedBy} />
      )}
      <p className="mt-2 text-xs text-slate-400">The number under each slot is how many instructors are free then. Click a slot to set that person&apos;s availability (recorded as set by the office) or fill an open shift with them. Approved leave always shows as busy.</p>
    </div>
  );
}
