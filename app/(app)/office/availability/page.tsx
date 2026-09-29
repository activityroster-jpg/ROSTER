import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getWeekAvailabilityMatrix } from "@/lib/services/availability";
import { addDays, weekStart } from "@/lib/services/schedule";
import { Card } from "@/components/ui";
import type { SlotCode } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const SLOTS: SlotCode[] = ["AM", "PM", "EV"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function fmtWeek(mondayIso: string): string {
  const sun = addDays(mondayIso, 6);
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${d(mondayIso)} – ${d(sun)}`;
}

const CELL: Record<string, { label: string; cls: string }> = {
  available: { label: "✓", cls: "bg-starboard/15 text-starboard" },
  tentative: { label: "~", cls: "bg-amber/15 text-amber" },
  unavailable: { label: "✕", cls: "bg-port/15 text-port" },
  none: { label: "", cls: "bg-slate-50 text-slate-300" },
};

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
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Availability</h1>
      <p className="mb-4 text-sm text-slate-500">
        Who&apos;s available — submitted by instructors in their app. Click through to plan future weeks.
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
        <Card className="overflow-x-auto p-0">
          <table className="border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th rowSpan={3} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold">Instructor</th>
                {DAY_LABELS.map((d, i) => (
                  <th key={d} colSpan={3} className="border-l border-slate-200 px-1 py-1 font-semibold">{d} <span className="text-slate-400">{days[i]?.slice(8)}</span></th>
                ))}
              </tr>
              <tr className="bg-slate-50 text-slate-400">
                {days.map((_, di) => SLOTS.map((s, si) => (
                  <th key={`${di}-${s}`} className={`w-9 px-0.5 py-0.5 font-semibold ${si === 0 ? "border-l border-slate-200" : ""}`}>{s}</th>
                )))}
              </tr>
              <tr className="bg-slate-50">
                {days.map((d, di) => SLOTS.map((s, si) => {
                  const n = availableCounts[`${d}|${s}`] ?? 0;
                  return <th key={`c${di}-${s}`} className={`px-0.5 pb-1 font-bold ${n > 0 ? "text-starboard" : "text-slate-300"} ${si === 0 ? "border-l border-slate-200" : ""}`} title="Available instructors">{n}</th>;
                }))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.instructorId} className="hover:bg-slate-50/40">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-3 py-1 text-left text-xs font-medium text-navy">{r.name}</td>
                  {days.map((d, di) => SLOTS.map((s, si) => {
                    const status = r.cells[`${d}|${s}`] ?? "none";
                    const cfg = CELL[status] ?? CELL.none;
                    const rostered = r.assigned[`${d}|${s}`];
                    return (
                      <td key={`${r.instructorId}-${di}-${s}`} className={`p-0 ${si === 0 ? "border-l border-slate-200" : ""}`}>
                        <span className={`relative inline-block h-6 w-9 leading-6 font-semibold ${cfg!.cls}`} title={rostered?.length ? `Rostered: ${rostered.join(", ")}` : undefined}>
                          {cfg!.label}
                          {rostered?.length ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-navy" /> : null}
                        </span>
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-2 text-xs text-slate-400">The number under each slot is how many instructors are free then — handy before you build the roster in Courses.</p>
    </div>
  );
}
