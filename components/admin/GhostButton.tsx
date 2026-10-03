"use client";

import { useState, useTransition } from "react";
import { startGhostAction } from "@/app/admin/actions";

/** Compact "open this centre in Ghost Mode" button for lists (errors, overview). */
export function GhostButton({ orgId }: { orgId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => start(async () => { const r = await startGhostAction(orgId); if (r && !r.ok) setErr(r.error ?? "Failed"); })} disabled={pending} title="See their office read-only" className="rounded-md bg-violet-700/10 px-2 py-0.5 text-xs font-semibold text-violet-800 hover:bg-violet-700/20 disabled:opacity-50">
        {pending ? "Opening…" : "👻 Ghost"}
      </button>
      {err ? <span className="text-xs text-port">{err}</span> : null}
    </span>
  );
}
