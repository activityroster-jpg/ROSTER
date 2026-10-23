import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { ComplianceFlow } from "@/components/marketing/ComplianceFlow";
import { ScreenShot } from "@/components/marketing/ScreenShot";
import { EmailStart } from "@/components/marketing/EmailStart";
import { SCREENS } from "@/lib/screens";
import { apexDomain } from "@/lib/config";

/**
 * PADI dive centres: the same platform with the PADI pack. Linked from the
 * footer only and kept out of search engines until it goes on the homepage.
 */
export const metadata = {
  title: "Staff rostering for PADI dive centres",
  description: "Rosters checked for PADI ratings, insurance, medicals and ratios; availability from instructors' phones; hours for payroll. First month free.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  {
    heading: "One place for the whole staff side of the dive centre",
    body: ["Most dive centres run on a booking system for customers and a spreadsheet, a WhatsApp group and the manager's memory for staff. It works until an instructor's PADI renewal lapses unnoticed, two Open Water groups land on the same morning, or the busiest week of the season hits a new person in the shop."],
    bullets: [
      "Courses, guided dives and boat trips on one calendar",
      "A roster board where you drag instructors and divemasters onto sessions, or press Auto-roster",
      "Every PADI rating, EFR certificate, insurance, medical and vetting check, with expiry dates",
      "Availability collected from instructors' phones, not chased by text",
      "Leave, open shifts, hours and payroll export",
      "A printable roster and an emergency sheet for the duty manager",
    ],
  },
  {
    heading: "PADI standards built in, not bolted on",
    body: [
      "Your centre starts with the PADI course list (Discover Scuba to Divemaster, the specialties, Bubblemaker to Junior Open Water), the professional ratings from Divemaster to Course Director, dive kit and the checks that lapse: annual membership renewal, liability insurance, diving medical, EFR, oxygen provider. Every list is yours to change.",
      "Each course type carries a student-to-instructor ratio you set, and every assignment is checked as you make it: the person must hold a rating that covers the course and be free. Switch on the ratio, licence and double-booking checks in Settings, and mark the certificates that must be in date. Nothing is silently blocked or silently allowed: when there's a problem the button says “Assign anyway”, and the override is recorded with who decided and when.",
    ],
  },
  {
    heading: "The same platform, whatever the water",
    body: ["ActivityRoster runs RYA sailing centres and clubs today. A dive centre gets exactly the same roster, app, checks and payroll, set up with PADI lists instead of RYA ones. A centre that does both adds the other list in a click. Pricing is flat per centre, not per user, so seasonal freelancers and divemasters-in-training don't cost extra."],
    bullets: ["Small centre: £35 a month for up to 10 people", "Standard: £65 a month for your whole team", "First month free, no card needed"],
  },
];

const FAQS = [
  { q: "Do you track PADI renewals and insurance?", a: "Yes. Membership renewal, professional liability insurance, the diving medical, EFR and oxygen provider all carry expiry dates with reminders. You choose which ones block rostering when they lapse." },
  { q: "We also teach RYA powerboat courses. Can one centre do both?", a: "Yes. Pick your main activity at sign-up, then add the RYA course list and instructor types from Course setup. One login, one roster." },
  { q: "Does it replace our booking system?", a: "No. ActivityRoster is the staff side: who is working, whether they are qualified and free, and their hours. Customer bookings stay where they are." },
  { q: "Are instructors paid per student or per certification?", a: "Either works. Each pay rate can be per hour, per session, per day or per student (the rate times the students on the course), for a role, a person or a particular course. Hours and pay export for your payroll." },
  { q: "We're not in the UK.", a: "Choose “Other” for your country at sign-up. Vetting checks, currency and time zone follow." },
];

export default function DivingPage() {
  const apex = apexDomain();
  const hero = SCREENS.dashboard;
  const gallery = [SCREENS.board, SCREENS.availability, SCREENS.staff, SCREENS.appHome].filter((s): s is NonNullable<typeof s> => Boolean(s));
  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:pb-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
            <Link href="/" className="hover:text-navy">Home</Link> <span aria-hidden="true">›</span> <span className="text-slate-500">Dive centres</span>
          </nav>
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal">For PADI dive centres</p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-navy md:text-4xl" style={{ textWrap: "balance" }}>Staff rostering that knows what a PADI rating is</h1>
              <p className="mt-4 text-lg text-slate-600">General rota software doesn't know that an Open Water class needs an instructor rated to teach it, that a Divemaster can assist but not certify, or that your best freelancer's insurance runs out in August. ActivityRoster does. It runs the staff side of a dive centre: courses and dives, rosters, ratings, availability, hours and the instructor app, in one place.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href="#start" className="rounded-lg bg-teal px-6 py-3 text-center font-semibold text-white shadow-sm hover:bg-teal-700">Start my free month →</a>
                <Link href="/demo" className="rounded-lg border border-slate-300 px-6 py-3 text-center font-semibold text-navy hover:bg-slate-50">Take the tour</Link>
              </div>
              <p className="mt-3 text-sm text-slate-500">Free for a month · no card · from £35 a month after</p>
            </div>
            <figure>
              <ScreenShot screen={hero} eager />
              <figcaption className="mt-2 text-center text-xs text-slate-500">The office dashboard. Screens show a sailing centre; a dive centre sees its own courses and ratings in the same places.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="font-display text-2xl font-semibold text-navy">Your week, in three steps</h2>
          <div className="mt-6"><ComplianceFlow /></div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 md:py-16">
          {SECTIONS.map((s) => (
            <div key={s.heading}>
              <h2 className="font-display text-2xl font-semibold text-navy">{s.heading}</h2>
              {s.body.map((p) => <p key={p.slice(0, 40)} className="mt-3 leading-relaxed text-slate-600">{p}</p>)}
              {s.bullets ? (
                <ul className="mt-4 space-y-2">
                  {s.bullets.map((b) => <li key={b} className="flex gap-2.5 text-slate-700"><Check className="mt-0.5 h-5 w-5 flex-none text-starboard" aria-hidden="true" />{b}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

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
              <Link href="/learn?topic=dive-centres" className="font-semibold text-teal hover:underline">📖 The dive-centre guide</Link>
              <span className="mx-2 text-slate-300">·</span>
              <Link href="/demo" className="font-semibold text-teal hover:underline">Every screen in the tour</Link>
            </p>
          </div>
        </section>
      ) : null}

      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">Questions</h2>
          <dl className="mt-6 space-y-5">
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-navy">{f.q}</dt>
                <dd className="mt-1 text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="start" className="bg-navy">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-10 md:py-16">
          <div className="text-white">
            <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Try it free for a month</h2>
            <p className="mt-3 text-white/80">Your dive centre is created in seconds with the PADI lists in place, and a guided set-up does the rest.</p>
            <ul className="mt-5 space-y-2 text-white/85">
              {["No card required, cancel any time", "£35 a month for up to 10 people, £65 for everyone", "Hosted in the EU, export your data whenever you like"].map((x) => (
                <li key={x} className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-[#4fd1c5]" aria-hidden="true" />{x}</li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-white/80 hover:text-white">See pricing <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="rounded-card bg-white p-6 shadow-xl">
            <EmailStart source="landing:diving" activityType="padi_centre" />
          </div>
        </div>
      </section>
    </>
  );
}
