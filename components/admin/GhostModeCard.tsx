"use client";

import { useState, useTransition } from "react";
import { startGhostAction } from "@/app/admin/actions";

export interface GhostSessionRow { id: string; kind: string; at: string; who: string | null }

/** Start a read-only, invisible view of a centre's office, and list past ghost visits. */
export function GhostModeCard({ orgId, centreName, sessions }: { orgId: string; centreName: string; sessions: GhostSessionRow[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const go = () => start(async () => {
    const r = await startGhostAction(orgId);
    if (r && !r.ok) setErr(r.error ?? "Could not start ghost mode");
  });
  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        See exactly what <strong>{centreName}</strong> sees — every page of their office, read-only. No changes are possible, nothing is written
        to their audit log, and they aren&apos;t notified. The visit is logged here, for 30 minutes at a time.
      </p>
      <button type="button" onClick={go} disabled={pending} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
        {pending ? "Opening…" : "👻 Open in Ghost Mode"}
      </button>
      {err ? <span className="ml-3 text-sm text-port">{err}</span> : null}
      {sessions.length ? (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent ghost visits</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">{s.kind === "ghost_start" ? "Started" : "Ended"}{s.who ? ` · ${s.who}` : ""}</span>
                <span className="text-xs text-slate-400">{s.at}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
