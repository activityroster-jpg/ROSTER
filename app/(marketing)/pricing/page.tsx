import Link from "next/link";
import { Check } from "lucide-react";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { fmtMoney } from "@/lib/pricing";

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
  "EU-hosted, GDPR-ready, data export any time — data strictly isolated per centre",
];

const SETUP_INCLUDED = [
  "A kick-off call to understand exactly how your centre runs",
  "We tailor the platform to your way of working — your courses, grades, roles, ratios, checks and session times, set up your way",
  "Custom features and tweaks built around what you actually need — tell us how you want it and we'll make it work like that",
  "We import your existing schedule, staff and tickets from your spreadsheets",
  "We invite your instructors and set up availability & the weekly rota",
  "A walk-through so you and your team are confident from day one",
];

export default async function PricingPage() {
  let monthly = 75, annual = 675, currency = "GBP", freeFirstMonth = true;
  let setupPrice = 850, setupEnabled = true;
  try {
    const p = await new PlatformRepository(await getDb()).getPricing();
    monthly = p.monthlyPrice; annual = p.annualPrice; currency = p.currency; freeFirstMonth = Boolean(p.freeFirstMonth);
    setupPrice = p.setupPrice; setupEnabled = Boolean(p.setupEnabled);
  } catch {
    // fall back to defaults if pricing can't be read at render time
  }
  const savings = Math.max(0, monthly * 12 - annual);
  const monthsFree = monthly > 0 ? Math.round(savings / monthly) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Pricing</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">One simple plan</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">
          Everything in the platform, for your whole centre. {freeFirstMonth ? "Start with a free month — no card required — then keep it only if it's earning its place." : "Cancel anytime."}
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-card border border-teal shadow-lg">
        {freeFirstMonth ? (
          <div className="bg-navy px-6 py-3 text-center text-sm font-semibold text-white">🎉 First month free · no card required</div>
        ) : null}
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="border-b border-slate-200 p-7 text-center sm:border-b-0 sm:border-r">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Monthly</p>
            <p className="mt-2"><span className="font-display text-4xl font-bold text-navy">{fmtMoney(monthly, currency)}</span><span className="ml-1 text-slate-500">/month</span></p>
            <p className="mt-1 text-sm text-slate-500">Billed monthly · cancel anytime</p>
          </div>
          <div className="relative p-7 text-center">
            {monthsFree > 0 ? <span className="absolute right-4 top-4 rounded-full bg-starboard/15 px-2.5 py-0.5 text-xs font-semibold text-starboard">{monthsFree} month{monthsFree === 1 ? "" : "s"} free</span> : null}
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Yearly</p>
            <p className="mt-2"><span className="font-display text-4xl font-bold text-navy">{fmtMoney(annual, currency)}</span><span className="ml-1 text-slate-500">/year</span></p>
            <p className="mt-1 text-sm text-slate-500">{savings > 0 ? `Save ${fmtMoney(savings, currency)}${monthsFree > 0 ? ` — that's ${monthsFree} month${monthsFree === 1 ? "" : "s"} free` : ""}` : "Billed annually"}</p>
          </div>
        </div>

        <div className="border-t border-slate-200 p-7">
          <p className="mb-3 text-sm font-semibold text-navy">Everything included:</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 flex-none text-starboard" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <a href="/#get-demo" className="mt-7 block rounded-lg bg-teal px-6 py-3 text-center font-semibold text-white transition hover:bg-teal-700">
            Start my free month
          </a>
          <p className="mt-2 text-center text-xs text-slate-500">No card required · cancel anytime · your own address at yourclub.activityroster.com</p>
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
