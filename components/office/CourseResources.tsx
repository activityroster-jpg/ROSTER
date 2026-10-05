"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setCourseEquipmentAction, setCourseLocationsAction } from "@/app/(app)/office/courses/actions";
import type { CourseResources as Resources, EquipmentContext } from "@/lib/services/course-resources";

export interface ResourceLocation { id: string; name: string; active: boolean }
export interface ResourceUnit { id: string; name: string; typeId: string; status: string }
export interface ResourceType { id: string; name: string; quantity: number | null; inventoryTracked: boolean; active: boolean }

/**
 * Where a course happens and what it uses, editable after creation (audit A6-3,
 * A7). Tracked units are ticked one by one; bulk kit is a quantity per type.
 */
export function CourseResources({ courseId, locations, units, types, initial, showEquipment = true, version: initialVersion = null, context = { unitBusy: {}, typeOthers: {} }, suggestedKit = [] }: {
  courseId: string;
  /** What other courses at the same time already use, for warnings while picking. */
  context?: EquipmentContext;
  /** Kit from the course type's kit rules (only when the centre uses them). */
  suggestedKit?: { equipmentTypeId: string; quantity: number }[];
  /** The course's last-changed time when the page loaded (epoch ms). */
  version?: number | null;
  locations: ResourceLocation[];
  units: ResourceUnit[];
  types: ResourceType[];
  initial: Resources;
  showEquipment?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locationIds, setLocationIds] = useState<string[]>(initial.locationIds);
  const [unitIds, setUnitIds] = useState<string[]>(initial.unitIds);
  const [bulk, setBulk] = useState<Record<string, number>>(Object.fromEntries(initial.bulk.map((b) => [b.equipmentTypeId, b.quantity])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState<number | null>(initialVersion);
  useEffect(() => { setVersion(initialVersion); }, [initialVersion]);

  const locDirty = JSON.stringify([...locationIds].sort()) !== JSON.stringify([...initial.locationIds].sort());
  const eqDirty = JSON.stringify([...unitIds].sort()) !== JSON.stringify([...initial.unitIds].sort()) || JSON.stringify(Object.entries(bulk).filter(([, q]) => q > 0).sort()) !== JSON.stringify(initial.bulk.map((b) => [b.equipmentTypeId, b.quantity]).sort());

  const saveLocations = () => start(async () => {
    const r = await setCourseLocationsAction({ courseId, locationIds, expectedVersion: version });
    setMsg({ ok: r.ok, text: r.ok ? "Locations saved" : r.error ?? "Failed" });
    if (r.ok) { if (r.version) setVersion(r.version); router.refresh(); }
  });
  const saveEquipment = () => start(async () => {
    const r = await setCourseEquipmentAction({ courseId, unitIds, bulk: Object.entries(bulk).filter(([, q]) => q > 0).map(([equipmentTypeId, quantity]) => ({ equipmentTypeId, quantity })), expectedVersion: version });
    setMsg({ ok: r.ok && !r.message?.includes("⚠"), text: r.ok ? (r.message?.includes("⚠") ? `Equipment saved. ${r.message.slice(r.message.indexOf("⚠"))}` : "Equipment saved") : r.error ?? "Failed" });
    if (r.ok) { if (r.version) setVersion(r.version); router.refresh(); }
  });
  const toggle = (set: (f: (ids: string[]) => string[]) => void, id: string) => set((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const visibleLocations = locations.filter((l) => l.active || locationIds.includes(l.id));
  const visibleUnits = units.filter((u) => u.status !== "retired" || unitIds.includes(u.id));
  const bulkTypes = types.filter((t) => (t.active && !t.inventoryTracked) || (bulk[t.id] ?? 0) > 0);
  const box = "max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Locations{locationIds.length ? ` (${locationIds.length})` : ""}</p>
        {visibleLocations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">No locations yet. Add them on the <a href="/office/locations" className="text-teal hover:underline">Locations</a> tab.</p>
        ) : (
          <div className={box}>
            {visibleLocations.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={locationIds.includes(l.id)} onChange={() => toggle(setLocationIds, l.id)} />
                <span className={l.active ? "" : "text-slate-400 line-through"}>{l.name}</span>
              </label>
            ))}
          </div>
        )}
        {locDirty ? <button type="button" onClick={saveLocations} disabled={pending} className="mt-2 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save locations"}</button> : null}
      </div>

      {showEquipment ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Equipment{unitIds.length || Object.values(bulk).some((q) => q > 0) ? ` (${unitIds.length + Object.values(bulk).filter((q) => q > 0).length})` : ""}</p>
          {visibleUnits.length === 0 && bulkTypes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">No equipment yet. Add it on the <a href="/office/equipment" className="text-teal hover:underline">Equipment</a> tab.</p>
          ) : (
            <div className={box}>
              {visibleUnits.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={unitIds.includes(u.id)} onChange={() => toggle(setUnitIds, u.id)} />
                  <span className={u.status === "retired" ? "text-slate-400 line-through" : ""}>{u.name}</span>
                  <span className="text-xs text-slate-400">{typeName.get(u.typeId) ?? ""}</span>
                  {u.status === "maintenance" ? <span className="rounded bg-amber/15 px-1 text-[10px] font-semibold text-amber">in maintenance</span> : null}
                  {context.unitBusy[u.id] ? <span className="rounded bg-amber/15 px-1 text-[10px] font-semibold text-amber">on {context.unitBusy[u.id]} at the same time</span> : null}
                </label>
              ))}
              {bulkTypes.length ? <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bulk kit (how many)</p> : null}
              {suggestedKit.length && !Object.values(bulk).some((q) => q > 0) ? (
                <p className="text-xs text-slate-500">Kit rules suggest {suggestedKit.map((k) => `${k.quantity} × ${typeName.get(k.equipmentTypeId) ?? "kit"}`).join(", ")}. <button type="button" onClick={() => setBulk(Object.fromEntries(suggestedKit.map((k) => [k.equipmentTypeId, k.quantity])))} className="font-medium text-teal hover:underline">Use these</button></p>
              ) : null}
              {bulkTypes.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="number" min={0} max={1000} value={bulk[t.id] ?? 0} onChange={(e) => setBulk((b) => ({ ...b, [t.id]: Math.max(0, Number(e.target.value) || 0) }))} aria-label={`${t.name} needed`} className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm outline-none focus:border-teal" />
                  <span>× {t.name}</span>
                  {t.quantity !== null ? <span className="text-xs text-slate-400">of {t.quantity}</span> : null}
                  {t.quantity !== null && (bulk[t.id] ?? 0) > 0 && (bulk[t.id] ?? 0) + (context.typeOthers[t.id] ?? 0) > t.quantity
                    ? <span className="rounded bg-amber/15 px-1 text-[10px] font-semibold text-amber">other courses at the same time need {context.typeOthers[t.id] ?? 0}: short by {(bulk[t.id] ?? 0) + (context.typeOthers[t.id] ?? 0) - t.quantity}</span>
                    : null}
                </label>
              ))}
            </div>
          )}
          {eqDirty ? <button type="button" onClick={saveEquipment} disabled={pending} className="mt-2 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save equipment"}</button> : null}
        </div>
      ) : null}
      {msg ? <p className={`sm:col-span-2 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
