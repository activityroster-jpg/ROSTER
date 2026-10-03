"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutEverywhereAction } from "@/app/(app)/security/actions";

/** One button: end every other session and forget confirmed devices. */
export function SignOutEverywhere() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
      <button
        disabled={pending}
        onClick={() => { if (confirm("Sign out every other device? They will each need to sign in and confirm again.")) start(async () => { const r = await signOutEverywhereAction(); setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Failed"); router.refresh(); }); }}
        className="rounded-lg border border-port/40 px-3 py-1.5 text-sm font-medium text-port hover:bg-port/5 disabled:opacity-50"
      >
        {pending ? "Signing out…" : "Sign out all other devices"}
      </button>
      <span className="text-xs text-slate-500">Lost a phone, or left yourself signed in somewhere? This keeps only the device you are on now.</span>
      {msg ? <span className="text-sm text-navy">{msg}</span> : null}
    </div>
  );
}
