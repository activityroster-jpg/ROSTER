"use client";

import { useEffect, useState } from "react";
import { joinCentreByCodeAction, joinCentreByNameAction, type JoinResult } from "@/app/app/actions";
import { SIGNUP_PHONE_KEY } from "./AppSignup";

export interface OfferedCentre { organisationId: string; name: string }

/**
 * Join a centre. If the centre's admin has already put this email on their
 * Instructors list, the centre is offered by name: pick it and you're in, no
 * company code. Anyone else (or someone joining a centre that hasn't listed
 * them yet) enters the centre's 6-character company code.
 */
export function JoinCentre({ pendingCentre, canSkip, offered }: { pendingCentre: string | null; canSkip: boolean; offered: OfferedCentre[] }) {
  const [mode, setMode] = useState<"name" | "code">(offered.length ? "name" : "code");
  const [chosen, setChosen] = useState<string>(offered[0]?.organisationId ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);
  const [phone, setPhone] = useState<string | undefined>(undefined);
  useEffect(() => { try { setPhone(sessionStorage.getItem(SIGNUP_PHONE_KEY) ?? undefined); } catch { /* ignore */ } }, []);

  const finish = (r: JoinResult) => {
    if (!r.ok) { setErr(r.error); return; }
    try { sessionStorage.removeItem(SIGNUP_PHONE_KEY); } catch { /* ignore */ }
    if (r.status === "joined") { window.location.href = "/portal"; return; }
    setResult(r);
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { finish(await joinCentreByCodeAction(code, phone)); } finally { setBusy(false); }
  };

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { finish(await joinCentreByNameAction(chosen, phone)); } finally { setBusy(false); }
  };

  if (result && result.ok && result.status !== "joined") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-3xl">✅</p>
        <h1 className="mt-2 font-display text-xl font-bold text-navy">Request sent to {result.centre}</h1>
        <p className="mt-2 text-sm text-slate-600">Your email didn&apos;t match anyone on their instructor list yet, so an admin needs to approve you. We&apos;ve let them know — you&apos;ll get an email as soon as they do, then just open the app again.</p>
      </div>
    );
  }

  const chosenName = offered.find((c) => c.organisationId === chosen)?.name ?? "centre";
  const button = "w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50";

  return (
    <div>
      {pendingCentre ? (
        <div className="mb-5 rounded-xl border border-amber/40 bg-amber/5 p-4 text-sm text-slate-700">
          <p className="font-semibold text-navy">Waiting for {pendingCentre} to approve you</p>
          <p className="mt-1">We&apos;ll email you when they do. If you were given a different code, you can enter it below.</p>
        </div>
      ) : null}

      {mode === "name" ? (
        <>
          <h1 className="font-display text-2xl font-bold text-navy">{offered.length === 1 ? `Join ${offered[0]!.name}?` : "Join your centre"}</h1>
          <p className="mb-5 text-sm text-slate-500">
            {offered.length === 1
              ? "Your email is already on their instructor list, so there's no code to enter: confirm and you're in."
              : "Your email is on the instructor list at more than one centre. Choose the one to join first; you can add the others afterwards."}
          </p>
          <form onSubmit={submitName} className="space-y-3">
            {offered.length === 1 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-navy">{offered[0]!.name}</div>
            ) : (
              <select value={chosen} onChange={(e) => setChosen(e.target.value)} aria-label="Centre" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-teal">
                {offered.map((c) => <option key={c.organisationId} value={c.organisationId}>{c.name}</option>)}
              </select>
            )}
            {err ? <p className="text-sm text-port">{err}</p> : null}
            <button type="submit" disabled={busy || !chosen} className={button}>{busy ? "Joining…" : `Yes, join ${chosenName}`}</button>
          </form>
          <button type="button" onClick={() => { setMode("code"); setErr(null); }} className="mt-4 block w-full text-center text-sm font-medium text-slate-500">Not your centre? Enter a company code instead</button>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold text-navy">Join your centre</h1>
          <p className="mb-5 text-sm text-slate-500">Enter the 6-character company code from your centre&apos;s admin. It&apos;s shown on their Settings page.</p>
          <form onSubmit={submitCode} className="space-y-3">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="e.g. 7KD4PX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoFocus className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-teal" />
            {err ? <p className="text-sm text-port">{err}</p> : null}
            <button type="submit" disabled={busy || code.length !== 6} className={button}>{busy ? "Checking…" : "Join centre"}</button>
          </form>
          {offered.length ? <button type="button" onClick={() => { setMode("name"); setErr(null); }} className="mt-4 block w-full text-center text-sm font-medium text-slate-500">Back to {offered.length === 1 ? offered[0]!.name : "the centres that listed you"}</button> : null}
        </>
      )}

      {canSkip ? <a href="/app/switch" className="mt-4 block text-center text-sm font-medium text-slate-500">Back to my centres</a> : null}
      <p className="mt-6 text-xs text-slate-400">Work for more than one centre? Join each one (by name if they&apos;ve listed you, or with its code); switch between them in Settings.</p>
    </div>
  );
}
