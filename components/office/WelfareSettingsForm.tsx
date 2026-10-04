"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setWelfareAction } from "@/app/(app)/office/settings/actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // Monday-first display → JS weekday
const SLOTS = ["AM", "PM", "EV"] as const;
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

export interface WelfareDefaultRow { weekday: number; slot: "AM" | "PM" | "EV"; name: string }

/**
 * Settings → Welfare officers: names (one per line) and who is on duty by
 * default on each day and slot. Not accounts; the roster shows the name.
 */
export function WelfareSettingsForm({ officers, defaults }: { officers: string[]; defaults: WelfareDefaultRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(officers.join("\n"));
  const [grid, setGrid] = useState<Record<string, string>>(Object.fromEntries(defaults.map((d) => [`${d.weekday}|${d.slot}`, d.name])));
  const [msg, setMsg] = useState<string | null>(null);
  const names = text.split("\n").map((s) => s.trim()).filter(Boolean);

  const save = () => start(async () => {
    const d: WelfareDefaultRow[] = [];
    for (const [k, name] of Object.entries(grid)) {
      if (!name || !names.includes(name)) continue;
      const [wd, slot] = k.split("|");
      d.push({ weekday: Number(wd), slot: slot as WelfareDefaultRow["slot"], name });
    }
    const r = await setWelfareAction({ officers: names, defaults: d });
    setMsg(r.ok ? r.message ?? "Saved" : r.error ?? "Failed");
    router.refresh();
  });

  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Welfare officers, one per line</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={"e.g. Sam Patel\nJo Murphy"} className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
      </label>
      {names.length ? (
        <div>
          <p className="text-xs font-medium text-slate-500">Who is on duty by default</p>
          <p className="mb-2 text-xs text-slate-400">Leave a cell blank if nobody is set. You can change any single day on the roster itself.</p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead><tr><th className="px-2 py-1 text-left font-semibold text-slate-500">Slot</th>{DAYS.map((d) => <th key={d} className="px-2 py-1 font-semibold text-slate-500">{d}</th>)}</tr></thead>
              <tbody>
                {SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td className="px-2 py-1 font-medium text-navy">{SLOT_LABEL[slot]}</td>
                    {DAY_INDEX.map((wd) => {
                      const k = `${wd}|${slot}`;
                      return (
                        <td key={k} className="px-1 py-1">
                          <select value={grid[k] ?? ""} onChange={(e) => setGrid((g) => ({ ...g, [k]: e.target.value }))} className="rounded border border-slate-300 px-1.5 py-1 text-xs">
                            <option value="">—</option>
                            {names.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <p className="text-xs text-slate-400">Add at least one name and the roster gains a &ldquo;Welfare on duty&rdquo; line you can set per day.</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
      </div>
    </div>
  );
}
