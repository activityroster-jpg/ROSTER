import Link from "next/link";
import { ProductTour } from "@/components/marketing/ProductTour";
import { DemoGate } from "@/components/marketing/DemoGate";

export const metadata = {
  title: "Demo — a week at a busy sailing centre",
  description: "A tour of ActivityRoster at a busy sailing centre: the office, the roster board, payroll and the instructor app. Real screens, made-up centre.",
  alternates: { canonical: "/demo" },
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
          it in the order a new centre gets going: set up courses and team, put the courses on the calendar,
          build and confirm the roster, run the season; then see the instructor app.
        </p>
      </div>

      <DemoGate>
        <ProductTour />
      </DemoGate>

      <div className="mx-auto mt-12 max-w-md text-center">
        <Link href="/start?src=demo" className="inline-block rounded-lg bg-teal px-6 py-3.5 font-semibold text-white hover:bg-teal-700">Start my free month →</Link>
        <p className="mt-4 text-sm text-slate-500">
          <Link href="/" className="font-semibold text-teal hover:underline">← Back to the overview</Link>
        </p>
      </div>
    </div>
  );
}
