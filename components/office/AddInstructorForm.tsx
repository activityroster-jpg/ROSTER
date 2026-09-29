"use client";

import { useActionState, useState } from "react";
import { setupInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";

const initial: ActionState = { ok: false };

export interface CourseChoice { id: string; name: string; audience: "youth" | "adult" | "all" }
export interface Choice { id: string; name: string; mandatory?: boolean }

function ChipGroup({
  label, hint, options, selected, toggle, tone = "teal",
}: { label: string; hint: string; options: Choice[]; selected: Set<string>; toggle: (id: string) => void; tone?: "teal" | "amber" }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? options : options.slice(0, 10);
  const onCls = tone === "amber" ? "border-amber bg-amber text-white" : "border-teal bg-teal text-white";
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mb-2 text-xs text-slate-400">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => {
          const on = selected.has(o.id);
          return (
            <button key={o.id} type="button" onClick={() => toggle(o.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? onCls : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
              {on ? "✓ " : ""}{o.name}
            </button>
          );
        })}
        {options.length > 10 ? (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-teal hover:underline">
            {showAll ? "Show fewer" : `View all ${options.length}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AddInstructorForm({ courses, quals, checks }: { courses: CourseChoice[]; quals: Choice[]; checks: Choice[] }) {
  const [state, action, pending] = useActionState(setupInstructorAction, initial);
  const [selCourses, setSelCourses] = useState<Set<string>>(new Set());
  const [selQuals, setSelQuals] = useState<Set<string>>(new Set());
  const [selChecks, setSelChecks] = useState<Set<string>>(new Set(checks.filter((c) => c.mandatory).map((c) => c.id)));

  const toggler = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
          <input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Email <span className="text-slate-400">(to send their invite)</span></label>
          <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Employment</label>
          <select name="employmentType" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
            <option value="employed">Employed</option><option value="freelance">Freelance</option><option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>

      <ChipGroup label="Courses they can teach" hint="Pick what this instructor is approved to run." options={courses} selected={selCourses} toggle={toggler(setSelCourses)} />
      <ChipGroup label="Licences / tickets required" hint="Their RYA instructor tickets — they'll upload proof for you to check." options={quals} selected={selQuals} toggle={toggler(setSelQuals)} />
      <ChipGroup label="Checks required" hint="DBS, first aid, safeguarding — mandatory ones are pre-selected." options={checks} selected={selChecks} toggle={toggler(setSelChecks)} tone="amber" />

      {[...selCourses].map((id) => <input key={`c${id}`} type="hidden" name="course" value={id} />)}
      {[...selQuals].map((id) => <input key={`q${id}`} type="hidden" name="qual" value={id} />)}
      {[...selChecks].map((id) => <input key={`k${id}`} type="hidden" name="check" value={id} />)}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {pending ? "Saving…" : "Save & send invite"}
        </button>
        {state.error ? <p className="text-sm text-port">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-starboard">{state.message}</p> : null}
      </div>
      <p className="text-xs text-slate-400">Saving emails the instructor a link to set up their account and upload their licence photos. You can also upload documents for them from their profile.</p>
    </form>
  );
}
