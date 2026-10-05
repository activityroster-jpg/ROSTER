"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFairUseAction } from "@/app/admin/actions";

/** The three fair use figures (decided 5 Oct). Nothing here blocks a centre for its size. */
export function FairUseForm({ fairUsePeople, fairUseAlertAt, inviteDailyCap }: { fairUsePeople: number; fairUseAlertAt: number; inviteDailyCap: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [people, setPeople] = useState(String(fairUsePeople));
  const [alertAt, setAlertAt] = useState(String(fairUseAlertAt));
  const [cap, setCap] = useState(String(inviteDailyCap));
  const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setFairUseAction({ fairUsePeople: Number(people), fairUseAlertAt: Number(alertAt), inviteDailyCap: Number(cap) });
      if (res.ok) { setMsg("Saved"); router.refresh(); } else setMsg(res.error ?? "Failed");
    });
  };
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-xs font-semibold text-slate-500">Fair use figure (people)
        <input value={people} onChange={(e) => setPeople(e.target.value)} type="number" min="50" className={field} />
        <span className="mt-1 block font-normal text-slate-400">Quoted in the Terms: above this we agree the right plan with the centre.</span>
      </label>
      <label className="text-xs font-semibold text-slate-500">Flag a centre here at (people)
        <input value={alertAt} onChange={(e) => setAlertAt(e.target.value)} type="number" min="10" className={field} />
        <span className="mt-1 block font-normal text-slate-400">Listed below so you can get in touch early. Nothing is blocked.</span>
      </label>
      <label className="text-xs font-semibold text-slate-500">Invite emails per centre per day
        <input value={cap} onChange={(e) => setCap(e.target.value)} type="number" min="10" className={field} />
        <span className="mt-1 block font-normal text-slate-400">Anything over goes automatically the next day.</span>
      </label>
      <div className="sm:col-span-3">
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        {msg ? <span className="ml-3 text-sm text-slate-500">{msg}</span> : null}
        <p className="mt-2 text-xs text-slate-400">The Terms and the pricing page use these figures straight away. The Learning Centre and Help answers quote 500 and 200 in words, so ask for them to be updated if you change these.</p>
      </div>
    </div>
  );
}
