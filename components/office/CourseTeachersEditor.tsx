"use client";

import { useState } from "react";
import type { TypeOption } from "@/lib/domain/teaching";
import { groupByLadder } from "@/lib/domain/ladders";

export interface TeacherTick { typeId: string; needsApproval: boolean; alsoRequiresTypeId?: string | null }

/**
 * "Who can teach it" for one course type: tick the instructor types that can
 * teach it, each either outright or only with the Principal's approval. The
 * types on the course's own ladder (and any already ticked) show first;
 * "Other instructor type…" opens the rest. Certificates (no ladder) never
 * teach on their own, so they aren't offered; an existing "also needs" one
 * shows beside its type.
 */
export function CourseTeachersEditor({ types, value, onChange, ladder, courseName }: {
  types: TypeOption[];
  value: TeacherTick[];
  onChange: (rows: TeacherTick[]) => void;
  /** The course's activity ladder (from its scheme), for the short list; null shows every type. */
  ladder: string | null;
  courseName?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const teaching = types.filter((t) => t.discipline);
  const ticked = new Map(value.map((v) => [v.typeId, v]));
  const relevant = teaching.filter((t) => ticked.has(t.id) || (ladder !== null && t.discipline === ladder));
  const limited = relevant.length > 0 && !showAll;
  const shown = limited ? relevant : teaching;
  const nameOf = (id: string | null | undefined) => types.find((t) => t.id === id)?.name ?? "a certificate";

  const toggle = (typeId: string, on: boolean) => onChange(on ? [...value, { typeId, needsApproval: false }] : value.filter((v) => v.typeId !== typeId));
  const setApproval = (typeId: string, needsApproval: boolean) => onChange(value.map((v) => (v.typeId === typeId ? { ...v, needsApproval } : v)));

  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">Tick every instructor type that can teach {courseName ? <strong className="text-navy">{courseName}</strong> : "this course"}. A higher type on the same ladder doesn&apos;t count unless it&apos;s ticked too.</p>
      {teaching.length === 0 ? <p className="text-xs text-slate-400">No instructor types on your list yet: add them in Settings → Instructor types.</p> : (
        <div className="space-y-2">
          {groupByLadder(shown).map((g) => (
            <fieldset key={g.key}>
              <legend className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</legend>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {g.types.map((t) => {
                  const row = ticked.get(t.id);
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-x-2 text-sm text-navy">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={Boolean(row)} onChange={(e) => toggle(t.id, e.target.checked)} />
                        {t.name}
                      </label>
                      {row ? (
                        <select value={row.needsApproval ? "approval" : "always"} onChange={(e) => setApproval(t.id, e.target.value === "approval")} aria-label={`When ${t.name} can teach it`} className="rounded border border-slate-300 px-1 py-0.5 text-[11px]">
                          <option value="always">always</option>
                          <option value="approval">with the Principal&apos;s approval</option>
                        </select>
                      ) : null}
                      {row?.alsoRequiresTypeId ? <span className="text-[11px] text-slate-500">· also needs {nameOf(row.alsoRequiresTypeId)}</span> : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {relevant.length > 0 && relevant.length < teaching.length ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-teal hover:underline">
              {showAll ? "Show only this course's ladder" : "Other instructor type…"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** "AI · DI · SI" for a course's instructor types, for a compact summary. */
export function teacherSummary(types: TypeOption[], rows: readonly TeacherTick[]): string {
  const byId = new Map(types.map((t) => [t.id, t]));
  return rows
    .map((r) => byId.get(r.typeId))
    .filter((t): t is TypeOption => Boolean(t))
    .sort((a, b) => a.rank - b.rank)
    .map((t) => `${t.code && !/_/.test(t.code) ? t.code : t.name}${rows.find((r) => r.typeId === t.id)?.needsApproval ? " (approval)" : ""}`)
    .join(" · ");
}
