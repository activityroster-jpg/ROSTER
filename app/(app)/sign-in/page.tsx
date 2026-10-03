"use client";

import { useState } from "react";
import { signIn, authClient } from "@/lib/auth/client";

type Mode = "link" | "password";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError("Enter your email first."); return; }
    setBusy(true);
    try {
      const res = await signIn.magicLink({ email, callbackURL: "/office" });
      if (res.error) setError(res.error.message ?? "Could not send link");
      else setSent(true);
    } finally { setBusy(false); }
  };

  const signInPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.email({ email, password, callbackURL: "/office" });
      if (res.error) {
        const notVerified = res.error.status === 403 || /verif/i.test(res.error.message ?? "");
        setUnverified(notVerified);
        setError(notVerified ? "Please confirm your email first — we sent you a link when you signed up." : res.error.message ?? "Sign-in failed");
      } else window.location.href = "/office";
    } finally { setBusy(false); }
  };

  const resendConfirmation = async () => {
    setError(null); setNote(null); setBusy(true);
    try {
      const res = await authClient.sendVerificationEmail({ email, callbackURL: "/office" });
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
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Sign in</h1>
      <p className="mb-6 text-sm text-slate-500">First time here? Just enter your email and we&apos;ll send you a link to get in and set up your account.</p>

      <div className="rounded-card border border-slate-200 bg-white p-5">
        {mode === "link" ? (
          <form onSubmit={sendLink} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcentre.com" required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
            {error ? <p className="text-sm text-port">{error}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            <button type="button" onClick={() => { setMode("password"); setError(null); }} className="w-full text-center text-sm font-medium text-slate-500 hover:text-navy">
              Sign in with a password instead
            </button>
          </form>
        ) : (
          <form onSubmit={signInPassword} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
            {error ? <p className="text-sm text-port">{error}</p> : null}
            {unverified ? <button type="button" onClick={resendConfirmation} disabled={busy} className="text-sm font-semibold text-teal hover:underline disabled:opacity-50">Resend the confirmation email</button> : null}
            {note ? <p className="text-sm text-starboard">{note}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setMode("link"); setError(null); setNote(null); }} className="font-medium text-slate-500 hover:text-navy">← Email me a link</button>
              <button type="button" onClick={forgotPassword} disabled={busy} className="font-medium text-teal hover:underline disabled:opacity-50">Forgot password?</button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">Forgot your PIN? Get in with a sign-in link above, then reset it from the PIN screen.</p>
    </div>
  );
}
