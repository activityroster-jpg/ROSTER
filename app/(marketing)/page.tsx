import Link from "next/link";
import {
  AlertTriangle, Anchor, CalendarCheck, LifeBuoy, ShieldCheck, Ship, Users, Waves, Wallet, FileCheck,
  Clock, CalendarOff, Repeat, BarChart3, FolderLock, UserPlus, Smartphone, ClipboardCheck,
  GitCompare, BookOpen, Newspaper, Tag, ArrowRight,
} from "lucide-react";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { apexDomain } from "@/lib/config";

// The full platform — one line each. Bodies are hidden on phones to keep the
// page light; the titles carry the message.
const PLATFORM = [
  { icon: CalendarCheck, title: "Scheduling & rostering", body: "Build the week; fit-checked as you go." },
  { icon: Clock, title: "Time & attendance", body: "Clock in/out; timesheets build themselves." },
  { icon: CalendarOff, title: "Availability & leave", body: "Staff set it in the app; you approve in a tap." },
  { icon: Repeat, title: "Open shifts & swaps", body: "Uncovered sessions claimed by fit, free staff." },
  { icon: ShieldCheck, title: "Compliance engine", body: "Ratios, safety cover and tickets enforced." },
  { icon: FileCheck, title: "Licence tracking", body: "Every RYA cert and vetting check, with expiry alerts." },
  { icon: UserPlus, title: "HR & onboarding", body: "Records, contracts and a new-starter checklist." },
  { icon: FolderLock, title: "Document vault", body: "Certificates held privately, encrypted, in the EU." },
  { icon: Wallet, title: "Payroll export", body: "Real hours × pay rates, one click a month." },
  { icon: BarChart3, title: "Reporting", body: "Labour cost, utilisation and budgets." },
  { icon: Smartphone, title: "Instructor app", body: "Schedule, hours and documents in their pocket." },
  { icon: ClipboardCheck, title: "Audit trail", body: "Every change logged, nothing off the record." },
];

const SAFETY = [
  { icon: ShieldCheck, title: "Won't roster the under-qualified", body: "Lapsed first aid or vetting? They can't be assigned." },
  { icon: Users, title: "Ratio-aware", body: "Flags a course the moment it's short of instructors." },
  { icon: LifeBuoy, title: "Safety-boat cover enforced", body: "Nothing goes afloat without cover — overrides are recorded." },
  { icon: AlertTriangle, title: "Nothing lapses quietly", body: "Expiry alerts on every ticket and check." },
  { icon: CalendarCheck, title: "Clash detection", body: "Double-booked instructor or boat? Caught instantly." },
  { icon: Wallet, title: "Hours & pay, done", body: "Scheduled vs actual, exported for payroll." },
];

const AUDIENCES = [
  { icon: Anchor, title: "Yacht clubs", body: "Volunteer rotas and racing safety cover, without the committee spreadsheet." },
  { icon: Ship, title: "Sailing schools", body: "Back-to-back RYA courses, a big freelance pool, every ticket tracked." },
  { icon: Waves, title: "Activity centres", body: "Dinghy, windsurf, powerboat and kayak — one roster, one compliance picture." },
];

const PHOTOS = {
  hero: "/photos/sailing-hero.jpg",
  keelboat: "/photos/keelboat.jpg",
  catamarans: "/photos/catamarans.jpg",
  kayaks: "/photos/kayaks.jpg",
  instructors: "/photos/instructors.jpg",
  deck: "/photos/deck.jpg",
  marina: "/photos/marina.jpg",
};

function PhotoBand({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="relative h-56 w-full overflow-hidden sm:h-64 md:h-72 lg:h-80">
      <img src={src} alt={alt} className="h-full w-full object-cover object-center" loading="lazy" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/50 via-navy/10 to-transparent" />
      {caption ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-5">
          <p className="font-display text-lg font-semibold text-white drop-shadow sm:text-xl">{caption}</p>
        </div>
      ) : null}
    </div>
  );
}

