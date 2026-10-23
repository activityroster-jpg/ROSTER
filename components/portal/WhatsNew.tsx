"use client";

import { useEffect, useState } from "react";

const KEY = "ar.build.seen";

/**
 * One line on first open after the web app changed behind the native shell
 * (or in the browser), so "it looks different" has an answer. Compares the
 * build id baked in at deploy time with the one last seen on this device.
 */
export function WhatsNew({ buildId }: { buildId: string | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!buildId) return;
    try {
      const seen = localStorage.getItem(KEY);
      if (seen && seen !== buildId) setShow(true);
      localStorage.setItem(KEY, buildId);
    } catch { /* private mode */ }
  }, [buildId]);
  if (!show) return null;
  return (
    <div role="status" className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border border-teal/40 bg-teal/5 px-3 py-2 text-xs text-navy">
      <span><span className="font-semibold">ActivityRoster has been updated</span> since you last opened it, so some screens may look a little different. Everything is where it was.</span>
      <button type="button" onClick={() => setShow(false)} aria-label="Dismiss" className="flex-none rounded-md px-2 py-1 font-semibold text-teal hover:bg-teal/10">OK</button>
    </div>
  );
}
