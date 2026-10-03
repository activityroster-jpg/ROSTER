import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getDaySheet, londonToday } from "@/lib/services/emergency";
import { addDays } from "@/lib/services/schedule";
import { PrintButton } from "@/components/office/PrintButton";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLOT: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

/** Printable emergency sheet for one day: who is on duty, where, and who to call. Admin only; every view is logged. */
export default async function EmergencySheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const sp = await searchParams;
  const date = typeof sp.date === "string" && ISO.test(sp.date) ? sp.date : londonToday();
  const sheet = await getDaySheet(repos, ctx, date);
  const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const nice = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:mb-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Emergency sheet</h1>
          <p className="text-sm text-slate-500">{organisation.name} · {nice} · {sheet.onDuty.length} on duty</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link href={`/office/rota/emergency?date=${addDays(date, -1)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">← Prev day</Link>
          <Link href={`/office/rota/emergency?date=${addDays(date, 1)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">Next day →</Link>
          <a href={`/api/office/emergency-sheet?date=${date}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-navy hover:bg-slate-50">Download CSV</a>
          <a href="/learn?topic=if-the-platform-is-down" target="_blank" rel="noreferrer" className="text-sm font-medium text-teal hover:underline">📖 Guide</a>
          <PrintButton downloadName={`${organisation.name} emergency sheet ${date}`} />
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-port/40 bg-port/5 px-4 py-3 text-sm text-navy print:border-black">
        <strong>Handle with care.</strong> This sheet contains personal phone numbers and emergency contacts. Keep it with the duty officer or in the safety boat, don&rsquo;t photograph or share it, and shred it at the end of the day. Printing it is recorded in your change log.
      </div>

      {sheet.sessions.length === 0 ? (
        <p className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No sessions on this day.</p>
      ) : (
        <div className="space-y-4">
          {sheet.sessions.map((s, i) => (
            <section key={i} className="overflow-hidden rounded-card border border-slate-200 bg-white print:break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 print:bg-white">
                <p className="font-semibold text-navy">{s.courseName} <span className="font-normal text-slate-500">· {SLOT[s.slot] ?? s.slot} {time(s.startAt)}–{time(s.endAt)}</span></p>
                {s.locations.length ? <p className="text-sm text-slate-600">{s.locations.join(", ")}</p> : null}
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Emergency contact</th></tr></thead>
                <tbody>
                  {s.staff.length === 0 ? <tr><td colSpan={4} className="px-4 py-2 text-slate-400">Nobody rostered</td></tr> : s.staff.map((p) => (
                    <tr key={p.instructorId} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-navy">{p.name}{p.under18 ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">U18</span> : null}{p.status === "assigned" ? <span className="ml-1 text-[10px] text-slate-400">unconfirmed</span> : null}</td>
                      <td className="px-4 py-2 text-slate-600">{p.role}</td>
                      <td className="px-4 py-2 text-slate-600">{p.phone ?? "–"}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {p.emergencyName || p.emergencyPhone ? <>{p.emergencyName}{p.emergencyRelationship ? ` (${p.emergencyRelationship})` : ""} {p.emergencyPhone}</> : <span className="text-port">none on file</span>}
                        {p.under18 && (p.guardianName || p.guardianPhone) ? <div className="text-xs text-slate-500">Guardian: {p.guardianName} {p.guardianPhone}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-400 print:text-black">Students are not recorded in ActivityRoster; keep the booking list from your own system with this sheet.</p>
    </div>
  );
}
