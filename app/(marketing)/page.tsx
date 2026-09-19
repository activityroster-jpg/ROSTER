import { AlertTriangle, LifeBuoy, ShieldCheck, Users } from "lucide-react";
import { SlugClaim } from "@/components/marketing/SlugClaim";
import { apexDomain } from "@/lib/config";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Won't roster the under-qualified",
    body: "An instructor with any lapsed mandatory check — first aid, DBS/PVG/AccessNI/Garda — is blocked from assignment automatically, per RYA rules.",
  },
  {
    icon: Users,
    title: "Ratio-aware",
    body: "Courses flag as under-staffed the moment there aren't enough ratio-counting instructors for the group size.",
  },
  {
    icon: LifeBuoy,
    title: "Safety-cover enforced",
    body: "Craft afloat without a safety-boat role filled? Flagged, before anyone launches.",
  },
  {
    icon: AlertTriangle,
    title: "Nothing lapses quietly",
    body: "Every ticket and vetting check is tracked with expiry alerts, so certificates never expire unnoticed.",
  },
];

export default function MarketingHome() {
  const apex = apexDomain();
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal">
            For RYA sailing &amp; watersports centres
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight text-navy md:text-5xl">
            Rostering that won&apos;t let a session run unsafe.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Compliance-aware staff rostering and course administration. It won&apos;t let a session run
            under-qualified, over-ratio, or without safety-boat cover — and it tracks every ticket so nothing
            lapses.
          </p>
          <ul className="mt-6 space-y-2 text-slate-600">
            <li>• Buy a plan, get provisioned automatically</li>
            <li>• Your own address at <span className="font-medium text-navy">yourcentre.{apex}</span></li>
            <li>• Set up your grades, checks and courses — then you&apos;re live</li>
          </ul>
        </div>
        <div className="flex justify-center">
          <SlugClaim apex={apex} plan="rostering" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">The compliance safety net</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            The rules that keep a centre safe are built in — not a checklist someone has to remember.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-card border border-slate-200 p-5">
                <f.icon className="h-8 w-8 text-teal" />
                <h3 className="mt-3 font-semibold text-navy">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold text-navy">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["1. Buy a plan", "Choose Rostering or Full and check out securely with Stripe."],
            ["2. Get provisioned", "Your centre is created automatically with RYA-aware defaults for your jurisdiction."],
            ["3. Set up & go live", "Adjust grades, checks and courses to fit your centre — then start rostering."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-card border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold text-navy">FAQ</h2>
          <dl className="mt-6 space-y-6">
            {[
              ["Is my centre's data isolated?", "Yes. Every centre's data is strictly separated and enforced in code, with an automated test proving no centre can ever see another's."],
              ["Where is data stored?", "In the EU, for GDPR residency. Documents are held privately and encrypted."],
              ["Which jurisdictions are supported?", "England, Wales, Scotland, Northern Ireland and Ireland — the right vetting checks (DBS/PVG/AccessNI/Garda) are set up for you."],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold text-navy">{q}</dt>
                <dd className="mt-1 text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
