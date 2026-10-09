import { WhoCanSee } from "@/components/office/WhoCanSee";
import { ownerName } from "@/lib/auth/rbac";
import { listOfficeMembers } from "@/lib/services/office-access";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getDaySheet, londonToday } from "@/lib/services/emergency";
import { addDays } from "@/lib/services/schedule";
import { PrintButton } from "@/components/office/PrintButton";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLOT: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

/** Printable emergency sheet for one day: who is on duty, where, and who to call. Contacts need the Emergency & guardian contacts tick; every view is logged. */
export default async function EmergencySheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { ctx, repos, organisation } = await requireTenant({ permission: "rota.view" });
  const sp = await searchParams;
  const date = typeof sp.date === "string" && ISO.test(sp.date) ? sp.date : londonToday();
  const sheet = await getDaySheet(repos, ctx, date);
  const owner = sheet.contactsShown ? null : ownerName(await listOfficeMembers(repos, ctx));
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

      {sheet.contactsShown ? <WhoCanSee repos={repos} ctx={ctx} feature="protected" className="-mt-2 mb-4" /> : (
        <p className="mb-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-2 text-sm text-navy print:hidden">Emergency and guardian contacts are hidden: they need the <strong>Emergency &amp; guardian contacts</strong> tick. {owner ? `Ask ${owner} (superadmin) to add it under Instructors → Office access.` : "Ask your superadmin."}</p>
      )}
      {Object.keys(sheet.welfare).length ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-navy"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Welfare on duty</span> {(["AM", "PM", "EV"] as const).filter((s) => sheet.welfare[s]).map((s) => `${SLOT[s] ?? s}: ${sheet.welfare[s]}`).join(" · ")}</p>
      ) : null}
      {sheet.onDuty.length === 0 ? (
        <p className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nobody is rostered on this day.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 print:bg-white">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Emergency contact</th><th className="px-4 py-2">Emergency number</th></tr>
            </thead>
            <tbody>
              {sheet.onDuty.map((p) => (
                <tr key={p.instructorId} className="border-t border-slate-100 align-top print:break-inside-avoid">
                  <td className="px-4 py-2 font-medium text-navy">{p.name}{p.under18 ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">U18</span> : null}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {!sheet.contactsShown ? <span className="text-slate-400">hidden</span> : p.emergencyName ? <>{p.emergencyName}{p.emergencyRelationship ? <span className="text-slate-500"> ({p.emergencyRelationship})</span> : null}</> : <span className="text-port">none on file</span>}
                    {sheet.contactsShown && p.under18 && (p.guardianName || p.guardianPhone) ? <div className="text-xs text-slate-500">Parent/guardian: {p.guardianName}</div> : null}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {!sheet.contactsShown ? <span className="text-slate-400">hidden</span> : p.emergencyPhone ?? <span className="text-port">none</span>}
                    {sheet.contactsShown && p.under18 && p.guardianPhone ? <div className="text-xs text-slate-500">{p.guardianPhone}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-400 print:text-black">Everyone rostered today, in name order. Who is on which course is on the <Link href={`/office/rota?week=${date}&view=print`} className="text-teal hover:underline print:hidden">roster</Link>. Students are not recorded in ActivityRoster; keep the booking list from your own system with this sheet.</p>
    </div>
  );
}
