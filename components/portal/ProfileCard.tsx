"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMyProfileAction } from "@/app/(app)/portal/settings/actions";

/** Name and phone, editable by the instructor. The centre sees the change straight away. */
export function ProfileCard({ name, phone, email }: { name: string; phone: string | null; email: string | null }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = n !== name || p !== (phone ?? "");
  const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-navy outline-none focus:border-teal";
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateMyProfileAction({ name: n, phone: p }); setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error ?? "Could not save" }); if (r.ok) router.refresh(); }); }} className="space-y-3">
      <label className="block text-xs font-medium text-slate-500">Your name<input value={n} onChange={(e) => setN(e.target.value)} className={field} autoComplete="name" /></label>
      <label className="block text-xs font-medium text-slate-500">Mobile number <span className="text-slate-400">(so the office can reach you about a shift)</span><input value={p} onChange={(e) => setP(e.target.value)} className={field} inputMode="tel" autoComplete="tel" /></label>
      <p className="text-xs text-slate-400">Sign-in email: {email ?? "—"}. Ask your centre if that needs to change.</p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !dirty} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`} role="status">{msg.text}</span> : null}
      </div>
    </form>
  );
}
