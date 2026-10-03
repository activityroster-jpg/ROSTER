import Link from "next/link";
import { Check } from "lucide-react";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { fmtMoney, comparisonRow, COMPETITOR_PRICING, ON_SITE_DAY_PRICE } from "@/lib/pricing";
import { TIERS, TIER_ORDER } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing — ActivityRoster",
  description:
    "Simple flat pricing per centre — no per-user fees. Small Club £35/mo (up to 10) or Standard £65/mo unlimited, plus an optional done-for-you custom build. Cheaper than per-user tools for volunteer-heavy RYA centres.",
  alternates: { canonical: "/pricing" },
};

const INCLUDED = [
  "Scheduling & rostering with RYA ratio + safety-cover checks built in",
  "Youth & adult courses kept cleanly separate throughout",
  "Time & attendance — clock in/out, auto timesheets",
  "Availability, leave & open-shift cover",
  "Cert, ticket & vetting tracking with expiry alerts",
  "Staff HR, onboarding & encrypted document vault",
  "Printable weekly roster (PDF) & payroll-ready hours export",
  "Import your existing courses from a spreadsheet or calendar",
  "Instructor app with clock-in, leave & notifications",
  "Hosted on Cloudflare (EU), UK GDPR-ready, export any time — strictly isolated per centre",
];

const SETUP_INCLUDED = [
  "A kick-off call to understand exactly how your centre runs",
  "We tailor the platform to your way of working — your courses, grades, roles, ratios, checks and session times, set up your way",
  "Custom features and tweaks built around what you actually need — tell us how you want it and we'll make it work like that",
  "We import your existing schedule, staff and tickets from your spreadsheets",
  "We invite your instructors and set up availability & the weekly roster",
  "A walk-through so you and your team are confident from day one",
];

// Travel to run the custom build on site with the centre's team (recommended).
const ON_SITE_TRAVEL = ON_SITE_DAY_PRICE;

// Names of the per-user platforms we compare against (for the intro copy).
const COMPETITOR_NAMES = COMPETITOR_PRICING.map((c) => c.name);
const COMPETITOR_NAMES_AND =
  COMPETITOR_NAMES.slice(0, -1).join(", ") + " and " + COMPETITOR_NAMES[COMPETITOR_NAMES.length - 1];

