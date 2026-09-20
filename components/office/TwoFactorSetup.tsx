"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

type Step = "start" | "verify" | "done";

/**
 * Admin 2FA enrolment. Enabling requires the account password (Better Auth),
 * returns a TOTP URI + backup codes; the admin scans/pastes the URI into an
 * authenticator, then confirms a code to finish. The DSN/secret never persist
 * in the client beyond the flow.
 */
export function TwoFactorSetup() {
  const [step, setStep] = useState<Step>("start");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.enable({ password });
      if (res.error) {
        setError(res.error.message ?? "Could not start 2FA setup");
        return;
      }
      const data = res.data;
      if (data && "totpURI" in data) {
        setTotpUri(data.totpURI);
        setBackupCodes(data.backupCodes);
      }
      setStep("verify");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code });
      if (res.error) {
        setError(res.error.message ?? "Invalid code");
        return;
      }
      setStep("done");
      setTimeout(() => (window.location.href = "/office"), 1200);
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") {
    return <p className="text-starboard">Two-factor authentication is on. Redirecting…</p>;
  }

  if (step === "verify") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-600">Add this to your authenticator app, then enter the 6-digit code.</p>
          {totpUri ? (
            <code className="mt-2 block break-all rounded-lg bg-slate-100 p-3 text-xs text-slate-700">{totpUri}</code>
          ) : null}
        </div>
        {backupCodes.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-navy">Backup codes (store these safely):</p>
            <ul className="mt-1 grid grid-cols-2 gap-1 text-xs text-slate-700">
              {backupCodes.map((c) => (
                <li key={c} className="font-mono">{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <form onSubmit={verify} className="space-y-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="123456"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          />
          {error ? <p className="text-sm text-port">{error}</p> : null}
          <button disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            Confirm &amp; enable
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={start} className="space-y-3">
      <p className="text-sm text-slate-600">Confirm your password to begin.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Your password"
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
      />
      {error ? <p className="text-sm text-port">{error}</p> : null}
      <button disabled={busy} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        Start 2FA setup
      </button>
    </form>
  );
}
