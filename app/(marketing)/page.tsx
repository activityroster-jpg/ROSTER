import Link from "next/link";
import { BuiltWithCentres } from "@/components/marketing/BuiltWithCentres";
import { ShieldCheck } from "lucide-react";
import { PHOTOS, PhotoBand, PlatformGrid, PricingTeaser, SAFETY } from "@/components/marketing/HomeSections";
import { EmailStart } from "@/components/marketing/EmailStart";
import { ComplianceFlow } from "@/components/marketing/ComplianceFlow";
import { ScreenShot } from "@/components/marketing/ScreenShot";
import { HomeExplainer } from "@/components/marketing/HomeExplainer";
import { SCREENS } from "@/lib/screens";
import { apexDomain, COMPANY } from "@/lib/config";
import { SCHEMA_AUDIENCE } from "@/lib/seo/og";

export const metadata = {
  title: { absolute: "RYA Sailing School Software & Staff Rostering | ActivityRoster" },
  description:
    "RYA sailing school software for Principals, Chief Instructors and centre managers. Build rotas that are ready to run: the right instructor type in every place, availability, course ratios and Senior Instructor cover checked as you schedule. Free for a month.",
  alternates: { canonical: "/" },
};

/** The four people who buy and run it, each sent to the page written for their search. */
const WHO = [
  { title: "Principals and owners", body: "Accountable for recognition, safety and the margin. See the whole season's staffing, every licence and every override from one place.", href: "/sailing-centre-management-software", link: "Sailing centre management software" },
  { title: "Chief and Senior Instructors", body: "Responsible for who teaches what, under whose supervision. Build the week with instructor types, ratios and Senior Instructor cover checked as you go.", href: "/rya-staff-rostering-software", link: "RYA staff rostering software" },
  { title: "Centre managers and the office", body: "The rota, availability, leave, hours and payroll without the spreadsheet and the WhatsApp thread.", href: "/sailing-school-rostering-software", link: "Sailing school rostering software" },
  { title: "Club officers", body: "Sailing secretaries, training officers and bosuns running duty rotas with volunteers, at one flat price per club.", href: "/sailing-club-duty-roster", link: "Sailing club duty roster software" },
];

