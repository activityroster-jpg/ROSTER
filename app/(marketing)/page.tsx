import Link from "next/link";
import { AlertTriangle, Anchor, CalendarCheck, LifeBuoy, ShieldCheck, Ship, Users, Waves, Wallet, FileCheck } from "lucide-react";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { apexDomain } from "@/lib/config";

const PILLARS = [
  {
    icon: CalendarCheck,
    title: "Rostering, simplified",
    body: "Build the week in minutes. Sessions, staff and boats in one view — the Saturday-morning scramble replaced by a plan that's already checked.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance, automatic",
    body: "It won't schedule an under-qualified instructor, an over-ratio course, or craft afloat without safety-boat cover. The RYA rules, enforced for you.",
  },
  {
    icon: FileCheck,
    title: "Licence tracking, sorted",
    body: "Every ticket, revalidation and vetting check tracked with expiry alerts — so nothing lapses the week before a course.",
  },
  {
    icon: Wallet,
    title: "Staff payments, tidy",
    body: "Scheduled vs actual hours captured as they happen, with pay rates applied and a one-click CSV for payroll.",
  },
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

export default function MarketingHome() {
  const apex = apexDomain();
  return (
    <>
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
              Rostering, compliance, licences &amp; pay — sorted for your centre.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              ActivityRoster is compliance-aware staff rostering built for the water. It won&apos;t schedule an
              under-qualified instructor, an over-ratio course, or craft afloat without safety-boat cover — it tracks
              every ticket so nothing lapses, and keeps staff hours and pay tidy for payroll.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#get-demo" className="rounded-lg bg-[#0C6B74] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Try free for a month →
              </a>
              <Link href="/demo" className="rounded-lg border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10">
                Explore the demo
              </Link>
            </div>
            <p className="mt-3 text-sm text-white/50">No card required · your own address at yourclub.{apex}</p>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md">
              <LeadCapture source="hero" />
            </div>
          </div>
        </div>
      </section>

      {/* Four pillars — what it does for owners */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">Everything a centre owner juggles — in one place</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Stop stitching together spreadsheets, WhatsApp groups and a folder of certificates. ActivityRoster handles
          the four jobs that eat your week.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-card border border-slate-200 bg-white p-5">
              <p.icon className="h-8 w-8 text-teal" />
              <h3 className="mt-3 font-semibold text-navy">{p.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-y border-slate-200 bg-white">
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

      {/* Subtle photo strip for vibe */}
      <section aria-hidden className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["/photos/dinghies.jpg", "Dinghies"],
            ["/photos/catamarans.jpg", "Catamarans"],
            ["/photos/kayaks.jpg", "Kayaks"],
            ["/photos/marina.jpg", "Marina"],
          ].map(([src, alt]) => (
            <div key={src} className="h-24 overflow-hidden rounded-card sm:h-28">
              <img src={src} alt={alt} className="h-full w-full object-cover opacity-90 transition hover:opacity-100" loading="lazy" />
            </div>
          ))}
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
              <li>• EU-hosted, GDPR-ready, data export any time</li>
              <li>• Your data is strictly isolated from every other centre</li>
            </ul>
          </div>
          <div className="rounded-card bg-white p-6 shadow-xl">
            <LeadCapture source="footer" variant="inline" />
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
