"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMyDetailsAction } from "@/app/(app)/portal/settings/actions";

/** Date of birth, under Settings in the instructor app. Optional; only the centre sees it. */
export function DetailsCard({ dateOfBirth }: { dateOfBirth: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dob, setDob] = useState(dateOfBirth ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setMyDetailsAction({ dateOfBirth: dob }); setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error ?? "Could not save" }); if (r.ok) router.refresh(); }); }}
      className="space-y-3"
    >
      <label className="block text-xs font-medium text-slate-500">Date of birth
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required className={`mt-1 ${field} max-w-xs`} />
        <span className="mt-1 block font-normal text-slate-400">Only your centre sees it.</span>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending || !dob} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
