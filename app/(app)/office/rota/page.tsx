import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { addDays, getWeekRota, weekStart } from "@/lib/services/schedule";
import { PrintButton } from "@/components/office/PrintButton";
import { AUDIENCE_META } from "@/lib/features";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const thisMonday = weekStart(new Date());
  const sp = await searchParams;
  const monday = typeof sp.week === "string" && ISO.test(sp.week) ? weekStart(new Date(`${sp.week}T00:00:00Z`)) : thisMonday;
  const rota = await getWeekRota(repos, ctx, monday);
  const range = `${new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })} – ${new Date(`${addDays(monday, 6)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
  const total = rota.reduce((n, d) => n + d.sessions.length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:mb-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Weekly rota</h1>
          <p className="text-sm text-slate-500">{organisation.name} · {range} · {total} session{total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href={`/office/rota?week=${addDays(monday, -7)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">← Prev</Link>
          <Link href={`/office/rota?week=${addDays(monday, 7)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">Next →</Link>
          <PrintButton />
        </div>
      </div>

      <div className="space-y-4">
        {rota.map((day) => (
          <div key={day.date} className="break-inside-avoid rounded-card border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 font-semibold text-navy print:bg-white">{day.label}</div>
            {day.sessions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">No sessions.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Time</th>
                    <th className="px-4 py-2 font-semibold">Course</th>
                    <th className="px-4 py-2 font-semibold">Staff</th>
                    <th className="px-4 py-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {day.sessions.map((s) => {
                    const a = AUDIENCE_META[s.audience];
                    return (
                      <tr key={s.sessionId} className="align-top">
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                          <div className="font-medium text-navy">{SLOT_LABEL[s.slot] ?? s.slot}</div>
                          <div className="text-xs text-slate-400">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-navy">{s.courseName}</div>
                          <div className="text-xs text-slate-400">
                            <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.audience === "youth" ? "bg-amber/15 text-amber" : s.audience === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{a.short}</span>
                            {s.courseTypeName}
                            {!s.coverageOk ? <span className="ml-1 font-semibold text-port">· needs cover</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {s.staff.length === 0 ? (
                            <span className="text-xs text-port">Unassigned</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {s.staff.map((m, i) => (
                                <li key={i}><span className="text-navy">{m.name}</span> <span className="text-xs text-slate-400">{m.role}</span></li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{s.locations.length ? s.locations.join(", ") : <span className="text-xs text-slate-400">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400 print:mt-2">Generated from ActivityRoster · {new Date().toLocaleDateString("en-GB")}</p>
    </div>
  );
}
