import Link from "next/link";
import {
  AlertTriangle, Anchor, CalendarCheck, LifeBuoy, ShieldCheck, Ship, Users, Waves, Wallet, FileCheck,
  Clock, CalendarOff, Smartphone, ClipboardCheck,
  GitCompare, BookOpen, Newspaper, Tag, ArrowRight, Baby, KeyRound, FileText, Upload,
} from "lucide-react";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { ComplianceFlow } from "@/components/marketing/ComplianceFlow";
import { ScreenShot } from "@/components/marketing/ScreenShot";
import { SCREENS } from "@/lib/screens";
import { apexDomain } from "@/lib/config";

export const metadata = {
  title: { absolute: "RYA Sailing School Software & Staff Rostering | ActivityRoster" },
  description:
    "The operating system for RYA sailing centres. Build rotas that are ready to run: instructor qualifications, availability, course ratios and safety-boat cover checked as you schedule. Free for a month.",
  alternates: { canonical: "/" },
};

// The full platform, one line each, in the order a centre manager cares about.
// Keep this in step with what is built (and with INCLUDED on the pricing page).
const PLATFORM = [
  { icon: CalendarCheck, title: "Roster builder", body: "Build the week; every assignment is checked for tickets, ratios and clashes." },
  { icon: Smartphone, title: "Instructor app", body: "Shifts, availability, swaps, hours and documents on their phone, with notifications." },
  { icon: FileCheck, title: "Certs & vetting", body: "Every RYA ticket, first aid and DBS/PVG/AccessNI/Garda check, with expiry reminders." },
  { icon: Baby, title: "Young workers' hours", body: "Under-18s checked against the legal hours for their age; adults warned over 48 a week." },
  { icon: Users, title: "Parent & guardian view", body: "A read-only roster for the parents of under-18 staff. Nothing else, nobody else's details." },
  { icon: KeyRound, title: "Roles for your team", body: "Admin, senior instructor and welfare officer, each seeing only what they need." },
  { icon: FileText, title: "Printable roster", body: "A day-by-day PDF in the layout you choose, ready for the noticeboard." },
  { icon: LifeBuoy, title: "Emergency sheet", body: "Today's staff and emergency contacts on one page for the duty officer." },
  { icon: CalendarOff, title: "Leave & cover", body: "Staff ask in the app; you approve in a tap and open the gap to the team." },
  { icon: Clock, title: "Hours & payroll", body: "Hours from the roster (or the optional clock), times pay rates, exported monthly." },
  { icon: Upload, title: "Import in minutes", body: "Bring your courses and staff across from a spreadsheet or calendar." },
  { icon: ClipboardCheck, title: "Audit trail & GDPR tools", body: "Every change logged; export, restrict or anonymise a person's data in a click." },
];

const SAFETY = [
  { icon: ShieldCheck, title: "Won't roster the under-qualified", body: "Lapsed first aid or vetting? They can't be assigned without a recorded override." },
  { icon: Users, title: "Ratio-aware", body: "Flags a course the moment it's short of instructors." },
  { icon: LifeBuoy, title: "Safety-boat cover enforced", body: "Nothing goes afloat without cover — overrides are recorded." },
  { icon: AlertTriangle, title: "Nothing lapses quietly", body: "Expiry alerts on every ticket and check." },
  { icon: CalendarCheck, title: "Clash detection", body: "Double-booked instructor or boat? Caught instantly." },
  { icon: Wallet, title: "Hours & pay, done", body: "Scheduled vs actual, exported for payroll." },
];

