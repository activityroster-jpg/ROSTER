"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelOpenShiftAction, confirmOpenShiftAction, createOpenShiftAction } from "@/app/(app)/office/leave/actions";
import { StatusPill } from "@/components/ui";
import type { OpenShiftRow } from "@/lib/services/openshifts";

const TONE = { open: "attention", offered: "attention", filled: "covered", cancelled: "neutral" } as const;

export function OpenShiftsAdmin({
  shifts,
  sessions,
  roles,
}: {
  shifts: OpenShiftRow[];
  sessions: { id: string; label: string }[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else router.refresh();
    });
  };

  return (
    <div>
      {/* Broadcast a new open shift */}
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
        <label className="text-xs text-slate-500">Session
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {sessions.length === 0 ? <option value="">No sessions</option> : sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Role
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <button
          disabled={pending || !sessionId || !roleId}
          onClick={() => run(() => createOpenShiftAction(sessionId, roleId))}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
        >
          Broadcast open shift
        </button>
        {error ? <span className="text-xs text-port">{error}</span> : null}
      </div>

      {shifts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">No open shifts.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shifts.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-navy">{s.roleName} · {s.courseName}</p>
                <p className="text-xs text-slate-400">{s.date} {s.slot}{s.claimedByName ? ` · ${s.claimedByName} offered` : ""}</p>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill tone={TONE[s.status]}>{s.status[0]!.toUpperCase() + s.status.slice(1)}</StatusPill>
                {s.status === "offered" ? (
                  <button disabled={pending} onClick={() => run(() => confirmOpenShiftAction(s.id))} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60">Confirm</button>
                ) : null}
                {s.status === "open" || s.status === "offered" ? (
                  <button disabled={pending} onClick={() => run(() => cancelOpenShiftAction(s.id))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-60">Cancel</button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
