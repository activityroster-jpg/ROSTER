"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient, signIn } from "@/lib/auth/client";
import { appLandingAction } from "@/app/app/actions";

const field = "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-teal";

export function AppSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const res = await signIn.email({ email: email.trim(), password });
      if (res.error) { setErr(res.error.message ?? "Sign-in failed"); return; }
      window.location.href = await appLandingAction();
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
      <h1 className="font-display text-2xl font-bold text-navy">Sign in</h1>
      <p className="mb-5 text-sm text-slate-500">Your rota, availability, hours and licences — all in your pocket.</p>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" inputMode="email" required className={field} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required className={field} />
        {err ? <p className="text-sm text-port">{err}</p> : null}
        {note ? <p className="text-sm text-slate-600">{note}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" onClick={forgot} disabled={busy} className="w-full py-1 text-center text-sm font-medium text-slate-500">Forgot password?</button>
      </form>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-center">
        <p className="text-sm text-slate-600">First time here?</p>
        <Link href="/app/signup" className="mt-2 inline-block w-full rounded-xl border-2 border-teal px-4 py-3 text-base font-semibold text-teal">Create your account</Link>
        <p className="mt-2 text-xs text-slate-400">You&apos;ll need your centre&apos;s company code — ask your admin.</p>
      </div>
    </div>
  );
}