const AUDIENCES = [
  { icon: Anchor, title: "Yacht clubs", body: "Volunteer rosters and racing safety cover, without the committee spreadsheet." },
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
        description: "RYA sailing school software: compliance-aware staff rostering, qualification tracking and course administration for RYA sailing and watersports centres, schools and clubs.",
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
        description: "RYA sailing school software. Instructor qualifications, availability, course ratios and safety-boat cover checked as you schedule. Flat per-centre pricing from £35/month.",
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
              Build rotas that are actually ready to run. ActivityRoster checks instructor qualifications, availability,
              course ratios and safety-boat cover as you schedule.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#get-demo" className="rounded-lg bg-[#0C6B74] px-6 py-3.5 text-center font-semibold text-white shadow-lg transition hover:bg-teal-700">
                Start my free month →
              </a>
              <Link href="/demo" className="rounded-lg border border-white/30 px-6 py-3.5 text-center font-semibold text-white hover:bg-white/10">
                Take the tour
              </Link>
            </div>
            <p className="mt-3 text-sm text-white/70">
              Free for a month · no card · set up in an afternoon ·{" "}
              <Link href="/pricing" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">from £35/month</Link>
            </p>
          </div>
          <div>
            <ScreenShot screen={SCREENS.courses} eager className="ring-1 ring-white/20" />
            <p className="mt-2 text-center text-xs text-white/60">The courses calendar at a busy centre in July. <Link href="/demo" className="underline underline-offset-2 hover:text-white">See every screen →</Link></p>
          </div>
        </div>
      </section>

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

      {/* The compliance engine: the product in one picture */}
      <section id="how-it-checks" className="border-b border-slate-200 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal">RYA staff rostering software</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-navy md:text-3xl" style={{ textWrap: "balance" }}>Every assignment is checked before it reaches the water</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Not a checklist someone has to remember at 07:30 on a Saturday. The checks run the moment you put someone on a session.</p>
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

      {/* Full platform grid */}
      <section id="features" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The whole staff platform, built for RYA centres and clubs</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Everything an RYA centre or club stitches together today — spreadsheets, WhatsApp, a folder of certificates — in one place.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {PLATFORM.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-card border border-slate-200 p-4">
                <f.icon className="h-6 w-6 flex-none text-teal" />
                <div>
                  <h3 className="text-base font-semibold text-navy">{f.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">{f.body}</p>
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
          <h2 className="font-display text-2xl font-semibold text-navy">Set up in an afternoon</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              { n: "1", title: "Set up your centre", body: "RYA defaults are in place from the start. A guided set-up imports your courses and staff." },
              { n: "2", title: "Build the week", body: "Drop courses on the calendar. Staff, ratios and safety cover are checked as you go." },
              { n: "3", title: "Run the season", body: "Staff confirm shifts, swap, pick up cover and book leave in the app. Hours flow to payroll." },
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

      {/* Demo band */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-navy">See it before you speak to anyone</h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">Step through the office and the instructor app at a busy centre in mid-July. Real screens, made-up centre.</p>
          <Link href="/demo" className="mt-6 inline-block rounded-lg bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-700">
            Take the tour
          </Link>
        </div>
      </section>

      {/* Quote */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center md:py-16">
          <p className="font-display text-2xl font-semibold leading-snug text-navy" style={{ textWrap: "balance" }}>
            No more Saturday-morning scramble to check who&apos;s ticketed and who&apos;s on safety boat.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">The checks happen when you build the roster, so the morning is about the water, not the paperwork.</p>
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
              { href: "/guides", icon: Newspaper, title: "Sailing school guides", body: "Ratios, safety cover, qualifications and a free rota template." },
              { href: "/pricing", icon: Tag, title: "Pricing", body: "Two flat plans, nothing per user. First month free." },
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
            <p className="mt-3 text-white/80">Your centre is created in seconds with the RYA defaults in place. A guided set-up does the rest, and we&apos;re happy to walk you through it.</p>
            <ul className="mt-5 space-y-2 text-white/85">
              {["No card required, cancel any time", "From £35 a month afterwards, nothing per user", "Hosted in the EU, export your data whenever you like"].map((x) => (
                <li key={x} className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-[#4fd1c5]" />{x}</li>
              ))}
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
              ["Where is data stored?", "In the EU. Certificates are held privately and encrypted; DBS, PVG, AccessNI and Garda checks are recorded by status and reference only, so the certificate itself is never stored."],
              ["Which jurisdictions are supported?", "England, Wales, Scotland, Northern Ireland and Ireland — DBS, PVG, AccessNI or Garda vetting set up automatically."],
              ["Can we tailor it to how we run?", "Yes. Grades, roles, checks, session times and course types are all yours to edit."],
              ["Do our instructors need to install anything?", "They get the instructor app on their phone for shifts, availability, swaps, hours and documents. It also works in any phone browser, so nobody is left out."],
              ["We have under-18 assistants. Is that covered?", "Yes. Their hours are checked against the legal limits for their age, their contact details stay private, and a parent or guardian can be given a read-only view of their roster."],
              ["Can we bring our existing schedule across?", "Yes. Import courses and staff from a spreadsheet or calendar, check what was read, then save. Most centres are set up in an afternoon."],
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
