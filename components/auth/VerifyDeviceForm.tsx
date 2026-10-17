"use client";

import { useState, useTransition } from "react";
import { Logo } from "@/components/Logo";
import { requestDeviceCodeAction, verifyDeviceAction } from "@/app/verify-device/actions";
import { NO_CODE_ON_CLIPBOARD, PasteCodeButton, useCodeFromClipboard } from "@/components/auth/PasteCode";

export function VerifyDeviceForm({ next, hasPassword, where, country }: { next: string; hasPassword: boolean; where: string; country: string | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [useCode, setUseCode] = useState(!hasPassword);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState<string | null>(null);

  const sendCode = () => {
    setErr(null);
    start(async () => {
      const r = await requestDeviceCodeAction();
      if (r.ok) setCodeSent(r.message ?? "Code sent."); else setErr(r.error ?? "Couldn't send a code");
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await verifyDeviceAction(next, useCode ? { code } : { password });
      if (r?.ok && r.next) { window.location.assign(r.next); return; }
      if (r && !r.ok) { setErr(r.error ?? "Something went wrong"); if (useCode) setCode(""); else setPassword(""); }
    });
  };

  // Coming back from the email with the code copied: fill it in.
  useCodeFromClipboard(useCode && Boolean(codeSent) && code.length === 0, (c) => { setCode(c); setErr(null); });

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center"><Logo variant="onLight" size="sm" /></div>
        <h1 className="text-center font-display text-xl font-bold text-navy">Signing in somewhere new</h1>
        <p className="mx-auto mt-1 mb-5 max-w-xs text-center text-sm text-slate-500">
          Your account hasn&apos;t been used {country ? `in ${country}` : "from here"} before{where ? ` (${where})` : ""}. {useCode ? "Enter the code we email you to continue." : "Enter your password to continue."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {useCode ? (
            <>
              {codeSent ? <p className="rounded-lg bg-teal/5 px-3 py-2 text-xs text-slate-600">{codeSent}</p> : null}
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="One-time code" className={`${field} text-center tracking-[0.3em]`} disabled={!codeSent} />
                {codeSent ? (
                  <PasteCodeButton onCode={(c) => { setCode(c); setErr(null); }} onMiss={() => setErr(NO_CODE_ON_CLIPBOARD)} disabled={pending} />
                ) : (
                  <button type="button" onClick={sendCode} disabled={pending} className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">
                    Email me a code
                  </button>
                )}
              </div>
              {codeSent ? <button type="button" onClick={sendCode} disabled={pending} className="text-xs font-medium text-slate-500 hover:text-navy disabled:opacity-50">Send it again</button> : null}
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Your password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus className={field} />
            </div>
          )}
          {err ? <p className="text-center text-sm text-port">{err}</p> : null}
          <button type="submit" disabled={pending || (useCode ? code.length !== 6 : password.length === 0)} className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <a href="/sign-in" className="font-medium text-slate-500 hover:text-navy">Not you? Sign out</a>
          {hasPassword ? (
            <button type="button" onClick={() => { setUseCode((v) => !v); setErr(null); }} className="font-medium text-teal hover:underline">
              {useCode ? "Use my password instead" : "Email me a code instead"}
            </button>
          ) : null}
        </div>
        <p className="mt-5 text-center text-[11px] text-slate-400">Once confirmed, you won&apos;t be asked again here. A new phone or computer somewhere you already use ActivityRoster isn&apos;t asked at all; we just email you to say it signed in.</p>
      </div>
    </div>
  );
}
