"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4 text-sm text-slate-400">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const err = params.get("error");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) { setError("Use at least 8 characters."); return; }
    if (pw !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    try {
      const res = await authClient.resetPassword({ newPassword: pw, token });
      if (res.error) setError(res.error.message ?? "Could not reset password — the link may have expired.");
      else setDone(true);
    } finally { setBusy(false); }
  };

  const wrap = "mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4";

  if (done) {
    return (
      <div className={wrap}>
        <div className="rounded-card border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl">✅</p>
          <h1 className="mt-2 font-display text-xl font-semibold text-navy">Password updated</h1>
          <p className="mt-2 text-sm text-slate-600">You can now sign in with your new password.</p>
          <a href="/sign-in" className="mt-4 inline-block rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Go to sign in</a>
        </div>
      </div>
    );
  }

  if (!token || err) {
    return (
      <div className={wrap}>
        <div className="rounded-card border border-slate-200 bg-white p-6 text-center">
          <h1 className="font-display text-xl font-semibold text-navy">This reset link isn&apos;t valid</h1>
          <p className="mt-2 text-sm text-slate-600">It may have expired or already been used. Request a fresh one from the sign-in page.</p>
          <a href="/sign-in" className="mt-4 inline-block rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Choose a new password</h1>
      <p className="mb-6 text-sm text-slate-500">Set a password you&apos;ll remember — at least 8 characters.</p>
      <form onSubmit={submit} className="space-y-3 rounded-card border border-slate-200 bg-white p-5">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
        {error ? <p className="text-sm text-port">{error}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
