"use client";

import { useEffect, useState } from "react";
import { signIn, authClient } from "@/lib/auth/client";
import { twoFactorHintAction } from "./actions";
import { Turnstile } from "@/components/auth/Turnstile";

type Mode = "link" | "password";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [expired, setExpired] = useState(false);
  // Shown only after repeated failures (the server answers 428 until a check passes).
  const [needsCheck, setNeedsCheck] = useState(false);
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsReset, setTsReset] = useState(0);
  const tsHeaders = () => (tsToken ? { headers: { "x-turnstile-token": tsToken } } : {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);
  // Where to land afterwards: the office by default, the portal when the apex
  // sign-in chooser sent an instructor here. Anything else is ignored.
  const [next, setNext] = useState("/office");
  // Centre admins confirm an emailed code (and choose "stay signed in?") before
  // the office opens; instructors go straight to their portal.
  const isPortal = next === "/portal" || next.startsWith("/go?to=portal");
  const after = isPortal ? next : `/verify-login?next=${encodeURIComponent(next)}`;
  // Remember how this person last signed in on this device.
  useEffect(() => {
    try { if (window.localStorage.getItem("ar.signin.mode") === "link") setMode("link"); } catch { /* blocked storage */ }
    const q = new URLSearchParams(window.location.search);
    const n = q.get("next");
    if (n === "/portal" || n === "/office" || n === "/go?to=portal" || n === "/go?to=office") setNext(n);
    if (q.get("expired") === "1") setExpired(true);
  }, []);
  const pickMode = (m: Mode) => { setMode(m); try { window.localStorage.setItem("ar.signin.mode", m); } catch { /* ignore */ } };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError("Enter your email first."); return; }
    setBusy(true);
    try {
      const res = await signIn.magicLink({ email, callbackURL: after });
      if (res.error) setError(res.error.message ?? "Could not send link");
      else setSent(true);
    } finally { setBusy(false); }
  };

  const signInPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.email({ email, password, callbackURL: after }, tsHeaders());
      if (res.error) {
        if (res.error.status === 428) { setNeedsCheck(true); setTsReset((n) => n + 1); setError("Please complete the security check below, then sign in again."); return; }
        setTsReset((n) => n + 1);
        const notVerified = res.error.status === 403 || /verif/i.test(res.error.message ?? "");
        setUnverified(notVerified);
        // One message for every failure, so the page never confirms whether an address has an account.
        setError("That email and password don't match our records. If you've just signed up, confirm your email first.");
      } else if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) {
        const hint = await twoFactorHintAction(email).catch(() => ({ method: null, hint: null }));
        const q = new URLSearchParams({ next: after });
        if (hint.method) q.set("m", hint.method);
        if (hint.hint) q.set("h", hint.hint);
        window.location.href = `/two-factor?${q.toString()}`;
      } else window.location.href = after;
    } finally { setBusy(false); }
  };

  const resendConfirmation = async () => {
    setError(null); setNote(null); setBusy(true);
    try {
      const res = await authClient.sendVerificationEmail({ email, callbackURL: after });
      if (res.error) setError(res.error.message ?? "Could not resend");
      else setNote("Confirmation email sent again — check your inbox and spam.");
    } finally { setBusy(false); }
  };

  const forgotPassword = async () => {
    setError(null); setNote(null);
    if (!email) { setError("Enter your email, then tap “Forgot password”."); return; }
    setBusy(true);
    try {
      const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (res.error) setError(res.error.message ?? "Could not send reset email");
      else setNote("If that email has an account, we've sent a link to reset your password.");
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
        <div className="rounded-card border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl">📩</p>
          <h1 className="mt-2 font-display text-xl font-semibold text-navy">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            We&apos;ve sent a sign-in link to <span className="font-medium text-navy">{email}</span>. Click it to come
            straight in — no password needed.
          </p>
          <button onClick={() => { setSent(false); setNote(null); }} className="mt-4 text-sm font-medium text-teal hover:underline">Use a different email</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">{isPortal ? "Instructor sign in" : "Sign in"}</h1>
      <p className="mb-6 text-sm text-slate-500">{isPortal ? "Enter your email and password to open your portal." : "Enter your email and password. We'll then email you a code to confirm it's you."}</p>
      {expired ? <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">You were signed out after a while away. Sign in again to carry on.</p> : null}

      <div className="rounded-card border border-slate-200 bg-white p-5">
        {mode === "link" ? (
          <form onSubmit={sendLink} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcentre.com" required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
            {error ? <p className="text-sm text-port">{error}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            <button type="button" onClick={() => { pickMode("password"); setError(null); }} className="w-full text-center text-sm font-medium text-slate-500 hover:text-navy">
              Sign in with a password instead
            </button>
          </form>
        ) : (
          <form onSubmit={signInPassword} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
            {needsCheck ? <Turnstile onToken={setTsToken} resetKey={tsReset} /> : null}
            {error ? <p className="text-sm text-port">{error}</p> : null}
            {unverified ? <button type="button" onClick={resendConfirmation} disabled={busy} className="text-sm font-semibold text-teal hover:underline disabled:opacity-50">Resend the confirmation email</button> : null}
            {note ? <p className="text-sm text-starboard">{note}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { pickMode("link"); setError(null); setNote(null); }} className="font-medium text-slate-500 hover:text-navy">No password yet? Email me a link</button>
              <button type="button" onClick={forgotPassword} disabled={busy} className="font-medium text-teal hover:underline disabled:opacity-50">Forgot password?</button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">Forgot your PIN? Get in with a sign-in link above, then reset it from the PIN screen.</p>
    </div>
  );
}
