"use client";

import { useEffect, useState } from "react";

/** A save made from a page that was loaded before a new version went live. */
const STALE = /Server Action .*(not found|was not found)|Failed to find Server Action|unexpected response was received from the server/i;

/**
 * Watches for a save that fails without telling anyone (9 Oct: an equipment
 * delete and a location category that "did nothing" / stuck on "Adding…").
 * A page left open across an update holds the old version's save actions,
 * which the new version doesn't recognise; reloading fixes it, so say that.
 * Anything else that fails is reported to the Dev Center error log.
 */
export function ActionFailureWatcher() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const seen = new Set<string>();
    const handle = (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
      if (!message) return;
      if (STALE.test(message)) { setStale(true); return; }
      if (seen.has(message)) return;
      seen.add(message);
      void fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `[unhandled] ${message}`.slice(0, 2000), digest: (reason as { digest?: string })?.digest, path: window.location.pathname }),
      }).catch(() => {});
    };
    const onRejection = (e: PromiseRejectionEvent) => handle(e.reason);
    const onError = (e: ErrorEvent) => handle(e.error ?? e.message);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => { window.removeEventListener("unhandledrejection", onRejection); window.removeEventListener("error", onError); };
  }, []);
  if (!stale) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-navy px-4 py-3 text-sm text-white shadow-lg print:hidden">
      <span>ActivityRoster has just been updated, so that change didn&rsquo;t save. Reload the page and try again.</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-navy">Reload</button>
    </div>
  );
}
