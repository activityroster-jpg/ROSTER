"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addTeamMemberAction, dismissOnboardingAction, setCoursesRunAction } from "@/app/(app)/office/onboarding/actions";

export interface CourseTypeOpt { id: string; name: string; scheme: string | null; active: boolean }
export interface QualOpt { id: string; name: string; discipline: string | null }
export interface TeamMember { name: string; employment: string; quals: number }

const EMPLOYMENT = [
  { value: "employed", label: "Employed" },
  { value: "freelance", label: "Freelance" },
  { value: "volunteer", label: "Volunteer" },
];

export function OnboardingWizard({
  centreName,
  courseTypes,
  quals,
  existingStaff,
}: {
  centreName: string;
  courseTypes: CourseTypeOpt[];
  quals: QualOpt[];
  existingStaff: TeamMember[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  // Step 1 — courses
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set(courseTypes.filter((c) => c.active).map((c) => c.id)));
  const toggleCourse = (id: string) => setSelectedCourses((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Step 2 — team
  const [team, setTeam] = useState<TeamMember[]>(existingStaff);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employment, setEmployment] = useState("employed");
  const [chosenQuals, setChosenQuals] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const toggleQual = (id: string) => setChosenQuals((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const saveCoursesThenNext = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setCoursesRunAction([...selectedCourses]);
      if (res.ok) setStep(2); else setMsg(res.error ?? "Could not save");
    });
  };

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!name.trim()) { setMsg("Enter a name"); return; }
    startTransition(async () => {
      const res = await addTeamMemberAction({ name, email, employmentType: employment, qualificationTypeIds: [...chosenQuals] });
      if (res.ok) {
        setTeam((t) => [...t, { name: name.trim(), employment, quals: chosenQuals.size }]);
        setName(""); setEmail(""); setChosenQuals(new Set());
      } else setMsg(res.error ?? "Could not add");
    });
  };

  const finish = () => startTransition(async () => { await dismissOnboardingAction(); router.push("/office"); });
  const skip = () => startTransition(async () => { await dismissOnboardingAction(); router.push("/office"); });

  const Stepper = () => (
    <div className="mb-6 flex items-center gap-2 text-xs font-semibold">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= n ? "bg-teal text-white" : "bg-slate-200 text-slate-500"}`}>{n}</span>
          <span className={step >= n ? "text-navy" : "text-slate-400"}>{["Courses", "Team", "Done"][n - 1]}</span>
          {n < 3 ? <span className="mx-1 h-px w-6 bg-slate-200" /> : null}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-navy">Welcome to ActivityRoster</h1>
        <button onClick={skip} disabled={pending} className="text-sm text-slate-400 hover:text-slate-600">Skip for now →</button>
      </div>
      <p className="mb-6 text-sm text-slate-500">Let&apos;s get {centreName} set up. Two quick steps and you&apos;re ready to roster.</p>
      <Stepper />

      {step === 1 ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Which courses do you run?</h2>
          <p className="mt-1 text-sm text-slate-500">Tick the ones you offer — you can change these anytime in Settings. We&apos;ve pre-ticked the RYA defaults.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {courseTypes.map((c) => {
              const on = selectedCourses.has(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleCourse(c.id)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${on ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
                  <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border ${on ? "border-teal bg-teal text-white" : "border-slate-300"}`}>{on ? "✓" : ""}</span>
                  <span><span className="block text-sm font-medium text-navy">{c.name}</span><span className="text-xs text-slate-400">{c.scheme}</span></span>
                </button>
              );
            })}
          </div>
          {msg ? <p className="mt-3 text-sm text-port">{msg}</p> : null}
          <div className="mt-5 flex justify-end">
            <button onClick={saveCoursesThenNext} disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {pending ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Add your team</h2>
          <p className="mt-1 text-sm text-slate-500">Add instructors and tick the qualifications they hold. Courses they&apos;re approved to run are worked out from these automatically.</p>

          <form onSubmit={addMember} className="mt-4 rounded-lg bg-canvas p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={employment} onChange={(e) => setEmployment(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {EMPLOYMENT.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Qualifications / instructor type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quals.map((q) => {
                const on = chosenQuals.has(q.id);
                return (
                  <button key={q.id} type="button" onClick={() => toggleQual(q.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-teal bg-teal text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                    {on ? "✓ " : ""}{q.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" disabled={pending} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                {pending ? "Adding…" : "+ Add to team"}
              </button>
              {msg ? <span className="text-sm text-port">{msg}</span> : null}
            </div>
          </form>

          {team.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {team.map((m, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-navy">{m.name}</span>
                  <span className="text-xs text-slate-400 capitalize">{m.employment}{m.quals ? ` · ${m.quals} qual${m.quals > 1 ? "s" : ""}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-slate-400">No team members yet — add your first above.</p>}

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm font-semibold text-slate-500 hover:text-navy">← Back</button>
            <button onClick={() => setStep(3)} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-700">Continue →</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="rounded-card border border-slate-200 bg-white p-8 text-center">
          <p className="font-display text-2xl font-semibold text-navy">🎉 You&apos;re set up</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            {selectedCourses.size} course type{selectedCourses.size === 1 ? "" : "s"} and {team.length} team member{team.length === 1 ? "" : "s"} ready.
            Next you can build your first week&apos;s roster and record staff tickets — your dashboard shows what&apos;s left.
          </p>
          <button onClick={finish} disabled={pending} className="mt-6 rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            Go to my dashboard →
          </button>
        </div>
      ) : null}
    </div>
  );
}
