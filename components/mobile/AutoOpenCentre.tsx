"use client";

import { useEffect, useState } from "react";
import { selectCentreAction } from "@/app/app/actions";

/**
 * Opens the instructor's only centre as soon as the app starts. The selected
 * centre lives in a signed cookie, and cookies can only be written from a
 * Server Action — so the page renders this, which calls the action on mount
 * (the action sets the cookie and redirects to the portal).
 */
export function AutoOpenCentre({ organisationId, name }: { organisationId: string; name: string }) {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    selectCentreAction(organisationId)
      .then((r) => { if (!cancelled && r && !r.ok) setErr(r.error ?? "Could not open your centre"); })
      .catch(() => { if (!cancelled) setErr("Could not open your centre. Pull down to try again."); });
    return () => { cancelled = true; };
  }, [organisationId]);
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-slate-500">Opening <span className="font-semibold text-navy">{name}</span>…</p>
      {err ? (
        <div className="mt-4">
          <p className="text-sm text-port">{err}</p>
          <a href="/app/switch" className="mt-3 inline-block rounded-xl border-2 border-teal px-4 py-2 text-sm font-semibold text-teal">Choose a centre</a>
        </div>
      ) : null}
    </div>
  );
}