const DISCIPLINES = [
  { src: PHOTOS.keelboat, label: "Keelboat & yacht", sub: "Cruising to Yachtmaster" },
  { src: PHOTOS.catamarans, label: "Dinghies & catamarans", sub: "National & Youth schemes" },
  { src: PHOTOS.kayaks, label: "Kayaking & SUP", sub: "Paddlesports" },
  { src: PHOTOS.instructors, label: "Instructors & coaching", sub: "Your whole team, one roster" },
];

function DisciplineGallery() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">Every discipline, one platform</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {DISCIPLINES.map((d) => (
            <div key={d.label} className="group relative aspect-[3/2] overflow-hidden rounded-card">
              <img src={d.src} alt={d.label} loading="lazy" className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-sm font-semibold leading-tight text-white sm:text-lg">{d.label}</p>
                <p className="hidden text-xs text-white/80 sm:block">{d.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Phones only: a photo strip straight under the hero, in place of the demo. */
function MobilePhotoStrip() {
  return (
    <div className="grid grid-cols-3 gap-1 md:hidden" aria-hidden>
      {[PHOTOS.catamarans, PHOTOS.instructors, PHOTOS.kayaks].map((src) => (
        <img key={src} src={src} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
      ))}
    </div>
  );
}

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
        url: site,
        description: "Compliance-aware staff rostering and course administration for RYA sailing and watersports centres, schools and clubs.",
        areaServed: "GB",
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: site,
        name: "ActivityRoster",
        publisher: { "@id": `${site}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "ActivityRoster",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "35", priceCurrency: "GBP" },
        description: "Flat per-centre pricing (from £35/mo) for staff rostering, qualifications and safety-cover compliance at RYA centres.",
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero — the photo shows through more on phones, where there's no demo */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-50 md:opacity-20"
          style={{ backgroundImage: `url('${PHOTOS.hero}')` }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy/60 via-navy/75 to-navy md:bg-[linear-gradient(90deg,#0A2E52_35%,rgba(10,46,82,0.72)_100%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#4fd1c5]">
              For RYA clubs, schools &amp; activity centres
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl" style={{ textWrap: "balance" }}>
              Staff rostering that knows the RYA rules.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              Rostering, hours, leave and payroll in one place — and it won&apos;t let an under-qualified instructor,
              an over-ratio course or a boat without safety cover slip through.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-lg bg-[#0C6B74] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Schedule a call →
              </Link>
              <Link href="/demo" className="hidden rounded-lg border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10 md:inline-block">
                Explore the demo
              </Link>
            </div>
            <p className="mt-3 text-sm text-white/60">
              Free for a month · no card ·{" "}
              <Link href="/pricing" className="font-semibold text-white/90 underline decoration-white/30 underline-offset-2 hover:decoration-white">Pricing</Link>
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md rounded-card bg-white/5 p-6 text-center ring-1 ring-white/15 backdrop-blur md:p-8">
              <p className="font-display text-2xl font-bold text-white">Start your free month</p>
              <p className="mt-2 text-sm text-white/70">Your centre is created instantly.</p>
              <a href="#get-demo" className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#0C6B74] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Start your free month →
              </a>
            </div>
          </div>
        </div>
      </section>

      <MobilePhotoStrip />

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

      {/* Full platform grid */}
      <section id="features" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The whole staff platform, built for the water</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Everything you stitch together today — spreadsheets, WhatsApp, a folder of certificates — in one place.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {PLATFORM.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-card border border-slate-200 p-3 sm:p-4">
                <f.icon className="h-6 w-6 flex-none text-teal" />
                <div>
                  <h3 className="text-sm font-semibold text-navy sm:text-base">{f.title}</h3>
                  <p className="mt-0.5 hidden text-sm text-slate-600 sm:block">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            <Link href="/compare" className="font-semibold text-teal hover:underline">See how it compares with what you use today →</Link>
          </p>
        </div>
      </section>

      <DisciplineGallery />

      <PhotoBand src={PHOTOS.deck} alt="A yacht on the water" caption="On the water, every session" />

      {/* How it works */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Up and running in a weekend</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              { n: "1", title: "Set up your centre", body: "RYA defaults are seeded for you. Tweak them, add your staff and their tickets." },
              { n: "2", title: "Build the week", body: "Drop courses on the calendar. Staff, ratios and safety cover are checked as you go." },
              { n: "3", title: "Run the season", body: "Staff clock in, claim shifts and book leave from their phone. Hours flow to payroll." },
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

      {/* Who it's for */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Built for the way RYA centres work</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="flex gap-4 rounded-card border border-slate-200 p-5 md:block md:p-6">
                <a.icon className="h-8 w-8 flex-none text-teal" />
                <div>
                  <h3 className="font-display text-lg font-semibold text-navy md:mt-3">{a.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{a.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PhotoBand src={PHOTOS.instructors} alt="Instructors briefing on the shore" caption="Every session safely staffed" />

      {/* The compliance safety net */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The safety net, built in</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Not a checklist someone has to remember at 07:30 on a Saturday.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {SAFETY.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-card border border-slate-200 p-4 md:block md:p-5">
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
          </p>
        </div>
      </section>

      {/* Demo band — desktop only; the demo is a desktop experience */}
      <section className="hidden bg-canvas md:block">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-navy">See it before you speak to anyone</h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">Click around the office admin and the instructor app, with example data.</p>
          <Link href="/demo" className="mt-6 inline-block rounded-lg bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-700">
            Open the live demo
          </Link>
        </div>
      </section>

      {/* Quote */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center md:py-16">
          <p className="font-display text-2xl font-medium leading-snug text-navy" style={{ textWrap: "balance" }}>
            &ldquo;The Saturday morning scramble to check who&apos;s ticketed and who&apos;s on safety boat just… stopped.&rdquo;
          </p>
        </div>
      </section>

      {/* Explore more */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Take a closer look</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { href: "/compare", icon: GitCompare, title: "Compare", body: "Against the tools centres use today." },
              { href: "/learn", icon: BookOpen, title: "Learning Centre", body: "Guides to every part of the platform." },
              { href: "/blog", icon: Newspaper, title: "Blog", body: "Running and filling RYA courses." },
              { href: "/pricing", icon: Tag, title: "Pricing", body: "One simple plan. First month free." },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="group rounded-card border border-slate-200 bg-white p-4 transition hover:border-teal hover:shadow-md md:p-5">
                <c.icon className="h-7 w-7 text-teal" />
                <h3 className="mt-3 flex items-center gap-1 font-semibold text-navy">
                  {c.title}
                  <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-sm text-slate-600">{c.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PhotoBand src={PHOTOS.marina} alt="Marina and moorings" caption="Run the whole centre in one place" />

      {/* Final CTA / free month signup */}
      <section id="get-demo" className="bg-navy">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-10 md:py-16">
          <div className="text-white">
            <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Try it free for a month</h2>
            <p className="mt-3 text-white/80">Leave your email and we&apos;ll set up your centre and offer a free walkthrough.</p>
            <ul className="mt-5 space-y-2 text-white/80">
              <li>• No card required</li>
              <li>• EU-hosted, UK GDPR-ready, export any time</li>
              <li>• Your data stays strictly yours</li>
            </ul>
          </div>
          <div className="rounded-card bg-white p-6 shadow-xl">
            <LeadCapture source="footer" variant="inline" apex={apex} />
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
              ["Where is data stored?", "In the EU. Certificates and vetting documents are held privately and encrypted."],
              ["Which jurisdictions are supported?", "England, Wales, Scotland, Northern Ireland and Ireland — DBS, PVG, AccessNI or Garda vetting set up automatically."],
              ["Can we tailor it to how we run?", "Yes. Grades, roles, checks, session times and course types are all yours to edit."],
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
