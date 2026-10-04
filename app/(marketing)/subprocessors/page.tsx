import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P } from "@/components/marketing/LegalPage";
import { SUBPROCESSORS, SUBPROCESSOR_CHANGES } from "@/lib/legal/subprocessors";
import { PRIVACY_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Sub-processors · ActivityRoster",
  description: "The companies that handle personal data on ActivityRoster's behalf, what each does, where it runs, and a dated record of every change.",
};

const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function SubprocessorsPage() {
  const latest = SUBPROCESSOR_CHANGES[0]?.date ?? "2026-09-29";
  return (
    <LegalPage title="Sub-processors" updated={fmt(latest)}>
      <P>These are the companies that handle personal data for us so that ActivityRoster can run. Each has a data processing agreement with us and, where it is outside the UK and EU, standard contractual clauses. We tell every centre before a new sub-processor starts handling their data, with at least 30 days to raise a concern, and we record every change below. Questions to <a className="text-teal hover:underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</P>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Company</th><th className="py-2 pr-3">What it does for us</th><th className="py-2 pr-3">Data involved</th><th className="py-2 pr-3">Where</th><th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 font-medium text-navy">{s.name}</td>
                <td className="py-2 pr-3">{s.purpose}</td>
                <td className="py-2 pr-3">{s.data}</td>
                <td className="py-2 pr-3">{s.location}</td>
                <td className="py-2">{s.status === "live" ? <span className="rounded-full bg-starboard/10 px-2 py-0.5 text-xs font-semibold text-starboard">In use</span> : <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-semibold text-amber" title="Listed ahead of use; only used if the primary fails">Standby</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Changes</H2>
      <ul className="space-y-2">
        {SUBPROCESSOR_CHANGES.map((c, i) => (
          <li key={i} className="flex gap-3"><span className="w-36 flex-none text-slate-400">{fmt(c.date)}</span><span>{c.summary}</span></li>
        ))}
      </ul>

      <P>See also our <Link href="/privacy" className="text-teal hover:underline">privacy policy</Link>, <Link href="/data-processing" className="text-teal hover:underline">data processing terms</Link> and <Link href="/trust" className="text-teal hover:underline">security overview</Link>.</P>
    </LegalPage>
  );
}
