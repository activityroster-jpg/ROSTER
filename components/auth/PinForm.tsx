"use client";

import { useEffect, useState, useTransition } from "react";
import { Logo } from "@/components/Logo";
import { setPinAction, verifyPinAction, resetMyPinAction, requestPinResetCodeAction } from "@/app/pin/actions";
import { biometricPinSaved, biometricsAvailable, forgetBiometricPin, isNative, savePinForBiometrics, unlockPinWithBiometrics } from "@/lib/mobile/native";

export function PinForm({ mode, next, hasPassword = true, userId }: { mode: "enter" | "set"; next: string; hasPassword?: boolean; userId?: string }) {
  const [pin, setPin] = useState("");
  // Inside the app: Face ID / fingerprint can release a PIN saved in the keychain.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [rememberBio, setRememberBio] = useState(false);
  const [bioTried, setBioTried] = useState(false);
  useEffect(() => {
    if (!isNative()) return;
    void biometricsAvailable().then((ok) => {
      setBioAvailable(ok);
      // Face ID / fingerprint is the default inside the app; the PIN is the backup.
      if (ok && mode === "set") setRememberBio(true);
      if (!ok || mode !== "enter" || !biometricPinSaved() || bioTried) return;
      setBioTried(true);
      void unlockPinWithBiometrics().then((saved) => {
        if (!saved) return;
        startTransition(async () => {
          const res = await verifyPinAction(saved, next);
          if (res && !res.ok) { await forgetBiometricPin(); setErr("Your saved PIN no longer matches — enter it to continue."); }
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Forgot-PIN panel: prove it's you with your password, or an emailed code.
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState<string | null>(null);
  const [useCode, setUseCode] = useState(!hasPassword);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      // Save for biometrics BEFORE the action (a successful action redirects away); undo on failure.
      if (rememberBio && bioAvailable && userId) { try { await savePinForBiometrics(userId, pin); } catch { /* ignore */ } }
      const res = mode === "set" ? await setPinAction(pin, confirm, next) : await verifyPinAction(pin, next);
      // On success the action redirects; only failures return here.
      if (res && !res.ok) { if (rememberBio) await forgetBiometricPin(); setErr(res.error ?? "Something went wrong"); setPin(""); setConfirm(""); }
    });
  };

  const sendCode = () => {
    setErr(null);
    startTransition(async () => {
      const r = await requestPinResetCodeAction();
      if (r.ok) setCodeSent(r.message ?? "Code sent."); else setErr(r.error ?? "Couldn't send a code");
    });
  };

  const doReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const r = await resetMyPinAction(next, useCode ? { code } : { password });
      if (r && !r.ok) { setErr(r.error ?? "Couldn't reset PIN"); if (!useCode) setPassword(""); else setCode(""); }
    });
  };

  const pinInput = (value: string, set: (v: string) => void, label: string, autoFocus = false) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="••••"
        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-teal"
      />
    </div>
  );

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center"><Logo variant="onLight" size="sm" /></div>

        {resetOpen ? (
          <>
            <h1 className="text-center font-display text-xl font-bold text-navy">Reset your PIN</h1>
            <p className="mx-auto mt-1 mb-5 max-w-xs text-center text-sm text-slate-500">
              {useCode ? "We'll email you a one-time code to confirm it's really you." : "Confirm it's really you with your password, then choose a new PIN."}
            </p>
            <form onSubmit={doReset} className="space-y-4">
              {useCode ? (
                <>
                  {codeSent ? <p className="rounded-lg bg-teal/5 px-3 py-2 text-xs text-slate-600">{codeSent}</p> : null}
                  <div className="flex gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="One-time code" className={`${field} text-center tracking-[0.3em]`} disabled={!codeSent} />
                    <button type="button" onClick={sendCode} disabled={pending} className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">
                      {codeSent ? "Resend" : "Email me a code"}
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Your password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus className={field} />
                </div>
              )}
              {err ? <p className="text-center text-sm text-port">{err}</p> : null}
              <button
                type="submit"
                disabled={pending || (useCode ? code.length !== 6 : password.length === 0)}
                className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {pending ? "Please wait…" : "Reset PIN"}
              </button>
            </form>
            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setResetOpen(false); setErr(null); }} className="font-medium text-slate-500 hover:text-navy">← Back</button>
              {hasPassword ? (
                <button type="button" onClick={() => { setUseCode((v) => !v); setErr(null); }} className="font-medium text-teal hover:underline">
                  {useCode ? "Use my password instead" : "Email me a code instead"}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-center font-display text-xl font-bold text-navy">
              {mode === "set" ? "Set your login PIN" : "Enter your PIN"}
            </h1>
            <p className="mx-auto mt-1 mb-5 max-w-xs text-center text-sm text-slate-500">
              {mode === "set"
                ? "One more step: choose a 4-digit PIN. It's a quick second check when you sign in, so a stolen password alone can't get into your centre. In the app you can use Face ID instead."
                : "Enter your 4-digit PIN to continue."}
            </p>

            <form onSubmit={submit} className="space-y-4">
              {pinInput(pin, setPin, mode === "set" ? "New 4-digit PIN" : "Your PIN", true)}
              {mode === "set" ? pinInput(confirm, setConfirm, "Confirm PIN") : null}
              {bioAvailable && userId ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={rememberBio} onChange={(e) => setRememberBio(e.target.checked)} />
                  Use Face ID / fingerprint next time
                </label>
              ) : null}
              {err ? <p className="text-center text-sm text-port">{err}</p> : null}
              <button
                type="submit"
                disabled={pending || pin.length !== 4 || (mode === "set" && confirm.length !== 4)}
                className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {pending ? "Please wait…" : mode === "set" ? "Set PIN & continue" : "Continue"}
              </button>
            </form>

            {mode === "enter" ? (
              <button
                type="button"
                onClick={() => { setErr(null); setResetOpen(true); }}
                disabled={pending}
                className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-navy disabled:opacity-50"
              >
                Forgot your PIN? Reset it
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
