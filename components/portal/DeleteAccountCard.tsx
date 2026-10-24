"use client";

import { useState, useTransition } from "react";
import { deleteMyAccountAction } from "@/app/(app)/portal/actions";

/** Delete my account, from inside the app: what goes, what stays, your PIN to confirm, then it is done. */
export function DeleteAccountCard({ after }: { after: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      {!open ? (
        <>
          <p className="mb-1 text-xs text-slate-500">Delete your ActivityRoster account and personal details. It happens straight away, from here.</p>
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-red-700 hover:underline">Delete my account →</button>
        </>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-navy">Delete your account?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
            <li>Your login, devices and notifications are removed now.</li>
            <li>In every centre you belong to, your profile, certificates, checks, availability and documents are removed.</li>
            <li>Past roster and pay records stay under “Former staff member”, because centres must keep working-time and pay records for the statutory period.</li>
            <li>This cannot be undone. If you own a centre, hand it over first.</li>
          </ul>
          <label className="mt-3 block text-xs font-medium text-slate-600">Enter your 4-digit PIN to confirm
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" aria-label="PIN" className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-red-500" />
          </label>
          {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={pending || pin.length !== 4} onClick={() => start(async () => {
              setErr(null);
              const r = await deleteMyAccountAction(pin);
              if (!r.ok) { setErr(r.error ?? "Could not delete the account"); return; }
              try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
              window.location.href = after;
            })} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{pending ? "Deleting…" : "Delete my account"}</button>
            <button type="button" onClick={() => { setOpen(false); setPin(""); setErr(null); }} className="text-sm text-slate-500 hover:text-navy">Keep my account</button>
          </div>
        </div>
      )}
    </div>
  );
}
