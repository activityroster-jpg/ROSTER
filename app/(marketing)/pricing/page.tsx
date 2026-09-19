import { Check } from "lucide-react";
import { SlugClaim } from "@/components/marketing/SlugClaim";
import { apexDomain } from "@/lib/config";

const TIERS = [
  {
    plan: "rostering" as const,
    name: "Rostering",
    tagline: "Compliance-aware staff rostering & course admin.",
    features: [
      "Compliance-aware assignment (fit-to-roster)",
      "Ratio & safety-cover checks",
      "Conflict detection with override + audit",
      "Staff, grades & vetting tracking with expiry alerts",
      "Instructor portal (schedule, availability, hours)",
      "CSV hours export",
    ],
  },
  {
    plan: "full" as const,
    name: "Full",
    tagline: "Everything in Rostering, plus bookings (coming soon).",
    features: [
      "Everything in Rostering",
      "Customer-facing bookings",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  const apex = apexDomain();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-navy">Pricing</h1>
      <p className="mt-2 text-slate-600">Start your centre in minutes. Cancel anytime from the billing portal.</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {TIERS.map((tier) => (
          <div key={tier.plan} className="rounded-card border border-slate-200 bg-white p-6">
            <h2 className="font-display text-2xl font-semibold text-navy">{tier.name}</h2>
            <p className="mt-1 text-slate-600">{tier.tagline}</p>
            <ul className="mt-5 space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-starboard" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <SlugClaim apex={apex} plan={tier.plan} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
