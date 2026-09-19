"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.email({ email, password, callbackURL: "/office" });
      if (res.error) setError(res.error.message ?? "Sign-in failed");
      else window.location.href = "/office";
    } finally {
      setBusy(false);
    }
  };

  const onMagicLink = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.magicLink({ email, callbackURL: "/office" });
      if (res.error) setError(res.error.message ?? "Could not send link");
      else setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Sign in</h1>
      <p className="mb-6 text-sm text-slate-500">Access your centre&apos;s roster.</p>

      {sent ? (
        <div className="rounded-card border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Check your email for a sign-in link.
        </div>
      ) : (
        <form onSubmit={onPassword} className="space-y-3 rounded-card border border-slate-200 bg-white p-5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          />
          {error ? <p className="text-sm text-port">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onMagicLink}
            disabled={busy || !email}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50"
          >
            Email me a magic link instead
          </button>
        </form>
      )}
    </div>
  );
}
