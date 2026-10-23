"use client";

import { useState, useTransition } from "react";
import { changeSlugAction } from "@/app/(app)/office/settings/actions";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);

/**
 * The centre's web address ({slug}.activityroster.com). It can be changed once,
 * within 30 days of signing up, by the owner; after that it is fixed, because
 * every link the team has been sent points at it.
 */
export function WebAddressCard({ slug, apex, canChange, reason }: { slug: string; apex: string; canChange: boolean; reason: string }) {
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState(slug);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setMsg(null);
    if (next === slug) { setEditing(false); return; }
    if (!window.confirm(`Change your web address to ${next}.${apex}? The old address stops working straight away, and anyone with the old link will need the new one. This can only be done once.`)) return;
    start(async () => {
      const r = await changeSlugAction(next);
      if (!r.ok) { setMsg(r.error ?? "Could not change the address"); return; }
      // Same sign-in, new address: carry on in the office there.
      window.location.href = `https://${next}.${apex}/office/settings`;
    });
  };

  return (
    <div>
      <p className="text-sm text-slate-600">Your team opens the office and the portal at <span className="font-semibold text-navy">{slug}.{apex}</span>.</p>
      {editing ? (
        <div className="mt-3">
          <div className="flex max-w-md items-stretch rounded-lg border border-slate-300 focus-within:border-teal">
            <input value={next} onChange={(e) => setNext(slugify(e.target.value))} aria-label="New web address" autoFocus className="w-0 flex-1 rounded-l-lg px-3 py-2 text-sm text-navy outline-none" />
            <span className="flex items-center rounded-r-lg bg-slate-50 px-3 text-sm text-slate-500">.{apex}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={save} disabled={pending || next.length < 3} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Changing…" : "Change address"}</button>
            <button type="button" onClick={() => { setEditing(false); setNext(slug); setMsg(null); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      ) : canChange ? (
        <button type="button" onClick={() => setEditing(true)} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">Change the address</button>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">{reason}</p>
      {msg ? <p className="mt-2 text-sm text-port">{msg}</p> : null}
    </div>
  );
}