export default function MarketingHome() {
  const apex = apexDomain();
  const site = `https://${apex}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: "ActivityRoster",
        alternateName: "Activity Roster",
        legalName: COMPANY.legalName,
        identifier: { "@type": "PropertyValue", propertyID: "Companies House company number", value: COMPANY.companyNumber },
        address: { "@type": "PostalAddress", streetAddress: COMPANY.addressLines[0], addressLocality: COMPANY.addressLines[1], postalCode: COMPANY.addressLines[2], addressCountry: "GB" },
        url: site,
        description: "RYA sailing school software: compliance-aware staff rostering, qualification tracking and course administration for RYA sailing and watersports centres, schools and clubs.",
        areaServed: "GB",
        audience: SCHEMA_AUDIENCE,
        knowsAbout: ["RYA training centre staffing", "sailing school rostering", "RYA instructor qualifications and expiry", "instructor ratios and safety boat cover", "sailing club duty rotas"],
        sameAs: [COMPANY.social.linkedin, COMPANY.social.facebook],
      },
      {
        // The site name Google shows above the result instead of the address.
        // It reads this from the homepage; url must be the homepage exactly.
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: `${site}/`,
        name: "ActivityRoster",
        alternateName: ["Activity Roster", "activityroster.com"],
        publisher: { "@id": `${site}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "ActivityRoster",
        url: site,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        audience: SCHEMA_AUDIENCE,
        offers: { "@type": "Offer", price: "35", priceCurrency: "GBP" },
        description: "RYA sailing school software. Instructor types, who can teach each course, availability and course ratios checked as you schedule. Flat per-centre pricing from £35/month.",
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero: the story on the left, the product itself on the right (under the text on phones) */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url('${PHOTOS.hero}')` }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy/70 via-navy/85 to-navy md:bg-[linear-gradient(90deg,#0A2E52_35%,rgba(10,46,82,0.75)_100%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:py-16">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#4fd1c5]">
              RYA sailing school software
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl" style={{ textWrap: "balance" }}>
              The operating system for RYA sailing centres.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">
              Build rotas that are actually ready to run. ActivityRoster checks each instructor&rsquo;s type against the place and
              the course, availability, course ratios and Senior Instructor cover as you schedule.
            </p>
            <p className="mt-3 text-sm font-medium text-[#4fd1c5]">Built for the people who run the centre: Principals, Chief Instructors, centre managers and club officers.</p>
            <div className="mt-7 max-w-xl">
              <EmailStart source="hero" variant="hero" />
            </div>
            <p className="mt-3 text-sm text-white/70">
              <Link href="/demo" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">Take the tour first</Link>
              {" "}· set up in an afternoon ·{" "}
              <Link href="/pricing" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">from £35/month</Link>
            </p>
            <p className="mt-2 text-xs text-white/60">Instructor or staff member? You don&rsquo;t sign up here: <Link href="/instructors" className="underline decoration-white/40 underline-offset-2 hover:text-white">get the app and join your centre →</Link></p>
          </div>
          <div>
            <ScreenShot screen={SCREENS.courses} eager className="ring-1 ring-white/20" />
            <p className="mt-2 text-center text-xs text-white/60">The courses calendar at a busy centre. <Link href="/demo" className="underline underline-offset-2 hover:text-white">See every screen →</Link></p>
          </div>
        </div>
      </section>

      {/* The two-minute explainer, once it's on the site */}
      <HomeExplainer />

      {/* Trust strip */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 text-center md:grid-cols-4">
          {[
            ["Compliance-first", "RYA rules enforced, not remembered"],
            ["EU-hosted", "Cloudflare · UK GDPR-ready"],
            ["Fully isolated", "Each centre's data kept separate"],
            ["Free for a month", "No card required"],
          ].map(([h, s]) => (
            <div key={h}>
              <p className="font-display text-base font-semibold text-navy">{h}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for: the people who run the centre, in their own job titles */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal">Who it&rsquo;s for</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-navy md:text-3xl" style={{ textWrap: "balance" }}>Built for the people who run an RYA centre or club</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w) => (
              <div key={w.title} className="flex flex-col rounded-card border border-slate-200 bg-canvas p-5">
                <h3 className="font-display text-lg font-semibold text-navy">{w.title}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-600">{w.body}</p>
                <Link href={w.href} className="mt-3 text-sm font-semibold text-teal hover:underline">{w.link} →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The compliance engine: the product in one picture */}
      <section id="how-it-checks" className="border-b border-slate-200 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal">RYA staff rostering software</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-navy md:text-3xl" style={{ textWrap: "balance" }}>Your week, in three steps</h2>
          <p className="mt-2 max-w-2xl text-slate-600">No training course needed. Add your courses, select your staff and confirm the day. The checking happens along the way, not from memory at 07:30 on a Saturday.</p>
          <div className="mt-8"><ComplianceFlow /></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {SAFETY.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-card border border-slate-200 bg-white p-4 md:block md:p-5">
                <f.icon className="h-7 w-7 flex-none text-teal md:h-8 md:w-8" />
                <div>
                  <h3 className="font-semibold text-navy md:mt-3">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            <Link href="/learn?topic=rostering" className="font-semibold text-teal hover:underline">See each check in the Learning Centre →</Link>
            <span className="mx-2 text-slate-300">·</span>
            <Link href="/sailing-school-compliance-software" className="font-semibold text-teal hover:underline">Sailing school compliance software →</Link>
          </p>
        </div>
      </section>

      <PlatformGrid more="features" />

      <PhotoBand src={PHOTOS.deck} alt="A yacht on the water" caption="On the water, every session" />

      {/* How it works */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Set up in an afternoon</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              { n: "1", title: "Set up your centre", body: "RYA defaults are in place from the start. A guided set-up imports your courses and staff." },
              { n: "2", title: "Build the week", body: "Drop courses on the calendar. Instructor types, ratios and supervision are checked as you go." },
              { n: "3", title: "Run the season", body: "Staff see their shifts, pick up open shifts and book leave in the app. Hours flow to payroll." },
            ].map((s) => (
              <div key={s.n} className="flex gap-4 rounded-card border border-slate-200 bg-white p-5 md:block md:p-6">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal font-display text-lg font-bold text-white">{s.n}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-navy md:mt-3">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            <Link href="/learn" className="font-semibold text-teal hover:underline">Step-by-step guides</Link> · or{" "}
            <Link href="/pricing" className="font-semibold text-teal hover:underline">let us set it up for you</Link>.
          </p>
        </div>
      </section>

      <BuiltWithCentres />

      {/* Demo band */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-navy">See it before you speak to anyone</h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">Step through the office and the instructor app at a busy centre. Real screens, made-up centre.</p>
          <Link href="/demo" className="mt-6 inline-block rounded-lg bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-700">
            Take the tour
          </Link>
        </div>
      </section>

      <PricingTeaser />

      {/* Final CTA / free month signup */}
      <section id="get-demo" className="bg-navy">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-10 md:py-16">
          <div className="text-white">
            <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Try it free for a month</h2>
            <p className="mt-3 text-white/80">Your centre is created in seconds with the RYA defaults in place. A guided set-up does the rest, and we&apos;re happy to walk you through it.</p>
            <ul className="mt-5 space-y-2 text-white/85">
              {["No card required, cancel any time", "From £35 a month afterwards, nothing per user", "Hosted in the EU, export your data whenever you like"].map((x) => (
                <li key={x} className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-[#4fd1c5]" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-card bg-white p-6 shadow-xl">
            <div className="rounded-card bg-white p-6 shadow-lg"><EmailStart source="footer" /></div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">FAQ</h2>
          <dl className="mt-6 space-y-5">
            {[
              ["Is my club's data kept separate?", "Yes — isolation is enforced in code, with an automated test that proves no centre can see another's data."],
              ["Where is data stored?", "In the EU. Certificates are held privately and encrypted; DBS, PVG, AccessNI and Garda checks are recorded by status and reference only, so the certificate itself is never stored."],
              ["Which jurisdictions are supported?", "England, Wales, Scotland, Northern Ireland and Ireland — DBS, PVG, AccessNI or Garda vetting set up automatically."],
              ["Can we tailor it to how we run?", "Yes. Grades, roles, checks, session times and course types are all yours to edit."],
              ["Do our instructors need to install anything?", "They get the instructor app on their phone for shifts, availability, open shifts, hours and documents. It also works in any phone browser, so nobody is left out."],
              ["We have under-18 assistants. Can they use it?", "Yes. Add their date of birth and they're marked as under 18, with their contact details kept private from colleagues. Each person's hours for the week show beside their name, so you can keep an eye on them."],
              ["Can we bring our existing schedule across?", "Yes. Import courses and staff from a spreadsheet or calendar, check what was read, then save. Most centres are set up in an afternoon."],
              ["Will the platform keep improving?", "Yes. ActivityRoster is a live platform, updated continuously with nothing to install. Centres request features from inside the platform and vote for each other's ideas, and we build around what centres vote for."],
              ["What does it cost after the free month?", "£35 a month for up to 10 people or £65 a month for unlimited instructors and volunteers (fair use applies, see our terms). No per-user fees, and annual billing gives you months free."],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold text-navy">{q}</dt>
                <dd className="mt-1 text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
