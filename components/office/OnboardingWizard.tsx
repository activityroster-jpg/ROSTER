"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addCustomCourseAction,
  addTeamMemberAction,
  dismissOnboardingAction,
  setCoursesRunAction,
  setSetupPreferencesAction,
} from "@/app/(app)/office/onboarding/actions";
import { FEATURE_META } from "@/lib/features";
import { OPTIONAL_FEATURES, type CourseAudience, type OptionalFeature } from "@/lib/db/schema";

export interface CourseTypeOpt { id: string; name: string; scheme: string | null; audience: CourseAudience; category: string | null; active: boolean }
export interface QualOpt { id: string; name: string; discipline: string | null }
export interface TeamMember { name: string; employment: string; quals: number }

const EMPLOYMENT = [
  { value: "employed", label: "Employed" },
  { value: "freelance", label: "Freelance" },
  { value: "volunteer", label: "Volunteer" },
];

const AUDIENCE_ORDER: { key: CourseAudience; label: string; hint: string }[] = [
  { key: "youth", label: "Youth", hint: "Under-18 provision — junior club, summer camps, school groups" },
  { key: "adult", label: "Adult", hint: "Adult courses and RYA cruising / powerboat" },
  { key: "all", label: "All ages", hint: "Runs for any age group" },
];

const STEP_LABELS = ["How you run", "Courses", "Team", "Finish"];

