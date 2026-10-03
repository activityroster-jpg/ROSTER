import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { addDays, getWeekRota, weekStart } from "@/lib/services/schedule";
import { PrintButton } from "@/components/office/PrintButton";
import { RotaView } from "@/components/office/RotaView";
import { PublishWeek } from "@/components/office/PublishWeek";
import { publishedWeeks } from "@/lib/services/roster";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const thisMonday = weekStart(new Date());
  const sp = await searchParams;
  const monday = typeof sp.week === "string" && ISO.test(sp.week) ? weekStart(new Date(`${sp.week}T00:00:00Z`)) : thisMonday;
  const [rota, published] = await Promise.all([getWeekRota(repos, ctx, monday), publishedWeeks(repos, ctx)]);
  const publishedAt = published.get(monday) ?? null;
  // One assignment per course, however many sessions it has.
  const perCourse = new Map<string, { status: string }[]>();
  for (const d of rota) for (const s of d.sessions) if (!perCourse.has(s.courseId)) perCourse.set(s.courseId, s.staff);
  const allStaff = [...perCourse.values()].flat();
  const confirmed = allStaff.filter((m) => m.status === "confirmed").length;
  const declined = allStaff.filter((m) => m.status === "declined").length;
  const range = `${new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })} – ${new Date(`${addDays(monday, 6)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
  const total = rota.reduce((n, d) => n + d.sessions.length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:mb-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Weekly roster</h1>
          <p className="text-sm text-slate-500">{organisation.name} · {range} · {total} session{total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href={`/office/rota?week=${addDays(monday, -7)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">← Prev</Link>
          <Link href={`/office/rota?week=${addDays(monday, 7)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">Next →</Link>
          <Link href="/office/rota/emergency" className="rounded-lg border border-port/40 px-3 py-1.5 text-sm font-medium text-port hover:bg-port/5">Emergency sheet</Link>
          <a href="/learn?topic=rota" target="_blank" rel="noreferrer" className="text-sm font-medium text-teal hover:underline">📖 Guide</a>
          <PrintButton downloadName={`${organisation.name} roster ${monday}`} />
        </div>
      </div>

      <PublishWeek weekStart={monday} publishedAt={publishedAt ? publishedAt.toISOString() : null} sessions={total} assigned={allStaff.length} confirmed={confirmed} declined={declined} />

      <RotaView rota={rota} />
      <p className="mt-4 text-center text-xs text-slate-400 print:mt-2">Generated from ActivityRoster · {new Date().toLocaleDateString("en-GB")}</p>
      <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] leading-snug text-slate-400">
        Under-18s on this roster were checked against the published working-time rules for {organisation.name}&rsquo;s jurisdiction when they were assigned; any override is recorded in the change log.
        This is a planning aid, not legal advice. The employer remains responsible for child-employment law, permits and school-leaving rules.
        <span className="print:hidden"> <a href={`/api/office/young-worker-register?from=${monday}&to=${addDays(monday, 6)}`} className="text-teal hover:underline">Download this week&rsquo;s young-worker time register (CSV)</a>.</span>
      </p>
    </div>
  );
}
