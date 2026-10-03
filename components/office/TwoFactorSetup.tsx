"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { clearTwoFactorPrefsAction, noteTwoFactorEnabledAction, setTwoFactorPrefsAction } from "@/app/(app)/security/actions";

export type TwoFactorMethodChoice = "app" | "email";
type Step = "summary" | "choose" | "password" | "verify" | "done";

const LABEL: Record<TwoFactorMethodChoice, string> = { app: "Authenticator app", email: "Code by email" };

/**
 * Second-step enrolment with a choice of method. Better Auth always creates the
 * TOTP secret + backup codes on enable; for email the person verifies an
 * emailed code instead of scanning anything, and we remember the chosen method
 * so sign-in asks the same way.
 */
export function TwoFactorSetup({ current, redirectTo = "/office" }: {
  current?: { enabled: boolean; method: TwoFactorMethodChoice | null; hint: string | null };
  redirectTo?: string;
}) {
  const [step, setStep] = useState<Step>(current?.enabled ? "summary" : "choose");
  const [method, setMethod] = useState<TwoFactorMethodChoice>("app");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal";
  const primary = "w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50";

  const choose = (m: TwoFactorMethodChoice) => { setMethod(m); setError(null); setStep("password"); };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const pref = await setTwoFactorPrefsAction({ method });
      if (!pref.ok) { setError(pref.error ?? "Could not save your choice"); return; }
      const res = await authClient.twoFactor.enable({ password });
      if (res.error) { setError(res.error.message ?? "Could not start set-up — check your password"); return; }
      const data = res.data;
      if (data && "totpURI" in data) { setTotpUri(data.totpURI); setBackupCodes(data.backupCodes); }
      if (method !== "app") {
        const sent = await authClient.twoFactor.sendOtp();
        if (sent.error) { setError(sent.error.message ?? "Could not send the code"); return; }
        setNote("We've emailed you a 6-digit code.");
      }
      setStep("verify");
    } finally { setBusy(false); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = method === "app"
        ? await authClient.twoFactor.verifyTotp({ code: code.trim() })
        : await authClient.twoFactor.verifyOtp({ code: code.trim() });
      if (res.error) { setError(res.error.message ?? "That code isn't right"); setCode(""); return; }
      await noteTwoFactorEnabledAction();
      setStep("done");
      setTimeout(() => (window.location.href = redirectTo), 1500);
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setError(null); setBusy(true);
    try {
      const sent = await authClient.twoFactor.sendOtp();
      setNote(sent.error ? null : "Sent again.");
      if (sent.error) setError(sent.error.message ?? "Could not resend");
    } finally { setBusy(false); }
  };

  const turnOff = async (e: React.FormEvent, thenChoose: boolean) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await authClient.twoFactor.disable({ password });
      if (res.error) { setError(res.error.message ?? "Could not turn off — check your password"); return; }
      await clearTwoFactorPrefsAction();
      setPassword("");
      if (thenChoose) setStep("choose");
      else { setTurningOff(false); setStep("done"); setNote("Second step turned off."); setTimeout(() => (window.location.href = redirectTo), 1200); }
    } finally { setBusy(false); }
  };

  if (step === "done") {
    return <p className="text-sm font-medium text-starboard">{note && note.startsWith("Second step turned off") ? note : "Your second step is on. Redirecting…"}</p>;
  }

  if (step === "summary" && current) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-starboard">On</span> · {LABEL[current.method ?? "app"]}{current.hint ? ` (${current.hint})` : ""}.
        </p>
        {!turningOff ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => { setTurningOff(true); setNote("change"); }} className="font-semibold text-teal hover:underline">Change method</button>
            <button type="button" onClick={() => { setTurningOff(true); setNote("off"); }} className="text-slate-500 hover:text-port">Turn off</button>
          </div>
        ) : (
          <form onSubmit={(e) => turnOff(e, note === "change")} className="space-y-2">
            <p className="text-xs text-slate-500">{note === "change" ? "Confirm your password to choose a different method." : "Confirm your password to turn the second step off."}</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" className={field} />
            {error ? <p className="text-sm text-port">{error}</p> : null}
            <div className="flex gap-2">
              <button disabled={busy} className={note === "change" ? "rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" : "rounded-lg bg-port px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"}>{busy ? "Please wait…" : note === "change" ? "Continue" : "Turn off"}</button>
              <button type="button" onClick={() => { setTurningOff(false); setError(null); }} className="text-sm text-slate-500">Cancel</button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (step === "choose") {
    const card = (m: TwoFactorMethodChoice, title: string, body: string) => (
      <button key={m} type="button" onClick={() => choose(m)} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-teal">
        <span className="block text-sm font-semibold text-navy">{title}</span>
        <span className="block text-xs text-slate-500">{body}</span>
      </button>
    );
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Choose how you&apos;d like to get your second step at sign-in.</p>
        {card("app", "Authenticator app (most secure)", "Google Authenticator, 1Password, Authy… a code that changes every 30 seconds, works offline.")}
        {card("email", "Code by email", "We email a 6-digit code to your sign-in address each time.")}
        {error ? <p className="text-sm text-port">{error}</p> : null}
      </div>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={start} className="space-y-3">
        <p className="text-sm text-slate-600">{LABEL[method]} · confirm your password to begin.</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" className={field} />
        {error ? <p className="text-sm text-port">{error}</p> : null}
        <div className="flex gap-2">
          <button disabled={busy} className={primary}>{busy ? "Please wait…" : method === "app" ? "Show my set-up code" : "Send me a code"}</button>
          <button type="button" onClick={() => setStep("choose")} className="text-sm text-slate-500">Back</button>
        </div>
      </form>
    );
  }

  // verify
  return (
    <div className="space-y-4">
      {method === "app" ? (
        <div>
          <p className="text-sm text-slate-600">Add this to your authenticator app (paste it as a “setup key” or open it as a link), then enter the 6-digit code it shows.</p>
          {totpUri ? <code className="mt-2 block break-all rounded-lg bg-slate-100 p-3 text-xs text-slate-700">{totpUri}</code> : null}
        </div>
      ) : (
        <p className="text-sm text-slate-600">{note ?? "Enter the 6-digit code."} <button type="button" onClick={resend} disabled={busy} className="font-medium text-teal hover:underline disabled:opacity-50">Resend</button></p>
      )}
      {backupCodes.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-navy">Backup codes — save these somewhere safe. Each works once if you lose your phone or email access.</p>
          <ul className="mt-1 grid grid-cols-2 gap-1 text-xs text-slate-700">{backupCodes.map((c) => <li key={c} className="font-mono">{c}</li>)}</ul>
        </div>
      ) : null}
      <form onSubmit={verify} className="space-y-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={field} />
        {error ? <p className="text-sm text-port">{error}</p> : null}
        <button disabled={busy || code.trim().length < 6} className={primary}>{busy ? "Checking…" : "Confirm & turn on"}</button>
      </form>
    </div>
  );
}