export function OnboardingWizard({
  centreName,
  courseTypes,
  quals,
  existingStaff,
  initialFeatures,
  initialSlotStyle,
}: {
  centreName: string;
  courseTypes: CourseTypeOpt[];
  quals: QualOpt[];
  existingStaff: TeamMember[];
  initialFeatures: OptionalFeature[];
  initialSlotStyle: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Step 1 — preferences
  const [features, setFeatures] = useState<Set<OptionalFeature>>(new Set(initialFeatures));
  const [slotStyle, setSlotStyle] = useState(initialSlotStyle || "slots");
  const toggleFeature = (f: OptionalFeature) => setFeatures((s) => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n; });

  // Step 2 — courses (local list so custom additions appear immediately)
  const [allCourses, setAllCourses] = useState<CourseTypeOpt[]>(courseTypes);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set(courseTypes.filter((c) => c.active).map((c) => c.id)));
  const toggleCourse = (id: string) => setSelectedCourses((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [ccName, setCcName] = useState("");
  const [ccAudience, setCcAudience] = useState<CourseAudience>("youth");
  const [ccCategory, setCcCategory] = useState("");

  const grouped = useMemo(() => {
    const byAudience = new Map<CourseAudience, Map<string, CourseTypeOpt[]>>();
    for (const c of allCourses) {
      const cat = c.category ?? c.scheme ?? "Other";
      const g = byAudience.get(c.audience) ?? new Map<string, CourseTypeOpt[]>();
      g.set(cat, [...(g.get(cat) ?? []), c]);
      byAudience.set(c.audience, g);
    }
    return byAudience;
  }, [allCourses]);

  // Step 3 — team
  const [team, setTeam] = useState<TeamMember[]>(existingStaff);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employment, setEmployment] = useState("employed");
  const [chosenQuals, setChosenQuals] = useState<Set<string>>(new Set());
  const toggleQual = (id: string) => setChosenQuals((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const savePrefsThenNext = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setSetupPreferencesAction({ features: [...features], slotStyle });
      if (res.ok) setStep(2); else setMsg(res.error ?? "Could not save");
    });
  };

  const addCustom = () => {
    if (!ccName.trim()) { setMsg("Name your course first"); return; }
    setMsg(null);
    startTransition(async () => {
      const res = await addCustomCourseAction({ name: ccName, audience: ccAudience, category: ccCategory });
      if (res.ok && res.id) {
        const opt: CourseTypeOpt = { id: res.id, name: ccName.trim(), scheme: ccCategory.trim() || "Centre course", audience: ccAudience, category: ccCategory.trim() || null, active: true };
        setAllCourses((c) => [...c, opt]);
        setSelectedCourses((s) => new Set(s).add(res.id!));
        setCcName(""); setCcCategory("");
      } else setMsg(res.error ?? "Could not add course");
    });
  };

  const saveCoursesThenNext = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setCoursesRunAction([...selectedCourses]);
      if (res.ok) setStep(3); else setMsg(res.error ?? "Could not save");
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-navy">Welcome to ActivityRoster</h1>
        <button onClick={skip} disabled={pending} className="text-sm text-slate-400 hover:text-slate-600">Skip for now →</button>
      </div>
      <p className="mb-6 text-sm text-slate-500">Let&apos;s get {centreName} rostering. Courses and team are all you need to start — the rest is optional.</p>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= n ? "bg-teal text-white" : "bg-slate-200 text-slate-500"}`}>{n}</span>
              <span className={step >= n ? "text-navy" : "text-slate-400"}>{label}</span>
              {n < STEP_LABELS.length ? <span className="mx-1 h-px w-5 bg-slate-200" /> : null}
            </div>
          );
        })}
      </div>

      {/* STEP 1 — how you run */}
      {step === 1 ? (
        <div className="space-y-5">
          <div className="rounded-card border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-navy">What do you want to manage?</h2>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-medium text-navy">Courses &amp; team</span> are always included — that&apos;s the rostering core.
              Switch on anything else you want; you can add these later too.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-teal bg-teal/5 p-3">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded bg-teal text-xs text-white">✓</span>
                <span><span className="block text-sm font-medium text-navy">Courses &amp; team</span><span className="text-xs text-slate-400">Rostering core — always on</span></span>
              </div>
              {OPTIONAL_FEATURES.map((f) => {
                const on = features.has(f);
                const meta = FEATURE_META[f];
                return (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${on ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border ${on ? "border-teal bg-teal text-white" : "border-slate-300"}`}>{on ? "✓" : ""}</span>
                    <span><span className="block text-sm font-medium text-navy">{meta.label}</span><span className="text-xs text-slate-400">{meta.blurb}</span></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-card border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-navy">How do your sessions run?</h2>
            <p className="mt-1 text-sm text-slate-500">Pick what fits how you timetable. You can change this in Settings.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { key: "slots", title: "Morning / afternoon / evening", hint: "Standard AM · PM · EV slots — simplest for most centres" },
                { key: "times", title: "Set start & end times", hint: "You run to a timetable with specific times" },
              ].map((o) => (
                <button key={o.key} type="button" onClick={() => setSlotStyle(o.key)}
                  className={`rounded-lg border p-3 text-left transition ${slotStyle === o.key ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
                  <span className="block text-sm font-medium text-navy">{o.title}</span>
                  <span className="text-xs text-slate-400">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {msg ? <p className="text-sm text-port">{msg}</p> : null}
          <div className="flex justify-end">
            <button onClick={savePrefsThenNext} disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {pending ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 2 — courses */}
      {step === 2 ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Which courses do you run?</h2>
          <p className="mt-1 text-sm text-slate-500">Grouped by youth and adult. Tick the ones you offer, or add your own below. Change anytime in Settings.</p>

          <div className="mt-5 space-y-5">
            {AUDIENCE_ORDER.filter((a) => grouped.has(a.key)).map((a) => (
              <div key={a.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.key === "youth" ? "bg-amber/15 text-amber" : a.key === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{a.label}</span>
                  <span className="text-xs text-slate-400">{a.hint}</span>
                </div>
                {[...(grouped.get(a.key) ?? new Map()).entries()].map(([cat, list]) => (
                  <div key={cat} className="mb-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(list as CourseTypeOpt[]).map((c) => {
                        const on = selectedCourses.has(c.id);
                        return (
                          <button key={c.id} type="button" onClick={() => toggleCourse(c.id)}
                            className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition ${on ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300"}`}>
                            <span className={`flex h-5 w-5 flex-none items-center justify-center rounded border text-xs ${on ? "border-teal bg-teal text-white" : "border-slate-300"}`}>{on ? "✓" : ""}</span>
                            <span className="text-sm font-medium text-navy">{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-canvas p-4">
            <p className="text-sm font-semibold text-navy">Add your own course</p>
            <p className="mb-3 text-xs text-slate-500">For anything not listed — e.g. a bespoke camp, a club night, a school programme.</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <input value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="Course name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
              <select value={ccAudience} onChange={(e) => setCcAudience(e.target.value as CourseAudience)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="youth">Youth</option>
                <option value="adult">Adult</option>
                <option value="all">All ages</option>
              </select>
              <input value={ccCategory} onChange={(e) => setCcCategory(e.target.value)} placeholder="Group (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button onClick={addCustom} disabled={pending} className="mt-3 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
              {pending ? "Adding…" : "+ Add course"}
            </button>
          </div>

          {msg ? <p className="mt-3 text-sm text-port">{msg}</p> : null}
          <div className="mt-5 flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm font-semibold text-slate-500 hover:text-navy">← Back</button>
            <button onClick={saveCoursesThenNext} disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {pending ? "Saving…" : `Continue with ${selectedCourses.size} →`}
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 3 — team */}
      {step === 3 ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Add your team</h2>
          <p className="mt-1 text-sm text-slate-500">Add instructors and tick the qualifications they hold. The courses they&apos;re approved to run are worked out from these automatically.</p>

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
            <button onClick={() => setStep(2)} className="text-sm font-semibold text-slate-500 hover:text-navy">← Back</button>
            <button onClick={() => setStep(4)} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-700">Continue →</button>
          </div>
        </div>
      ) : null}

      {/* STEP 4 — finish + funnel for chosen extras */}
      {step === 4 ? (
        <div className="rounded-card border border-slate-200 bg-white p-8">
          <p className="text-center font-display text-2xl font-semibold text-navy">🎉 You&apos;re ready to roster</p>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600">
            {selectedCourses.size} course type{selectedCourses.size === 1 ? "" : "s"} and {team.length} team member{team.length === 1 ? "" : "s"} set up.
          </p>

          {features.size > 0 ? (
            <div className="mx-auto mt-6 max-w-md">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Finish setting up your extras</p>
              <ul className="space-y-2">
                {[...features].map((f) => {
                  const meta = FEATURE_META[f];
                  return (
                    <li key={f}>
                      <a href={meta.href} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-teal">
                        <span><span className="font-medium text-navy">{meta.label}</span><span className="block text-xs text-slate-400">{meta.blurb}</span></span>
                        <span className="text-teal">Set up →</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 flex justify-center">
            <button onClick={finish} disabled={pending} className="rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              Go to my dashboard →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
