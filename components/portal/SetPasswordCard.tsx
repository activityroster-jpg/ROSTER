"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { setMyPasswordAction } from "@/app/(app)/portal/welcome/actions";

/** First-time "set a password" card on the portal welcome page. Optional — they
 *  can always sign in with an emailed link — but lets them set one now. */
export function SetPasswordCard() {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(true);

  if (msg?.ok) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-starboard/30 bg-starboard/5 p-4">
        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-starboard/15 text-starboard"><KeyRound className="h-5 w-5" /></span>
        <div>
          <p className="font-semibold text-navy">Password set ✓</p>
          <p className="text-sm text-slate-600">You can now sign in with your email &amp; password, or keep using the emailed link.</p>
        </div>
      </div>
    );
  }

  const save = () => {
    setMsg(null);
    if (pw.length < 10) { setMsg({ ok: false, text: "Use at least 10 characters." }); return; }
    if (pw !== confirm) { setMsg({ ok: false, text: "The two passwords don't match." }); return; }
    start(async () => {
      const res = await setMyPasswordAction(pw);
      setMsg({ ok: res.ok, text: res.ok ? "Saved" : res.error ?? "Could not set password" });
      if (res.ok) { setPw(""); setConfirm(""); }
    });
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal/15 text-teal"><KeyRound className="h-5 w-5" /></span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-navy">Set a password <span className="font-normal text-slate-400">(optional)</span></p>
            <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-teal hover:underline">{open ? "Hide" : "Set one"}</button>
          </div>
          <p className="text-sm text-slate-600">You&apos;re signed in with your emailed link. Set a password if you&apos;d like to sign in with one next time (you can always use a link instead).</p>
          {open ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ chars)" autoComplete="new-password" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
              <div className="sm:col-span-2 flex items-center gap-3">
                <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save password"}</button>
                {msg && !msg.ok ? <span className="text-sm text-port">{msg.text}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
