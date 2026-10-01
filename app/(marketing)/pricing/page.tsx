import Link from "next/link";
import { Check } from "lucide-react";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { fmtMoney, tierSaving, PER_USER_BENCHMARK } from "@/lib/pricing";
import { TIERS, TIER_ORDER } from "@/lib/tiers";

export const dynamic = "force-dynamic";

const INCLUDED = [
  "Scheduling & rostering with RYA ratio + safety-cover checks built in",
  "Youth & adult courses kept cleanly separate throughout",
  "Time & attendance — clock in/out, auto timesheets",
  "Availability, leave & open-shift cover",
  "Licence, ticket & vetting tracking with expiry alerts",
  "Staff HR, onboarding & encrypted document vault",
  "Printable weekly rota (PDF) & payroll-ready hours export",
  "Import your existing courses from a spreadsheet or calendar",
  "Instructor app with clock-in, leave & notifications",
  "Hosted on Cloudflare (EU), UK GDPR-ready, export any time — strictly isolated per centre",
];

const SETUP_INCLUDED = [
  "A kick-off call to understand exactly how your centre runs",
  "We tailor the platform to your way of working — your courses, grades, roles, ratios, checks and session times, set up your way",
  "Custom features and tweaks built around what you actually need — tell us how you want it and we'll make it work like that",
  "We import your existing schedule, staff and tickets from your spreadsheets",
  "We invite your instructors and set up availability & the weekly rota",
  "A walk-through so you and your team are confident from day one",
];

// Team sizes (volunteers included) where a flat price clearly beats per-seat
// pricing. RYA centres roster everyone who runs sessions, so real headcount sits
// well above the paid core — and a per-user tool bills every one of them.
const COMPARE_HEADCOUNTS = [15, 20, 25, 30, 40];

// Travel to run the custom build on site with the centre's team (recommended).
const ON_SITE_TRAVEL = 350;

// The per-user scheduling platforms we compare against on /compare. These price
// per user per month, so a volunteer-heavy centre pays for every seat.
const PER_USER_COMPETITORS = "Deputy, When I Work, RotaCloud and Planday";

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

  const standard = TIERS.standard;
  const rows = COMPARE_HEADCOUNTS.map((n) => tierSaving(n, standard.monthlyPrice));
  const biggest = rows[rows.length - 1]!; // COMPARE_HEADCOUNTS is non-empty

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Pricing</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">One flat price for your whole centre</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">
          No per-user fees. Add every instructor and volunteer for one simple price.{" "}
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
              <a
                href="/#get-demo"
                className="mt-6 block rounded-lg bg-amber-500 px-6 py-3 text-center font-semibold text-navy transition hover:bg-amber-400"
              >
                Talk to us about custom
              </a>
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
          <h2 className="mt-1 font-display text-2xl font-bold text-navy">The bigger your team, the more you save</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Scheduling platforms like {PER_USER_COMPETITORS} charge per user — typically around{" "}
            {fmtMoney(PER_USER_BENCHMARK, currency)} a head every month. RYA centres roster everyone who runs sessions —
            senior and assistant instructors, powerboat cover, shore crew and volunteers — so a per-seat tool bills for
            your whole volunteer base. Our Standard plan is{" "}
            <strong className="text-navy">{fmtMoney(standard.monthlyPrice, currency)} flat</strong>, however many people you
            add. See the <Link href="/compare" className="font-semibold text-teal hover:underline">full comparison</Link>.
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Team size (incl. volunteers)</th>
                  <th className="px-4 py-3">{PER_USER_COMPETITORS.replace(" and ", ", ")} (per user)</th>
                  <th className="px-4 py-3">ActivityRoster (flat)</th>
                  <th className="px-4 py-3">You save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.people}>
                    <td className="px-4 py-3 font-medium text-navy">{r.people} people</td>
                    <td className="px-4 py-3 text-slate-600">{fmtMoney(r.theirs, currency)}/mo</td>
                    <td className="px-4 py-3 text-slate-600">{fmtMoney(r.ours, currency)}/mo</td>
                    <td className="px-4 py-3 font-semibold text-starboard">
                      {r.save > 0 ? `${fmtMoney(r.save, currency)}/mo (${r.pct}% less)` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Illustrative, based on a typical per-user price of {fmtMoney(PER_USER_BENCHMARK, currency)}/user/month
            ({PER_USER_COMPETITORS.replace(" and ", ", ")} vary ≈ £2–£6 per user). A {biggest.people}-person centre would
            pay {fmtMoney(biggest.theirs, currency)} a month on a per-seat tool — with us it&apos;s still just{" "}
            {fmtMoney(standard.monthlyPrice, currency)}.
          </p>
        </div>
      </div>

      {setupEnabled ? (
        <div className="mt-10 overflow-hidden rounded-card border border-amber/60 bg-amber/5 shadow-sm">
          <div className="p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Custom platform · recommended</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-navy">What the done-for-you build includes</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              Want it just so? We&apos;ll build the platform around exactly how your centre runs. It&apos;s{" "}
              <strong className="text-navy">from {fmtMoney(setupPrice, currency)} setup</strong>, plus{" "}
              <strong className="text-navy">{fmtMoney(ON_SITE_TRAVEL, currency)} travel</strong> if we come and work with
              your team on site (recommended) — then you continue on the normal{" "}
              {fmtMoney(standard.monthlyPrice, currency)}/month plan with an unlimited team.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {SETUP_INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a href="/#get-demo" className="mt-6 inline-block rounded-lg bg-amber-500 px-6 py-3 text-center font-semibold text-navy transition hover:bg-amber-400">
              Talk to us about a custom build
            </a>
          </div>
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm text-slate-500">
        Prefer to set things up yourself? The platform is designed to be quick to get going, and{" "}
        <Link href="/learn" className="font-semibold text-teal hover:underline">the Learning Centre</Link> walks you
        through every step — or <Link href="/#get-demo" className="font-semibold text-teal hover:underline">talk to us</Link>.
      </p>
    </div>
  );
}
