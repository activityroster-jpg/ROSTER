"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export interface SurplusGroup {
  roleName: string;
  /** Everyone filling this role's places right now. */
  people: { instructorId: string; name: string }[];
  /** How many of them have to come off to fit the new number of places (0 places = all). */
  surplus: number;
}

/**
 * Fewer places than people: the office chooses who comes off the course.
 * Opens when a role is removed or its count lowered while people fill it;
 * the last-added people come pre-ticked.
 */
export function SurplusPicker({ open, groups, busy, onCancel, onConfirm }: {
  open: boolean; groups: SurplusGroup[]; busy: boolean; onCancel: () => void; onConfirm: (instructorIds: string[]) => void;
}) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    const next = new Set<string>();
    for (const g of groups) for (const p of g.people.slice(Math.max(0, g.people.length - g.surplus))) next.add(p.instructorId);
    setTicked(next);
  }, [open, groups]);
  const countIn = (g: SurplusGroup) => g.people.filter((p) => ticked.has(p.instructorId)).length;
  const ready = groups.every((g) => countIn(g) === g.surplus);
  const total = groups.reduce((n, g) => n + g.surplus, 0);
  const toggle = (id: string) => setTicked((t) => { const n = new Set(t); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <ConfirmDialog open={open} title={`Who comes off the course?`} confirmLabel={`Remove ${total} and save`} busy={busy} confirmDisabled={!ready}
      onCancel={onCancel} onConfirm={() => onConfirm([...ticked])}
      consequences={[
        "You've set fewer places than there are people in them. Tick who comes off; the rest stay.",
        "Those ticked come off every day of this course and are told; their unapproved pay lines for it are removed.",
      ]}>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.roleName}>
            <p className="mb-1 text-xs font-semibold text-slate-500">{g.roleName}: choose {g.surplus} of {g.people.length}{countIn(g) !== g.surplus ? <span className="ml-2 font-normal text-port">({countIn(g)} ticked)</span> : null}</p>
            <ul className="space-y-1">
              {g.people.map((p) => (
                <li key={p.instructorId}>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" checked={ticked.has(p.instructorId)} onChange={() => toggle(p.instructorId)} className="h-4 w-4 rounded border-slate-300" />
                    {p.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ConfirmDialog>
  );
}
