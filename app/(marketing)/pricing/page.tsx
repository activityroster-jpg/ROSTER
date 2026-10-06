import Link from "next/link";
import { Check } from "lucide-react";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { fmtMoney, comparisonRow, COMPETITOR_PRICING, ON_SITE_DAY_PRICE } from "@/lib/pricing";
import { TIERS, TIER_ORDER } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing",
  description:
    "Simple flat pricing per centre — no per-user fees. Small Club £35/mo (up to 10) or Standard £65/mo unlimited, plus an optional done-for-you custom build. Cheaper than per-user tools for volunteer-heavy RYA centres.",
  alternates: { canonical: "/pricing" },
};

const INCLUDED = [
  "Roster builder with RYA ratio, ticket and safety-cover checks on every assignment",
  "Instructor app: shifts, availability, swaps, leave, hours and documents",
  "Certificate and vetting tracking (DBS, PVG, AccessNI, Garda) with expiry reminders",
  "Young workers' hours checked by age; parent and guardian read-only view",
  "Roles for admins, senior instructors and a welfare officer",
  "Printable day-by-day roster PDF in your choice of layout",
  "Emergency sheet and young-worker register for the duty officer",
  "Leave, cover and open shifts; hours and payroll export",
  "Import your courses and staff from a spreadsheet or calendar",
  "Hosted in the EU, strictly isolated per centre, export your data any time",
]

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

      {/* Plans. Every card has the same skeleton (band, name, tagline, price label,
          price, sub-line, badge, button pinned to the bottom) so the prices and
          buttons line up across the row on desktop. On phones the popular plan
          comes first. */}
      <div className={`mt-10 grid items-stretch gap-6 ${setupEnabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {TIER_ORDER.map((tid) => {
          const t = TIERS[tid];
          const popular = tid === "standard";
          const annualSaving = Math.max(0, t.monthlyPrice * 12 - t.annualPrice);
          const monthsFree = t.monthlyPrice > 0 ? Math.round(annualSaving / t.monthlyPrice) : 0;
          return (
            <div
              key={tid}
              className={`relative flex flex-col overflow-hidden rounded-card border bg-white shadow-sm ${popular ? "order-first border-teal shadow-lg ring-1 ring-teal md:order-none" : "border-slate-200"}`}
            >
              <div className={`px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide ${popular ? "bg-navy text-white" : "bg-slate-100 text-slate-500"}`}>
                {popular ? "Most popular · unlimited team" : `For teams up to ${t.userCap ?? smallClubCap}`}
              </div>
              <div className="flex flex-1 flex-col p-7">
                <h2 className="font-display text-xl font-bold text-navy">{t.name}</h2>
                <p className="mt-1 text-sm text-slate-500 md:min-h-[2.5rem]">{t.tagline}</p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold leading-none text-navy">{fmtMoney(t.monthlyPrice, currency)}</span>
                  <span className="text-slate-500">/month</span>
                </p>
                <p className="mt-2 text-sm text-slate-500 md:min-h-[2.5rem]">
                  or {fmtMoney(t.annualPrice, currency)} a year{monthsFree > 0 ? `, ${monthsFree} month${monthsFree === 1 ? "" : "s"} free` : ""}
                </p>
                <p className="mt-3 inline-flex self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {t.userCap ? `Up to ${t.userCap} people on your team` : "Unlimited instructors & volunteers"}
                </p>
                {t.userCap ? null : <Link href="/terms#fair-use" className="mt-1.5 self-start text-xs text-slate-500 underline hover:text-navy">Fair use applies</Link>}
                <div className="mt-auto pt-6">
                  <a
                    href="/#get-demo"
                    className={`block rounded-lg px-6 py-3 text-center font-semibold transition ${popular ? "bg-teal text-white hover:bg-teal-700" : "border border-teal text-teal hover:bg-teal/5"}`}
                  >
                    {freeFirstMonth ? "Start my free month" : "Get started"}
                  </a>
                  <p className="mt-2 text-center text-xs text-slate-400">{freeFirstMonth ? "No card needed" : "Cancel anytime"}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Custom platform: done-for-you build */}
        {setupEnabled ? (
          <div className="relative flex flex-col overflow-hidden rounded-card border border-amber/50 bg-white shadow-sm">
            <div className="bg-amber/15 px-6 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber">
              Done for you
            </div>
            <div className="flex flex-1 flex-col p-7">
              <h2 className="font-display text-xl font-bold text-navy">Custom platform</h2>
              <p className="mt-1 text-sm text-slate-500 md:min-h-[2.5rem]">We set it up and tailor it around exactly how your centre runs.</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">One-off setup, from</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold leading-none text-navy">{fmtMoney(setupPrice, currency)}</span>
                <span className="text-slate-500">setup</span>
              </p>
              <p className="mt-2 text-sm text-slate-500 md:min-h-[2.5rem]">
                then {fmtMoney(standard.monthlyPrice, currency)}/month · optional {fmtMoney(ON_SITE_TRAVEL, currency)} on-site day
              </p>
              <p className="mt-3 inline-flex self-start rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-amber">
                Unlimited team · set up for you
              </p>
              <Link href="/terms#fair-use" className="mt-1.5 self-start text-xs text-slate-500 underline hover:text-navy">Fair use applies</Link>
              <div className="mt-auto pt-6">
                <Link
                  href="/contact"
                  className="block rounded-lg border border-navy px-6 py-3 text-center font-semibold text-navy transition hover:bg-navy hover:text-white"
                >
                  Talk to us
                </Link>
                <p className="mt-2 text-center text-xs text-slate-400">We reply within a working day</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Both plans include everything below. Outgrow {TIERS.small_club.userCap} people on Small Club and you can move to
        Standard in a click; nothing you have set up changes.
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
            {COMPETITOR_NAMES_AND} charge per user. A centre rosters everyone (instructors, safety-boat cover, shore
            crew, volunteers), so per-seat pricing bills your whole volunteer base. One flat price per centre comes out
            cheaper at every size.{" "}
            <Link href="/compare" className="font-semibold text-teal hover:underline">Full comparison →</Link>
          </p>

          {/* Phones: one compact row per team size. */}
          <ul className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white md:hidden">
            {rows.map((r) => (
              <li key={r.people} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-navy">{r.people} people</p>
                  <p className="text-xs text-slate-500">Per-user tools from {fmtMoney(r.cheapestRival, currency)}/mo</p>
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap font-semibold text-navy">{fmtMoney(r.ours, currency)}/mo</p>
                  <p className="text-xs text-slate-400">{r.plan}</p>
                  <p className="text-xs font-semibold text-starboard">{r.save > 0 ? `Save ${fmtMoney(r.save * 12, currency)} a year` : "Cheapest"}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
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
            <p className="text-sm font-semibold uppercase tracking-wide text-amber">Custom platform</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-navy">What the done-for-you build includes</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              We build the platform around how your centre runs:{" "}
              <strong className="text-navy">from {fmtMoney(setupPrice, currency)} setup</strong>, then{" "}
              {fmtMoney(standard.monthlyPrice, currency)}/month. Add an on-site day with your team for{" "}
              {fmtMoney(ON_SITE_TRAVEL, currency)} if you would like us there in person.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {SETUP_INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-amber" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/contact" className="mt-6 inline-block rounded-lg border border-navy px-6 py-3 text-center font-semibold text-navy transition hover:bg-navy hover:text-white">
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
