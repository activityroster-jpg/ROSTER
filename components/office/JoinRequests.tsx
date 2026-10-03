"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveJoinRequestAction, declineJoinRequestAction } from "@/app/(app)/office/staff/actions";

export interface JoinRequestRow { id: string; name: string; email: string | null; phone: string | null; requestedAt: string }

/** People who entered the company code in the app but weren't on the Staff list yet. */
export function JoinRequests({ rows }: { rows: JoinRequestRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (rows.length === 0) return null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Something went wrong");
    router.refresh();
  });
  return (
    <div className="mb-5 rounded-card border border-amber/50 bg-amber/5 p-4">
      <h2 className="font-semibold text-navy">Join requests <span className="ml-1 rounded-full bg-amber/20 px-2 py-0.5 text-xs font-semibold text-amber">{rows.length}</span></h2>
      <p className="mb-3 text-xs text-slate-600">These people entered your company code in the app. Approve to add them to your staff (they get the instructor app straight away), or decline.</p>
      <ul className="divide-y divide-amber/20">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy">{r.name}</p>
              <p className="truncate text-xs text-slate-500">{[r.email, r.phone].filter(Boolean).join(" · ")} · asked {r.requestedAt}</p>
            </div>
            <button type="button" disabled={pending} onClick={() => run(() => approveJoinRequestAction(r.id))} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Approve</button>
            <button type="button" disabled={pending} onClick={() => { if (confirm(`Decline ${r.name}? They'll be told their request wasn't approved.`)) run(() => declineJoinRequestAction(r.id)); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-port hover:text-port disabled:opacity-50">Decline</button>
          </li>
        ))}
      </ul>
      {msg ? <p role="status" className="mt-2 text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
