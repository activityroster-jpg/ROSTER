"use client";

import { useMemo, useState, useTransition } from "react";
import { slotDayLabel, slotTimeLabel } from "@/lib/calls/slots";
import { bookCallAction } from "@/app/(marketing)/book/actions";

export function BookCall({ slotsIso }: { slotsIso: string[] }) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [centre, setCentre] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Group slots by day (preserving chronological order).
  const days = useMemo(() => {
    const map = new Map<string, { iso: string; label: string }[]>();
    for (const iso of slotsIso) {
      const d = new Date(iso);
      const key = slotDayLabel(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ iso, label: slotTimeLabel(d) });
    }
    return Array.from(map.entries()).map(([label, times]) => ({ label, times }));
  }, [slotsIso]);

  const submit = () => {
    setErr(null);
    if (!selected) { setErr("Please choose a time slot first."); return; }
    if (!name.trim()) { setErr("Please enter your name."); return; }
    if (!email.trim()) { setErr("Please enter your email."); return; }
    start(async () => {
      const res = await bookCallAction({ startAtIso: selected, name, email, centre, notes });
      if (!res.ok) { setErr(res.error ?? "Something went wrong."); return; }
      setDone(selected);
    });
  };

  if (done) {
    const d = new Date(done);
    return (
      <div className="rounded-card border border-teal bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-starboard/15 text-2xl">✓</div>
        <h2 className="font-display text-2xl font-bold text-navy">You&apos;re booked in</h2>
        <p className="mt-2 text-slate-600">
          Your 30-minute call is set for <strong>{slotDayLabel(d)} at {slotTimeLabel(d)} GMT</strong>.
          We&apos;ve emailed a confirmation to {email} and will send a joining link shortly.
        </p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-card border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">No call times are open right now. Please email{" "}
          <a href="mailto:hello@activityroster.com" className="font-semibold text-teal hover:underline">hello@activityroster.com</a>{" "}
          and we&apos;ll find a time that works.</p>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      {/* Slot picker */}
      <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-navy">Pick a time</h2>
        <p className="mb-3 text-xs text-slate-500">All times GMT · 30-minute call</p>
        <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
          {days.map((day) => (
            <div key={day.label}>
              <p className="mb-1.5 text-sm font-semibold text-navy">{day.label}</p>
              <div className="flex flex-wrap gap-2">
                {day.times.map((t) => {
                  const on = selected === t.iso;
                  return (
                    <button key={t.iso} type="button" onClick={() => setSelected(t.iso)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${on ? "border-teal bg-teal text-white" : "border-slate-300 text-navy hover:border-teal"}`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-navy">Your details</h2>
        <p className="mb-3 text-xs text-slate-500">
          {selected ? <>Selected: <strong className="text-navy">{slotDayLabel(new Date(selected))} · {slotTimeLabel(new Date(selected))} GMT</strong></> : "Choose a time on the left."}
        </p>
        <div className="space-y-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={field} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className={field} />
          <input value={centre} onChange={(e) => setCentre(e.target.value)} placeholder="Centre / club (optional)" className={field} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you'd like to cover? (optional)" rows={3} className={field} />
        </div>
        {err ? <p className="mt-2 text-sm text-port">{err}</p> : null}
        <button onClick={submit} disabled={pending}
          className="mt-3 w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Booking…" : "Book my call"}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">No card required · we&apos;ll email a confirmation.</p>
      </div>
    </div>
  );
}
