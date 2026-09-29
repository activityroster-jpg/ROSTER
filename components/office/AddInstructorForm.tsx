"use client";

import { useActionState, useState } from "react";
import { setupInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";
import { MultiSelect } from "@/components/MultiSelect";

const initial: ActionState = { ok: false };

export interface CourseChoice { id: string; name: string; audience: "youth" | "adult" | "all" }
export interface Choice { id: string; name: string; mandatory?: boolean }

export function AddInstructorForm({ courses, quals, checks }: { courses: CourseChoice[]; quals: Choice[]; checks: Choice[] }) {
  const [state, action, pending] = useActionState(setupInstructorAction, initial);
  const [selCourses, setSelCourses] = useState<Set<string>>(new Set());
  const [selQuals, setSelQuals] = useState<Set<string>>(new Set());
  const [selChecks, setSelChecks] = useState<Set<string>>(new Set(checks.filter((c) => c.mandatory).map((c) => c.id)));

  const toggler = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOf = (opts: { id: string }[], set: React.Dispatch<React.SetStateAction<Set<string>>>) => () => set(new Set(opts.map((o) => o.id)));
  const clear = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => () => set(new Set());

  const Field = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-navy">{title}</label>
      <p className="mb-1.5 text-xs text-slate-500">{hint}</p>
      {children}
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Full name</label>
          <input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Email</label>
          <input name="email" type="email" placeholder="so we can send their invite" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Employment</label>
          <select name="employmentType" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
            <option value="employed">Employed</option><option value="freelance">Freelance</option><option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>

      <Field title="Courses this instructor can teach" hint="Tick every course they're approved to run.">
        <MultiSelect placeholder="Select courses…" options={courses} selected={selCourses} onToggle={toggler(setSelCourses)} onSelectAll={allOf(courses, setSelCourses)} onClear={clear(setSelCourses)} />
      </Field>

      <Field title="RYA tickets / licences they need on file" hint="They'll upload a photo of each for you to verify.">
        <MultiSelect placeholder="Select licences…" options={quals} selected={selQuals} onToggle={toggler(setSelQuals)} onSelectAll={allOf(quals, setSelQuals)} onClear={clear(setSelQuals)} />
      </Field>

      <Field title="Background checks they need" hint="DBS, first aid, safeguarding — the mandatory ones are already ticked.">
        <MultiSelect placeholder="Select checks…" options={checks} selected={selChecks} onToggle={toggler(setSelChecks)} onSelectAll={allOf(checks, setSelChecks)} onClear={clear(setSelChecks)} />
      </Field>

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
