import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Lightbulb } from "lucide-react";
import { guideBySlug, type GuideBlock } from "@/lib/seo/guides";
import { landingBySlug } from "@/lib/seo/landings";
import { apexDomain } from "@/lib/config";

// Rendered on request: pages pre-built from generateStaticParams need an
// incremental cache on Cloudflare, which this deployment doesn't have, so they
// 404'd in production (6 Oct). Unknown slugs still 404 via notFound().
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return { title: "Guide" };
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: { title: g.title, description: g.description, url: `/guides/${g.slug}`, type: "article" },
  };
}

function Block({ b }: { b: GuideBlock }) {
  switch (b.kind) {
    case "p":
      return <p className="leading-relaxed text-slate-700">{b.text}</p>;
    case "h2":
      return <h2 className="pt-4 font-display text-2xl font-semibold text-navy">{b.text}</h2>;
    case "list":
      return (
        <ul className="space-y-2">
          {b.items.map((t) => <li key={t} className="flex gap-2.5 text-slate-700"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-teal" aria-hidden="true" />{t}</li>)}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2.5">
          {b.items.map((t, i) => (
            <li key={t} className="flex gap-3 text-slate-700">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      );
    case "tip":
      return (
        <div className="flex gap-3 rounded-lg border-l-4 border-amber bg-amber/10 px-4 py-3 text-navy">
          <Lightbulb className="mt-0.5 h-5 w-5 flex-none text-amber" aria-hidden="true" />
          <p><span className="font-semibold">Tip:</span> {b.text}</p>
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            {b.caption ? <caption className="mb-2 text-left text-xs text-slate-500">{b.caption}</caption> : null}
            <thead><tr>{b.head.map((h) => <th key={h} className="border-b-2 border-slate-200 px-3 py-2 font-semibold text-navy">{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r) => <tr key={r.join("|")}>{r.map((c, i) => <td key={i} className="border-b border-slate-100 px-3 py-2 text-slate-700">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();
  const landing = landingBySlug(g.landing);
  const related = g.related.map((r) => guideBySlug(r)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const site = `https://${apexDomain()}`;
  const updated = new Date(`${g.updated}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: g.title, description: g.description, dateModified: g.updated, datePublished: g.updated, mainEntityOfPage: `${site}/guides/${g.slug}`, author: { "@type": "Organization", name: "ActivityRoster" }, publisher: { "@type": "Organization", name: "ActivityRoster", url: site } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${site}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${site}/guides` },
        { "@type": "ListItem", position: 3, name: g.title, item: `${site}/guides/${g.slug}` },
      ] },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
        <Link href="/" className="hover:text-navy">Home</Link> <span aria-hidden="true">›</span>{" "}
        <Link href="/guides" className="hover:text-navy">Guides</Link>
      </nav>
      <h1 className="font-display text-3xl font-bold leading-tight text-navy sm:text-4xl" style={{ textWrap: "balance" }}>{g.title}</h1>
      <p className="mt-2 text-sm text-slate-400">{g.readMins} min read · Updated {updated}</p>

      <div className="mt-6 rounded-card border border-teal/30 bg-teal/5 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-teal">The short answer</p>
        <p className="mt-2 leading-relaxed text-navy">{g.answer}</p>
      </div>

      {g.download ? (
        <a href={g.download.href} download className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-700">
          <Download className="h-5 w-5" aria-hidden="true" />{g.download.label}
          <span className="text-sm font-normal text-white/70">· {g.download.size}</span>
        </a>
      ) : null}

      <div className="mt-8 space-y-4">
        {g.blocks.map((b, i) => <Block key={i} b={b} />)}
      </div>

      <aside className="mt-12 rounded-card bg-navy p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-[#4fd1c5]">How ActivityRoster handles this</p>
        <p className="mt-2 leading-relaxed text-white/90">{g.product}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a href="/#get-demo" className="rounded-lg bg-[#0C6B74] px-5 py-2.5 text-center font-semibold text-white hover:bg-teal-700">Start my free month →</a>
          {landing ? <Link href={`/${landing.slug}`} className="rounded-lg border border-white/30 px-5 py-2.5 text-center font-semibold text-white hover:bg-white/10">{landing.navLabel}</Link> : null}
        </div>
        <p className="mt-3 text-sm text-white/60"><Link href={`/learn?topic=${g.learn}`} className="underline underline-offset-2 hover:text-white">📖 See how it works in the Learning Centre</Link></p>
      </aside>

      {related.length ? (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-navy">Related guides</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/guides/${r.slug}`} className="rounded-card border border-slate-200 bg-white p-4 text-sm font-semibold text-navy transition hover:border-teal hover:text-teal">{r.title}</Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
