"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { minutesToHHMM, WEEKDAY_NAMES } from "@/lib/calls/slots";
import { addAvailabilityAction, deleteAvailabilityAction, setBookingStatusAction } from "@/app/admin/calls/actions";

export interface AvailabilityRow { id: string; dayOfWeek: number; startMinute: number; endMinute: number }
export interface BookingRow { id: string; startAtIso: string; name: string; email: string; centre: string | null; notes: string | null; status: "booked" | "cancelled" | "completed" }

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${day} · ${time} GMT`;
};

export function CallScheduler({ availability, bookings }: { availability: AvailabilityRow[]; bookings: BookingRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [day, setDay] = useState("1");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Something went wrong");
      else router.refresh();
    });
  };

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
  const upcoming = bookings.filter((b) => b.status !== "cancelled");

  return (
    <div className="space-y-8">
      {/* Weekly availability */}
      <section className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-navy">Weekly availability (GMT)</h2>
        <p className="mb-4 text-sm text-slate-500">Each window is split into 30-minute slots on the booking page.</p>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-500">Day
            <select value={day} onChange={(e) => setDay(e.target.value)} className={`mt-1 block ${field}`}>
              {WEEKDAY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">From
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
          </label>
          <label className="text-xs font-medium text-slate-500">To
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
          </label>
          <button onClick={() => run(() => addAvailabilityAction({ dayOfWeek: Number(day), start: from, end: to }))} disabled={pending}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">Add window</button>
        </div>
        {err ? <p className="mb-3 text-sm text-port">{err}</p> : null}

        {availability.length === 0 ? (
          <p className="text-sm text-slate-400">No availability set yet — add a window above so prospects can book.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availability.map((w) => (
              <span key={w.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-navy">
                <span className="font-medium">{WEEKDAY_NAMES[w.dayOfWeek]}</span>
                <span className="text-slate-500">{minutesToHHMM(w.startMinute)}–{minutesToHHMM(w.endMinute)}</span>
                <button onClick={() => run(() => deleteAvailabilityAction(w.id))} disabled={pending} title="Remove" className="text-slate-300 hover:text-port">✕</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming bookings */}
      <section className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-navy">Upcoming bookings</h2>
        <p className="mb-4 text-sm text-slate-500">{upcoming.length} booked.</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400">No calls booked yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-navy">{fmtWhen(b.startAtIso)}</p>
                  <p className="text-xs text-slate-500">
                    {b.name} · <a href={`mailto:${b.email}`} className="hover:text-teal">{b.email}</a>
                    {b.centre ? ` · ${b.centre}` : ""}
                  </p>
                  {b.notes ? <p className="mt-0.5 text-xs text-slate-400">{b.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => run(() => setBookingStatusAction(b.id, "completed"))} disabled={pending}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-teal hover:text-teal">Mark done</button>
                  <button onClick={() => run(() => setBookingStatusAction(b.id, "cancelled"))} disabled={pending}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-400 hover:border-port hover:text-port">Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
