"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAdminPasswordAction, verifyAdminTotpAction } from "@/app/admin/security/actions";
import { TwoFactorSetup } from "@/components/office/TwoFactorSetup";

const safeNext = (n: string | undefined) => (n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin");

/** Enter the authenticator code for this Dev Center session. */
export function AdminTotpVerify({ next }: { next?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await verifyAdminTotpAction(code);
      if (!r.ok) { setErr(r.error ?? "Failed"); setCode(""); return; }
      router.push(safeNext(next));
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-xl tracking-[0.4em] outline-none focus:border-teal" aria-label="Authenticator code" />
      {err ? <p className="text-sm text-port">{err}</p> : null}
      <button type="submit" disabled={pending || code.length !== 6} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

/** Enrol an authenticator app, setting a password first when the account has none. */
export function AdminTotpEnrol({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(hasPassword);
  const [pending, start] = useTransition();
  if (!done) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); if (pw !== pw2) { setErr("The two passwords don't match."); return; } start(async () => { const r = await setAdminPasswordAction(pw); if (!r.ok) setErr(r.error ?? "Failed"); else { setDone(true); router.refresh(); } }); }} className="space-y-3">
        <p className="text-sm text-slate-600">Your account has no password yet (you&apos;ve been using sign-in links). Authenticator set-up needs one, so choose a password first — you can keep using links to sign in.</p>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (10+ characters)" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat it" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
        {err ? <p className="text-sm text-port">{err}</p> : null}
        <button type="submit" disabled={pending || pw.length < 10} className="w-full rounded-lg bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Set password"}</button>
      </form>
    );
  }
  return <TwoFactorSetup />;
}
