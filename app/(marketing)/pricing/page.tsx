import Link from "next/link";
import { Check } from "lucide-react";

const INCLUDED = [
  "Scheduling & rostering with compliance checks built in",
  "Time & attendance — clock in/out, auto timesheets",
  "Availability, leave & open-shift cover",
  "Licence, ticket & vetting tracking with expiry alerts",
  "Staff HR, onboarding & encrypted document vault",
  "Bookings, revenue and labour-cost reporting",
  "Payroll-ready hours export (CSV)",
  "Instructor app with clock-in, leave & notifications",
  "EU-hosted, GDPR-ready, data export any time",
  "Every centre's data strictly isolated",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Pricing</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">One simple plan</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600">
          Everything in the platform, for your whole centre. Start with a free month — no card required — then keep it
          only if it&apos;s earning its place.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-card border border-teal shadow-lg">
        <div className="bg-navy px-6 py-3 text-center text-sm font-semibold text-white">
          🎉 First month free · no card required
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {/* Monthly */}
          <div className="border-b border-slate-200 p-7 text-center sm:border-b-0 sm:border-r">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Monthly</p>
            <p className="mt-2"><span className="font-display text-4xl font-bold text-navy">£75</span><span className="ml-1 text-slate-500">/month</span></p>
            <p className="mt-1 text-sm text-slate-500">Billed monthly · cancel anytime</p>
          </div>
          {/* Annual */}
          <div className="relative p-7 text-center">
            <span className="absolute right-4 top-4 rounded-full bg-starboard/15 px-2.5 py-0.5 text-xs font-semibold text-starboard">2 months free</span>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Yearly</p>
            <p className="mt-2"><span className="font-display text-4xl font-bold text-navy">£750</span><span className="ml-1 text-slate-500">/year</span></p>
            <p className="mt-1 text-sm text-slate-500">Save £150 — that&apos;s 2 months free</p>
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
          <a
            href="/#get-demo"
            className="mt-7 block rounded-lg bg-teal px-6 py-3 text-center font-semibold text-white transition hover:bg-teal-700"
          >
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
