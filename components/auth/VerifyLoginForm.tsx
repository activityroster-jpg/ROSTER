"use client";

import { useEffect, useRef, useState } from "react";
import { checkLoginCodeAction, finishLoginAction, sendLoginCodeAction } from "@/app/verify-login/actions";

export function VerifyLoginForm({ next, emailHint, preVerified }: { next: string; emailHint: string; preVerified: boolean }) {
  const [step, setStep] = useState<"code" | "stay">(preVerified ? "stay" : "code");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const sentOnce = useRef(false);

  const send = async (quiet = false) => {
    setErr(null); if (!quiet) setNote(null);
    setBusy(true);
    try {
      const r = await sendLoginCodeAction();
      if (!r.ok) setErr(r.error ?? "Could not send a code"); else setNote(r.message ?? "Code sent.");
    } finally { setBusy(false); }
  };
  useEffect(() => {
    if (!preVerified && !sentOnce.current) { sentOnce.current = true; void send(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await checkLoginCodeAction(code.trim());
      if (!r.ok) { setErr(r.error ?? "That code isn't right."); setCode(""); return; }
      setStep("stay");
    } finally { setBusy(false); }
  };

  const finish = async (stay: boolean) => {
    setErr(null); setBusy(true);
    try {
      const r = await finishLoginAction(stay, next);
      if (r?.ok && r.next) { window.location.assign(r.next); return; }
      if (r && !r.ok) setErr(r.error ?? "Something went wrong. Please sign in again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-card border border-slate-200 bg-white p-6">
        {step === "code" ? (
          <>
            <h1 className="font-display text-xl font-semibold text-navy">Check your email</h1>
            <p className="mt-1 mb-4 text-sm text-slate-500">We&rsquo;ve sent a 6-digit code to {emailHint}. Enter it to finish signing in.</p>
            <form onSubmit={submitCode} className="space-y-3">
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" aria-label="Code" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-xl tracking-widest outline-none focus:border-teal" />
              {err ? <p className="text-sm text-port">{err}</p> : null}
              {note ? <p className="text-sm text-starboard">{note}</p> : null}
              <button type="submit" disabled={busy || code.trim().length < 6} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Checking…" : "Continue"}</button>
            </form>
            <div className="mt-4 flex justify-between text-xs">
              <button type="button" onClick={() => void send()} disabled={busy} className="font-medium text-teal hover:underline disabled:opacity-50">Send it again</button>
              <a href="/sign-in" className="font-medium text-slate-500 hover:text-navy">← Back to sign in</a>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-navy">Stay signed in?</h1>
            <p className="mt-1 mb-4 text-sm text-slate-500">Either way you&rsquo;ll be asked for your PIN after 30 minutes without activity, and to sign in again after 12 hours away. We only email a code the first time you use a device, or after it has gone 12 hours without using the office.</p>
            {err ? <p className="mb-3 text-sm text-port">{err}</p> : null}
            <button type="button" onClick={() => void finish(true)} disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "One moment…" : "Yes, stay signed in on this device"}</button>
            <button type="button" onClick={() => void finish(false)} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Just this once (sign me out when I close the browser)</button>
            <p className="mt-3 text-xs text-slate-400">Pick &ldquo;just this once&rdquo; on a shared or public computer.</p>
          </>
        )}
      </div>
    </div>
  );
}
