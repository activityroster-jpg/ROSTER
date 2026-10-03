"use client";

import { useState, useTransition } from "react";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { changeMyPasswordAction } from "@/app/(app)/portal/settings/actions";
import { setMyPasswordAction } from "@/app/(app)/portal/welcome/actions";

/** Change (or first set) the account password. Sign-in links keep working either way. */
export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const field = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-navy outline-none focus:border-teal";

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{hasPassword ? "You have a password. Sign-in links work too." : "No password yet — you sign in with emailed links. Set one if you'd rather type a password."}</p>
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="text-sm font-semibold text-teal">{hasPassword ? "Change password →" : "Set a password →"}</button>
      </div>
    );
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw !== pw2) { setMsg({ ok: false, text: "The two passwords don't match." }); return; }
    start(async () => {
      const r = hasPassword ? await changeMyPasswordAction(current, pw) : await setMyPasswordAction(pw);
      if (!r.ok) { setMsg({ ok: false, text: r.error ?? "Could not save" }); return; }
      setMsg({ ok: true, text: hasPassword ? "Password changed." : "Password set." });
      setCurrent(""); setPw(""); setPw2(""); setOpen(false);
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {hasPassword ? <label className="block text-xs font-medium text-slate-500">Current password<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} autoComplete="current-password" /></label> : null}
      <label className="block text-xs font-medium text-slate-500">New password (8+ characters, letters and numbers)<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={field} autoComplete="new-password" /></label>
      <PasswordStrength password={pw} />
      <label className="block text-xs font-medium text-slate-500">Repeat it<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={field} autoComplete="new-password" /></label>
      {msg ? <p className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`} role="status">{msg.text}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || pw.length < 10} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
      </div>
    </form>
  );
}
