import Link from "next/link";
import { DemoApp } from "@/components/marketing/DemoApp";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { apexDomain } from "@/lib/config";

export const metadata = {
  title: "Live demo — ActivityRoster",
  description: "Play with the ActivityRoster office admin and instructor portal. No login, example data.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Interactive demo</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">Take the helm — click around</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">
          The full platform with example data — scheduling, a live time clock, availability &amp; leave, open-shift
          cover, HR &amp; documents, reports and payroll. Switch between the office admin and the instructor app, and
          watch the compliance checks flag an under-qualified instructor and a course with no safety cover.
        </p>
      </div>

      <DemoApp />

      <div className="mx-auto mt-12 max-w-md">
        <LeadCapture source="demo" apex={apexDomain()} />
        <p className="mt-4 text-center text-sm text-slate-500">
          Prefer to read more first? <Link href="/" className="font-semibold text-teal hover:underline">Back to the overview</Link>
        </p>
      </div>
    </div>
  );
}
