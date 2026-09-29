"use client";

import { useEffect } from "react";

/**
 * In-app error boundary. Keeps a runtime error inside the app shell (rather than
 * blanking the whole page) and offers a retry. The detail is logged, never shown.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] render error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-xl font-semibold text-navy">Something went wrong</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        We hit a snag loading this page. Try again — if it keeps happening, refresh or come back shortly.
      </p>
      <div className="mt-5 flex gap-3">
        <button onClick={reset} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
          Try again
        </button>
        <a href="/office" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
