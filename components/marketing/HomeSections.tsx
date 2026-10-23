import Link from "next/link";
import { AlertTriangle, Anchor, ArrowRight, BookOpen, CalendarCheck, CalendarOff, ClipboardCheck, Clock, FileCheck, FileText, GitCompare, KeyRound, LifeBuoy, Newspaper, ShieldCheck, Ship, Smartphone, Sparkles, Tag, Upload, Users, Wallet, Waves } from "lucide-react";
import { TIER_ORDER, TIERS } from "@/lib/tiers";

/**
 * The marketing site's building blocks, shared by the home page (the short
 * version: hero, three steps, the platform grid, proof, pricing, FAQ) and
 * /features (everything else: disciplines, who it's for, the photo bands).
 */

// The full platform, one line each, in the order a centre manager cares about.
// Keep this in step with what is built (and with INCLUDED on the pricing page).
export const PLATFORM = [
  { icon: CalendarCheck, title: "Roster builder", body: "Build the week; every assignment is checked for the right instructor type and availability, with licence, ratio and clash checks you can switch on. Each session shows who is on and what is still open." },
  { icon: Sparkles, title: "Auto-roster", body: "One click fills every open role from who's free, shared out evenly. Not enough people? It fills what it can and shows you the gaps." },
  { icon: Smartphone, title: "Instructor app", body: "Shifts, availability, open shifts, hours and documents on their phone, with notifications." },
  { icon: FileCheck, title: "Certs & vetting", body: "Every RYA licence, first aid and DBS/PVG/AccessNI/Garda check, with expiry reminders." },
  { icon: Clock, title: "Hours at a glance", body: "Each person's rostered hours for the week, beside their name on the roster and the availability sheet." },
  { icon: KeyRound, title: "Access for your team", body: "Office admins see only the parts you tick for them; instructors see their own shifts; welfare officers on duty show on the roster." },
  { icon: FileText, title: "Printable roster", body: "A day-by-day PDF in the layout you choose, ready for the noticeboard." },
  { icon: LifeBuoy, title: "Emergency sheet", body: "Today's staff and emergency contacts on one page for the duty officer." },
  { icon: CalendarOff, title: "Leave & cover", body: "Staff ask in the app; you approve in a tap and open the gap to the team." },
  { icon: Clock, title: "Hours & payroll", body: "Hours from the roster (or the optional clock), times pay rates by the hour, session, day or student, exported monthly." },
  { icon: Upload, title: "Import in minutes", body: "Bring your courses and staff across from a spreadsheet or calendar." },
  { icon: ClipboardCheck, title: "Audit trail & GDPR tools", body: "Every change logged; export, restrict or anonymise a person's data in a click." },
];

export const SAFETY = [
  { icon: ShieldCheck, title: "Make the key checks mandatory", body: "Mark first aid, safeguarding or vetting as mandatory and anyone lapsed can't be assigned without a recorded override." },
  { icon: Users, title: "Ratio-aware", body: "Flags a course the moment it's short of instructors." },
  { icon: LifeBuoy, title: "The right instructor in every place", body: "Each place is an instructor type: an AI never fills a DI place, and a session with no Senior Instructor on duty is flagged. Overrides are recorded." },
  { icon: AlertTriangle, title: "Nothing lapses quietly", body: "Expiry alerts on every licence and check." },
  { icon: CalendarCheck, title: "Clash detection", body: "Double-booked instructor or boat? Caught instantly." },
  { icon: Wallet, title: "Hours & pay, done", body: "Scheduled vs actual, exported for payroll." },
];

const AUDIENCES = [
  { icon: Anchor, title: "Yacht clubs", body: "Volunteer rosters for training, racing and duties, without the committee spreadsheet." },
  { icon: Ship, title: "Sailing schools", body: "Back-to-back RYA courses, a big freelance pool, every licence tracked." },
  { icon: Waves, title: "Activity centres", body: "Dinghy, windsurf, powerboat and kayak — one roster, one compliance picture." },
];

export const PHOTOS = {
  hero: "/photos/sailing-hero.jpg",
  keelboat: "/photos/keelboat.jpg",
  catamarans: "/photos/catamarans.jpg",
  kayaks: "/photos/kayaks.jpg",
  instructors: "/photos/instructors.jpg",
  deck: "/photos/deck.jpg",
  marina: "/photos/marina.jpg",
};

export function PhotoBand({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
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

export function DisciplineGallery() {
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

/** The whole platform, one card each. `more` adds the link to /features (on the home page) or /compare (on /features). */
export function PlatformGrid({ more }: { more: "features" | "compare" }) {
  return (
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
          {more === "features"
            ? <Link href="/features" className="font-semibold text-teal hover:underline">Everything it does, who it&apos;s for and every discipline →</Link>
            : <Link href="/compare" className="font-semibold text-teal hover:underline">See how it compares with what you use today →</Link>}
        </p>
      </div>
    </section>
  );
}

export function Audiences() {
  return (
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
  );
}

export function Quote() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 text-center md:py-16">
        <p className="font-display text-2xl font-semibold leading-snug text-navy" style={{ textWrap: "balance" }}>
          No more Saturday-morning scramble to check who&apos;s qualified and who&apos;s on safety boat.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">The checks happen when you build the roster, so the morning is about the water, not the paperwork.</p>
      </div>
    </section>
  );
}

export function ExploreMore() {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">Take a closer look</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { href: "/compare", icon: GitCompare, title: "Compare", body: "Against the tools centres use today." },
            { href: "/learn", icon: BookOpen, title: "Learning Centre", body: "Guides to every part of the platform." },
            { href: "/guides", icon: Newspaper, title: "Sailing school guides", body: "Ratios, supervision, qualifications and a free rota template." },
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
  );
}

/** The two plans in one line each (prices from lib/tiers, the same source as /pricing). */
export function PricingTeaser() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">Two flat plans, nothing per user</h2>
            <p className="mt-2 max-w-2xl text-slate-600">Free for a month, no card. Then one price for the whole centre, however many instructors use the app.</p>
          </div>
          <Link href="/pricing" className="font-semibold text-teal hover:underline">Full pricing and what&apos;s included →</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {TIER_ORDER.map((id) => {
            const t = TIERS[id];
            return (
              <Link key={id} href={`/start?plan=${id}&src=home`} className="group rounded-card border border-slate-200 p-5 transition hover:border-teal hover:shadow-sm">
                <p className="font-display text-lg font-semibold text-navy">{t.name}</p>
                <p className="mt-1 text-3xl font-bold text-navy">£{t.monthlyPrice}<span className="text-base font-normal text-slate-500"> a month</span></p>
                <p className="mt-1 text-sm text-slate-600">{t.tagline}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-teal group-hover:underline">Start my free month →</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
