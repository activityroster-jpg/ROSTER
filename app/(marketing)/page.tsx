import Link from "next/link";
import {
  AlertTriangle, Anchor, CalendarCheck, LifeBuoy, ShieldCheck, Ship, Users, Waves, Wallet, FileCheck,
  Clock, CalendarOff, Repeat, BarChart3, FolderLock, UserPlus, Smartphone, ClipboardCheck,
  GitCompare, BookOpen, Newspaper, Tag, ArrowRight,
} from "lucide-react";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { apexDomain } from "@/lib/config";

// The full platform — workforce management, built for the water.
const PLATFORM = [
  { icon: CalendarCheck, title: "Scheduling & rostering", body: "Drag-and-drop the week across sessions, staff and boats — fit-checked as you build." },
  { icon: Clock, title: "Time & attendance", body: "Clock in/out with optional photo & GPS; timesheets build themselves from real hours." },
  { icon: CalendarOff, title: "Availability & leave", body: "Staff set availability and request leave in the app; you approve in a tap." },
  { icon: Repeat, title: "Open shifts & swaps", body: "Broadcast uncovered sessions; fit, available staff claim or swap them." },
  { icon: ShieldCheck, title: "Compliance engine", body: "Ratios, safety-boat cover and qualifications enforced before anyone goes afloat." },
  { icon: FileCheck, title: "Licence & ticket tracking", body: "Every RYA cert and vetting check with expiry alerts, so nothing lapses unnoticed." },
  { icon: UserPlus, title: "HR & onboarding", body: "Staff records, contracts and an onboarding checklist for every new starter." },
  { icon: FolderLock, title: "Document vault", body: "Certificates and vetting held privately and encrypted, in the EU." },
  { icon: Wallet, title: "Payroll export", body: "Scheduled vs actual hours with pay rates, ready as a one-click CSV each month." },
  { icon: BarChart3, title: "Reporting & analytics", body: "Labour cost vs revenue, utilisation and budgets — drill down to the session." },
  { icon: Smartphone, title: "Instructor app", body: "Schedule, availability, hours and documents in every instructor's pocket." },
  { icon: ClipboardCheck, title: "Audit trail", body: "Every roster, override and settings change is logged — nothing happens off the record." },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Won't roster the under-qualified", body: "An instructor whose first aid, DBS/PVG/AccessNI or Garda vetting has lapsed is blocked from assignment automatically." },
  { icon: Users, title: "Ratio-aware in real time", body: "Courses flag the moment there aren't enough ratio-counting instructors for the group size. No headcount maths on the slipway." },
  { icon: LifeBuoy, title: "Safety-boat cover enforced", body: "Craft going afloat without a safety-boat role filled? Flagged before launch — with a recorded override if you decide to proceed." },
  { icon: AlertTriangle, title: "Nothing lapses quietly", body: "Tickets and vetting tracked with expiry alerts, so certificates never expire unnoticed." },
  { icon: CalendarCheck, title: "Clash detection built in", body: "The same instructor or safety boat double-booked across overlapping sessions is caught instantly — reassign or override." },
  { icon: Wallet, title: "Hours & pay, done", body: "Scheduled vs actual hours with pay rates, ready to export for payroll each month." },
];

const AUDIENCES = [
  { icon: Anchor, title: "Yacht clubs", body: "Volunteer-heavy rotas, member instructors, safety-boat cover for racing and training — kept compliant without the committee spreadsheet." },
  { icon: Ship, title: "Sailing schools", body: "RYA courses back to back all season. Fit-checked staffing, hours for payroll, and tickets tracked across a large freelance pool." },
  { icon: Waves, title: "Activity centres", body: "Dinghy, windsurf, powerboat and kayak under one roof. One roster, one compliance picture, per-jurisdiction vetting built in." },
];

