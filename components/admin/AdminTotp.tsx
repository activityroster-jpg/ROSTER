"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendAdminOtpAction, setAdminPasswordAction, verifyAdminOtpAction, verifyAdminTotpAction } from "@/app/admin/security/actions";
import { TwoFactorSetup, type TwoFactorMethodChoice } from "@/components/office/TwoFactorSetup";

const safeNext = (n: string | undefined) => (n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin");

/** Enter this session's second-step code: authenticator, or an emailed / texted code. */
export function AdminTotpVerify({ next, method, hint }: { next?: string; method: TwoFactorMethodChoice; hint: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sentOnce = useRef(false);
  const channel = method === "sms" ? "text" : "email";

  const send = () => start(async () => {
    setErr(null);
    const r = await sendAdminOtpAction();
    if (!r.ok) setErr(r.error ?? "Could not send the code");
    else setNote(`Code sent by ${channel}${hint ? ` to ${hint}` : ""}.`);
  });
  useEffect(() => { if (method !== "app" && !sentOnce.current) { sentOnce.current = true; send(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [method]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = method === "app" ? await verifyAdminTotpAction(code) : await verifyAdminOtpAction(code);
      if (!r.ok) { setErr(r.error ?? "Failed"); setCode(""); return; }
      router.push(safeNext(next));
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-xl tracking-[0.4em] outline-none focus:border-teal" aria-label="Code" />
      {err ? <p className="text-sm text-port">{err}</p> : null}
      {note ? <p className="text-sm text-starboard">{note}</p> : null}
      <button type="submit" disabled={pending || code.length !== 6} className="w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Checking…" : "Continue"}</button>
      {method !== "app" ? <button type="button" onClick={send} disabled={pending} className="text-xs font-medium text-teal hover:underline disabled:opacity-50">Send it again</button> : null}
    </form>
  );
}

/** Enrol a second step (choice of method), setting a password first when the account has none. */
export function AdminTotpEnrol({ hasPassword, smsAvailable }: { hasPassword: boolean; smsAvailable: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(hasPassword);
  const [pending, start] = useTransition();
  if (!done) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); if (pw !== pw2) { setErr("The two passwords don't match."); return; } start(async () => { const r = await setAdminPasswordAction(pw); if (!r.ok) setErr(r.error ?? "Failed"); else { setDone(true); router.refresh(); } }); }} className="space-y-3">
        <p className="text-sm text-slate-600">Your account has no password yet (you&apos;ve been using sign-in links). Second-step set-up needs one, so choose a password first — you can keep using links to sign in.</p>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (10+ characters)" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat it" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal" />
        {err ? <p className="text-sm text-port">{err}</p> : null}
        <button type="submit" disabled={pending || pw.length < 10} className="w-full rounded-lg bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Set password"}</button>
      </form>
    );
  }
  return <TwoFactorSetup smsAvailable={smsAvailable} redirectTo="/admin/security" />;
}
