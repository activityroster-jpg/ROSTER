"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOutUserEverywhereAction } from "@/app/(app)/security/actions";

export interface OfficeUserSecurityRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  twoFactor: "app" | "email" | "off";
  lastSignIn: string | null;
  activeSessions: number;
}

/** The superadmin's view of everyone who can open the office: second step on or off, last sign-in, and a way to sign someone out everywhere. */
export function OfficeUsersSecurity({ rows, meId, isOwner }: { rows: OfficeUserSecurityRow[]; meId: string; isOwner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="text-sm">
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-navy">{r.name || r.email}{r.userId === meId ? <span className="ml-1 text-xs font-normal text-slate-400">(you)</span> : null} <span className="text-xs font-normal text-slate-400">· {r.role === "owner" ? "Superadmin" : "Office admin"}</span></p>
              <p className="text-xs text-slate-500">
                {r.twoFactor === "off" ? <span className="rounded-full bg-amber/15 px-1.5 py-0.5 font-medium text-amber">No second step</span> : <span className="rounded-full bg-starboard/10 px-1.5 py-0.5 font-medium text-starboard">2FA: {r.twoFactor === "app" ? "authenticator app" : "email code"}</span>}
                <span className="ml-2">Last sign-in {r.lastSignIn ?? "never"}</span>
                <span className="ml-2">· {r.activeSessions} active session{r.activeSessions === 1 ? "" : "s"}</span>
              </p>
            </div>
            {isOwner && r.userId !== meId && r.activeSessions > 0 ? (
              <button type="button" disabled={pending} onClick={() => { if (confirm(`Sign ${r.name || r.email} out of every device? They'll need to sign in again.`)) start(async () => { const x = await signOutUserEverywhereAction(r.userId); setMsg(x.ok ? "Signed out everywhere" : x.error ?? "Failed"); router.refresh(); }); }} className="text-xs font-medium text-port hover:underline disabled:opacity-50">Sign out everywhere</button>
            ) : null}
          </li>
        ))}
      </ul>
      {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
