"use client";

import { useState, useTransition } from "react";
import { clockInAction, clockOutAction, type GeoFix } from "@/app/(app)/portal/timeclock/actions";

/** Approximate position, or null if unavailable / refused / slow. Never blocks the clock-in for long. */
function currentFix(): Promise<GeoFix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const done = (v: GeoFix | null) => { clearTimeout(t); resolve(v); };
    const t = setTimeout(() => done(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => done(null),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60_000 },
    );
  });
}

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
  // Clocking in without a session needs a reason; this holds it until they press Clock in.
  const [noteOpen, setNoteOpen] = useState(sessions.length === 0);
  const [note, setNote] = useState("");

  // The device's own clock: what the instructor sees on their phone is what is recorded.
  const nowHHMM = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const localNow = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

  const doIn = (sessionId: string | null, sessionLabel: string | null) => {
    setError(null);
    if (!sessionId && note.trim().length < 3) { setNoteOpen(true); setError("Say what you're working on first."); return; }
    setOpen(true);
    setSince(nowHHMM());
    setLabel(sessionLabel ?? (note.trim() || null));
    startTransition(async () => {
      const res = await clockInAction(sessionId, await currentFix(), sessionId ? null : note, localNow());
      if (!res.ok) { setOpen(false); setSince(null); setLabel(null); setError(res.error ?? "Could not clock in"); }
      else { setNote(""); setNoteOpen(false); }
    });
  };
  const doOut = () => {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      const res = await clockOutAction(await currentFix(), localNow());
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
      {noteOpen ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-xs font-medium text-slate-500">What are you working on?</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Boat maintenance, beach set-up, office cover" autoFocus className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
          <p className="mt-1 text-[11px] text-slate-400">Required when there&apos;s no session — the office sees this on your hours.</p>
        </div>
      ) : null}
      <button
        onClick={() => (noteOpen || sessions.length === 0 ? doIn(null, null) : setNoteOpen(true))}
        disabled={pending}
        className="mt-3 w-full rounded-lg bg-navy px-4 py-3 font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "…" : sessions.length > 0 ? (noteOpen ? "Clock in" : "Clock in without a session") : "Clock in"}
      </button>
      {error ? <p className="mt-2 text-xs text-port">{error}</p> : null}
    </div>
  );
}
