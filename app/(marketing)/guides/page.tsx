import Link from "next/link";
import { GUIDES } from "@/lib/seo/guides";
import { LANDINGS } from "@/lib/seo/landings";

export const metadata = {
  title: "Sailing School Guides: Staffing, Rotas & Compliance",
  description: "Practical answers for RYA sailing schools: instructor ratios, availability, qualification tracking, safety-boat cover, freelancers, a free staff rota template and a compliance checklist.",
  alternates: { canonical: "/guides" },
};

/** The guides hub: operational questions centre managers search for, each answered in full. */
export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Sailing school guides</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl" style={{ textWrap: "balance" }}>Running the staff side of a sailing school</h1>
        <p className="mt-3 text-slate-600">
          Straight answers to the questions that come up every season: how many instructors a course needs, how to collect availability,
          how to keep track of tickets and safety-boat cover, and how to build a rota you can run. Free to read, and free to use without our software.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="group flex flex-col rounded-card border border-slate-200 bg-white p-5 transition hover:border-teal hover:shadow-md">
            <p className="font-display text-lg font-semibold leading-snug text-navy group-hover:text-teal">{g.title}</p>
            <p className="mt-2 flex-1 text-sm text-slate-600">{g.description}</p>
            <p className="mt-3 text-xs text-slate-400">{g.download ? "Free download · " : ""}{g.readMins} min read</p>
          </Link>
        ))}
      </div>
      <div className="mt-12 rounded-card border border-slate-200 bg-white p-6">
        <h2 className="font-display text-xl font-semibold text-navy">Software for RYA centres</h2>
        <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {LANDINGS.map((l) => <Link key={l.slug} href={`/${l.slug}`} className="text-sm font-medium text-teal hover:underline">{l.navLabel}</Link>)}
        </div>
        <p className="mt-4 text-sm text-slate-500">Looking for how to use ActivityRoster itself? See the <Link href="/learn" className="font-medium text-teal hover:underline">Learning Centre</Link>.</p>
      </div>
    </div>
  );
}
