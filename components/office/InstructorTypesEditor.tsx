"use client";

import { Hint } from "@/components/ui";

import { useMemo, useState } from "react";
import { approvalCourses, coursesTaught, rulesByCourse, type TeachingData } from "@/lib/domain/teaching";
import { groupByLadder } from "@/lib/domain/ladders";

export interface TypesValue { typeIds: Set<string>; approvedIds: Set<string> }

/**
 * The approvals worth saving for these types: the Principal's approval on a
 * course that needs it for them, and a tick on a course no instructor type is
 * linked to. An approval left over from a type they no longer hold is dropped.
 */
export function approvalsToSave(data: TeachingData, value: TypesValue): string[] {
  const byCourse = rulesByCourse(data.rules);
  const eligible = new Set(approvalCourses(byCourse, value.typeIds));
  const unmapped = new Set(data.courses.filter((c) => !byCourse.has(c.id)).map((c) => c.id));
  return [...value.approvedIds].filter((id) => eligible.has(id) || unmapped.has(id));
}

/** How many of the centre's courses these types (and approvals) let someone teach. */
export function taughtCount(data: TeachingData, value: TypesValue): number {
  const staffing = new Map<string, string[]>();
  for (const r of data.staffing) staffing.set(r.courseTypeId, [...(staffing.get(r.courseTypeId) ?? []), r.qualificationTypeId]);
  return coursesTaught(data.courses, rulesByCourse(data.rules), value.typeIds, value.approvedIds, new Map(data.types.map((t) => [t.id, { discipline: t.discipline }])), staffing).size;
}

/**
 * Tick the instructor types someone holds (as many as apply), grouped by
 * ladder. The courses they can teach follow from the types (the centre's
 * course map) and show underneath, read-only; a course that needs the
 * Principal's approval for their type gets its own tick, and so does a course
 * no instructor type is linked to yet. The ladders that matter for the
 * centre's courses show first; "Show every instructor type" opens the rest.
 * Used in the setup wizard, when adding someone, and on their profile.
 */
export function InstructorTypesEditor({ data, value, onChange, personName, compact = false }: {
  data: TeachingData;
  value: TypesValue;
  onChange: (next: TypesValue) => void;
  /** "Sam", or "they" when the person has no name yet. */
  personName?: string;
  compact?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const who = personName?.trim() || "they";
  const byCourse = useMemo(() => rulesByCourse(data.rules), [data.rules]);
  const typeInfo = useMemo(() => new Map(data.types.map((t) => [t.id, { discipline: t.discipline }])), [data.types]);
  const staffing = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of data.staffing) m.set(r.courseTypeId, [...(m.get(r.courseTypeId) ?? []), r.qualificationTypeId]);
    return m;
  }, [data.staffing]);

  const relevant = new Set(data.relevantTypeIds);
  const limited = relevant.size > 0 && !showAll;
  const shownTypes = limited ? data.types.filter((t) => relevant.has(t.id) || value.typeIds.has(t.id)) : data.types;
  const hiddenCount = data.types.length - shownTypes.length;
  const groups = groupByLadder(shownTypes);

  const approvalIds = new Set(approvalCourses(byCourse, value.typeIds));
  const approvalList = data.courses.filter((c) => approvalIds.has(c.id));
  const unmapped = data.courses.filter((c) => !byCourse.has(c.id));
  const taught = coursesTaught(data.courses, byCourse, value.typeIds, value.approvedIds, typeInfo, staffing);
  const taughtList = data.courses.filter((c) => taught.has(c.id));

  const toggle = (set: "typeIds" | "approvedIds", id: string, on: boolean) => {
    const next = new Set(value[set]);
    if (on) next.add(id); else next.delete(id);
    onChange({ ...value, [set]: next });
  };
  const head = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy">Instructor types {who === "they" ? "they hold" : `${who} holds`} <span className="text-xs font-normal text-slate-400">({value.typeIds.size} ticked · tick every one that applies)</span><Hint text="An instructor type is a qualification such as Dinghy Instructor or Senior Instructor. It decides which places on a course this person can fill; a higher type on the same ladder can fill a lower place." /></p>
          <a href="/learn?topic=instructor-types" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
        </div>
        <div className={`space-y-3 rounded-lg border border-slate-200 p-3 ${compact ? "max-h-80 overflow-y-auto" : ""}`}>
          {groups.length === 0 ? <p className="text-xs text-slate-400">No instructor types on your list yet. Add them in Settings → Instructor types.</p> : groups.map((g) => (
            <fieldset key={g.key}>
              <legend className={`mb-1 ${head}`}>{g.label}</legend>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {g.types.map((t) => (
                  <label key={t.id} className="flex items-start gap-2 text-sm text-navy">
                    <input type="checkbox" className="mt-0.5" checked={value.typeIds.has(t.id)} onChange={(e) => toggle("typeIds", t.id, e.target.checked)} />
                    <span>{t.name}{t.code && !/_/.test(t.code) ? <span className="ml-1 text-[10px] text-slate-400">{t.code}</span> : null}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {relevant.size > 0 ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-teal hover:underline">
              {showAll ? "Show only the types for your courses" : `Show every instructor type (${hiddenCount} more)`}
            </button>
          ) : null}
        </div>
      </div>

      {approvalList.length ? (
        <div>
          <p className="text-sm font-medium text-navy">Principal&rsquo;s approval</p>
          <p className="mb-1.5 text-xs text-slate-500">With {who === "they" ? "their" : `${who}'s`} instructor type, these courses can be taught only with the Principal&rsquo;s or Chief Instructor&rsquo;s approval. Tick the ones they&rsquo;re approved for.</p>
          <div className="grid gap-x-4 gap-y-1 rounded-lg border border-amber/30 bg-amber/5 p-3 sm:grid-cols-2">
            {approvalList.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-navy">
                <input type="checkbox" checked={value.approvedIds.has(c.id)} onChange={(e) => toggle("approvedIds", c.id, e.target.checked)} />
                Approved to teach {c.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {unmapped.length ? (
        <div>
          <p className="text-sm font-medium text-navy">Other courses {who === "they" ? "they" : who} can teach</p>
          <p className="mb-1.5 text-xs text-slate-500">These courses aren&rsquo;t linked to an instructor type yet (link them in Course setup and this list goes away). Tick the ones {who === "they" ? "they" : who} can teach.</p>
          <div className="grid max-h-48 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            {unmapped.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-navy">
                <input type="checkbox" checked={value.approvedIds.has(c.id)} onChange={(e) => toggle("approvedIds", c.id, e.target.checked)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className={head}>Courses {who === "they" ? "they" : who} can teach ({taughtList.length})</p>
        {taughtList.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">{value.typeIds.size ? "None of your courses yet with these types." : "Tick their instructor types and the courses they can teach appear here."}</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {taughtList.map((c) => <li key={c.id} className="rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal">{c.name}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
