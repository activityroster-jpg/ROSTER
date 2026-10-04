import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import { COMPETITORS, competitorBySlug, type Cell } from "@/lib/marketing/competitors";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) return { title: "Compare — ActivityRoster" };
  return {
    title: `ActivityRoster vs ${c.name}`,
    description: `How ActivityRoster compares with ${c.name} for RYA sailing and watersports centres.`,
  };
}

const ICON: Record<Cell, React.ReactNode> = {
  yes: <Check className="mx-auto h-5 w-5 text-starboard" aria-label="Yes" />,
  partial: <Minus className="mx-auto h-5 w-5 text-amber" aria-label="Partial" />,
  no: <X className="mx-auto h-5 w-5 text-slate-300" aria-label="No" />,
};

export default async function CompetitorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link href="/compare" className="text-sm text-slate-400 hover:text-navy">← All comparisons</Link>

      <div className="mt-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">{c.category}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">ActivityRoster vs {c.name}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{c.tagline}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-navy">Where {c.name} is a good fit</h2>
          <ul className="mt-3 space-y-2">
            {c.goodFor.map((g) => (
              <li key={g} className="flex gap-2 text-sm text-slate-600"><Check className="mt-0.5 h-4 w-4 flex-none text-starboard" /><span>{g}</span></li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-teal bg-teal/5 p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-navy">Where ActivityRoster wins for RYA centres</h2>
          <ul className="mt-3 space-y-2">
            {c.weWin.map((w) => (
              <li key={w} className="flex gap-2 text-sm text-slate-700"><span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-teal" /><span>{w}</span></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Matrix */}
      <div className="mt-10 overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Capability</th>
              <th scope="col" className="w-32 bg-teal/5 p-4 text-center font-display text-sm font-bold text-teal">ActivityRoster</th>
              <th scope="col" className="w-32 p-4 text-center font-display text-sm font-bold text-navy">{c.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {c.rows.map((r) => (
              <tr key={r.feature} className="hover:bg-slate-50/60">
                <th scope="row" className="p-4 text-left font-medium text-navy">{r.feature}</th>
                <td className="bg-teal/5 p-4 text-center">{ICON[r.us]}</td>
                <td className="p-4 text-center">{ICON[r.them]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-starboard" /> Built in</span>
        <span className="inline-flex items-center gap-1"><Minus className="h-4 w-4 text-amber" /> Partial / add-on / manual</span>
        <span className="inline-flex items-center gap-1"><X className="h-4 w-4 text-slate-300" /> Not really</span>
        <span className="ml-auto">Reflects typical offerings — check {c.name}&apos;s current features.</span>
      </div>

      {/* Migration */}
      <div className="mt-10 rounded-card border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-navy">Moving from {c.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{c.migration}</p>
      </div>

      {/* Other comparisons */}
      <div className="mt-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Compare with others</p>
        <div className="flex flex-wrap gap-2">
          {COMPETITORS.filter((o) => o.slug !== c.slug).map((o) => (
            <Link key={o.slug} href={`/compare/${o.slug}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-teal hover:text-navy">vs {o.name}</Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-card border border-teal bg-navy p-8 text-center text-white">
        <h2 className="font-display text-2xl font-bold">Try it with your own courses</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">Start a free month — no card required. Import your schedule and rota your first week with the safety checks on.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/#get-demo" className="rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-700">Start my free month</a>
          <Link href="/learn" className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10">Learning Centre</Link>
        </div>
      </div>
    </div>
  );
}
