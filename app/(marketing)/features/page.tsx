import { EmailStart } from "@/components/marketing/EmailStart";
import { Audiences, DisciplineGallery, ExploreMore, PHOTOS, PhotoBand, PlatformGrid, Quote } from "@/components/marketing/HomeSections";

export const metadata = {
  title: "Features",
  description: "Everything ActivityRoster does for an RYA centre or club: the roster builder and Auto-roster, the instructor app, certificates and vetting, leave and cover, hours and payroll, and who it is built for.",
  alternates: { canonical: "/features" },
};

/** The long version of the home page: every part of the platform, who it is for, every discipline. */
export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal">Features</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-navy md:text-4xl" style={{ textWrap: "balance" }}>Everything ActivityRoster does</h1>
          <p className="mt-3 max-w-2xl text-slate-600">The staff side of an RYA centre or club in one place: courses, instructors, qualifications and ratios, a roster that fills itself with people who are free and qualified, and an app for your team.</p>
        </div>
      </section>
      <PlatformGrid more="compare" />
      <DisciplineGallery />
      <Audiences />
      <PhotoBand src={PHOTOS.instructors} alt="Instructors briefing on the shore" caption="Every session safely staffed" />
      <Quote />
      <ExploreMore />
      <PhotoBand src={PHOTOS.marina} alt="Marina and moorings" caption="Run the whole centre in one place" />
      <section className="bg-navy">
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-white md:py-16">
          <h2 className="font-display text-3xl font-bold" style={{ textWrap: "balance" }}>Try it free for a month</h2>
          <p className="mt-3 text-white/80">No card, and your centre is ready in a minute.</p>
          <div className="mt-6 rounded-card bg-white p-6 text-left shadow-xl"><EmailStart source="features" /></div>
        </div>
      </section>
    </>
  );
}
