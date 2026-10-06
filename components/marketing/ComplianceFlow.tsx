import { ArrowDown, ArrowRight, CalendarPlus, Check, Send, Users } from "lucide-react";

/**
 * How a centre's week comes together, in three tiles: add the courses, pick
 * the staff (the checks run here), publish. Used on the homepage and the
 * search pages; the strip underneath shows what happens when plans change.
 */
const CHECKS = ["Qualified", "Available", "Ratio", "Safety cover"];

function Arrow() {
  return (
    <div className="flex items-center justify-center text-teal" aria-hidden="true">
      <ArrowDown className="h-6 w-6 lg:hidden" />
      <ArrowRight className="hidden h-6 w-6 lg:block" />
    </div>
  );
}

function StepNumber({ n, light = false }: { n: number; light?: boolean }) {
  return (
    <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-display text-sm font-bold ${light ? "bg-white text-starboard" : "bg-navy text-white"}`} aria-hidden="true">{n}</span>
  );
}

export function ComplianceFlow({ showStrip = true }: { showStrip?: boolean }) {
  return (
    <figure aria-label="Your week in three steps: add your courses, select your staff, publish">
      <ol className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        <li className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><StepNumber n={1} /><CalendarPlus className="h-5 w-5 text-teal" aria-hidden="true" /></div>
          <p className="mt-3 font-display text-lg font-semibold text-navy">Add your courses</p>
          <p className="mt-1 text-sm text-slate-600">Import them from your calendar or booking system, or add them by hand. Ratios and staffing are filled in for you.</p>
        </li>

        <Arrow />

        <li className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><StepNumber n={2} /><Users className="h-5 w-5 text-teal" aria-hidden="true" /></div>
          <p className="mt-3 font-display text-lg font-semibold text-navy">Select your staff</p>
          <p className="mt-1 text-sm text-slate-600">See at a glance who&rsquo;s available and who&rsquo;s already assigned, on one availability sheet. Clashes, expired tickets and missing safety cover are flagged as you go.</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Checked for every assignment">
            {CHECKS.map((c) => (
              <li key={c} className="inline-flex items-center gap-1 rounded-full bg-starboard/10 px-2 py-0.5 text-[11px] font-semibold text-starboard"><Check className="h-3 w-3" aria-hidden="true" />{c}</li>
            ))}
          </ul>
        </li>

        <Arrow />

        <li className="flex flex-col justify-center rounded-card bg-starboard p-5 text-white shadow-sm">
          <div className="flex items-center gap-3"><StepNumber n={3} light /><Send className="h-5 w-5" aria-hidden="true" /></div>
          <p className="mt-3 font-display text-lg font-semibold">Publish: ready to run</p>
          <p className="mt-1 text-sm text-white/85">In every instructor&rsquo;s app, on the printed roster and on the emergency sheet.</p>
        </li>
      </ol>

      {showStrip ? (
        <div className="mt-4 flex flex-col gap-3 rounded-card border border-teal/25 bg-teal/5 p-4 sm:flex-row sm:items-center">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal/15 text-teal"><Users className="h-5 w-5" aria-hidden="true" /></span>
          <p className="text-sm text-navy">
            <span className="font-semibold">Change something later?</span> Everyone affected is told in the app, and the roster and emergency sheet update themselves.
          </p>
        </div>
      ) : null}
    </figure>
  );
}
