import { ArrowDown, ArrowRight, Check, CircleCheck, UserPlus, X } from "lucide-react";

/**
 * The compliance engine in one picture: an assignment goes in, four checks run
 * as you schedule, and the session comes out ready to run. The failing example
 * underneath shows what happens when a check doesn't pass. Names are from the
 * made-up demo centre (lib/screens.ts).
 */
const CHECKS = [
  { label: "Qualification", detail: "Dinghy Instructor, in date until 2030" },
  { label: "Availability", detail: "Marked free for Saturday morning" },
  { label: "Ratio", detail: "2 instructors for 6 students" },
  { label: "Safety cover", detail: "Safety boat driver rostered" },
];

function Arrow() {
  return (
    <div className="flex items-center justify-center text-teal" aria-hidden="true">
      <ArrowDown className="h-6 w-6 lg:hidden" />
      <ArrowRight className="hidden h-6 w-6 lg:block" />
    </div>
  );
}

export function ComplianceFlow({ showFailure = true }: { showFailure?: boolean }) {
  return (
    <figure aria-label="How ActivityRoster checks an assignment">
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_minmax(0,1fr)] lg:gap-4">
        <div className="flex flex-col justify-center rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400"><UserPlus className="h-4 w-4" aria-hidden="true" />Assign instructor</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden="true">EM</span>
            <div className="min-w-0">
              <p className="font-semibold text-navy">Ellie Murray</p>
              <p className="text-sm text-slate-500">Start Sailing weekend · Sat 09:00</p>
            </div>
          </div>
        </div>

        <Arrow />

        <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Checked as you schedule</p>
          <ul className="mt-3 space-y-2.5">
            {CHECKS.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-starboard/15 text-starboard"><Check className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{c.label} <span className="sr-only">passed</span></p>
                  <p className="text-sm text-slate-500">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Arrow />

        <div className="flex flex-col items-center justify-center rounded-card bg-starboard p-5 text-center text-white shadow-sm">
          <CircleCheck className="h-10 w-10" aria-hidden="true" />
          <p className="mt-2 font-display text-2xl font-bold tracking-wide">READY TO RUN</p>
          <p className="mt-1 text-sm text-white/85">On the roster, in Ellie&apos;s app, on the printed sheet.</p>
        </div>
      </div>

      {showFailure ? (
        <div className="mt-4 flex flex-col gap-3 rounded-card border border-port/25 bg-port/5 p-4 sm:flex-row sm:items-center">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-port/15 text-port"><X className="h-5 w-5" aria-hidden="true" /></span>
          <p className="text-sm text-navy">
            <span className="font-semibold">When a check fails:</span> Jamie Lowry&apos;s first aid certificate ran out on 3 August, so he can&apos;t be put on
            Monday&apos;s session. You see why straight away, and if you go ahead anyway the override needs a reason and goes in the change log.
          </p>
        </div>
      ) : null}
    </figure>
  );
}