function PhotoBand({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="relative h-44 w-full overflow-hidden sm:h-60 md:h-72 lg:h-80">
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
  { src: "/photos/keelboat.jpg", label: "Keelboat & yacht", sub: "Cruising to Yachtmaster" },
  { src: "/photos/catamarans.jpg", label: "Dinghies & catamarans", sub: "National & Youth schemes" },
  { src: "/photos/kayaks.jpg", label: "Kayaking & SUP", sub: "Paddlesports" },
  { src: "/photos/instructors.jpg", label: "Instructors & coaching", sub: "Your whole team, one roster" },
];

function DisciplineGallery() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">Every discipline, one platform</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Sailing, powerboat, windsurf, paddlesports and more — rostered, ratio-checked and compliance-covered under one roof.</p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {DISCIPLINES.map((d) => (
            <div key={d.label} className="group relative aspect-[3/2] overflow-hidden rounded-card">
              <img src={d.src} alt={d.label} loading="lazy" className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-base font-semibold text-white sm:text-lg">{d.label}</p>
                <p className="text-xs text-white/80">{d.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
        offers: { "@type": "Offer", price: "75", priceCurrency: "GBP" },
        description: "Staff rostering, qualifications and safety-cover compliance for RYA centres.",
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        {/* Subtle watersports photo behind a heavy navy wash */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/photos/sailing-hero.jpg')" }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, #0A2E52 35%, rgba(10,46,82,0.72) 100%)" }} aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#4fd1c5]">
              For RYA yacht clubs, sailing schools &amp; activity centres
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl" style={{ textWrap: "balance" }}>
              The all-in-one platform for RYA sailing &amp; watersports centres.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              Scheduling, time &amp; attendance, leave, HR, payroll and reporting in one place — and it&apos;s
              compliance-aware: it won&apos;t roster an under-qualified instructor, an over-ratio course, or craft afloat
              without safety cover, and it tracks every ticket so nothing lapses.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/book" className="rounded-lg bg-[#0C6B74] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Schedule a call →
              </Link>
              <Link href="/demo" className="rounded-lg border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10">
                Explore the demo
              </Link>
            </div>
            <p className="mt-3 text-sm text-white/60">
              No card required · one simple plan ·{" "}
              <Link href="/pricing" className="font-semibold text-white/90 underline decoration-white/30 underline-offset-2 hover:decoration-white">See pricing</Link>
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md rounded-card bg-white/5 p-8 text-center ring-1 ring-white/15 backdrop-blur">
              <p className="font-display text-2xl font-bold text-white">Start your free month</p>
              <p className="mt-2 text-sm text-white/70">No card required. Your centre is created instantly.</p>
              <a href="#get-demo" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#0C6B74] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Start your free month →
              </a>
              <p className="mt-3 text-xs text-white/60">Takes under a minute</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 text-center md:grid-cols-4">
          {[
            ["Compliance-first", "RYA rules enforced, not remembered"],
            ["Cloudflare-hosted", "Cloudflare's EU network · UK GDPR-ready"],
            ["Fully isolated", "Each centre's data proven separate"],
            ["Free for a month", "No card required to start"],
          ].map(([h, s]) => (
            <div key={h}>
              <p className="font-display text-base font-semibold text-navy">{h}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Full platform grid — the breadth */}
      <section id="features" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The complete staff platform — built for the water</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Scheduling, time &amp; attendance, leave, HR, compliance, payroll and reporting in one place — with the RYA
            rules and the realities of a busy slipway built in. Stop stitching together spreadsheets, WhatsApp groups
            and a folder of certificates.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-card border border-slate-200 p-4">
                <f.icon className="h-6 w-6 flex-none text-teal" />
                <div>
                  <h3 className="font-semibold text-navy">{f.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            Wondering how it stacks up against what you use today?{" "}
            <Link href="/compare" className="font-semibold text-teal hover:underline">See how ActivityRoster compares →</Link>
          </p>
        </div>
      </section>

      <DisciplineGallery />

      <PhotoBand src="/photos/deck.jpg" alt="A yacht on the water" caption="On the water, every session" />

      {/* How it works */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Up and running in a weekend</h2>
          <p className="mt-2 max-w-2xl text-slate-600">No IT project. Your centre is live at its own web address, and shapes itself to how you already run.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { n: "1", title: "Set up your centre", body: "We seed the RYA defaults — grades, roles, checks and course types — then you tweak them to match your centre. Add your staff and their tickets." },
              { n: "2", title: "Build the week", body: "Drop courses onto the calendar. It fit-checks staff, ratios and safety cover as you go, and flags anything that isn't safe to run." },
              { n: "3", title: "Run the season", body: "Staff clock in, claim open shifts and request leave from their phone. Hours flow into payroll; compliance and revenue stay on the dashboard." },
            ].map((s) => (
              <div key={s.n} className="rounded-card border border-slate-200 bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal font-display text-lg font-bold text-white">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-navy">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            Prefer a hand? Follow the step-by-step{" "}
            <Link href="/learn" className="font-semibold text-teal hover:underline">guides in the Learning Centre</Link>, or
            let us do it for you with{" "}
            <Link href="/pricing" className="font-semibold text-teal hover:underline">done-for-you setup</Link>.
          </p>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Built for the way RYA centres work</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Every centre starts identical and shapes itself to how you run — grades, roles, checks and course types are all yours to set.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="rounded-card border border-slate-200 p-6">
                <a.icon className="h-8 w-8 text-teal" />
                <h3 className="mt-3 font-display text-lg font-semibold text-navy">{a.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature detail — the compliance safety net */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The compliance safety net, in detail</h2>
          <p className="mt-2 max-w-2xl text-slate-600">The rules that keep a centre safe are built in — not a checklist someone has to remember at 07:30 on a Saturday.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-card border border-slate-200 p-5">
                <f.icon className="h-8 w-8 text-teal" />
                <h3 className="mt-3 font-semibold text-navy">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-600">
            See exactly how each check works, with real screenshots, in the{" "}
            <Link href="/learn?topic=rostering" className="font-semibold text-teal hover:underline">Learning Centre →</Link>
          </p>
        </div>
      </section>

      {/* Demo band */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-navy">See it before you speak to anyone</h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">
            Open the interactive demo and click around the office admin and the instructor portal — with example
            data that shows a blocked instructor, an under-staffed course and a safety-cover gap.
          </p>
          <Link href="/demo" className="mt-6 inline-block rounded-lg bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-700">
            Open the live demo
          </Link>
        </div>
      </section>

      {/* Quote */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="font-display text-2xl font-medium leading-snug text-navy" style={{ textWrap: "balance" }}>
            &ldquo;The Saturday morning scramble to check who&apos;s ticketed and who&apos;s on safety boat just… stopped.
            It tells us before we get to the water.&rdquo;
          </p>
        </div>
      </section>

      {/* Explore more — surfaces the deeper pages */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Take a closer look</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Everything you need to decide — compare the options, learn how it works, and read up on running a centre.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/compare", icon: GitCompare, title: "Compare", body: "How we stack up against the tools centres use today." },
              { href: "/learn", icon: BookOpen, title: "Learning Centre", body: "Step-by-step guides to every part of the platform, with screenshots." },
              { href: "/blog", icon: Newspaper, title: "Blog", body: "Guides on running, filling and promoting RYA courses and clubs." },
              { href: "/pricing", icon: Tag, title: "Pricing", body: "One simple plan — or done-for-you setup. First month free." },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="group rounded-card border border-slate-200 bg-white p-5 transition hover:border-teal hover:shadow-md">
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

      <PhotoBand src="/photos/marina.jpg" alt="Marina and moorings" caption="Run the whole centre in one place" />

      {/* Final CTA / free month signup */}
      <section id="get-demo" className="bg-navy">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div className="text-white">
            <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Try ActivityRoster free for a month</h2>
            <p className="mt-3 text-white/80">
              No card required. Leave your email and we&apos;ll set you up with your own centre and a free walkthrough —
              and you can start in the interactive demo right away.
            </p>
            <ul className="mt-5 space-y-2 text-white/80">
              <li>• Free for a month, then simple monthly pricing</li>
              <li>• Hosted on Cloudflare (EU), UK GDPR-ready, export any time</li>
              <li>• Your data is strictly isolated from every other centre</li>
            </ul>
          </div>
          <div className="rounded-card bg-white p-6 shadow-xl">
            <LeadCapture source="footer" variant="inline" apex={apex} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">FAQ</h2>
          <dl className="mt-6 space-y-6">
            {[
              ["Is my club's data kept separate?", "Yes — every centre's data is strictly isolated and enforced in code, with an automated test proving no centre can ever see another's."],
              ["Where is data stored?", "In the EU, for GDPR residency. Certificates and vetting documents are held privately and encrypted."],
              ["Which jurisdictions are supported?", "England, Wales, Scotland, Northern Ireland and Ireland — the right vetting checks (DBS/PVG/AccessNI/Garda) are set up automatically."],
              ["Can we tailor it to how we run?", "Completely. Grades, roles, compliance checks, session times and the course catalogue are all yours to edit — without ever affecting another centre."],
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