export default async function PricingPage() {
  let currency = "GBP", freeFirstMonth = true;
  let setupPrice = 850, setupEnabled = true;
  try {
    const p = await new PlatformRepository(await getDb()).getPricing();
    currency = p.currency; freeFirstMonth = Boolean(p.freeFirstMonth);
    setupPrice = p.setupPrice; setupEnabled = Boolean(p.setupEnabled);
  } catch {
    // fall back to defaults if pricing can't be read at render time
  }

  const smallClub = TIERS.small_club;
  const standard = TIERS.standard;
  const smallClubCap = smallClub.userCap ?? 10;
  // Headcounts where our flat price beats every named competitor. The first row
  // is the Small Club tier at its cap (still cheapest even at 10 people); the
  // rest are Standard, where the gap widens fast as volunteers are counted.
  const rows = [
    comparisonRow(smallClubCap, smallClub.monthlyPrice, smallClub.name),
    comparisonRow(20, standard.monthlyPrice, standard.name),
    comparisonRow(25, standard.monthlyPrice, standard.name),
    comparisonRow(30, standard.monthlyPrice, standard.name),
    comparisonRow(40, standard.monthlyPrice, standard.name),
  ];
  const biggest = rows[rows.length - 1]!;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Pricing</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">One flat price for your whole centre</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">
          No per-user fees — every instructor and volunteer included.{" "}
          {freeFirstMonth ? "Start with a free month — no card required." : "Cancel anytime."}
        </p>
      </div>

      {/* Plans */}
      <div className={`mt-10 grid gap-6 ${setupEnabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {TIER_ORDER.map((tid) => {
          const t = TIERS[tid];
          const popular = tid === "standard";
          const annualSaving = Math.max(0, t.monthlyPrice * 12 - t.annualPrice);
          const monthsFree = t.monthlyPrice > 0 ? Math.round(annualSaving / t.monthlyPrice) : 0;
          return (
            <div
              key={tid}
              className={`relative overflow-hidden rounded-card border shadow-sm ${popular ? "border-teal shadow-lg" : "border-slate-200"}`}
            >
              {popular ? (
                <div className="bg-navy px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  Most popular · unlimited team
                </div>
              ) : null}
              <div className="p-7">
                <h2 className="font-display text-xl font-bold text-navy">{t.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>
                <p className="mt-4">
                  <span className="font-display text-4xl font-bold text-navy">{fmtMoney(t.monthlyPrice, currency)}</span>
                  <span className="ml-1 text-slate-500">/month</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  or {fmtMoney(t.annualPrice, currency)}/year{monthsFree > 0 ? ` — ${monthsFree} months free` : ""}
                </p>
                <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {t.userCap ? `Up to ${t.userCap} people on your team` : "Unlimited instructors & volunteers"}
                </p>
                <a
                  href="/#get-demo"
                  className={`mt-6 block rounded-lg px-6 py-3 text-center font-semibold transition ${popular ? "bg-teal text-white hover:bg-teal-700" : "border border-teal text-teal hover:bg-teal/5"}`}
                >
                  {freeFirstMonth ? "Start my free month" : "Get started"}
                </a>
              </div>
            </div>
          );
        })}

        {/* Custom platform — done-for-you build (replaces the standalone setup offer) */}
        {setupEnabled ? (
          <div className="relative overflow-hidden rounded-card border border-amber/60 shadow-sm">
            <div className="bg-amber-500 px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide text-navy">
              Done for you · recommended
            </div>
            <div className="p-7">
              <h2 className="font-display text-xl font-bold text-navy">Custom platform</h2>
              <p className="mt-1 text-sm text-slate-500">We build and tailor it around exactly how your centre runs.</p>
              <p className="mt-4">
                <span className="font-display text-4xl font-bold text-navy">from {fmtMoney(setupPrice, currency)}</span>
                <span className="ml-1 text-slate-500">setup</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">+ {fmtMoney(ON_SITE_TRAVEL, currency)} travel to work with your team on site (recommended)</p>
              <p className="mt-1 text-sm text-slate-500">then {fmtMoney(standard.monthlyPrice, currency)}/month</p>
              <p className="mt-3 inline-flex rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-amber-700">
                Unlimited team · everything set up for you
              </p>
              <Link
                href="/contact"
                className="mt-6 block rounded-lg bg-amber-500 px-6 py-3 text-center font-semibold text-navy transition hover:bg-amber-400"
              >
                Talk to us about custom
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Every plan includes everything below. On Small Club you can add up to {TIERS.small_club.userCap} people;
        when your team grows, upgrade to Standard for unlimited instructors and volunteers in a click.
      </p>

      {/* Everything included (shared) */}
      <div className="mt-10 overflow-hidden rounded-card border border-slate-200 shadow-sm">
        {freeFirstMonth ? (
          <div className="bg-navy px-6 py-3 text-center text-sm font-semibold text-white">🎉 First month free · no card required</div>
        ) : null}
        <div className="p-7">
          <p className="mb-3 text-sm font-semibold text-navy">Everything included, on both plans:</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 flex-none text-starboard" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-slate-500">
            No card required · cancel anytime · your own address at yourclub.activityroster.com ·{" "}
            <Link href="/learn?topic=plans" className="font-semibold text-teal hover:underline">📖 Read the guide</Link>
          </p>
        </div>
      </div>

      {/* Competitor savings */}
      <div className="mt-12 overflow-hidden rounded-card border border-starboard/40 bg-starboard/5 shadow-sm">
        <div className="p-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-starboard">Flat price vs the per-user platforms</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-navy">Cheaper than the per-user platforms — at every size</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            {COMPETITOR_NAMES_AND} charge per user. A centre rosters everyone — instructors, safety-boat cover, shore
            crew, volunteers — so per-seat pricing bills your whole volunteer base. One flat price per centre comes out
            cheaper at every size.{" "}
            <Link href="/compare" className="font-semibold text-teal hover:underline">Full comparison →</Link>
          </p>

          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Team size (incl. volunteers)</th>
                  {COMPETITOR_NAMES.map((n) => (
                    <th key={n} className="px-4 py-3 whitespace-nowrap">{n}</th>
                  ))}
                  <th className="px-4 py-3 whitespace-nowrap bg-starboard/10 text-navy">ActivityRoster</th>
                  <th className="px-4 py-3">You save per year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.people}>
                    <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">{r.people} people</td>
                    {r.competitors.map((c) => (
                      <td key={c.name} className={`px-4 py-3 ${c.monthly === r.cheapestRival ? "text-slate-700" : "text-slate-500"}`}>
                        {fmtMoney(c.monthly, currency)}/mo
                      </td>
                    ))}
                    <td className="px-4 py-3 font-semibold text-navy whitespace-nowrap bg-starboard/10">
                      {fmtMoney(r.ours, currency)}/mo
                      <span className="block text-[11px] font-normal text-slate-500">{r.plan}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-starboard whitespace-nowrap">
                      {r.save > 0 ? (
                        <>
                          {fmtMoney(r.save * 12, currency)}/yr
                          <span className="block text-[11px] font-normal text-slate-500">{fmtMoney(r.save, currency)}/mo · {r.pct}% less</span>
                        </>
                      ) : "Cheapest"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Even at {smallClubCap} people our Small Club plan comes in under all four; a {biggest.people}-person centre would
            pay from {fmtMoney(biggest.cheapestRival, currency)} a month on a per-seat tool — with us it&apos;s still just{" "}
            {fmtMoney(standard.monthlyPrice, currency)}. &ldquo;You save&rdquo; is measured against the cheapest of the four.
          </p>
          <p className="mt-2 text-xs italic text-slate-400">
            Competitor prices are estimates for feature-comparable paid tiers (scheduling, time &amp; attendance and leave)
            and may be out of date — check each provider&apos;s current pricing. Figures are illustrative; providers
            typically range from about £2 to £6 per user per month.
          </p>
        </div>
      </div>

      {setupEnabled ? (
        <div className="mt-10 overflow-hidden rounded-card border border-amber/60 bg-amber/5 shadow-sm">
          <div className="p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Custom platform · recommended</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-navy">What the done-for-you build includes</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              We build the platform around how your centre runs:{" "}
              <strong className="text-navy">from {fmtMoney(setupPrice, currency)} setup</strong>, plus{" "}
              <strong className="text-navy">{fmtMoney(ON_SITE_TRAVEL, currency)} travel</strong> to work with your team
              on site (recommended), then {fmtMoney(standard.monthlyPrice, currency)}/month.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {SETUP_INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/contact" className="mt-6 inline-block rounded-lg bg-amber-500 px-6 py-3 text-center font-semibold text-navy transition hover:bg-amber-400">
              Talk to us about a custom build
            </Link>
          </div>
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm text-slate-500">
        Prefer to set things up yourself? The platform is designed to be quick to get going, and{" "}
        <Link href="/learn" className="font-semibold text-teal hover:underline">the Learning Centre</Link> walks you
        through every step — or <Link href="/contact" className="font-semibold text-teal hover:underline">talk to us</Link>.
      </p>
    </div>
  );
}
