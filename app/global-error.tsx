"use client";

import { useEffect } from "react";
import { isStaleActionError } from "@/lib/ui/stale-action";

/**
 * Root error boundary. Reports the error to our /api/report-error endpoint,
 * which forwards to Sentry server-side (PII-scrubbed). Keeps the DSN off the
 * client entirely.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // A page left open across an update: not a bug, reload fixes it, so don't report it.
  const stale = isStaleActionError(error.message);
  useEffect(() => {
    if (stale) return;
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest }),
    }).catch(() => {});
  }, [error, stale]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1 style={{ color: "#0F2A3F" }}>{stale ? "ActivityRoster has just been updated" : "Something went wrong"}</h1>
        <p style={{ color: "#475569" }}>{stale ? "This page was opened before the update. Reload it to carry on." : "We\u2019ve been notified. Please try again."}</p>
        <button
          onClick={stale ? () => window.location.reload() : reset}
          style={{
            marginTop: "1rem",
            background: "#0C6B74",
            color: "white",
            border: 0,
            borderRadius: 8,
            padding: "0.6rem 1.2rem",
            cursor: "pointer",
          }}
        >
          {stale ? "Reload the page" : "Try again"}
        </button>
      </body>
    </html>
  );
}
