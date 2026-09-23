import Link from "next/link";
import { Check } from "lucide-react";

const TIERS = [
  {
    name: "Basic",
    tagline: "Off the shelf. Everything a centre needs to roster compliantly.",
    price: "£55",
    per: "per month",
    setup: null as string | null,
    highlight: false,
    features: [
      "Compliance-aware assignment (blocks under-qualified staff)",
      "Ratio & safety-boat cover checks",
      "Conflict detection with override + audit trail",
      "Licence, ticket & vetting tracking with expiry alerts",
      "Instructor portal (schedule, availability, hours)",
      "Staff hours & pay export (CSV) for payroll",
      "EU-hosted, GDPR-ready, data export any time",
    ],
    cta: "Start my free month",
  },
  {
    name: "Custom",
    tagline: "Tailored to exactly how your centre runs, set up for you.",
    price: "£95",
    per: "per month",
    setup: "£450 one-off setup",
    highlight: true,
    features: [
      "Everything in Basic",
      "We configure your grades, roles, checks & course catalogue",
      "Bespoke session times, jurisdictions & vetting rules",
      "Data migration from your spreadsheets",
      "Onboarding & staff training session",
      "Priority support",
    ],
    cta: "Talk to us about setup",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Pricing</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">Simple pricing, no surprises</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">
          Try it free for a month — no card required. Then pick the plan that suits your centre. Cancel anytime.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-card border bg-white p-7 ${
              tier.highlight ? "border-teal shadow-lg" : "border-slate-200"
            }`}
          >
            {tier.highlight ? (
              <span className="absolute -top-3 left-7 rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            ) : null}
            <h2 className="font-display text-2xl font-semibold text-navy">{tier.name}</h2>
            <p className="mt-1 min-h-[2.5rem] text-slate-600">{tier.tagline}</p>

            <div className="mt-5">
              <span className="font-display text-4xl font-bold text-navy">{tier.price}</span>
              <span className="ml-1 text-slate-500">/{tier.per}</span>
              {tier.setup ? (
                <p className="mt-1 text-sm font-semibold text-teal">+ {tier.setup}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">No setup fee</p>
              )}
            </div>

            <ul className="mt-6 flex-1 space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-starboard" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="/#get-demo"
              className={`mt-7 inline-block rounded-lg px-6 py-3 text-center font-semibold transition ${
                tier.highlight
                  ? "bg-teal text-white hover:bg-teal-700"
                  : "border border-navy text-navy hover:bg-navy hover:text-white"
              }`}
            >
              {tier.cta}
            </a>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-slate-500">
        Every centre starts with the same strong foundation and a free month.{" "}
        <Link href="/#get-demo" className="font-semibold text-teal hover:underline">
          Start your free month →
        </Link>
      </p>
    </div>
  );
}
