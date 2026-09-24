"use client";

import { useState, useTransition } from "react";
import { clockInAction, clockOutAction } from "@/app/(app)/portal/timeclock/actions";

export interface ClockSession {
  id: string;
  label: string;
  time: string;
}

export function ClockPanel({
  openSince,
  openLabel,
  sessions,
}: {
  openSince: string | null; // "HH:MM" if currently clocked in, else null
  openLabel: string | null;
  sessions: ClockSession[];
}) {
  const [open, setOpen] = useState<boolean>(openSince != null);
  const [since, setSince] = useState<string | null>(openSince);
  const [label, setLabel] = useState<string | null>(openLabel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nowHHMM = () => new Date().toISOString().slice(11, 16);

  const doIn = (sessionId: string | null, sessionLabel: string | null) => {
    setError(null);
    setOpen(true);
    setSince(nowHHMM());
    setLabel(sessionLabel);
    startTransition(async () => {
      const res = await clockInAction(sessionId);
      if (!res.ok) { setOpen(false); setSince(null); setLabel(null); setError(res.error ?? "Could not clock in"); }
    });
  };
  const doOut = () => {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      const res = await clockOutAction();
      if (!res.ok) { setOpen(true); setError(res.error ?? "Could not clock out"); }
      else { setSince(null); setLabel(null); }
    });
  };

  if (open) {
    return (
      <div className="rounded-card border border-starboard/30 bg-starboard/10 p-5 text-center">
        <p className="text-sm font-semibold text-starboard">You&apos;re on the water</p>
        <p className="mt-1 text-xs text-slate-500">Clocked in{since ? ` at ${since}` : ""}{label ? ` · ${label}` : ""}</p>
        <button
          onClick={doOut}
          disabled={pending}
          className="mt-4 w-full rounded-lg bg-port px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "…" : "Clock out"}
        </button>
        {error ? <p className="mt-2 text-xs text-port">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {sessions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clock in to a session</p>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => doIn(s.id, s.label)}
              disabled={pending}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-teal disabled:opacity-60"
            >
              <span><span className="block text-sm font-semibold text-navy">{s.label}</span><span className="text-xs text-slate-400">{s.time}</span></span>
              <span className="rounded-lg bg-starboard px-3 py-1.5 text-xs font-semibold text-white">Clock in</span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        onClick={() => doIn(null, null)}
        disabled={pending}
        className="mt-3 w-full rounded-lg bg-navy px-4 py-3 font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "…" : sessions.length > 0 ? "Clock in (no session)" : "Clock in"}
      </button>
      {error ? <p className="mt-2 text-xs text-port">{error}</p> : null}
    </div>
  );
}
