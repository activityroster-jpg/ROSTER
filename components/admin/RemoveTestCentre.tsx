"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { removeTestCentreAction } from "@/app/admin/actions";

/**
 * For centres the platform owner set up to try things out. Removes the centre,
 * everything in it, its uploaded files and the logins that belong only to it,
 * straight away, so the same emails can sign up again. Customers leaving use
 * the 90-day route instead (EraseCentre).
 */
export function RemoveTestCentre({ id, slug, members, liveSubscription }: { id: string; slug: string; members: number; liveSubscription: boolean }) {
  const [pending, start] = useTransition();
  const [isTest, setIsTest] = useState(false);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const ready = isTest && typed.trim().toLowerCase() === slug && !liveSubscription;
  const run = () => start(async () => {
    if (!await askConfirm(`Remove ${slug} now? The centre, everything in it and its logins are deleted straight away. This cannot be undone.`)) return;
    const r = await removeTestCentreAction({ id, confirmSlug: typed, confirmedTest: isTest });
    // On success the action takes you back to the Dev Center overview.
    if (r && !r.ok) setMsg(r.error ?? "Failed");
  });
  return (
    <div className="rounded-xl border border-port/30 bg-port/5 p-4">
      <h3 className="font-semibold text-port">Remove test centre</h3>
      <p className="mt-1 text-xs text-slate-600">
        Only for centres you set up yourself to test. Deletes the centre, all its records and uploaded files, and the {members === 1 ? "login" : `${members} logins`} that belong only to it, straight away, so the same emails can sign up again.
        A login that is also in another centre is kept, and so is your Dev Center login. A customer who is leaving gets the 90-day route above instead.
      </p>
      {liveSubscription ? (
        <p className="mt-2 text-xs font-medium text-port">This centre has a live Stripe subscription. Cancel it in Stripe first; then it can be removed here.</p>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        This is a test centre, not a customer
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${slug} to confirm`} className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" aria-label="Type the centre's address to confirm" />
        <button disabled={pending || !ready} onClick={run} className="rounded-lg bg-port px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{pending ? "Removing…" : "Remove test centre now"}</button>
      </div>
      {msg ? <p className="mt-2 text-xs text-port">{msg}</p> : null}
    </div>
  );
}
