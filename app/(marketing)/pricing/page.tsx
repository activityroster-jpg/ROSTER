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
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Pricing</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">One flat price for your whole centre</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">
          No per-user fees. Add every instructor and volunteer for one simple price.{" "}
          {freeFirstMonth ? "Start with a free month — no card required." : "Cancel anytime."}
        </p>
      </div>

      {/* Two tiers */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
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
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Both plans include everything below. On Small Club you can add up to {TIERS.small_club.userCap} people;
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
          <p className="text-sm font-semibold uppercase tracking-wide text-starboard">Flat price vs per-user tools</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-navy">The bigger your team, the more you save</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Most rostering tools charge per user, around {fmtMoney(PER_USER_BENCHMARK, currency)} a head every month. RYA
            centres roster everyone who runs sessions — senior and assistant instructors, powerboat cover, shore crew and
            volunteers — so per-seat tools bill for your whole volunteer base. Our Standard plan is{" "}
            <strong className="text-navy">{fmtMoney(standard.monthlyPrice, currency)} flat</strong>, however many people you add.
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Team size (incl. volunteers)</th>
                  <th className="px-4 py-3">Per-user tools (~{fmtMoney(PER_USER_BENCHMARK, currency)}/head)</th>
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
            Illustrative, based on a typical per-user price of {fmtMoney(PER_USER_BENCHMARK, currency)}/user/month (tools vary ≈ £2–£6).
            A {biggest.people}-person centre would pay{" "}
            {fmtMoney(biggest.theirs, currency)} a month on a per-seat tool — with us it&apos;s still just{" "}
            {fmtMoney(standard.monthlyPrice, currency)}.
          </p>
        </div>
      </div>

      {setupEnabled ? (
        <div className="mt-10 overflow-hidden rounded-card border border-amber/60 bg-amber/5 shadow-sm">
          <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
            <div className="p-7">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Optional · done for you</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-navy">We&apos;ll set it up and customise it exactly how you want</h2>
              <p className="mt-2 text-slate-600">
                Short on time, or want it just so? For a one-off fee we&apos;ll build the platform around exactly how your
                centre runs — tailoring the setup, adding the custom features and tweaks you ask for, importing your data,
                and handing it over ready to go. Tell us how you want it to work and we&apos;ll make it work like that.
                After that you simply continue on the normal plan.
              </p>
              <ul className="mt-4 grid gap-2">
                {SETUP_INCLUDED.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center border-t border-amber/40 bg-white p-7 text-center md:border-l md:border-t-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">One-off setup</p>
              <p className="mt-2"><span className="font-display text-4xl font-bold text-navy">{fmtMoney(setupPrice, currency)}</span></p>
              <p className="mt-1 text-sm text-slate-500">Single payment · then the normal plan</p>
              <a href="/api/billing/setup" className="mt-5 block rounded-lg bg-amber-500 px-6 py-3 text-center font-semibold text-navy transition hover:bg-amber-400">
                Get done-for-you setup
              </a>
              <Link href="/#get-demo" className="mt-2 text-xs font-semibold text-teal hover:underline">
                Questions first? Talk to us
              </Link>
            </div>
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
