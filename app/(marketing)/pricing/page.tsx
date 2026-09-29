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

export default async function PricingPage() {
  let monthly = 75, annual = 675, currency = "GBP", freeFirstMonth = true;
  try {
    const p = await new PlatformRepository(await getDb()).getPricing();
    monthly = p.monthlyPrice; annual = p.annualPrice; currency = p.currency; freeFirstMonth = Boolean(p.freeFirstMonth);
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

      <p className="mt-8 text-center text-sm text-slate-500">
        Need help getting set up or migrating your spreadsheets?{" "}
        <Link href="/#get-demo" className="font-semibold text-teal hover:underline">Talk to us</Link> — onboarding help is available.
      </p>
    </div>
  );
}
