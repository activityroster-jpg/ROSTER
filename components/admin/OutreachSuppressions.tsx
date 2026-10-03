"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSuppressionAction, removeSuppressionAction, type OutreachResult } from "@/app/admin/outreach/actions";

export function OutreachSuppressions({ rows }: { rows: { email: string; reason: string; note: string | null; createdAt: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<OutreachResult | null>(null);
  const [show, setShow] = useState(false);
  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-navy">Do-not-email list <span className="text-sm font-normal text-slate-400">({rows.length})</span></h2>
        <button onClick={() => setShow(!show)} className="text-sm font-semibold text-teal hover:underline">{show ? "Hide" : "Show"}</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Anyone who opts out, bounces, complains or replies lands here automatically and is never emailed by any campaign. Add an address by hand if someone asks you to stop.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@club.org.uk" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal" />
        <button disabled={pending || !email.trim()} onClick={() => { setMsg(null); start(async () => { const r = await addSuppressionAction(email, "Added by hand"); setMsg(r); if (r.ok) { setEmail(""); router.refresh(); } }); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Add</button>
        {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.ok ? msg.message : msg.error}</span> : null}
      </div>
      {show ? (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {rows.length === 0 ? <li className="py-2 text-slate-400">Empty.</li> : rows.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium text-navy">{r.email}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.reason}</span>
              {r.note ? <span className="text-xs text-slate-400">{r.note}</span> : null}
              <span className="ml-auto text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString("en-GB")}</span>
              <button disabled={pending} onClick={() => { if (!confirm(`Allow emails to ${r.email} again?`)) return; start(async () => { await removeSuppressionAction(r.email); router.refresh(); }); }} className="text-xs text-port hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
