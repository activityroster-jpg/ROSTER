"use client";

import { useState } from "react";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import Link from "next/link";
import { authClient, signIn, signUp } from "@/lib/auth/client";
import { NO_CODE_ON_CLIPBOARD, PasteCodeButton, useCodeFromClipboard } from "@/components/auth/PasteCode";

const field = "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-teal";
const PHONE_KEY = "ar.signup.phone";

/**
 * Create account: name, email, password (mobile number optional) → 6-digit email code → join a
 * centre (by name, or with its company code) choosing the PIN on the same screen. The phone is kept locally
 * until the join step, when it's saved with the instructor record.
 */
export function AppSignup() {
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const sendCode = async () => {
    const r = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "email-verification" });
    if (r.error) throw new Error(r.error.message ?? "Could not send the code");
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) { setErr("Enter your full name."); return; }
    // The mobile number is optional; check it only when one is given.
    if (phone.trim() && !/^[+\d][\d\s()-]{6,}$/.test(phone.trim())) { setErr("That mobile number doesn't look right. Check it, or leave it blank."); return; }
    if (password.length < 8) { setErr("Use at least 8 characters for your password."); return; }
    setBusy(true);
    try {
      const res = await signUp.email({ name: name.trim(), email: email.trim(), password });
      if (res.error && !/already|exist/i.test(res.error.message ?? "")) { setErr(res.error.message ?? "Could not create your account"); return; }
      try { sessionStorage.setItem(PHONE_KEY, phone.trim()); } catch { /* ignore */ }
      await sendCode();
      setStep("code");
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  const verify = (e: React.FormEvent) => { e.preventDefault(); void verifyCode(otp); };

  const verifyCode = async (value: string) => {
    setErr(null); setBusy(true);
    try {
      const r = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: value.trim() });
      if (r.error) { setErr(r.error.message ?? "That code isn't right."); return; }
      // Make sure we hold a session (verifyEmail signs in when configured; the
      // password sign-in is a harmless no-op otherwise).
      await signIn.email({ email: email.trim(), password });
      window.location.href = "/app/join";
    } finally { setBusy(false); }
  };

  // Back from the email with the code copied: fill it in and check it.
  useCodeFromClipboard(step === "code" && otp.length === 0 && !busy, (c) => { setOtp(c); setErr(null); void verifyCode(c); });

  const resend = async () => {
    setErr(null); setNote(null); setBusy(true);
    try { await sendCode(); setNote("New code sent."); } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  if (step === "code") {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Check your email</h1>
        <p className="mb-5 text-sm text-slate-500">We sent a 6-digit code to <span className="font-medium text-navy">{email}</span>. Enter it to confirm it&apos;s yours.</p>
        <form onSubmit={verify} className="space-y-3">
          <div className="flex gap-2">
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" autoFocus className={`${field} text-center text-2xl tracking-[0.4em]`} />
            <PasteCodeButton onCode={(c) => { setOtp(c); setErr(null); void verifyCode(c); }} onMiss={() => setErr(NO_CODE_ON_CLIPBOARD)} disabled={busy} className="whitespace-nowrap rounded-xl border border-slate-300 px-3 text-sm font-medium text-navy disabled:opacity-50" />
          </div>
          <p className="text-xs text-slate-400">The code is in the email&apos;s subject line, so it shows in the notification. Copy it and come back: it fills in by itself.</p>
          {err ? <p className="text-sm text-port">{err}</p> : null}
          {note ? <p className="text-sm text-slate-600">{note}</p> : null}
          <button type="submit" disabled={busy || otp.length !== 6} className="w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Checking…" : "Confirm email"}</button>
          <button type="button" onClick={resend} disabled={busy} className="w-full py-1 text-center text-sm font-medium text-slate-500">Resend code</button>
        </form>
        <p className="mt-6 text-xs text-slate-400">Next: join your centre (by name if they&apos;ve already added you, or with their company code) and choose a 4-digit PIN, on one screen.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Create your account</h1>
      <p className="mb-5 text-sm text-slate-500">Takes a minute. You&apos;ll confirm your email with a code, then join your centre and pick a PIN.</p>
      <form onSubmit={createAccount} className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" required className={field} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number (optional)" autoComplete="tel" inputMode="tel" className={field} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" inputMode="email" required className={field} />
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters, letters and numbers)" autoComplete="new-password" required className={`${field} pr-16`} />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-teal hover:bg-teal/10">{showPw ? "Hide" : "Show"}</button>
        </div>
        <PasswordStrength password={password} />
        {err ? <p className="text-sm text-port">{err}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Creating…" : "Continue"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">Already have an account? <Link href="/app" className="font-semibold text-teal">Sign in</Link></p>
      <p className="mt-6 text-center text-[11px] text-slate-400">By continuing you agree to the <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.</p>
    </div>
  );
}

export const SIGNUP_PHONE_KEY = PHONE_KEY;
