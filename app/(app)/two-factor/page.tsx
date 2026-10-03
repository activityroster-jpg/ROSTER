"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/office");
type Mode = "totp" | "otp" | "backup";

function TwoFactorInner() {
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const preferred = sp.get("m") === "email" ? "email" : "app";
  const hint = sp.get("h");
  const [mode, setMode] = useState<Mode>(preferred === "app" ? "totp" : "otp");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sentOnce = useRef(false);

  const sendCode = async (quiet = false) => {
    setErr(null); if (!quiet) setNote(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.sendOtp();
      if (res.error) setErr(res.error.message ?? "Could not send a code");
      else { setMode("otp"); setNote(`We've emailed a code${hint ? ` to ${hint}` : ""}.`); }
    } finally { setBusy(false); }
  };

  // Email users get their code the moment the page opens.
  useEffect(() => {
    if (preferred !== "app" && !sentOnce.current) { sentOnce.current = true; void sendCode(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const clean = code.trim();
      const res = mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: clean, trustDevice: true })
        : mode === "otp"
          ? await authClient.twoFactor.verifyOtp({ code: clean, trustDevice: true })
          : await authClient.twoFactor.verifyBackupCode({ code: clean, trustDevice: true });
      if (res.error) { setErr(res.error.message ?? "That code isn't right."); setCode(""); return; }
      window.location.href = next;
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-card border border-slate-200 bg-white p-6">
        <h1 className="font-display text-xl font-semibold text-navy">One more step</h1>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          {mode === "totp" ? "Enter the 6-digit code from your authenticator app." : mode === "otp" ? "Enter the 6-digit code we emailed you." : "Enter one of your backup codes."}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode={mode === "backup" ? "text" : "numeric"} autoComplete="one-time-code" autoFocus placeholder={mode === "backup" ? "backup code" : "123456"} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-xl tracking-widest outline-none focus:border-teal" aria-label="Code" />
          {err ? <p className="text-sm text-port">{err}</p> : null}
          {note ? <p className="text-sm text-starboard">{note}</p> : null}
          <button type="submit" disabled={busy || code.trim().length < 6} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Checking…" : "Continue"}</button>
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs">
          {mode === "otp" ? (
            <button type="button" onClick={() => void sendCode()} disabled={busy} className="font-medium text-teal hover:underline disabled:opacity-50">Send it again</button>
          ) : (
            <button type="button" onClick={() => void sendCode()} disabled={busy} className="font-medium text-teal hover:underline disabled:opacity-50">Email me a code{preferred === "app" ? " instead" : ""}</button>
          )}
          {preferred === "app" && mode !== "totp" ? <button type="button" onClick={() => { setMode("totp"); setNote(null); }} className="font-medium text-teal hover:underline">Use my authenticator app</button> : null}
          {mode !== "backup" ? <button type="button" onClick={() => { setMode("backup"); setNote(null); }} className="font-medium text-slate-500 hover:text-navy">Use a backup code</button> : null}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400"><a href="/sign-in" className="hover:underline">← Back to sign in</a></p>
    </div>
  );
}

export default function TwoFactorPage() {
  return <Suspense fallback={null}><TwoFactorInner /></Suspense>;
}
