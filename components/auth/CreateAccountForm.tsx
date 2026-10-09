"use client";

import { useState, useTransition } from "react";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { createAccountAction } from "@/app/(app)/welcome/actions";

/** Name + password for someone arriving from an invitation link. */
export function CreateAccountForm({ initialName, next }: { initialName: string; next: string }) {
  const [name, setName] = useState(initialName);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== confirm) { setErr("The two passwords don't match."); return; }
    start(async () => {
      const r = await createAccountAction({ name, password: pw });
      if (r.ok) window.location.href = next;
      else setErr(r.error ?? "That didn't save");
    });
  };
  return (
    <form onSubmit={submit} className="mt-5 grid gap-3">
      <label className="text-sm font-medium text-navy">Your name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={`${field} mt-1`} /></label>
      <label className="text-sm font-medium text-navy">Choose a password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" className={`${field} mt-1`} /></label>
      <PasswordStrength password={pw} />
      <label className="text-sm font-medium text-navy">Type it again<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className={`${field} mt-1`} /></label>
      {err ? <p className="text-sm text-port">{err}</p> : null}
      <button type="submit" disabled={pending} className="mt-1 rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Creating your account…" : "Create my account"}</button>
      <p className="text-xs text-slate-400">8+ characters with letters and numbers. Next you&rsquo;ll choose a 4-digit PIN, and you&rsquo;re in.</p>
    </form>
  );
}
