"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RotaTemplateForm } from "./RotaTemplateForm";
import { DEFAULT_ROTA_TEMPLATE } from "@/lib/rota/template";
import {
  addCustomCourseAction,
  addDefaultCoursesAction,
  addDefaultGradesAction,
  addQualificationTypeAction,
  addTeamMemberAction,
  dismissOnboardingAction,
  setCoursesRunAction,
  setSetupPreferencesAction,
} from "@/app/(app)/office/onboarding/actions";
import { FEATURE_META } from "@/lib/features";
import { OPTIONAL_FEATURES, type CourseAudience, type OptionalFeature } from "@/lib/db/schema";
import { qualTeachDiscipline, courseTeachDiscipline } from "@/lib/rya/teaching-map";

export interface CourseTypeOpt { id: string; name: string; scheme: string | null; audience: CourseAudience; category: string | null; active: boolean }
export interface QualOpt { id: string; name: string; discipline: string | null }
export interface TeamMember { name: string; employment: string; quals: number; courses?: number; invited?: boolean }

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

const STEP_LABELS = ["How you run", "Courses", "Team", "Rota PDF", "Finish"];

export function OnboardingWizard({
  centreName,
  courseTypes,
  quals: initialQuals,
  existingStaff,
  initialFeatures,
  initialSlotStyle,
  initialWeeksAhead,
}: {
  centreName: string;
  courseTypes: CourseTypeOpt[];
  quals: QualOpt[];
  existingStaff: TeamMember[];
  initialFeatures: OptionalFeature[];
  initialSlotStyle: string;
  initialWeeksAhead?: number;
}) {
  const [quals, setQuals] = useState<QualOpt[]>(initialQuals);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Step 1 — preferences
  const [features, setFeatures] = useState<Set<OptionalFeature>>(new Set(initialFeatures));
  const [slotStyle, setSlotStyle] = useState(initialSlotStyle || "slots");
  const [weeksAhead, setWeeksAhead] = useState(initialWeeksAhead ?? 4);
  const toggleFeature = (f: OptionalFeature) => setFeatures((s) => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n; });

  // Step 2 — courses (local list so custom additions appear immediately)
  const [allCourses, setAllCourses] = useState<CourseTypeOpt[]>(courseTypes);
  // Tick what the centre already runs (active types). A brand-new centre whose
  // seeded types are all active therefore starts with the RYA list ticked and
  // unticks what it doesn't run; re-opening the wizard never wipes the list.
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(() => new Set(courseTypes.filter((c) => c.active).map((c) => c.id)));
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
  const [chosenTeach, setChosenTeach] = useState<Set<string>>(new Set());
  const toggleTeach = (id: string) => setChosenTeach((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [newType, setNewType] = useState("");

  // Courses this instructor can teach are picked from the ones the centre runs.
  const runCourses = useMemo(() => allCourses.filter((c) => selectedCourses.has(c.id)), [allCourses, selectedCourses]);

  // Selecting a licence auto-ticks the courses they can teach (matched by
  // discipline). Deselecting a licence removes those courses again, unless
  // another still-held licence covers the same discipline.
  const toggleQual = (id: string) => {
    const qual = quals.find((q) => q.id === id);
    const turningOn = !chosenQuals.has(id);
    const nextQuals = new Set(chosenQuals);
    turningOn ? nextQuals.add(id) : nextQuals.delete(id);
    setChosenQuals(nextQuals);

    const d = qual ? qualTeachDiscipline(qual.name) : null;
    if (!d) return;
    setChosenTeach((teach) => {
      const n = new Set(teach);
      const matches = runCourses.filter((c) => courseTeachDiscipline(c) === d);
      if (turningOn) {
        for (const c of matches) n.add(c.id);
      } else if (!quals.some((q) => nextQuals.has(q.id) && qualTeachDiscipline(q.name) === d)) {
        for (const c of matches) n.delete(c.id);
      }
      return n;
    });
  };

  const addType = () => {
    const name = newType.trim();
    if (!name) return;
    setMsg(null);
    startTransition(async () => {
      const res = await addQualificationTypeAction({ name });
      if (res.ok && res.id) {
        setQuals((q) => [...q, { id: res.id!, name: res.name!, discipline: res.discipline ?? null }]);
        setChosenQuals((s) => new Set(s).add(res.id!));
        setNewType("");
      } else setMsg(res.error ?? "Could not add type");
    });
  };
  const addAllTypes = () => startTransition(async () => {
    const res = await addDefaultGradesAction();
    if (res.ok && res.created.length) setQuals((q) => [...q, ...res.created.map((c) => ({ id: c.id, name: c.name, discipline: c.discipline }))]);
  });
  const addAllCourses = () => startTransition(async () => {
    const res = await addDefaultCoursesAction();
    if (res.ok && res.created.length) {
      setAllCourses((c) => [...c, ...res.created.map((x) => ({ id: x.id, name: x.name, scheme: x.scheme, audience: x.audience as CourseAudience, category: x.category, active: true }))]);
      setSelectedCourses((s) => { const n = new Set(s); res.created.forEach((x) => n.add(x.id)); return n; });
    }
  });

  const savePrefsThenNext = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setSetupPreferencesAction({ features: [...features], slotStyle, availabilityWeeksAhead: weeksAhead });
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
    if (selectedCourses.size === 0) { setMsg("Tick at least one course you run (you can always add more later)."); return; }
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
      const res = await addTeamMemberAction({ name, email, employmentType: employment, qualificationTypeIds: [...chosenQuals], courseTypeIds: [...chosenTeach] });
      if (res.ok) {
        setTeam((t) => [...t, { name: name.trim(), employment, quals: chosenQuals.size, courses: chosenTeach.size, invited: res.invited }]);
        setName(""); setEmail(""); setChosenQuals(new Set()); setChosenTeach(new Set());
        setMsg(res.message ?? null);
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

          <div className="rounded-card border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-navy">How far ahead can instructors set availability?</h2>
            <p className="mt-1 text-sm text-slate-500">Instructors can submit availability from now up to this many weeks ahead. You can change this in Settings.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[2, 4, 6, 8, 12].map((n) => (
                <button key={n} type="button" onClick={() => setWeeksAhead(n)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${weeksAhead === n ? "border-teal bg-teal/5 text-navy" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {n} weeks
                </button>
              ))}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-xs">or</span>
                <input type="number" min={1} max={26} value={weeksAhead} onChange={(e) => setWeeksAhead(Math.max(1, Math.min(26, Number(e.target.value) || 1)))} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
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
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-navy">Which courses do you run?</h2>
            <button type="button" onClick={addAllCourses} disabled={pending} className="flex-none text-xs font-semibold text-teal hover:underline disabled:opacity-50">+ Add all RYA courses</button>
          </div>
          <p className="mt-1 text-sm text-slate-500">Grouped by youth and adult. Tick the ones you offer, or add your own below. Missing some? Use &ldquo;Add all RYA courses&rdquo;. Change anytime in Settings.</p>

          <div className="mt-5 space-y-5">
            {AUDIENCE_ORDER.filter((a) => grouped.has(a.key)).map((a) => (
              <div key={a.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.key === "youth" ? "bg-amber/15 text-amber" : a.key === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{a.label}</span>
                  <span className="text-xs text-slate-400">{a.hint}</span>
                </div>
                {[...(grouped.get(a.key) ?? new Map()).entries()].map(([cat, list]) => (
                  <div key={cat} className="mb-2.5">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(list as CourseTypeOpt[]).map((c) => {
                        const on = selectedCourses.has(c.id);
                        return (
                          <button key={c.id} type="button" onClick={() => toggleCourse(c.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-teal bg-teal text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                            {on ? "✓ " : ""}{c.name}
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
          <p className="mt-1 text-sm text-slate-500">Add each instructor, tick the certs they hold and the courses they can teach. Add their email and we&apos;ll send them an invite to upload their certs themselves. Got a spreadsheet? <a href="/office/staff/import" className="font-semibold text-teal hover:underline">Import your instructors</a> instead.</p>

          <form onSubmit={addMember} className="mt-4 rounded-lg bg-canvas p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (to send an invite)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={employment} onChange={(e) => setEmployment(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {EMPLOYMENT.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Certs / instructor type</p>
              <button type="button" onClick={addAllTypes} disabled={pending} className="text-xs font-semibold text-teal hover:underline disabled:opacity-50">+ Add all RYA types</button>
            </div>
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }}
                placeholder="Add another type / job role…"
                className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-teal"
              />
              <button type="button" onClick={addType} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">+ Add type</button>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Courses they can teach</p>
            {runCourses.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">Pick the courses you run in the previous step and they&apos;ll appear here.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {runCourses.map((c) => {
                  const on = chosenTeach.has(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleTeach(c.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-teal bg-teal text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                      {on ? "✓ " : ""}{c.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button type="submit" disabled={pending} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                {pending ? "Adding…" : "+ Add to team"}
              </button>
              {msg ? <span className={`text-sm ${/couldn|required|Enter/.test(msg) ? "text-port" : "text-starboard"}`}>{msg}</span> : null}
            </div>
          </form>

          {team.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {team.map((m, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-navy">{m.name}{m.invited ? <span className="ml-2 rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold text-teal">invited</span> : null}</span>
                  <span className="text-xs text-slate-400 capitalize">{m.employment}{m.quals ? ` · ${m.quals} qual${m.quals > 1 ? "s" : ""}` : ""}{m.courses ? ` · teaches ${m.courses}` : ""}</span>
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

      {/* STEP 4 — rota PDF layout */}
      {step === 4 ? (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-navy">Your rota PDF</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">The roster you download and pin up or email. Choose what goes on it and how it is laid out; you can change this later under Settings → Rota PDF.</p>
          <RotaTemplateForm initial={DEFAULT_ROTA_TEMPLATE} compact onSaved={() => setStep(5)} />
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(3)} className="text-sm font-semibold text-slate-500 hover:text-navy">← Back</button>
            <button onClick={() => setStep(5)} className="text-sm font-semibold text-slate-500 hover:text-navy">Keep the defaults →</button>
          </div>
        </div>
      ) : null}

      {/* STEP 5 — finish + funnel for chosen extras */}
      {step === 5 ? (
        <div className="rounded-card border border-slate-200 bg-white p-8">
          <p className="text-center font-display text-2xl font-semibold text-navy">🎉 You&apos;re ready to roster</p>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600">
            {selectedCourses.size} course type{selectedCourses.size === 1 ? "" : "s"} and {team.length} team member{team.length === 1 ? "" : "s"} set up.
          </p>

          {/* Promote booking-system integration */}
          <div className="mx-auto mt-6 max-w-md rounded-lg border border-teal/40 bg-teal/5 p-4">
            <p className="font-semibold text-navy">Already take bookings elsewhere?</p>
            <p className="mt-1 text-sm text-slate-600">Connect WebCollect, Bookwhen, Eola, Class4Kids and more to feed your courses in automatically — no re-typing.</p>
            <a href="/office/integrations" className="mt-3 inline-block rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">Connect a booking system →</a>
          </div>

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
