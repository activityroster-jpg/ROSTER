"use client";

import { useState, useTransition } from "react";
import { removeUserAction } from "@/app/admin/actions";

/** Dev Center → Users: remove one login, after typing its email to confirm. */
export function RemoveUserButton({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = typed.trim().toLowerCase() === email.toLowerCase();

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-lg border border-port/40 px-2.5 py-1 text-xs font-semibold text-port hover:bg-port/5">Remove</button>;
  return (
    <div className="ml-auto w-64 space-y-1.5 rounded-lg border border-port/30 bg-port/5 p-2 text-left">
      <p className="text-xs text-slate-600">Deletes this login now and anonymises them in every centre. This can&apos;t be undone.</p>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type their email to confirm" aria-label={`Type ${email} to confirm`} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" autoFocus />
      <div className="flex gap-2">
        <button
          disabled={!ready || pending}
          onClick={() => start(async () => {
            const r = await removeUserAction({ userId, confirmEmail: typed });
            if (!r.ok) setMsg(r.error ?? "Could not remove");
          })}
          className="rounded bg-port px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >{pending ? "Removing…" : "Remove for good"}</button>
        <button onClick={() => { setOpen(false); setTyped(""); setMsg(null); }} className="text-xs text-slate-500">Cancel</button>
      </div>
      {msg ? <p className="text-xs text-port">{msg}</p> : null}
    </div>
  );
}
