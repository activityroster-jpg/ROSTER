import Link from "next/link";
import { AlertTriangle, Anchor, CalendarCheck, LifeBuoy, ShieldCheck, Ship, Users, Waves } from "lucide-react";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { apexDomain } from "@/lib/config";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Won't roster the under-qualified",
    body: "An instructor whose first aid, DBS/PVG/AccessNI or Garda vetting has lapsed is blocked from assignment automatically — the RYA rule, enforced for you.",
  },
  {
    icon: Users,
    title: "Ratio-aware in real time",
    body: "Every course flags the moment there aren't enough ratio-counting instructors for the group size. No more headcount maths on the slipway.",
  },
  {
    icon: LifeBuoy,
    title: "Safety-boat cover enforced",
    body: "Craft going afloat without a safety-boat role filled? Flagged before anyone launches — with a recorded override if you decide to proceed.",
  },
  {
    icon: AlertTriangle,
    title: "Nothing lapses quietly",
    body: "Every ticket, revalidation and vetting check is tracked with expiry alerts, so certificates never expire unnoticed the week before a course.",
  },
  {
    icon: CalendarCheck,
    title: "Clash detection built in",
    body: "The same instructor or the same safety boat double-booked across overlapping sessions is caught instantly — reassign or override with a note.",
  },
  {
    icon: Waves,
    title: "Sessions, not spreadsheets",
    body: "A weekend course or a four-evening improver is just its sessions. A weekly calendar and a chronological list, coloured by coverage at a glance.",
  },
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
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "radial-gradient(60% 60% at 80% 10%, #0C6B74 0%, transparent 60%)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#4fd1c5]">
              For RYA yacht clubs, sailing schools &amp; activity centres
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl" style={{ textWrap: "balance" }}>
              Rostering that won&apos;t let a session run unsafe.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              ActivityRoster is compliance-aware staff rostering built for the water. It won&apos;t schedule an
              under-qualified instructor, an over-ratio course, or craft afloat without safety-boat cover — and it
              tracks every ticket so nothing lapses.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/demo" className="rounded-lg bg-[#0C6B74] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Try the live demo →
              </Link>
              <a href="#get-demo" className="rounded-lg border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10">
                Get a free walkthrough
              </a>
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

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">Built for the way the water works</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Every centre starts identical and shapes itself to how you run — grades, roles, checks and course types are all yours to set.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-card border border-slate-200 bg-white p-6">
              <a.icon className="h-8 w-8 text-teal" />
              <h3 className="mt-3 font-display text-lg font-semibold text-navy">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The compliance safety net</h2>
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

      {/* Illustrative quote */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="font-display text-2xl font-medium leading-snug text-navy" style={{ textWrap: "balance" }}>
            &ldquo;The Saturday morning scramble to check who&apos;s ticketed and who&apos;s on safety boat just… stopped.
            It tells us before we get to the water.&rdquo;
          </p>
          <p className="mt-4 text-sm text-slate-500">Illustrative — how principals describe the compliance safety net.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">Up and running in an afternoon</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["1. Claim your address", "Pick a plan and check out securely. You get your own space at yourclub.activityroster.com."],
            ["2. Provisioned instantly", "Your centre is created with RYA-aware defaults for your jurisdiction — grades, roles, checks and the course catalogue."],
            ["3. Add your team & go", "Import instructors, record tickets, and start rostering with the safety net on from day one."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-card border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA / capture */}
      <section id="get-demo" className="bg-navy">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div className="text-white">
            <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Get a free walkthrough on your own courses</h2>
            <p className="mt-3 text-white/80">
              Leave your email and we&apos;ll show you ActivityRoster set up for a centre like yours — and hand you
              instant access to the interactive demo.
            </p>
            <ul className="mt-5 space-y-2 text-white/80">
              <li>• EU-hosted, GDPR-ready, data export any time</li>
              <li>• Your data is strictly isolated from every other centre</li>
              <li>• No card required to look around</li>
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
