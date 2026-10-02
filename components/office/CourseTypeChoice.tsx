"use client";

import { TYPE_NEW, TYPE_ONEOFF } from "@/lib/domain/course-type-match";

export interface TypeOption { id: string; name: string }

/**
 * Per-row course type picker for import reviews. Pre-set to our best match;
 * unmatched rows default to "one-off" and are flagged so the admin can file
 * them under the right type, add them to the list, or leave them as one-offs.
 */
export function CourseTypeChoice({ value, onChange, types, importedName, matched }: {
  value: string;
  onChange: (v: string) => void;
  types: TypeOption[];
  importedName: string;
  matched: boolean;
}) {
  const unresolved = !matched && value === TYPE_ONEOFF;
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Course type for ${importedName}`}
        className={`max-w-[14rem] rounded border px-1.5 py-1 text-xs ${unresolved ? "border-amber bg-amber/5" : "border-slate-300"}`}
      >
        <optgroup label="Your course types">
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </optgroup>
        <optgroup label="No match">
          <option value={TYPE_NEW}>＋ Add “{importedName.slice(0, 40)}” to my list</option>
          <option value={TYPE_ONEOFF}>One-off (keep off my list)</option>
        </optgroup>
      </select>
      {unresolved ? <span className="text-[10px] font-semibold text-amber">no match</span> : null}
    </span>
  );
}

/** Starting choice for a row: the suggested type, else one-off. */
export const initialChoice = (suggestedTypeId: string | null) => suggestedTypeId ?? TYPE_ONEOFF;
