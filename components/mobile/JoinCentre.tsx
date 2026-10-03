"use client";

import { useEffect, useState } from "react";
import { joinCentreByCodeAction, type JoinResult } from "@/app/app/actions";
import { SIGNUP_PHONE_KEY } from "./AppSignup";

export function JoinCentre({ pendingCentre, canSkip }: { pendingCentre: string | null; canSkip: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);
  const [phone, setPhone] = useState<string | undefined>(undefined);
  useEffect(() => { try { setPhone(sessionStorage.getItem(SIGNUP_PHONE_KEY) ?? undefined); } catch { /* ignore */ } }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await joinCentreByCodeAction(code, phone);
      if (!r.ok) { setErr(r.error); return; }
      try { sessionStorage.removeItem(SIGNUP_PHONE_KEY); } catch { /* ignore */ }
      if (r.status === "joined") { window.location.href = "/portal"; return; }
      setResult(r);
    } finally { setBusy(false); }
  };

  if (result && result.ok && result.status !== "joined") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-3xl">✅</p>
        <h1 className="mt-2 font-display text-xl font-bold text-navy">Request sent to {result.centre}</h1>
        <p className="mt-2 text-sm text-slate-600">Your email didn&apos;t match anyone on their staff list yet, so an admin needs to approve you. We&apos;ve let them know — you&apos;ll get an email as soon as they do, then just open the app again.</p>
      </div>
    );
  }

  return (
    <div>
      {pendingCentre ? (
        <div className="mb-5 rounded-xl border border-amber/40 bg-amber/5 p-4 text-sm text-slate-700">
          <p className="font-semibold text-navy">Waiting for {pendingCentre} to approve you</p>
          <p className="mt-1">We&apos;ll email you when they do. If you were given a different code, you can enter it below.</p>
        </div>
      ) : null}
      <h1 className="font-display text-2xl font-bold text-navy">Join your centre</h1>
      <p className="mb-5 text-sm text-slate-500">Enter the 6-character company code from your centre&apos;s admin. It&apos;s shown on their Settings page.</p>
      <form onSubmit={submit} className="space-y-3">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="e.g. 7KD4PX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoFocus className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-teal" />
        {err ? <p className="text-sm text-port">{err}</p> : null}
        <button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Checking…" : "Join centre"}</button>
      </form>
      {canSkip ? <a href="/app/switch" className="mt-4 block text-center text-sm font-medium text-slate-500">Back to my centres</a> : null}
      <p className="mt-6 text-xs text-slate-400">Work for more than one centre? Join each with its own code; switch between them in Settings.</p>
    </div>
  );
}
