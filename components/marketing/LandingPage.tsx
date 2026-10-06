import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { ComplianceFlow } from "./ComplianceFlow";
import { ScreenShot } from "./ScreenShot";
import { LeadCapture } from "./LeadCapture";
import { BuiltWithCentres } from "./BuiltWithCentres";
import { SCREENS } from "@/lib/screens";
import { landingBySlug, type Landing } from "@/lib/seo/landings";
import { guideBySlug } from "@/lib/seo/guides";
import { apexDomain } from "@/lib/config";

/** Page metadata for a search page: its own title, description and canonical. */
export function landingMetadata(slug: string) {
  const l = mustLanding(slug);
  return {
    title: l.title,
    description: l.description,
    alternates: { canonical: `/${l.slug}` },
    openGraph: { title: `${l.title} | ActivityRoster`, description: l.description, url: `/${l.slug}`, type: "website" },
  };
}

function mustLanding(slug: string): Landing {
  const l = landingBySlug(slug);
  if (!l) throw new Error(`Unknown landing page: ${slug}`);
  return l;
}

/** One search page: what it is, the product on screen, how it works, questions, and where to go next. */
export function LandingPage({ slug }: { slug: string }) {
  const l = mustLanding(slug);
  const apex = apexDomain();
  const site = `https://${apex}`;
  const hero = SCREENS[l.heroScreen];
  const gallery = l.screens.filter((id) => id !== l.heroScreen).map((id) => SCREENS[id]);
  const guides = l.guides.map((g) => guideBySlug(g)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const related = l.related.map((r) => landingBySlug(r)).filter((r): r is Landing => Boolean(r));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${site}/${l.slug}#page`, url: `${site}/${l.slug}`, name: l.title, description: l.description, isPartOf: { "@id": `${site}/#website` }, about: { "@id": `${site}/#software` } },
      { "@type": "SoftwareApplication", "@id": `${site}/#software`, name: "ActivityRoster", applicationCategory: "BusinessApplication", operatingSystem: "Web, iOS, Android", offers: { "@type": "Offer", price: "35", priceCurrency: "GBP" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${site}/` },
        { "@type": "ListItem", position: 2, name: l.navLabel, item: `${site}/${l.slug}` },
      ] },
      { "@type": "FAQPage", mainEntity: l.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero: the promise and the product side by side */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:pb-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
            <Link href="/" className="hover:text-navy">Home</Link> <span aria-hidden="true">›</span> <span className="text-slate-500">{l.navLabel}</span>
          </nav>
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal">{l.eyebrow}</p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-navy md:text-4xl" style={{ textWrap: "balance" }}>{l.h1}</h1>
              <p className="mt-4 text-lg text-slate-600">{l.intro}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href="#start" className="rounded-lg bg-teal px-6 py-3 text-center font-semibold text-white shadow-sm hover:bg-teal-700">Start my free month →</a>
                <Link href="/demo" className="rounded-lg border border-slate-300 px-6 py-3 text-center font-semibold text-navy hover:bg-slate-50">Take the tour</Link>
              </div>
              <p className="mt-3 text-sm text-slate-500">Free for a month · no card · from £35 a month after</p>
            </div>
            <figure>
              <ScreenShot screen={hero} eager className={hero.device === "phone" ? "mx-auto max-w-[260px]" : ""} />
              <figcaption className="mt-2 text-center text-xs text-slate-500">{hero.caption}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {l.showFlow ? (
        <section className="border-b border-slate-200 bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="font-display text-2xl font-semibold text-navy">Your week, in three steps</h2>
            <div className="mt-6"><ComplianceFlow /></div>
          </div>
        </section>
      ) : null}

      {/* The case, section by section */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 md:py-16">
          {l.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="font-display text-2xl font-semibold text-navy">{s.heading}</h2>
              {s.body.map((p) => <p key={p.slice(0, 40)} className="mt-3 leading-relaxed text-slate-600">{p}</p>)}
              {s.bullets ? (
                <ul className="mt-4 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5 text-slate-700"><Check className="mt-0.5 h-5 w-5 flex-none text-starboard" aria-hidden="true" />{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* More of the product */}
      {gallery.length ? (
        <section className="border-y border-slate-200 bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="font-display text-2xl font-semibold text-navy">See it in the platform</h2>
            <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
              {gallery.map((s) => (
                <figure key={s.src} className={s.device === "phone" ? "mx-auto w-full max-w-[240px]" : ""}>
                  <ScreenShot screen={s} />
                  <figcaption className="mt-2 text-sm text-slate-600"><span className="font-semibold text-navy">{s.title}.</span> {s.caption}</figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-600">
              <Link href={`/learn?topic=${l.learn}`} className="font-semibold text-teal hover:underline">📖 How it works, step by step</Link>
              <span className="mx-2 text-slate-300">·</span>
              <Link href="/demo" className="font-semibold text-teal hover:underline">Every screen in the tour</Link>
            </p>
          </div>
        </section>
      ) : null}

      <BuiltWithCentres compact />

      {/* Questions */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Questions</h2>
          <dl className="mt-6 space-y-5">
            {l.faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-navy">{f.q}</dt>
                <dd className="mt-1 text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Guides and related pages */}
      <section className="border-t border-slate-200 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="font-display text-2xl font-semibold text-navy">Guides for running a sailing school</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group rounded-card border border-slate-200 bg-white p-5 transition hover:border-teal hover:shadow-md">
                <p className="font-semibold text-navy group-hover:text-teal">{g.title}</p>
                <p className="mt-1 text-sm text-slate-600">{g.description}</p>
                <p className="mt-2 text-xs text-slate-400">{g.readMins} min read</p>
              </Link>
            ))}
          </div>
          {related.length ? (
            <p className="mt-8 text-sm text-slate-600">
              Related:{" "}
              {related.map((r, i) => (
                <span key={r.slug}>
                  {i > 0 ? <span className="mx-1.5 text-slate-300">·</span> : null}
                  <Link href={`/${r.slug}`} className="font-medium text-teal hover:underline">{r.navLabel}</Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </section>

      {/* Start */}
      <section id="start" className="bg-navy">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-10 md:py-16">
          <div className="text-white">
            <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Try it free for a month</h2>
            <p className="mt-3 text-white/80">Your centre is created in seconds with the RYA defaults in place, and a guided set-up does the rest.</p>
            <ul className="mt-5 space-y-2 text-white/85">
              {["No card required, cancel any time", "£35 a month for up to 10 people, £65 for everyone", "Hosted in the EU, export your data whenever you like"].map((x) => (
                <li key={x} className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-[#4fd1c5]" aria-hidden="true" />{x}</li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-white/80 hover:text-white">See pricing <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="rounded-card bg-white p-6 shadow-xl">
            <LeadCapture source={`landing:${l.slug}`} variant="inline" apex={apex} />
          </div>
        </div>
      </section>
    </>
  );
}
