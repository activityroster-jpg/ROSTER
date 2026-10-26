"use client";

import { useEffect, useState } from "react";
import { Turnstile } from "@/components/auth/Turnstile";
import { twoFactorHintAction } from "@/app/(app)/sign-in/actions";
import Link from "next/link";
import { authClient, signIn } from "@/lib/auth/client";
import { appLandingAction } from "@/app/app/actions";
import { NO_CODE_ON_CLIPBOARD, PasteCodeButton, useCodeFromClipboard } from "@/components/auth/PasteCode";

const field = "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-teal";

export function AppSignIn() {
  const [deleted, setDeleted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsReset, setTsReset] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Sign in with a 6-digit emailed code: no password, no human check, stays in the app.
  const [codeMode, setCodeMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [checkFailed, setCheckFailed] = useState(false);

  /** After any successful sign-in: the second step if they use one, else into the app. */
  const land = async (data: unknown) => {
    if (data && typeof data === "object" && "twoFactorRedirect" in data && (data as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
      const hint = await twoFactorHintAction(email.trim()).catch(() => ({ method: null, hint: null }));
      const q = new URLSearchParams({ next: "/app" });
      if (hint.method) q.set("m", hint.method);
      if (hint.hint) q.set("h", hint.hint);
      window.location.href = `/two-factor?${q.toString()}`;
      return;
    }
    window.location.href = await appLandingAction();
  };

  const sendCode = async (to: string = email) => {
    setErr(null); setNote(null);
    const addr = to.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { setErr("Enter your email first, then tap “Email me a code”."); return; }
    setBusy(true);
    try {
      const r = await authClient.emailOtp.sendVerificationOtp({ email: addr, type: "sign-in" });
      if (r.error) { setErr(r.error.message ?? "Could not send the code"); return; }
      setCodeMode(true); setOtp("");
      setNote(`We've emailed a 6-digit code to ${addr}. It's in the subject line.`);
    } finally { setBusy(false); }
  };

  // Arriving from elsewhere in the app: the web sign-in hands over with the
  // address; "Create account" hands over when the email already has a login.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      setDeleted(q.get("deleted") === "1");
      const em = q.get("email") ?? "";
      if (em && em.length <= 200) setEmail(em);
      if (q.get("existing") === "1") setNote("You already have an account with this email. Sign in with your password, or get a one-time code by email.");
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithCode = async (value: string) => {
    setErr(null); setBusy(true);
    try {
      const res = await authClient.signIn.emailOtp({ email: email.trim(), otp: value.trim() });
      if (res.error) { setErr(res.error.message ?? "That code isn't right."); return; }
      await land(res.data);
    } finally { setBusy(false); }
  };
  // Back from the email with the code copied: fill it in and sign in.
  useCodeFromClipboard(codeMode && otp.length === 0 && !busy, (c) => { setOtp(c); void signInWithCode(c); });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const res = await signIn.email({ email: email.trim(), password }, tsToken ? { headers: { "x-turnstile-token": tsToken } } : {});
      if (res.error?.status === 428) { setNeedsCheck(true); setTsReset((n) => n + 1); setErr("After a few tries we need a quick check that you're a person. Tick the box below, or sign in with an emailed code instead."); return; }
      if (res.error) { setErr(res.error.message ?? "Sign-in failed"); return; }
      await land(res.data);
    } finally { setBusy(false); }
  };

  const forgot = async () => {
    setErr(null); setNote(null);
    if (!email.trim()) { setErr("Enter your email, then tap “Forgot password”."); return; }
    setBusy(true);
    try {
      const res = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
      if (res.error) setErr(res.error.message ?? "Could not send reset email");
      else setNote("If that email has an account, we've sent a link to reset your password.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      {deleted ? <p className="mb-4 rounded-lg border border-starboard/40 bg-starboard/5 px-3 py-2 text-sm text-navy">Your account has been deleted. Thanks for using ActivityRoster.</p> : null}
      <h1 className="font-display text-2xl font-bold text-navy">Sign in</h1>
      <p className="mb-5 text-sm text-slate-500">Your roster, availability, hours and certs — all in your pocket.</p>
      {codeMode ? (
        <form onSubmit={(e) => { e.preventDefault(); void signInWithCode(otp); }} className="space-y-3">
          <p className="text-sm text-slate-600">{note}</p>
          <div className="flex gap-2">
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" autoFocus aria-label="Code" className={`${field} text-center tracking-[0.3em]`} />
            <PasteCodeButton onCode={(c) => { setOtp(c); void signInWithCode(c); }} onMiss={() => setErr(NO_CODE_ON_CLIPBOARD)} disabled={busy} className="whitespace-nowrap rounded-xl border border-slate-300 px-3 text-sm font-semibold text-navy" />
          </div>
          {err ? <p className="text-sm text-port">{err}</p> : null}
          <button type="submit" disabled={busy || otp.length !== 6} className="w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => void sendCode()} disabled={busy} className="font-medium text-slate-500">Send a new code</button>
            <button type="button" onClick={() => { setCodeMode(false); setErr(null); setNote(null); }} className="font-medium text-slate-500">Use my password</button>
          </div>
        </form>
      ) : (
      <form onSubmit={submit} className="space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" inputMode="email" required className={field} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required className={field} />
        {err ? <p className="text-sm text-port">{err}</p> : null}
        {note ? <p className="text-sm text-slate-600">{note}</p> : null}
        {needsCheck ? <Turnstile onToken={setTsToken} resetKey={tsReset} appearance="always" onError={() => setCheckFailed(true)} /> : null}
        {needsCheck && checkFailed ? <p className="text-sm text-slate-600">The check couldn&apos;t load here. Sign in with a code instead: it&apos;s just as secure.</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" onClick={() => void sendCode()} disabled={busy} className={needsCheck ? "w-full rounded-xl border-2 border-teal px-4 py-3 text-base font-semibold text-teal" : "w-full py-1 text-center text-sm font-semibold text-teal"}>Email me a sign-in code instead</button>
        <button type="button" onClick={forgot} disabled={busy} className="w-full py-1 text-center text-sm font-medium text-slate-500">Forgot password?</button>
      </form>
      )}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-center">
        <p className="text-sm text-slate-600">First time here?</p>
        <Link href="/app/signup" className="mt-2 inline-block w-full rounded-xl border-2 border-teal px-4 py-3 text-base font-semibold text-teal">Create your account</Link>
        <p className="mt-2 text-xs text-slate-400">If your centre has already added you, it&apos;s offered by name after you sign in. Otherwise ask them for their company code.</p>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Running a centre rather than working at one? Centres are set up on the <a href="/start" target="_blank" rel="noopener noreferrer" className="underline">website</a>, not in the app.</p>
    </div>
  );
}
