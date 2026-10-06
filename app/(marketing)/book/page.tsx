import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { openSlots } from "@/lib/calls/slots";
import { BookCall } from "@/components/marketing/BookCall";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Book a call",
  description: "Book a free 30-minute call to see how ActivityRoster can handle rostering, certs and safety-cover compliance for your RYA centre.",
  alternates: { canonical: "/book" },
};

export default async function BookCallPage() {
  let slotsIso: string[] = [];
  try {
    const repo = new PlatformRepository(await getDb());
    const [windows, booked] = await Promise.all([repo.listAvailability(), repo.bookedSlotsFrom(new Date())]);
    slotsIso = openSlots(
      windows.map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute, active: w.active })),
      booked,
      { maxWorkingDays: 7 },
    ).map((d) => d.toISOString());
  } catch {
    slotsIso = [];
  }

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal">Talk to us</p>
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">Book a 30-minute call</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          A quick, no-pressure walkthrough of how ActivityRoster handles rostering, certs and safety-cover
          compliance for RYA centres and clubs. Pick a time that suits you — all times are shown in <strong>GMT</strong>.
        </p>
        <div className="mt-8">
          <BookCall slotsIso={slotsIso} />
        </div>
      </div>
    </section>
  );
}
