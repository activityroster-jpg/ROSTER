"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMyLicenceAction, addMyCustomLicenceAction } from "@/app/(app)/portal/documents/actions";

export interface LicenceType { id: string; name: string }

/** Lets an instructor add a cert to their own record — one from the centre's
 *  list, or a custom one the centre doesn't list yet. */
export function AddLicence({ types }: { types: LicenceType[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState("");
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const addFromList = () => {
    if (!typeId) return;
    setMsg(null);
    start(async () => {
      const res = await addMyLicenceAction(typeId);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Added" : res.error ?? "Failed" });
      if (res.ok) { setTypeId(""); router.refresh(); }
    });
  };

  const addCustom = () => {
    if (custom.trim().length < 2) { setMsg({ ok: false, text: "Give the cert a name." }); return; }
    setMsg(null);
    start(async () => {
      const res = await addMyCustomLicenceAction(custom);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Added" : res.error ?? "Failed" });
      if (res.ok) { setCustom(""); setShowCustom(false); router.refresh(); }
    });
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <p className="font-semibold text-navy">Add another cert</p>
      <p className="mb-3 text-sm text-slate-500">Hold a licence your centre hasn&apos;t listed? Add it here, then upload a photo of it below.</p>

      <div className="flex flex-wrap items-center gap-2">
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
          <option value="">Choose a cert…</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" onClick={addFromList} disabled={pending || !typeId} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Add</button>
      </div>

      <div className="mt-2">
        {showCustom ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="Name of your cert / licence" className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
            <button type="button" onClick={addCustom} disabled={pending || custom.trim().length < 2} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">Add cert</button>
            <button type="button" onClick={() => { setShowCustom(false); setCustom(""); }} className="text-sm text-slate-400 hover:text-navy">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setShowCustom(true); setMsg(null); }} className="text-sm font-medium text-teal hover:underline">+ My cert isn&apos;t in the list</button>
        )}
      </div>

      {msg ? <p className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </div>
  );
}
