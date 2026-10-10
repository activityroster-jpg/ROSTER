"use client";

import { useEffect, useState } from "react";
import { isStaleActionError } from "@/lib/ui/stale-action";

/**
 * In-app error boundary. Keeps a runtime error inside the app shell, shows a
 * short reference, and lets the user report it (which stores a triage-able record
 * bucketed by centre and emails the platform owner).
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reported, setReported] = useState<"idle" | "sending" | "done">("idle");
  // A page left open across an update: reloading fixes it; nothing to report.
  const stale = isStaleActionError(error.message);

  useEffect(() => {
    console.error("[app] render error:", error.message, error.digest);
  }, [error]);

  const report = async () => {
    setReported("sending");
    try {
      await fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message || "Unknown client error",
          digest: error.digest,
          path: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
    } catch { /* ignore */ }
    setReported("done");
  };

  if (stale) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-xl font-semibold text-navy">ActivityRoster has just been updated</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">This page was opened before the update, so that didn&rsquo;t go through. Reload the page and try again.</p>
        <button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Reload the page</button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-xl font-semibold text-navy">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        We hit a snag loading this page. Try again — if it keeps happening, report it and we&apos;ll look into it.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p> : null}

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
          Try again
        </button>
        <a href="/office" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">
          Back to dashboard
        </a>
        {reported === "done" ? (
          <span className="self-center text-sm text-starboard">✓ Reported — thank you</span>
        ) : (
          <button onClick={report} disabled={reported === "sending"} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">
            {reported === "sending" ? "Reporting…" : "Report this problem"}
          </button>
        )}
      </div>
    </div>
  );
}
