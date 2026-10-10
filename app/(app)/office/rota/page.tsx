import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { addDays, getWeekRota, weekStart } from "@/lib/services/schedule";
import { RotaDownload } from "@/components/office/RotaDownload";
import { parseRotaTemplate } from "@/lib/rota/template";
import { RotaView } from "@/components/office/RotaView";
import { PublishWeek } from "@/components/office/PublishWeek";
import { publishedWeeks } from "@/lib/services/roster";
import { parseWelfareSettings } from "@/lib/services/welfare";
import { can } from "@/lib/auth/rbac";
import { availabilityHorizon } from "@/lib/services/availability";
import { findProblems, problemLabel } from "@/lib/services/problems";
import { getBoard } from "@/lib/services/board";
import { RosterBoard } from "@/components/office/RosterBoard";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string }> }) {
  const { ctx, repos, organisation } = await requireTenant({ permission: "rota.view" });
  const thisMonday = weekStart(new Date());
  const sp = await searchParams;
  const monday = typeof sp.week === "string" && ISO.test(sp.week) ? weekStart(new Date(`${sp.week}T00:00:00Z`)) : thisMonday;
  const canEdit = can(ctx, "roster.edit");
  // The board is the roster (view and edit); the print templates stay one click away.
  const view: "board" | "print" = sp.view === "print" || !canEdit ? "print" : "board";
  const board = view === "board" ? await getBoard(repos, ctx, monday) : null;
  const [rota, published, settingsRows, problems] = await Promise.all([getWeekRota(repos, ctx, monday), publishedWeeks(repos, ctx), repos.tenant.orgSettings.list(ctx), findProblems(repos, ctx, { from: monday, to: addDays(monday, 7) })]);
  const flags: Record<string, string[]> = Object.fromEntries(Object.entries(problems.bySession).map(([id, ps]) => [id, ps.map((p) => `${p.instructorName ? `${p.instructorName}: ` : ""}${problemLabel(p.kind)} (${p.detail})`)]));
  const rotaTemplate = parseRotaTemplate(settingsRows[0]?.rotaTemplate);
  const welfare = parseWelfareSettings(settingsRows[0]?.welfareOfficers, settingsRows[0]?.welfareDuty);
  const publishedAt = published.get(monday) ?? null;
  const horizon = availabilityHorizon(settingsRows[0]);
  // Nobody is "asked" when the office keeps availability, so there's no window to warn about.
  const beyondWindow = monday >= horizon.to && settingsRows[0]?.staffManagedBy !== "office";
  // One assignment per course, however many sessions it has.
  const perCourse = new Map<string, { status: string }[]>();
  for (const d of rota) for (const s of d.sessions) if (!perCourse.has(s.courseId)) perCourse.set(s.courseId, s.staff);
  const allStaff = [...perCourse.values()].flat();
  const confirmed = allStaff.filter((m) => m.status === "confirmed").length;
  const declined = allStaff.filter((m) => m.status === "declined").length;
  const range = `${new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })} – ${new Date(`${addDays(monday, 6)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
  const total = rota.reduce((n, d) => n + d.sessions.length, 0);

  return (
    <div className={view === "print" ? "mx-auto max-w-4xl" : "w-full"}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:mb-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Weekly roster</h1>
          <p className="text-sm text-slate-500">{organisation.name} · {range} · {total} session{total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href={`/office/rota?week=${addDays(monday, -7)}${view === "print" ? "&view=print" : ""}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">← Prev</Link>
          <Link href={`/office/rota?week=${addDays(monday, 7)}${view === "print" ? "&view=print" : ""}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">Next →</Link>
          {canEdit ? (
            <span className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
              <Link href={`/office/rota?week=${monday}`} className={`rounded-md px-2.5 py-1 font-semibold ${view === "board" ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>Board</Link>
              <Link href={`/office/rota?week=${monday}&view=print`} className={`rounded-md px-2.5 py-1 font-semibold ${view === "print" ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>Print view</Link>
            </span>
          ) : null}
          <Link href="/office/rota/emergency" className="rounded-lg border border-port/40 px-3 py-1.5 text-sm font-medium text-port hover:bg-port/5">Emergency sheet</Link>
          <a href="/learn?topic=roster" target="_blank" rel="noreferrer" className="text-sm font-medium text-teal hover:underline">📖 Guide</a>
          <RotaDownload weekStart={monday} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} defaultRange={rotaTemplate.range} />
          <Link href="/office/settings#rota-pdf" className="text-xs text-slate-400 hover:text-navy">Change layout</Link>
        </div>
      </div>

      <PublishWeek weekStart={monday} publishedAt={publishedAt ? publishedAt.toISOString() : null} sessions={total} assigned={allStaff.length} confirmed={confirmed} declined={declined} />
      {beyondWindow ? (
        <p className="mb-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-navy print:hidden">
          Instructors haven&apos;t been asked about this week yet: they can set availability {horizon.weeksAhead} week{horizon.weeksAhead === 1 ? "" : "s"} ahead, so nothing here is blocked by availability.{" "}
          <Link href="/office/settings#availability-window" className="font-medium text-teal hover:underline">Lengthen the window in Settings</Link> if you roster further out.
        </p>
      ) : null}

      {view === "print" && problems.problems.length > 0 ? (
        <details className="mb-4 rounded-card border border-port/30 bg-port/5 px-4 py-2 text-sm print:hidden" open={problems.blocks > 0}>
          <summary className="cursor-pointer font-semibold text-navy">⚠ {problems.problems.length} problem{problems.problems.length === 1 ? "" : "s"} this week{problems.blocks ? ` (${problems.blocks} blocking)` : ""}</summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {problems.problems.map((p, i) => (
              <li key={`${p.kind}-${p.courseId}-${p.instructorId ?? ""}-${p.date}-${i}`}>
                <span className={`mr-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.severity === "block" ? "bg-port/15 text-port" : "bg-amber/15 text-amber"}`}>{problemLabel(p.kind)}</span>
                {p.instructorName ? `${p.instructorName} · ` : ""}<Link href={`/office/courses/${p.courseId}`} className="font-medium text-navy hover:underline">{p.courseName}</Link> · {p.date}{p.slot ? ` ${p.slot}` : ""} · {p.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {board ? <RosterBoard data={board} canEdit={canEdit} /> : <RotaView rota={rota} welfareOfficers={welfare.officers} canEditWelfare={canEdit} problems={flags} />}
      <p className="mt-4 text-center text-xs text-slate-400 print:mt-2">Generated from ActivityRoster · {new Date().toLocaleDateString("en-GB")}</p>
    </div>
  );
}
