"use client";

import { useEffect, useState } from "react";
import { isStaleActionError } from "@/lib/ui/stale-action";

/** Signed-in areas, where an unexpected failure is worth reporting (the public site has browser-extension noise). */
const REPORTED_AREAS = /^\/(office|portal|admin|app|welcome|set-pin|pin|verify-login|verify-device|security|two-factor)(\/|$)/;

/**
 * Watches for a save that fails without telling anyone (9 Oct: an equipment
 * delete and a location category that "did nothing" / stuck on "Adding…").
 * A page left open across an update holds the old version's save actions,
 * which the new version doesn't recognise; reloading fixes it, so say that.
 * Anything else that fails is reported to the Dev Center error log.
 */
export function ActionFailureWatcher() {
  const [stale, setStale] = useState(false);
  // A save answered with a Cloudflare security check (an HTML page instead of
  // the action's result): the page looks frozen until it is reloaded.
  const [challenged, setChallenged] = useState(false);
  useEffect(() => {
    const seen = new Set<string>();
    const handle = (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
      if (!message) return;
      if (isStaleActionError(message)) { setStale(true); return; }
      if (/unexpected response was received from the server|failed to fetch|load failed/i.test(message)) { setChallenged(true); }
      if (seen.has(message) || !REPORTED_AREAS.test(window.location.pathname)) return;
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
  if (!stale && challenged) {
    return (
      <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-navy px-4 py-3 text-sm text-white shadow-lg print:hidden">
        <span>That didn&rsquo;t go through: the connection was interrupted or a security check got in the way. Reload the page and try again.</span>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-navy">Reload</button>
        <button type="button" onClick={() => setChallenged(false)} className="text-white/70 hover:text-white">Dismiss</button>
      </div>
    );
  }
  if (!stale) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-navy px-4 py-3 text-sm text-white shadow-lg print:hidden">
      <span>ActivityRoster has just been updated, so that change didn&rsquo;t save. Reload the page and try again.</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-navy">Reload</button>
    </div>
  );
}
