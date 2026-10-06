import Link from "next/link";
import { ProductTour } from "@/components/marketing/ProductTour";
import { LeadCapture } from "@/components/marketing/LeadCapture";
import { apexDomain } from "@/lib/config";

export const metadata = {
  title: "Demo — ActivityRoster",
  description: "A tour of ActivityRoster at a busy sailing centre: the office, the roster board, payroll and the instructor app. Real screens, made-up centre.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Demo</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">A week at a busy centre</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">
          Real screens from the platform, set up as a made-up centre in the middle of July: summer camps, club
          nights and powerboat courses, eighteen instructors, and the problems a real week throws up. Step through
          the office, then the instructor app.
        </p>
      </div>

      <ProductTour />

      <div className="mx-auto mt-12 max-w-md">
        <LeadCapture source="demo" apex={apexDomain()} />
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-teal hover:underline">← Back to the overview</Link>
        </p>
      </div>
    </div>
  );
}
