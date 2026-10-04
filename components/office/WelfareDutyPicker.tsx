"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setWelfareDutyAction } from "@/app/(app)/office/rota/actions";

const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

/**
 * "Welfare on duty" for one day of the roster: a name per slot, from the
 * centre's list in Settings. Office users with roster access can change a
 * day; everyone else just reads it. A note, nothing more.
 */
export function WelfareDutyPicker({ date, slots, bySlot, officers, canEdit }: {
  date: string;
  slots: readonly string[];
  bySlot: Partial<Record<string, string>>;
  officers: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (officers.length === 0) return null;
  const set = (slot: string, name: string) => start(async () => { await setWelfareDutyAction(date, slot, name || null); router.refresh(); });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      <span className="font-semibold uppercase tracking-wide text-slate-400">Welfare on duty</span>
      {slots.map((slot) => (
        <span key={slot} className="flex items-center gap-1">
          <span className="text-slate-400">{SLOT_LABEL[slot] ?? slot}:</span>
          {canEdit ? (
            <select value={bySlot[slot] ?? ""} disabled={pending} onChange={(e) => set(slot, e.target.value)} className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-navy print:appearance-none print:border-0">
              <option value="">—</option>
              {officers.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <span className="font-medium text-navy">{bySlot[slot] ?? "—"}</span>
          )}
        </span>
      ))}
    </div>
  );
}
