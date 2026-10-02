"use client";

import { useTransition } from "react";
import { exitGhostAction } from "@/app/(app)/office/ghost-actions";

/** Only ever rendered for the platform owner's own ghost session — the centre never sees it. */
export function GhostBanner({ centreName }: { centreName: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-violet-300 bg-violet-700 px-6 py-2 text-sm text-white">
      <span>
        <span className="mr-2 rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">Ghost mode</span>
        Viewing <strong>{centreName}</strong> read-only as platform owner. Nothing here can be changed, and the centre can&apos;t see this visit.
      </span>
      <button type="button" onClick={() => start(() => exitGhostAction())} disabled={pending} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60">
        {pending ? "Leaving…" : "Exit ghost mode"}
      </button>
    </div>
  );
}
