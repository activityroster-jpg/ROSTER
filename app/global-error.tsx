"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Reports the error to our /api/report-error endpoint,
 * which forwards to Sentry server-side (PII-scrubbed). Keeps the DSN off the
 * client entirely.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1 style={{ color: "#0F2A3F" }}>Something went wrong</h1>
        <p style={{ color: "#475569" }}>We&apos;ve been notified. Please try again.</p>
        <button
          onClick={reset}
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
          Try again
        </button>
      </body>
    </html>
  );
}
