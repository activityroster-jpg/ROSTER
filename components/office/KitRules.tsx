"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setKitRulesAction } from "@/app/(app)/office/course-setup/actions";
import { describeKitRule, type KitRule } from "@/lib/domain/kit";

interface Type { id: string; name: string }

/**
 * Kit rules per course type (built, off by default): what kit a course of this
 * type needs, fixed or per so many students. Only used when Settings → "Use kit
 * rules" is ticked; then a new course gets its equipment from them.
 */
export function KitRules({ courseTypes, equipmentTypes, rules, enabled }: { courseTypes: Type[]; equipmentTypes: Type[]; rules: Record<string, KitRule[]>; enabled: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const typeName = (id: string) => equipmentTypes.find((t) => t.id === id)?.name ?? "Equipment";
  return (
    <div className="mt-6 rounded-card border border-slate-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-navy">Kit rules <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${enabled ? "bg-starboard/15 text-starboard" : "bg-slate-100 text-slate-500"}`}>{enabled ? "On" : "Off"}</span></h2>
        <a href="/learn?topic=equipment" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        What each kind of course needs, for example one Pico per two students and one safety boat. {enabled
          ? "A new course gets this kit automatically, worked out from the students booked; you can still change it on the course."
          : <>These are only used once you tick <a href="/office/settings" className="text-teal hover:underline">Settings → Use kit rules</a>.</>}
      </p>
      {equipmentTypes.length === 0 ? <p className="text-sm text-slate-400">Add equipment types on the Equipment page first.</p> : (
        <ul className="divide-y divide-slate-100">
          {courseTypes.map((ct) => (
            <li key={ct.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-navy">{ct.name}</span>
                <span className="flex-1 text-xs text-slate-500">{(rules[ct.id] ?? []).map((r) => describeKitRule(r, typeName(r.equipmentTypeId))).join(" · ") || "No kit rules"}</span>
                <button type="button" onClick={() => setOpen(open === ct.id ? null : ct.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-navy hover:bg-slate-50">{open === ct.id ? "Close" : "Edit"}</button>
              </div>
              {open === ct.id ? <KitEditor courseTypeId={ct.id} equipmentTypes={equipmentTypes} initial={rules[ct.id] ?? []} onDone={() => setOpen(null)} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KitEditor({ courseTypeId, equipmentTypes, initial, onDone }: { courseTypeId: string; equipmentTypes: Type[]; initial: KitRule[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lines, setLines] = useState<{ equipmentTypeId: string; quantity: number; perStudents: number | null }[]>(initial.length ? initial : [{ equipmentTypeId: equipmentTypes[0]!.id, quantity: 1, perStudents: null }]);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const field = "rounded border border-slate-300 px-1.5 py-0.5 text-sm";
  const save = () => start(async () => {
    const r = await setKitRulesAction({ courseTypeId, rules: lines });
    setMsg(r.ok ? r.message ?? "Saved" : r.error ?? "Failed");
    if (r.ok) { router.refresh(); onDone(); }
  });
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
      {lines.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="number" min={1} max={100} value={l.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} aria-label="How many" className={`${field} w-16`} />
          <span>×</span>
          <select value={l.equipmentTypeId} onChange={(e) => set(i, { equipmentTypeId: e.target.value })} aria-label="Equipment type" className={field}>
            {equipmentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={l.perStudents == null ? "fixed" : "per"} onChange={(e) => set(i, { perStudents: e.target.value === "fixed" ? null : (l.perStudents ?? 2) })} aria-label="Fixed or per students" className={field}>
            <option value="fixed">for the course</option>
            <option value="per">per students</option>
          </select>
          {l.perStudents != null ? <><span>for every</span><input type="number" min={1} max={50} value={l.perStudents} onChange={(e) => set(i, { perStudents: Number(e.target.value) })} aria-label="Students" className={`${field} w-14`} /><span>students</span></> : null}
          <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-port hover:underline">Remove</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setLines((ls) => [...ls, { equipmentTypeId: equipmentTypes[0]!.id, quantity: 1, perStudents: null }])} className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-navy hover:bg-white">+ Add a line</button>
        <button type="button" disabled={pending} onClick={save} className="rounded bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save kit rules"}</button>
        {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
      </div>
    </div>
  );
}
