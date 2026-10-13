"use client";

import { useState } from "react";
import { bySeniority } from "@/lib/domain/role-rank";

export interface PlaceOption {
  id: string;
  name: string;
  /** The place's instructor-type rank (0 or absent for a place with no type, such as Volunteer). */
  rank?: number;
  qualificationTypeId?: string | null;
}

const OTHER = "__other__";

/**
 * The place (role) drop-down for one course: the places whose instructor type
 * can teach the course, plus places with no type (Volunteer), with "Other…" at
 * the bottom opening the rest. A course nobody has mapped (no instructor types
 * linked to it) lists every place. Higher levels first.
 */
export function PlaceSelect({ value, onChange, places, relevant, relevantLabel = "For this course", ariaLabel, placeholder, className }: {
  value: string;
  onChange: (id: string) => void;
  places: readonly PlaceOption[];
  /** Place ids whose instructor type teaches this course; null or empty = the course has no instructor types linked. */
  relevant: readonly string[] | null | undefined;
  /** The heading over the short list once "Other…" is open. */
  relevantLabel?: string;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const mapped = Boolean(relevant && relevant.length > 0);
  const relevantSet = new Set(relevant ?? []);
  const short = places.filter((p) => !p.qualificationTypeId || relevantSet.has(p.id));
  const rest = places.filter((p) => p.qualificationTypeId && !relevantSet.has(p.id));
  // A place already chosen from the rest stays visible, so the drop-down never shows something it doesn't list.
  const expanded = all || (value !== "" && rest.some((p) => p.id === value));
  const option = (p: PlaceOption) => <option key={p.id} value={p.id}>{p.name}</option>;
  return (
    <select
      value={value}
      onChange={(e) => { if (e.target.value === OTHER) setAll(true); else onChange(e.target.value); }}
      aria-label={ariaLabel}
      className={className}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {!mapped ? bySeniority(places).map(option) : expanded ? (
        <>
          <optgroup label={relevantLabel}>{bySeniority(short).map(option)}</optgroup>
          {rest.length ? <optgroup label="Other instructor types">{bySeniority(rest).map(option)}</optgroup> : null}
        </>
      ) : (
        <>
          {bySeniority(short).map(option)}
          {rest.length ? <option value={OTHER}>Other instructor type…</option> : null}
        </>
      )}
    </select>
  );
}
